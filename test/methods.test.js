'use strict';

/**
 * Tests für lib/methods.js
 * Ausführen: node --test test/methods.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    bytetoMb,
    used_level,
    prepareNameForId,
    findState,
} = require('../lib/methods');

// findState braucht this.used_level / this.bytetoMb nicht mehr (direkte Funktionsaufrufe)
// Wir binden einen Dummy-this für removeNamespace (nicht getestet hier)

// ─── bytetoMb ────────────────────────────────────────────────────────────────

describe('bytetoMb()', () => {
    it('rechnet 1 MiB korrekt um', () => {
        assert.equal(bytetoMb(1048576), 1);
    });
    it('rechnet 0 zu 0 um', () => {
        assert.equal(bytetoMb(0), 0);
    });
    it('rundet auf ganze MiB', () => {
        assert.equal(bytetoMb(1048576 + 524288), 2); // 1.5 MiB → 2
    });
    it('verarbeitet große Werte (GB)', () => {
        assert.equal(bytetoMb(1073741824), 1024); // 1 GiB
    });
});

// ─── used_level ──────────────────────────────────────────────────────────────

describe('used_level()', () => {
    it('50% korrekt', () => {
        assert.equal(used_level(512, 1024), 50);
    });
    it('100% korrekt', () => {
        assert.equal(used_level(1024, 1024), 100);
    });
    it('0% korrekt', () => {
        assert.equal(used_level(0, 1024), 0);
    });
    it('gibt 0 zurück wenn total = 0 (kein NaN/Infinity)', () => {
        assert.equal(used_level(0, 0), 0);
        assert.equal(used_level(100, 0), 0);
    });
    it('rundet auf 2 Dezimalstellen', () => {
        // 1/3 ≈ 33.33%
        assert.equal(used_level(1, 3), 33.33);
    });
});

// ─── prepareNameForId ────────────────────────────────────────────────────────

describe('prepareNameForId()', () => {
    it('ersetzt einzelnen Punkt', () => {
        assert.equal(prepareNameForId('vm.100'), 'vm-100');
    });
    it('ersetzt ALLE Punkte (war der Bug: nur erster wurde ersetzt)', () => {
        assert.equal(prepareNameForId('vm.1.2'), 'vm-1-2');
    });
    it('kein Punkt → unverändert', () => {
        assert.equal(prepareNameForId('myvm'), 'myvm');
    });
    it('konvertiert Zahl zu String', () => {
        assert.equal(prepareNameForId(100), '100');
    });
    it('leerer String bleibt leer', () => {
        assert.equal(prepareNameForId(''), '');
    });
    it('viele Punkte', () => {
        assert.equal(prepareNameForId('a.b.c.d.e'), 'a-b-c-d-e');
    });
});

// ─── findState – Storage (aus dem Log-Beispiel) ───────────────────────────────

describe('findState() – Storage local-lvm', () => {
    const storageData = {
        content: 'images,rootdir',
        type: 'lvmthin',
        active: 1,
        shared: 0,
        total: 151640866816,
        enabled: 1,
        used: 97429256929,
        avail: 54211609887,
    };

    const result = findState.call({}, 'proxmox.0.storage_local-lvm', storageData);
    const get = (key) => result.find(r => r[1] === key);

    it('erzeugt State für "used" (size/MiB)', () => {
        const s = get('used');
        assert.ok(s, '"used" fehlt');
        assert.equal(s[2], 'size');
        assert.equal(s[3], bytetoMb(97429256929));
    });

    it('erzeugt State für "total" (size/MiB)', () => {
        const s = get('total');
        assert.ok(s, '"total" fehlt');
        assert.equal(s[2], 'size');
        assert.equal(s[3], bytetoMb(151640866816));
    });

    it('erzeugt State für "avail" (size/MiB)', () => {
        const s = get('avail');
        assert.ok(s, '"avail" fehlt');
        assert.equal(s[2], 'size');
        assert.equal(s[3], bytetoMb(54211609887));
    });

    it('erzeugt used_lev (level %)', () => {
        const s = get('used_lev');
        assert.ok(s, '"used_lev" fehlt');
        assert.equal(s[2], 'level');
        assert.equal(s[3], used_level(97429256929, 151640866816));
    });

    it('used_lev ist kein NaN', () => {
        const s = get('used_lev');
        assert.ok(!isNaN(s[3]), `used_lev ist NaN: ${s[3]}`);
    });

    it('erzeugt "content" als text', () => {
        const s = get('content');
        assert.ok(s, '"content" fehlt');
        assert.equal(s[2], 'text');
        assert.equal(s[3], 'images,rootdir');
    });

    it('erzeugt "type" als text', () => {
        const s = get('type');
        assert.ok(s, '"type" fehlt');
        assert.equal(s[2], 'text');
        assert.equal(s[3], 'lvmthin');
    });

    it('erzeugt "active" als default_num', () => {
        const s = get('active');
        assert.ok(s, '"active" fehlt');
        assert.equal(s[2], 'default_num');
        assert.equal(s[3], 1);
    });

    it('erzeugt "shared" als default_num', () => {
        const s = get('shared');
        assert.ok(s, '"shared" fehlt');
        assert.equal(s[2], 'default_num');
        assert.equal(s[3], 0);
    });

    it('erzeugt "enabled" als default_num', () => {
        const s = get('enabled');
        assert.ok(s, '"enabled" fehlt');
        assert.equal(s[2], 'default_num');
        assert.equal(s[3], 1);
    });

    it('alle States haben die SID proxmox.0.storage_local-lvm', () => {
        for (const s of result) {
            assert.equal(s[0], 'proxmox.0.storage_local-lvm', `Falsche SID bei "${s[1]}"`);
        }
    });
});

// ─── findState – Storage mit total=0 (deaktiviert) ───────────────────────────

describe('findState() – Storage total=0 (Schutz vor NaN)', () => {
    it('used_lev ist 0 wenn total=0', () => {
        const data   = { used: 0, total: 0, avail: 0 };
        const result = findState.call({}, 'proxmox.0.storage_off', data);
        const lev    = result.find(r => r[1] === 'used_lev');
        assert.ok(lev, 'used_lev fehlt');
        assert.equal(lev[3], 0, `Erwartet 0, erhalten: ${lev[3]}`);
        assert.ok(!isNaN(lev[3]), 'used_lev ist NaN');
    });
});

// ─── findState – QEMU VM (laufend) ───────────────────────────────────────────

describe('findState() – QEMU running', () => {
    const vmData = {
        name:      'myvm',
        status:    'running',
        cpu:       0.05,
        mem:       1073741824,   // 1 GiB
        maxmem:    4294967296,   // 4 GiB
        disk:      10737418240,  // 10 GiB
        maxdisk:   53687091200,  // 50 GiB
        netin:     1024000,
        netout:    512000,
        diskread:  204800,
        diskwrite: 102400,
        uptime:    3600,
        pid:       12345,
        vmid:      100,
    };

    let result;
    result = findState.call({}, 'proxmox.0.qemu_myvm', vmData);

    const get = (key) => result.find(r => r[1] === key);

    it('cpu → level (0-100%)', () => {
        const s = get('cpu');
        assert.ok(s, '"cpu" fehlt');
        assert.equal(s[2], 'level');
        assert.equal(s[3], 5); // 0.05 * 100 = 5%
    });

    it('mem → size (MiB)', () => {
        const s = get('mem');
        assert.ok(s, '"mem" fehlt');
        assert.equal(s[2], 'size');
        assert.equal(s[3], 1024); // 1 GiB = 1024 MiB
    });

    it('mem_lev → level (25%)', () => {
        const s = get('mem_lev');
        assert.ok(s, '"mem_lev" fehlt');
        assert.equal(s[2], 'level');
        assert.equal(s[3], 25); // 1GiB / 4GiB = 25%
    });

    it('maxmem → size (MiB)', () => {
        const s = get('maxmem');
        assert.ok(s, '"maxmem" fehlt');
        assert.equal(s[2], 'size');
        assert.equal(s[3], 4096);
    });

    it('disk → size (MiB)', () => {
        const s = get('disk');
        assert.ok(s, '"disk" fehlt');
        assert.equal(s[2], 'size');
    });

    it('disk_lev → level (20%)', () => {
        const s = get('disk_lev');
        assert.ok(s, '"disk_lev" fehlt');
        assert.equal(s[3], 20); // 10GiB / 50GiB = 20%
    });

    it('netin → sizeb (Bytes, nicht MiB)', () => {
        const s = get('netin');
        assert.ok(s, '"netin" fehlt');
        assert.equal(s[2], 'sizeb');
        assert.equal(s[3], 1024000); // unverändert
    });

    it('netout → sizeb', () => {
        const s = get('netout');
        assert.ok(s, '"netout" fehlt');
        assert.equal(s[2], 'sizeb');
    });

    it('diskread → sizeb (war vorher komplett ignoriert – Bug-Fix)', () => {
        const s = get('diskread');
        assert.ok(s, '"diskread" fehlt – war Bug: diskread wurde ignoriert');
        assert.equal(s[2], 'sizeb');
        assert.equal(s[3], 204800);
    });

    it('diskwrite → sizeb (war in sizeKeys falsch als MiB – Bug-Fix)', () => {
        const s = get('diskwrite');
        assert.ok(s, '"diskwrite" fehlt');
        assert.equal(s[2], 'sizeb');
        assert.equal(s[3], 102400); // unverändert, nicht durch bytetoMb geteilt
    });

    it('uptime → time', () => {
        const s = get('uptime');
        assert.ok(s, '"uptime" fehlt');
        assert.equal(s[2], 'time');
        assert.equal(s[3], 3600);
    });

    it('pid → default_num', () => {
        const s = get('pid');
        assert.ok(s, '"pid" fehlt');
        assert.equal(s[2], 'default_num');
        assert.equal(s[3], 12345);
    });

    it('vmid → default_num', () => {
        const s = get('vmid');
        assert.ok(s, '"vmid" fehlt');
        assert.equal(s[3], 100);
    });

    it('status → text', () => {
        const s = get('status');
        assert.ok(s, '"status" fehlt');
        assert.equal(s[2], 'text');
        assert.equal(s[3], 'running');
    });
});

// ─── findState – VM offline (offlineResourceStatus) ──────────────────────────

describe('findState() – VM offline (offlineResourceStatus)', () => {
    const offlineStatus = {
        uptime: 0, disk: 0, netout: 0, netin: 0,
        diskread: 0, cpu: 0, diskwrite: 0,
        pid: 0, mem: 0, swap: 0,
        status: 'stopped', type: 'qemu', name: 'myvm', vmid: 100,
    };

    let result;
    result = findState.call({}, 'proxmox.0.qemu_myvm', offlineStatus);

    const get = (key) => result.find(r => r[1] === key);

    it('kein NaN bei diskread=0', () => {
        const s = get('diskread');
        assert.ok(s, '"diskread" fehlt');
        assert.ok(!isNaN(s[3]));
    });

    it('kein NaN bei diskwrite=0', () => {
        const s = get('diskwrite');
        assert.ok(s, '"diskwrite" fehlt');
        assert.ok(!isNaN(s[3]));
    });

    it('swap → size (war vorher nicht in sizeKeys)', () => {
        const s = get('swap');
        assert.ok(s, '"swap" fehlt – war Bug: swap wurde ignoriert');
        assert.equal(s[2], 'size');
    });
});

// ─── findState – null/undefined Werte werden übersprungen ────────────────────

describe('findState() – null/undefined Werte', () => {
    it('überspringt null-Werte ohne Crash', () => {
        const data = { used: null, total: undefined, avail: 1000 };
        assert.doesNotThrow(() => findState.call({}, 'proxmox.0.x', data));
    });

    it('verarbeitet avail trotzdem', () => {
        const data = { used: null, total: undefined, avail: 1048576 };
        const result = findState.call({}, 'proxmox.0.x', data);
        const avail = result.find(r => r[1] === 'avail');
        assert.ok(avail);
        assert.equal(avail[3], 1);
    });
});
