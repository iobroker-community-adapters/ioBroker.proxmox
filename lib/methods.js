'use strict';

/**
 * Wandelt Bytes in MiB um.
 *
 * @param {number} val
 */
function bytetoMb(val) {
    return Math.round(val / 1048576);
}

/**
 * Berechnet den prozentualen Anteil (0–100).
 * Gibt 0 zurück wenn total = 0, um NaN/Infinity zu vermeiden.
 *
 * @param {number} vala
 * @param {number} valb
 */
function used_level(vala, valb) {
    if (!valb) {
return 0;
}
    return Math.round((vala / valb) * 10000) / 100;
}

/**
 * Entfernt den Adapter-Namespace-Prefix aus einer State-ID.
 *
 * @param {string} id
 */
function removeNamespace(id) {
    const re = new RegExp(`^${this.namespace}\\.`);
    return id.replace(re, '');
}

/**
 * Ersetzt ALLE Punkte in einem Wert durch Bindestriche (für State-IDs).
 * Vorher: "vm.1.2" → "vm-1.2"  (nur erster Punkt)
 * Jetzt:  "vm.1.2" → "vm-1-2"  (alle Punkte)
 *
 * @param {string|any} val
 */
function prepareNameForId(val) {
    return String(val).replace(/\./g, '-');
}

/**
 * Bildet State-Definitionen aus einem Proxmox-Statusobjekt.
 * Gibt ein Array von [sid, key, type, value] Tupeln zurück.
 *
 * @param {string} sid
 * @param {object} states
 * @returns {Array<[string, string, string, any]>}
 */
function findState(sid, states) {
    const result = [];

    // Byte-Werte → MiB (size)
    const sizeKeys = new Set([
        'mem', 'maxmem', 'balloon', 'balloon_min', 'maxmem',
        'disk', 'maxdisk',
        'swap', 'maxswap',
        'used', 'total', 'avail',
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
            result.push([sid, 'mem_lev', 'level', used_level(states.mem, states.maxmem)]);
        }
        if (key === 'disk' && states.maxdisk) {
            result.push([sid, 'disk_lev', 'level', used_level(states.disk, states.maxdisk)]);
        }
        if (key === 'used' && states.total !== undefined) {
            result.push([sid, 'used_lev', 'level', used_level(states.used, states.total)]);
        }
        if (key === 'swap' && states.maxswap) {
            result.push([sid, 'swap_lev', 'level', used_level(states.swap, states.maxswap)]);
        }

        // ── Primäre Werte ─────────────────────────────────────────────────
        if (sizeKeys.has(key)) {
            result.push([sid, key, 'size', bytetoMb(value)]);
        } else if (timeKeys.has(key)) {
            result.push([sid, key, 'time', value]);
        } else if (sizebKeys.has(key)) {
            result.push([sid, key, 'sizeb', value]);
        } else if (key === 'cpu') {
            result.push([sid, key, 'level', Math.round(value * 10000) / 100]);
        } else if (numKeys.has(key)) {
            result.push([sid, key, 'default_num', parseInt(value, 10)]);
        } else if (textKeys.has(key)) {
            result.push([sid, key, 'text', value]);
        }
    }
    return result;
}

module.exports = {
    bytetoMb,
    used_level,
    removeNamespace,
    prepareNameForId,
    findState,
};


