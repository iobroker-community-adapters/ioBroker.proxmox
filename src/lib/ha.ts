import { API_RETRY_COUNT, withRetry } from './methods';
import type { ProxmoxAdapterContext, ProxmoxHAEntry } from './types';

/**
 * Traversiert haInformation.data und ruft für jeden State onCreate (optional) und onState auf.
 *
 * @param ctx - Adapter-Instanz
 * @param haid - Basis-State-ID
 * @param data - Einträge aus der Proxmox-API
 * @param createObjects - ob Objekte angelegt werden sollen
 * @param onState - wird für jeden State aufgerufen
 */
async function traverseHA(
    ctx: ProxmoxAdapterContext,
    haid: string,
    data: ProxmoxHAEntry[],
    createObjects: boolean,
    onState: (id: string, val: ioBroker.StateValue) => Promise<unknown>,
): Promise<void> {
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
 * createHA – legt HA-Objekte beim Adapter-Start an.
 */
export async function createHA(this: ProxmoxAdapterContext): Promise<void> {
    const haid = `${this.namespace}.ha`;

    try {
        await this.setObjectNotExistsAsync(haid, {
            type: 'channel',
            common: { name: 'ha' },
            native: {},
        });

        const haInformation = await withRetry(
            this,
            () => this.proxmox!.getHAStatusInformation(),
            API_RETRY_COUNT,
            'createHA',
        );

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('createHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        await traverseHA(this, haid, haInformation.data, true, async (id, val) =>
            this.setStateChangedAsync(id, val, true),
        );

        this.log.debug('createHA: HA-Objekte erfolgreich angelegt');
    } catch (err) {
        this.log.error(`createHA: Fehler beim Verarbeiten der HA-Informationen: ${(err as Error).message}`);
    }
}

/**
 * setHA – aktualisiert HA-States im laufenden Betrieb.
 */
export async function setHA(this: ProxmoxAdapterContext): Promise<void> {
    const haid = `${this.namespace}.ha`;

    try {
        const haInformation = await withRetry(
            this,
            () => this.proxmox!.getHAStatusInformation(),
            API_RETRY_COUNT,
            'setHA',
        );

        this.log.debug(`haInformation: ${JSON.stringify(haInformation)}`);

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('setHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        await traverseHA(this, haid, haInformation.data, false, async (id, val) =>
            this.setStateChangedAsync(id, val, true),
        );
    } catch (err) {
        this.log.error(`setHA: Fehler beim Abrufen der HA-Informationen: ${(err as Error).message}`);
    }
}
