'use strict';

const API_TIMEOUT_MS = 10000;
const API_RETRY_COUNT = 2;

/**
 * Schlüsselnamen die beim Traversieren komplett übersprungen werden sollen – unabhängig von ihrer Position im Baum.
 * Nur den Schlüsselnamen eintragen (kein Pfad).
 */
const CEPH_EXCLUDED_PATHS = [
    'available_modules',
];

/**
 * Retry-Wrapper mit Timeout für async Funktionen.
 *
 * @param {Function} fn
 * @param {number} retries
 * @param {string} label
 * @returns {Promise<any>}
 */
async function withRetry(fn, retries, label) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await Promise.race([
                fn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout nach ${API_TIMEOUT_MS}ms`)), API_TIMEOUT_MS)
                ),
            ]);
        } catch (err) {
            if (i === retries) {
throw err;
}
            this.log.debug(`${label}: Retry ${i + 1}/${retries} nach Fehler: ${err.message}`);
        }
    }
}

/**
 * Traversiert cephInformation.data ohne feste Tiefengrenze.
 * Schutz vor Zyklen via visitedPaths-Set.
 *
 * @param {object} ctx - Adapter-Instanz (this)
 * @param {string} baseId - Basis-State-ID
 * @param {object} data - zu traversierende Daten
 * @param {number} depth - aktuelle Tiefe (1-basiert)
 * @param {string} path - aktueller State-Pfad
 * @param {boolean} createObjects - ob Objekte angelegt werden sollen
 * @param {Function} onState - async (id, val) => void
 * @param {Set<string>} [visitedPaths] - bereits besuchte Pfade (Zyklenschutz)
 */
async function traverseCeph(ctx, baseId, data, depth, path, createObjects, onState, visitedPaths = new Set()) {
    if (!data || typeof data !== 'object') {
return;
}
    if (depth > 10) {
        ctx.log.warn(`traverseCeph: maximale Tiefe 10 erreicht bei Pfad: ${path}`);
        return;
    }

    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
continue;
}

        const stateId = `${path}.${key}`;

        // Schlüssel-Ausschluss: key direkt gegen CEPH_EXCLUDED_PATHS prüfen
        if (CEPH_EXCLUDED_PATHS.includes(key)) {
            ctx.log.debug(`traverseCeph: Schlüssel ausgeschlossen – ${stateId}`);
            continue;
        }

        if (Array.isArray(value)) {
            if (createObjects) {
                await ctx.extendObjectAsync(stateId, {
                    type: 'folder',
                    common: { name: key },
                    native: {},
                });
            }
            for (let i = 0; i < value.length; i++) {
                const arrId = `${stateId}.${i}`;
                if (typeof value[i] === 'object' && value[i] !== null) {
                    if (createObjects) {
                        await ctx.extendObjectAsync(arrId, {
                            type: 'folder',
                            common: { name: `${key}[${i}]` },
                            native: {},
                        });
                    }
                    await traverseCeph(ctx, baseId, value[i], depth + 1, arrId, createObjects, onState, visitedPaths);
                } else {
                    if (createObjects) {
                        await ctx.extendObjectAsync(arrId, {
                            type: 'state',
                            common: { name: `${key}[${i}]`, type: typeof value[i], read: true, write: false, role: 'value' },
                            native: {},
                        });
                    }
                    await onState(arrId, value[i]);
                }
            }
        } else if (typeof value === 'object') {
            if (visitedPaths.has(stateId)) {
                ctx.log.warn(`traverseCeph: Zyklus erkannt bei ${stateId}, überspringe`);
                continue;
            }
            visitedPaths.add(stateId);
            if (createObjects) {
                await ctx.setObjectNotExistsAsync(stateId, {
                    type: 'folder',
                    common: { name: key },
                    native: {},
                });
            }
            await traverseCeph(ctx, baseId, value, depth + 1, stateId, createObjects, onState, visitedPaths);
        } else {
            if (createObjects) {
                await ctx.extendObjectAsync(stateId, {
                    type: 'state',
                    common: { name: key, type: typeof value, read: true, write: false, role: 'value' },
                    native: {},
                });
            }
            await onState(stateId, value);
        }
    }
}

/**
 * createCeph – legt Ceph-Objekte beim Adapter-Start an.
 */
async function createCeph() {
    const cephid = `${this.namespace}.ceph`;

    try {
        await this.setObjectNotExistsAsync(cephid, {
            type: 'channel',
            common: { name: 'ceph' },
            native: {},
        });

        const cephInformation = await withRetry.call(
            this,
            () => this.proxmox.getCephInformation(),
            API_RETRY_COUNT,
            'createCeph'
        );

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('createCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        await traverseCeph(
            this, cephid, cephInformation.data, 1, cephid, true,
            async (id, val) => this.setStateChangedAsync(id, val, true)
        );

        this.log.debug('createCeph: Ceph-Objekte erfolgreich angelegt');
    } catch (err) {
        this.log.error(`createCeph: Fehler beim Verarbeiten der Ceph-Informationen: ${err.message}`);
    }
}

/**
 * setCeph – aktualisiert Ceph-States im laufenden Betrieb.
 */
async function setCeph() {
    const cephid = `${this.namespace}.ceph`;

    try {
        const cephInformation = await withRetry.call(
            this,
            () => this.proxmox.getCephInformation(),
            API_RETRY_COUNT,
            'setCeph'
        );

        this.log.debug(`cephInformation: ${JSON.stringify(cephInformation)}`);

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('setCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        await traverseCeph(
            this, cephid, cephInformation.data, 1, cephid, true,
            async (id, val) => this.setStateChangedAsync(id, val, true)
        );
    } catch (err) {
        this.log.error(`setCeph: Fehler beim Abrufen der Ceph-Informationen: ${err.message}`);
    }
}

module.exports = { createCeph, setCeph };
