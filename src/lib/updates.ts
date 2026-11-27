import { withTimeout } from './methods';
import type { ProxmoxUtils } from './proxmox';
import { updateStateNames } from './translations';
import type { ProxmoxAdapterContext } from './types';

/** So lange wartet der Button `updates.refresh` höchstens auf `apt-get update` */
const REFRESH_TIMEOUT_MS = 120000;

/** Abstand, in dem der Button den Stand von `apt-get update` abfragt */
const TASK_POLL_MS = 2000;

/** Ein Eintrag in `updates.list` */
export interface NodeUpdate {
    package: string;
    oldVersion?: string;
    version?: string;
    origin?: string;
}

/**
 * @param err - gefangener Fehler
 * @returns lesbarer Grund. Bei einer abgelehnten Anfrage nennt Proxmox im Statustext das fehlende Recht.
 */
function errorText(err: unknown): string {
    const response = (err as { response?: { status?: number; statusText?: string } }).response;
    if (response?.status) {
        return `HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;
    }
    return (err as Error).message;
}

/**
 * Wartet über einen Adapter-Timer. Fährt der Adapter herunter, geht es sofort weiter, und der nächste
 * API-Aufruf bricht mit STOPPED ab.
 *
 * @param ctx - Adapter-Instanz
 * @param ms - Wartezeit in Millisekunden
 */
function delay(ctx: ProxmoxAdapterContext, ms: number): Promise<void> {
    return new Promise(resolve => {
        if (!ctx.setTimeout(resolve, ms)) {
            resolve();
        }
    });
}

/**
 * Legt `updates.count`, `updates.list` und den Button `updates.refresh` unter einem Node an.
 *
 * @param ctx - Adapter-Instanz
 * @param sid - volle ID des Node-Channels
 * @param native - `native` des Buttons, wie bei den anderen Node-Buttons
 */
export async function createUpdateObjects(
    ctx: ProxmoxAdapterContext,
    sid: string,
    native: Record<string, unknown>,
): Promise<void> {
    await ctx.extendObjectAsync(`${sid}.updates`, {
        type: 'folder',
        common: { name: updateStateNames.folder },
        native: {},
    });
    await ctx.extendObjectAsync(`${sid}.updates.count`, {
        type: 'state',
        common: {
            name: updateStateNames.count,
            type: 'number',
            role: 'value',
            read: true,
            write: false,
        },
        native: {},
    });
    await ctx.extendObjectAsync(`${sid}.updates.list`, {
        type: 'state',
        common: {
            name: updateStateNames.list,
            type: 'string',
            role: 'json',
            read: true,
            write: false,
        },
        native: {},
    });
    await ctx.extendObjectAsync(`${sid}.updates.refresh`, {
        type: 'state',
        common: {
            name: updateStateNames.refresh,
            type: 'boolean',
            role: 'button',
            read: true,
            write: true,
        },
        native,
    });
}

/**
 * Entfernt `updates.*`, nachdem die Abfrage abgeschaltet wurde. Sonst stünde dort ein veralteter Stand.
 *
 * @param ctx - Adapter-Instanz
 * @param sid - volle ID des Node-Channels
 */
export async function removeUpdateObjects(ctx: ProxmoxAdapterContext, sid: string): Promise<void> {
    if (await ctx.getForeignObjectAsync(`${sid}.updates`)) {
        await ctx.delForeignObjectAsync(`${sid}.updates`, { recursive: true });
        ctx.log.info(`Removed the available updates of "${sid}", the option is switched off`);
    }
}

/**
 * Liest die verfügbaren Updates eines Nodes und schreibt sie in `updates.count` und `updates.list`.
 * Fehler landen als Warnung im Log, nur STOPPED geht weiter.
 *
 * @param ctx - Adapter-Instanz
 * @param inst - Proxmox-Instanz des Nodes
 * @param sid - volle ID des Node-Channels
 * @param nodeName - Node-Name für die API
 */
export async function setUpdateStates(
    ctx: ProxmoxAdapterContext,
    inst: ProxmoxUtils,
    sid: string,
    nodeName: string,
): Promise<void> {
    try {
        const updates = await withTimeout(ctx, () => inst.getNodeUpdates(nodeName));
        const list: NodeUpdate[] = updates
            .map(pkg => ({
                package: String(pkg.Package ?? ''),
                oldVersion: pkg.OldVersion,
                version: pkg.Version,
                origin: pkg.Origin,
            }))
            // Feste Reihenfolge: Sonst ändert sich der State, ohne dass sich etwas geändert hat
            .sort((a, b) => a.package.localeCompare(b.package));

        ctx.log.debug(`Node ${nodeName}: ${list.length} available update(s)`);
        await ctx.setStateChangedAsync(`${sid}.updates.count`, { val: list.length, ack: true });
        await ctx.setStateChangedAsync(`${sid}.updates.list`, { val: JSON.stringify(list), ack: true });
    } catch (err) {
        if ((err as Error).message === 'STOPPED') {
            throw err;
        }
        ctx.log.warn(`Cannot read the available updates of node ${nodeName}: ${errorText(err)}`);
    }
}

/**
 * Button `updates.refresh`: startet `apt-get update` auf dem Node, wartet darauf und liest die Updates neu.
 *
 * @param ctx - Adapter-Instanz
 * @param inst - Proxmox-Instanz des Nodes
 * @param sid - volle ID des Node-Channels
 * @param nodeName - Node-Name für die API
 */
export async function refreshUpdates(
    ctx: ProxmoxAdapterContext,
    inst: ProxmoxUtils,
    sid: string,
    nodeName: string,
): Promise<void> {
    try {
        ctx.log.info(`Refreshing the package index of node ${nodeName}`);
        const upid = (await inst.refreshNodeUpdates(nodeName))?.data;
        if (upid) {
            await waitForTask(ctx, inst, nodeName, upid);
        }
    } catch (err) {
        if ((err as Error).message === 'STOPPED') {
            return;
        }
        // Weiter: Die Liste lässt sich oft trotzdem lesen, etwa wenn nur Sys.Modify fehlt
        ctx.log.warn(`Cannot refresh the package index of node ${nodeName}: ${errorText(err)}`);
    }

    try {
        await setUpdateStates(ctx, inst, sid, nodeName);
    } catch {
        // STOPPED: Der Adapter fährt herunter
    }
}

/**
 * @param ctx - Adapter-Instanz
 * @param inst - Proxmox-Instanz des Nodes
 * @param nodeName - Node-Name für die API
 * @param upid - Kennung der Aufgabe
 */
async function waitForTask(
    ctx: ProxmoxAdapterContext,
    inst: ProxmoxUtils,
    nodeName: string,
    upid: string,
): Promise<void> {
    const end = Date.now() + REFRESH_TIMEOUT_MS;
    while (Date.now() < end) {
        await delay(ctx, TASK_POLL_MS);
        const task = await withTimeout(ctx, () => inst.getTaskStatus(nodeName, upid));
        if (task?.status === 'stopped') {
            if (task.exitstatus !== 'OK') {
                ctx.log.warn(`Refreshing the package index of node ${nodeName} ended with: ${task.exitstatus}`);
            }
            return;
        }
    }
    ctx.log.warn(
        `Refreshing the package index of node ${nodeName} takes longer than ${REFRESH_TIMEOUT_MS / 1000} s, reading the updates anyway`,
    );
}
