import type { ProxmoxUtils } from './proxmox';
import type { ProxmoxAdapterContext, StateDefinition, StatusRecord } from './types';

const API_TIMEOUT_MS = 10000;

/** Anzahl der Wiederholungen in withRetry() für Ceph- und HA-Abfragen */
export const API_RETRY_COUNT = 2;

/** Die Timer-Methoden des Adapters. Nur deren Timer werden beim Unload automatisch gestoppt. */
type TimerHost = Pick<ioBroker.Adapter, 'setTimeout' | 'clearTimeout'>;

/**
 * Führt fn() mit Timeout aus.
 *
 * @param adapter - Adapter-Instanz, deren Timer benutzt wird
 * @param fn - auszuführende Funktion
 */
export async function withTimeout<T>(adapter: TimerHost, fn: () => Promise<T>): Promise<T> {
    let timer: ioBroker.Timeout | undefined;
    try {
        return await Promise.race([
            fn(),
            new Promise<never>((_, reject) => {
                timer = adapter.setTimeout(() => reject(new Error(`Timeout nach ${API_TIMEOUT_MS}ms`)), API_TIMEOUT_MS);
            }),
        ]);
    } finally {
        adapter.clearTimeout(timer);
    }
}

/**
 * Retry-Wrapper mit Timeout für async Funktionen.
 *
 * @param adapter - Adapter-Instanz, deren Timer und Log benutzt werden
 * @param fn - auszuführende Funktion
 * @param retries - Anzahl der Wiederholungen nach dem ersten Versuch
 * @param label - Bezeichnung für das Log
 */
export async function withRetry<T>(
    adapter: TimerHost & Pick<ioBroker.Adapter, 'log'>,
    fn: () => Promise<T>,
    retries: number,
    label: string,
): Promise<T> {
    for (let i = 0; ; i++) {
        try {
            return await withTimeout(adapter, fn);
        } catch (err) {
            if (i >= retries) {
                throw err;
            }
            adapter.log.debug(`${label}: Retry ${i + 1}/${retries} nach Fehler: ${(err as Error).message}`);
        }
    }
}

/**
 * Wandelt Bytes in MiB um.
 *
 * @param val - Wert in Bytes
 */
export function bytetoMb(val: number): number {
    return Math.round(val / 1048576);
}

/**
 * Berechnet den prozentualen Anteil (0–100).
 * Gibt 0 zurück wenn total = 0, um NaN/Infinity zu vermeiden.
 *
 * @param vala - Anteil
 * @param valb - Gesamtwert
 */
export function used_level(vala: number, valb: number): number {
    if (!valb) {
        return 0;
    }
    return Math.round((vala / valb) * 10000) / 100;
}

/**
 * Entfernt den Adapter-Namespace-Prefix aus einer State-ID.
 *
 * @param this - Adapter-Instanz
 * @param this.namespace - Namespace des Adapters
 * @param id - State-ID
 */
export function removeNamespace(this: { namespace: string }, id: string): string {
    const re = new RegExp(`^${this.namespace}\\.`);
    return id.replace(re, '');
}

/**
 * Ersetzt ALLE Punkte in einem Wert durch Bindestriche (für State-IDs).
 * Vorher: "vm.1.2" → "vm-1.2"  (nur erster Punkt)
 * Jetzt:  "vm.1.2" → "vm-1-2"  (alle Punkte)
 *
 * Absicht: Ein fehlender Name wird zu 'undefined'. setMachines() erkennt daran
 * Maschinen, zu denen Proxmox keine Details liefert.
 *
 * @param val - Name
 */
export function prepareNameForId(val: unknown): string {
    return String(val).replace(/\./g, '-');
}

