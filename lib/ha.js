'use strict';

const API_TIMEOUT_MS = 10000;
const API_RETRY_COUNT = 2;

/**
 * Retry-Wrapper mit Timeout für async Funktionen.
 *
 * @param fn
 * @param retries
 * @param label
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
 * Traversiert haInformation.data und ruft für jeden State onCreate (optional) und onState auf.
 *
 * @param ctx
 * @param haid
 * @param data
 * @param createObjects
 * @param onState
 */
async function traverseHA(ctx, haid, data, createObjects, onState) {
    for (const lpData of data) {
        if (typeof lpData !== 'object' || lpData === null) {
continue;
}
        if (!lpData.id) {
            ctx.log.debug('traverseHA: HA-Eintrag ohne id übersprungen');
            continue;
        }

        const lpData2Id = String(lpData.id).replace(/[:/.\s]/g, '_');

        for (const [key, value] of Object.entries(lpData)) {
            if (key === 'id') {
continue;
}
            if (value === null || value === undefined) {
continue;
}

            const stateId = `${haid}.${lpData2Id}_${key}`;

            if (createObjects) {
                await ctx.extendObjectAsync(stateId, {
                    type: 'state',
                    common: {name: key, type: typeof value, read: true, write: false, role: 'value'},
                    native: {},
                });
            }
            await onState(stateId, value);
        }
    }
}

/**
 * createHA – legt HA-Objekte beim Adapter-Start an.
 */
async function createHA() {
    const haid = `${this.namespace}.ha`;

    try {
        await this.setObjectNotExistsAsync(haid, {
            type: 'channel',
            common: {name: 'ha'},
            native: {},
        });

        const haInformation = await withRetry.call(
            this,
            () => this.proxmox.getHAStatusInformation(),
            API_RETRY_COUNT,
            'createHA'
        );

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('createHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        await traverseHA(
            this, haid, haInformation.data, true,
            async (id, val) => this.setStateChangedAsync(id, val, true)
        );

        this.log.debug('createHA: HA-Objekte erfolgreich angelegt');
    } catch (err) {
        this.log.error(`createHA: Fehler beim Verarbeiten der HA-Informationen: ${err.message}`);
    }
}

/**
 * setHA – aktualisiert HA-States im laufenden Betrieb.
 */
async function setHA() {
    const haid = `${this.namespace}.ha`;

    try {
        const haInformation = await withRetry.call(
            this,
            () => this.proxmox.getHAStatusInformation(),
            API_RETRY_COUNT,
            'setHA'
        );

        this.log.debug(`haInformation: ${JSON.stringify(haInformation)}`);

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('setHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        await traverseHA(
            this, haid, haInformation.data, false,
            async (id, val) => this.setStateChangedAsync(id, val, true)
        );
    } catch (err) {
        this.log.error(`setHA: Fehler beim Abrufen der HA-Informationen: ${err.message}`);
    }
}

module.exports = {createHA, setHA};
