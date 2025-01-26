'use strict';
function bytetoMb(val) {
    return Math.round(val / 1048576);
}

function used_level(vala, valb) {
    return Math.round((vala / valb) * 10000) / 100;
}

function removeNamespace(id) {
    const re = new RegExp(`${this.namespace}*\\.`, 'g');
    return id.replace(re, '');
}

function prepareNameForId(val) {
    return String(val).replace('.', '-');
}

module.exports = {
    bytetoMb,
    used_level,
    removeNamespace,
    prepareNameForId
};