/**
 * Ermittelt den Host-Zusatz einer Objekt-ID.
 *
 * Einzel-Hosts wissen nichts voneinander und heißen oft gleich (`pve`). Melden mehrere Instanzen dieselbe
 * ID, bekommen alle `_<hostId>`, sonst bleibt die ID unverändert. Einmal vergeben, bleibt der Zusatz,
 * solange der Channel existiert: Sonst wechselte die ID, sobald der andere Host nicht antwortet.
 *
 * @param ctx - Adapter-Instanz
 * @param inst - Proxmox-Instanz, zu der die ID gehört
 * @param relativeId - ID ohne Namespace und ohne Host-Zusatz
 * @returns `_<hostId>` oder eine leere Zeichenkette
 */
export function getHostSuffix(ctx: ProxmoxAdapterContext, inst: ProxmoxUtils | null, relativeId: string): string {
    if (!inst) {
        return '';
    }
    const suffix = `_${inst.hostId}`;
    if (ctx.objects[`${ctx.namespace}.${relativeId}${suffix}`]) {
        return suffix;
    }
    for (const [other, ids] of ctx.instanceIds) {
        if (other !== inst && ids.has(relativeId)) {
            return suffix;
        }
    }
    return '';
}

/**
 * Bildet State-Definitionen aus einem Proxmox-Statusobjekt.
 * Gibt ein Array von [sid, key, type, value] Tupeln zurück.
 *
 * @param sid - State-Basis-ID
 * @param states - Statusobjekt aus der Proxmox-API
 */
export function findState(sid: string, states: StatusRecord): StateDefinition[] {
    const result: StateDefinition[] = [];

    // Byte-Werte → MiB (size)
    const sizeKeys = new Set([
        'mem',
        'maxmem',
        'balloon',
        'balloon_min',
        'disk',
        'maxdisk',
        'swap',
        'maxswap',
        'used',
        'total',
        'avail',
    ]);

    // Sekunden-Werte (time)
    const timeKeys = new Set(['uptime', 'cttime']);

    // Byte-Raten → Bytes behalten (sizeb)
    const sizebKeys = new Set(['netin', 'netout', 'diskread', 'diskwrite']);

    // Ganzzahl-Werte (default_num)
    const numKeys = new Set(['pid', 'vmid', 'cpus', 'shared', 'enabled', 'active']);

    // Text-Werte
    const textKeys = new Set(['content', 'type', 'status', 'volid', 'parent', 'format']);

    for (const [key, value] of Object.entries(states)) {
        if (value === null || value === undefined) {
            continue;
        }

        // ── Abgeleitete Level-States ──────────────────────────────────────
        if (key === 'mem' && states.maxmem) {
            result.push([sid, 'mem_lev', 'level', used_level(states.mem as number, states.maxmem as number)]);
        }
        if (key === 'disk' && states.maxdisk) {
            result.push([sid, 'disk_lev', 'level', used_level(states.disk as number, states.maxdisk as number)]);
        }
        if (key === 'used' && states.total !== undefined) {
            result.push([sid, 'used_lev', 'level', used_level(states.used as number, states.total as number)]);
        }
        if (key === 'swap' && states.maxswap) {
            result.push([sid, 'swap_lev', 'level', used_level(states.swap as number, states.maxswap as number)]);
        }

        // ── Primäre Werte ─────────────────────────────────────────────────
        if (sizeKeys.has(key)) {
            result.push([sid, key, 'size', bytetoMb(value as number)]);
        } else if (timeKeys.has(key)) {
            result.push([sid, key, 'time', value as number]);
        } else if (sizebKeys.has(key)) {
            result.push([sid, key, 'sizeb', value as number]);
        } else if (key === 'cpu') {
            result.push([sid, key, 'level', Math.round((value as number) * 10000) / 100]);
        } else if (numKeys.has(key)) {
            // Proxmox liefert diese Werte teils als Zahl, teils als String
            result.push([sid, key, 'default_num', parseInt(value as string, 10)]);
        } else if (textKeys.has(key)) {
            result.push([sid, key, 'text', value as string]);
        }
    }
    return result;
}
