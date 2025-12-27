'use strict';
/**
 *
 * @param val
 */
function bytetoMb(val) {
    return Math.round(val / 1048576);
}

/**
 *
 * @param vala
 * @param valb
 */
function used_level(vala, valb) {
    return Math.round((vala / valb) * 10000) / 100;
}

/**
 *
 * @param id
 */
function removeNamespace(id) {
    const re = new RegExp(`${this.namespace}*\\.`, 'g');
    return id.replace(re, '');
}

/**
 *
 * @param val
 */
function prepareNameForId(val) {
    return String(val).replace('.', '-');
}

/**
 *
 * @param sid
 * @param states
 */
function findState(sid, states) {
    const result = [];

    const sizeKeys = new Set(['mem', 'disk', 'balloon_min', 'maxdisk', 'maxmem', 'diskwrite', 'used', 'total', 'avail']);

    const timeKeys = new Set(['uptime', 'cttime']);
    const sizebKeys = new Set(['netin', 'netout']);
    const numKeys = new Set(['pid', 'vmid', 'cpus', 'shared', 'enabled', 'active']);
    const textKeys = new Set(['content', 'type', 'status', 'volid', 'parent', 'format']);

    for (const [key, value] of Object.entries(states)) {
        // Level-Berechnungen
        if (key === 'mem') {
            result.push([sid, 'mem_lev', 'level', this.used_level(states.mem, states.maxmem)]);
        }

        if (key === 'disk') {
            result.push([sid, 'disk_lev', 'level', this.used_level(states.disk, states.maxdisk)]);
        }

        if (key === 'used') {
            result.push([sid, 'used_lev', 'level', this.used_level(states.used, states.total)]);
        }

        // Typ-Zuordnung
        if (sizeKeys.has(key)) {
            result.push([sid, key, 'size', this.bytetoMb(value)]);
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
