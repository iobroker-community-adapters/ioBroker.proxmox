import { API_RETRY_COUNT, withRetry } from './methods';
import type { ProxmoxAdapterContext } from './types';

/**
 * Schlüsselnamen die beim Traversieren komplett übersprungen werden sollen – unabhängig von ihrer Position im Baum.
 * Nur den Schlüsselnamen eintragen (kein Pfad).
 */
const CEPH_EXCLUDED_PATHS = ['available_modules'];

/**
 * Serialisiert das gesamte 'checks'-Objekt als JSON-String.
 * Dadurch werden keinerlei Unterordner für einzelne Checks oder Details angelegt.
 *
 * @param data - zu verarbeitende Daten (wird direkt mutiert)
 */
function flattenCephChecksDetail(data: unknown): void {
    if (!data || typeof data !== 'object') {
        return;
    }
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            flattenCephChecksDetail(data[i]);
        }
        return;
    }
    const record = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
        if (key === 'checks' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Das gesamte checks-Objekt als JSON-String serialisieren
            record[key] = JSON.stringify(value);
        } else if (typeof value === 'object') {
            flattenCephChecksDetail(value);
        }
    }
}

/**
 * Traversiert cephInformation.data ohne feste Tiefengrenze.
 * Schutz vor Zyklen via visitedPaths-Set.
 *
 * @param ctx - Adapter-Instanz (this)
 * @param baseId - Basis-State-ID
 * @param data - zu traversierende Daten
 * @param depth - aktuelle Tiefe (1-basiert)
 * @param path - aktueller State-Pfad
 * @param createObjects - ob Objekte angelegt werden sollen
 * @param onState - wird für jeden State aufgerufen
 * @param visitedPaths - bereits besuchte Pfade (Zyklenschutz)
 */
async function traverseCeph(
    ctx: ProxmoxAdapterContext,
    baseId: string,
    data: unknown,
    depth: number,
    path: string,
    createObjects: boolean,
    onState: (id: string, val: ioBroker.StateValue) => Promise<unknown>,
    visitedPaths = new Set<string>(),
): Promise<void> {
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
                const element: unknown = value[i];
                if (typeof element === 'object' && element !== null) {
                    if (createObjects) {
                        await ctx.extendObjectAsync(arrId, {
                            type: 'folder',
                            common: { name: `${key}[${i}]` },
                            native: {},
                        });
                    }
                    await traverseCeph(ctx, baseId, element, depth + 1, arrId, createObjects, onState, visitedPaths);
                } else {
                    if (createObjects) {
                        await ctx.extendObjectAsync(arrId, {
                            type: 'state',
                            common: {
                                name: `${key}[${i}]`,
                                type: typeof element as ioBroker.CommonType,
                                read: true,
                                write: false,
                                role: 'value',
                            },
                            native: {},
                        });
                    }
                    await onState(arrId, element as ioBroker.StateValue);
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
                    common: {
                        name: key,
                        type: typeof value as ioBroker.CommonType,
                        read: true,
                        write: false,
                        role: 'value',
                    },
                    native: {},
                });
            }
            await onState(stateId, value as ioBroker.StateValue);
        }
    }
}

/**
 * createCeph – legt Ceph-Objekte beim Adapter-Start an.
 */
export async function createCeph(this: ProxmoxAdapterContext): Promise<void> {
    const cephid = `${this.namespace}.ceph`;

    try {
        await this.setObjectNotExistsAsync(cephid, {
            type: 'channel',
            common: { name: 'ceph' },
            native: {},
        });

        const cephInformation = await withRetry(
            this,
            () => this.proxmox!.getCephInformation(),
            API_RETRY_COUNT,
            'createCeph',
        );

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('createCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        flattenCephChecksDetail(cephInformation.data);

        await traverseCeph(this, cephid, cephInformation.data, 1, cephid, true, async (id, val) =>
            this.setStateChangedAsync(id, val, true),
        );

        this.log.debug('createCeph: Ceph-Objekte erfolgreich angelegt');
    } catch (err) {
        this.log.error(`createCeph: Fehler beim Verarbeiten der Ceph-Informationen: ${(err as Error).message}`);
    }
}

/**
 * setCeph – aktualisiert Ceph-States im laufenden Betrieb.
 */
export async function setCeph(this: ProxmoxAdapterContext): Promise<void> {
    const cephid = `${this.namespace}.ceph`;

    try {
        const cephInformation = await withRetry(
            this,
            () => this.proxmox!.getCephInformation(),
            API_RETRY_COUNT,
            'setCeph',
        );

        this.log.debug(`cephInformation: ${JSON.stringify(cephInformation)}`);

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('setCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        flattenCephChecksDetail(cephInformation.data);

        // Absicht (seit 2bcf333): createObjects = true. Anders als bei setHA() werden Objekte hier
        // auch im laufenden Betrieb angelegt bzw. erweitert.
        await traverseCeph(this, cephid, cephInformation.data, 1, cephid, true, async (id, val) =>
            this.setStateChangedAsync(id, val, true),
        );
    } catch (err) {
        this.log.error(`setCeph: Fehler beim Abrufen der Ceph-Informationen: ${(err as Error).message}`);
    }
}
