'use strict';

/**
 * Tests für src/lib/vms.ts (createVM + setMachines)
 *
 * Ausführen:  node --test test/vms.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createVM, setMachines } = require('../build/lib/vms');
const { findState, bytetoMb, used_level, prepareNameForId, removeNamespace } = require('../build/lib/methods');

// ─── Adapter-Mock ─────────────────────────────────────────────────────────────

function makeAdapter(resources = [], overrides = {}) {
    const states   = {};
    const objects  = {};
    const logs     = { debug: [], info: [], warn: [], error: [] };

    const proxmox = {
        getClusterResources: async () => resources,
        getResourceStatus:   async () => ({ cpu: 0.1, mem: 512 * 1024 * 1024, maxmem: 2048 * 1024 * 1024, disk: 0, maxdisk: 10 * 1024 * 1024 * 1024, netin: 0, netout: 0, diskread: 0, diskwrite: 0, uptime: 100, status: 'running', type: 'qemu', vmid: 100, name: 'testvm', pid: 1234 }),
        getStorageStatus:    async () => ({ used: 10 * 1024 * 1024 * 1024, total: 100 * 1024 * 1024 * 1024, avail: 90 * 1024 * 1024 * 1024 }),
        getBackupStatus:     async () => [],
    };

    const adapter = {
        namespace: 'proxmox.0',
        config: {
            newTreeStructure:              false,
            requestStorageInformation:     false,
            requestStorageInformationBackup: false,
            ...overrides.config,
        },
        objects,
        log: {
            debug: (m) => logs.debug.push(m),
            info:  (m) => logs.info.push(m),
            warn:  (m) => logs.warn.push(m),
            error: (m) => logs.error.push(m),
        },
        proxmox,
        offlineResourceStatus: {
            uptime: 0, disk: 0, netout: 0, netin: 0, diskread: 0,
            cpu: 0, diskwrite: 0, pid: 0, mem: 0, swap: 0,
            status: '', type: '', name: '', vmid: 0,
        },
        _states: states,
        _logs:   logs,

        setObjectNotExistsAsync: async (id, obj) => { if (!objects[id]) objects[id] = obj; },
        extendObjectAsync:       async (id, obj)  => { objects[id] = { ...(objects[id] || {}), ...obj }; },
        setStateChangedAsync:    async (id, val)  => { states[id] = typeof val === 'object' && val !== null && 'val' in val ? val.val : val; },
        setStateAsync:           async (id, val)  => { states[id] = typeof val === 'object' && val !== null && 'val' in val ? val.val : val; },
        delObjectAsync:          async (id)       => { delete objects[id]; },
        subscribeForeignStates:  () => {},
        restart:                 () => { adapter._restarted = true; },
        _restarted: false,

        // lib/methods binden
        bytetoMb:         bytetoMb,
        used_level:       used_level,
        prepareNameForId: prepareNameForId,
        removeNamespace:  removeNamespace.bind({ namespace: 'proxmox.0' }),
        findState:        findState,

        createCustomState: async function(sid, name, type, val) {
            const key = `${sid}.${name}`;
            await this.setObjectNotExistsAsync(key, { type: 'state', common: { name, type: 'number' }, native: {} });
            await this.setStateChangedAsync(key, { val, ack: true });
        },

        ...overrides,
    };

    // createVM / setMachines werden als this-gebundene Funktionen aufgerufen
    adapter.createVM    = createVM.bind(adapter);
    adapter.setMachines = setMachines.bind(adapter);

    return adapter;
}

// ─── Testdaten ────────────────────────────────────────────────────────────────

function makeQemuResource(overrides = {}) {
    return {
        type: 'qemu', node: 'pve', vmid: 100,
        name: 'testvm', status: 'running',
        ...overrides,
    };
}

function makeLxcResource(overrides = {}) {
    return {
        type: 'lxc', node: 'pve', vmid: 200,
        name: 'testlxc', status: 'running',
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createVM', () => {

    describe('Alte Baumstruktur (newTreeStructure=false)', () => {
        it('legt Channel-Objekte mit Unterstrich-Format an', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            await adapter.createVM();

            assert.ok(
                adapter.objects['proxmox.0.qemu_testvm'],
                'Channel-Objekt qemu_testvm soll existieren',
            );
        });

        it('legt Status-State an und setzt ihn', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            await adapter.createVM();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.status'], 'running');
        });

        it('legt available-State an und setzt ihn auf true (running)', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            await adapter.createVM();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.available'], true);
        });

        it('setzt available=false für gestoppte VMs', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'stopped' })]);
            await adapter.createVM();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.available'], false);
        });

        it('verarbeitet status "unknown" als "offline"', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'unknown' })]);
            await adapter.createVM();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.status'], 'offline');
        });

        it('gibt nur vorhandene Ressourcen zurück und löscht selbst nichts', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            // Altes Objekt vorab eintragen
            adapter.objects['proxmox.0.qemu_oldvm'] = { type: 'channel', common: { name: 'oldvm' }, native: { type: 'qemu' } };

            const keep = await adapter.createVM();

            assert.deepEqual(keep, ['qemu_testvm']);
            assert.ok(adapter.objects['proxmox.0.qemu_oldvm'], 'Gelöscht wird erst in getNodes()');
        });

        it('gibt null zurück wenn die Ressourcen nicht abrufbar sind', async () => {
            const adapter = makeAdapter();
            adapter.proxmox.getClusterResources = async () => { throw new Error('HTTP 500'); };

            assert.equal(await adapter.createVM(), null);
        });

        it('gibt null zurück wenn der Adapter stoppt', async () => {
            const adapter = makeAdapter();
            adapter.proxmox.getClusterResources = async () => { throw new Error('STOPPED'); };

            assert.equal(await adapter.createVM(), null);
        });

        it('legt Button-States (start/stop/shutdown/reboot/reset/suspend/resume) an', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            await adapter.createVM();

            for (const cmd of ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume']) {
                assert.ok(
                    adapter.objects[`proxmox.0.qemu_testvm.${cmd}`],
                    `Button-State "${cmd}" soll existieren`,
                );
            }
        });

        it('alle Button-States haben type=boolean, role=button, write=true', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            await adapter.createVM();

            for (const cmd of ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume']) {
                const obj = adapter.objects[`proxmox.0.qemu_testvm.${cmd}`];
                assert.ok(obj, `Button "${cmd}" soll existieren`);
                assert.equal(obj.common?.type, 'boolean', `Button "${cmd}" soll type=boolean haben`);
                assert.equal(obj.common?.role, 'button',  `Button "${cmd}" soll role=button haben`);
                assert.equal(obj.common?.write, true,     `Button "${cmd}" soll write=true haben`);
            }
        });

        it('Button-State native enthält node, type, vmid', async () => {
            const adapter = makeAdapter([makeQemuResource({ node: 'pve', vmid: 100 })]);
            await adapter.createVM();

            const resetObj = adapter.objects['proxmox.0.qemu_testvm.reset'];
            assert.ok(resetObj, 'reset-Objekt soll existieren');
            assert.equal(resetObj.native?.node,  'pve');
            assert.equal(resetObj.native?.type,  'qemu');
            assert.equal(resetObj.native?.vmid,  100);
        });
    });

    describe('Neue Baumstruktur (newTreeStructure=true)', () => {
        it('legt Channel-Objekte mit Punkt-Format an', async () => {
            const adapter = makeAdapter([makeQemuResource()], { config: { newTreeStructure: true } });
            await adapter.createVM();

            assert.ok(
                adapter.objects['proxmox.0.qemu.testvm'],
                'Channel-Objekt qemu.testvm soll existieren',
            );
        });

        it('BUG FIX: gibt vorhandene Ressourcen auch im Punkt-Format zurück', async () => {
            const adapter = makeAdapter([makeQemuResource()], { config: { newTreeStructure: true } });

            assert.deepEqual(await adapter.createVM(), ['qemu.testvm']);
        });

        it('BUG FIX: behält aktive Ressourcen bei Punkt-Format', async () => {
            const adapter = makeAdapter([makeQemuResource()], { config: { newTreeStructure: true } });
            await adapter.createVM();

            assert.ok(adapter.objects['proxmox.0.qemu.testvm'], 'Aktives Objekt soll nicht gelöscht werden');
        });
    });

    describe('LXC-Ressourcen', () => {
        it('legt LXC-Objekte korrekt an', async () => {
            const adapter = makeAdapter([makeLxcResource()]);
            await adapter.createVM();

            assert.ok(adapter.objects['proxmox.0.lxc_testlxc']);
        });

        it('legt alle 7 Button-States auch für LXC an', async () => {
            const adapter = makeAdapter([makeLxcResource()]);
            await adapter.createVM();

            for (const cmd of ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume']) {
                assert.ok(
                    adapter.objects[`proxmox.0.lxc_testlxc.${cmd}`],
                    `LXC-Button "${cmd}" soll existieren`,
                );
            }
        });
    });

    describe('Gemischte Ressourcen', () => {
        it('verarbeitet QEmu + LXC gleichzeitig', async () => {
            const adapter = makeAdapter([makeQemuResource(), makeLxcResource()]);
            await adapter.createVM();

            assert.ok(adapter.objects['proxmox.0.qemu_testvm']);
            assert.ok(adapter.objects['proxmox.0.lxc_testlxc']);
        });
    });

    describe('Fehlerbehandlung', () => {
        it('fängt getClusterResources-Fehler ab (kein Crash)', async () => {
            const adapter = makeAdapter([]);
            adapter.proxmox.getClusterResources = async () => { throw new Error('Network error'); };

            // Soll keinen Fehler werfen
            await assert.doesNotReject(() => adapter.createVM());
            assert.ok(adapter._logs.debug.some(m => m.includes('Unable to get cluster resources')));
        });

        it('STOPPED von getClusterResources → kein Log, kein Crash', async () => {
            const adapter = makeAdapter([]);
            adapter.proxmox.getClusterResources = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.createVM());
            // Kein debug/warn/error Log bei STOPPED
            assert.ok(!adapter._logs.debug.some(m => m.includes('Unable to get cluster resources')), 'Kein debug-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.warn.length,  0, 'Kein warn-Log bei STOPPED erwartet');
        });

        it('STOPPED von getResourceStatus → kein error-Log, kein Crash', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'running' })]);
            adapter.proxmox.getResourceStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.createVM());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
        });

        it('STOPPED von getStorageStatus → kein Log, früher return', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], { config: { requestStorageInformation: true } });
            adapter.proxmox.getStorageStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.createVM());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.warn.length,  0, 'Kein warn-Log bei STOPPED erwartet');
        });

        it('echter Storage-Fehler (HTTP 500) → error-Log mit Fehlermeldung', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], { config: { requestStorageInformation: true } });
            adapter.proxmox.getStorageStatus = async () => { throw new Error('getStorageStatus für "local" auf "pve" fehlgeschlagen: HTTP 500: storage offline'); };

            await assert.doesNotReject(() => adapter.createVM());
            assert.ok(adapter._logs.error.some(m => m.includes('Storageerror createVM')), 'error-Log soll bei echtem Fehler erscheinen');
        });
    });
});

// ─── setMachines Tests ────────────────────────────────────────────────────────

describe('setMachines', () => {

    describe('State-Updates', () => {
        it('aktualisiert Status-State für laufende VM', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            adapter.objects['proxmox.0.qemu_testvm'] = { type: 'channel', native: { type: 'qemu' } };

            await adapter.setMachines();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.status'], 'running');
        });

        it('setzt available=false für gestoppte VM', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'stopped' })]);
            adapter.objects['proxmox.0.qemu_testvm'] = { type: 'channel', native: { type: 'qemu' } };

            await adapter.setMachines();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.available'], false);
        });

        it('setzt available=true für laufende VM', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'running' })]);
            adapter.objects['proxmox.0.qemu_testvm'] = { type: 'channel', native: { type: 'qemu' } };

            await adapter.setMachines();

            assert.equal(adapter._states['proxmox.0.qemu_testvm.available'], true);
        });
    });

    describe('BUG FIX: offlineMachines', () => {
        it('setzt info.offlineMachines NACH den VM-State-Aktualisierungen', async () => {
            // Trackt die kombinierte Reihenfolge beider State-Methoden
            const callOrder = [];
            const adapter = makeAdapter([makeQemuResource()]);
            adapter.objects['proxmox.0.qemu_testvm'] = { type: 'channel', native: { type: 'qemu' } };

            const origSetChanged = adapter.setStateChangedAsync.bind(adapter);
            adapter.setStateChangedAsync = async (id, val) => {
                callOrder.push({ fn: 'changed', id });
                return origSetChanged(id, val);
            };

            const origSetState = adapter.setStateAsync.bind(adapter);
            adapter.setStateAsync = async (id, val) => {
                callOrder.push({ fn: 'state', id });
                return origSetState(id, val);
            };

            await adapter.setMachines();

            const offlineIdx  = callOrder.findIndex(e => e.id === 'info.offlineMachines');
            const changedCalls = callOrder.filter(e => e.fn === 'changed');

            assert.ok(offlineIdx !== -1, 'info.offlineMachines soll aufgerufen worden sein');
            assert.ok(changedCalls.length > 0, 'Es sollen setStateChanged-Aufrufe geben');

            // Alle setStateChanged-Aufrufe sollen VOR info.offlineMachines liegen
            const lastChangedIdx = callOrder.lastIndexOf(callOrder.filter(e => e.fn === 'changed').pop());
            // Alternativ: offlineIdx muss der letzte Aufruf sein (nach allen changed)
            const allChangedBeforeOffline = changedCalls.every(e =>
                callOrder.indexOf(e) < offlineIdx
            );
            assert.ok(allChangedBeforeOffline,
                'Alle setStateChangedAsync-Aufrufe sollen VOR info.offlineMachines liegen');
        });

        it('fügt VM mit Name "undefined" zur offlineMachines-Liste hinzu', async () => {
            const adapter = makeAdapter([{ type: 'qemu', node: 'pve', vmid: 999, name: undefined, status: 'stopped', id: 'qemu/999' }]);

            await adapter.setMachines();

            const offlineMachinesJson = adapter._states['info.offlineMachines'];
            const offlineMachines = JSON.parse(offlineMachinesJson);
            assert.ok(offlineMachines['qemu/999'] === 'offline');
        });
    });

    describe('Neustart bei unbekannter VM', () => {
        it('ruft restart() auf wenn VM nicht in objects vorhanden', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            // Kein Objekt für die VM registriert

            await adapter.setMachines();

            assert.equal(adapter._restarted, true, 'Adapter soll restarted werden');
        });
    });

    describe('Fehlerbehandlung', () => {
        it('fängt getClusterResources-Fehler ab', async () => {
            const adapter = makeAdapter([]);
            adapter.proxmox.getClusterResources = async () => { throw new Error('timeout'); };

            await assert.doesNotReject(() => adapter.setMachines());
        });

        it('STOPPED von getClusterResources → kein warn/error-Log', async () => {
            const adapter = makeAdapter([]);
            adapter.proxmox.getClusterResources = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.warn.length,  0, 'Kein warn-Log bei STOPPED erwartet');
        });

        it('STOPPED von getResourceStatus (laufende VM) → kein error-Log', async () => {
            const adapter = makeAdapter([makeQemuResource({ status: 'running' })]);
            adapter.objects['proxmox.0.qemu_testvm'] = { type: 'channel', native: { type: 'qemu' } };
            adapter.proxmox.getResourceStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
        });

        it('STOPPED von getResourceStatus (laufendes LXC) → kein error-Log', async () => {
            const adapter = makeAdapter([makeLxcResource({ status: 'running' })]);
            adapter.objects['proxmox.0.lxc_testlxc'] = { type: 'channel', native: { type: 'lxc' } };
            adapter.proxmox.getResourceStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED (LXC) erwartet');
        });

        it('STOPPED von getStorageStatus → kein warn/error-Log, früher return', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], { config: { requestStorageInformation: true } });
            adapter.proxmox.getStorageStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.warn.length,  0, 'Kein warn-Log bei STOPPED erwartet');
        });

        it('STOPPED von getBackupStatus → kein warn/error-Log, früher return', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], {
                config: { requestStorageInformation: true, requestStorageInformationBackup: true },
            });
            adapter.proxmox.getBackupStatus = async () => { throw new Error('STOPPED'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log bei STOPPED erwartet');
            assert.equal(adapter._logs.warn.length,  0, 'Kein warn-Log bei STOPPED erwartet');
        });

        it('echter Storage-Fehler (HTTP 500) → warn-Log, kein Crash', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], { config: { requestStorageInformation: true } });
            adapter.proxmox.getStorageStatus = async () => { throw new Error('getStorageStatus für "local" auf "pve" fehlgeschlagen: HTTP 500'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.ok(adapter._logs.warn.some(m => m.includes('setMachines storageStatus')), 'warn-Log soll bei echtem Fehler erscheinen');
            assert.equal(adapter._logs.error.length, 0, 'Kein error-Log – Storage-Fehler ist warn-Level');
        });

        it('echter Backup-Fehler → warn-Log, kein Crash', async () => {
            const storageRes = { type: 'storage', node: 'pve', storage: 'local', status: 'available', shared: false };
            const adapter = makeAdapter([storageRes], {
                config: { requestStorageInformation: true, requestStorageInformationBackup: true },
            });
            adapter.proxmox.getBackupStatus = async () => { throw new Error('getBackupStatus fehlgeschlagen für local auf pve: HTTP 500'); };

            await assert.doesNotReject(() => adapter.setMachines());
            assert.ok(adapter._logs.warn.some(m => m.includes('setMachines backupStatus')), 'warn-Log soll bei echtem Backup-Fehler erscheinen');
        });
    });
});

// ─── Gleiche Namen (#702) ─────────────────────────────────────────────────────

describe('VMs/LXC mit gleichem Namen (#702)', () => {
    const twins = () => [
        makeLxcResource({ id: 'lxc/113', vmid: 113, name: 'iobroker', node: 'pve1' }),
        makeLxcResource({ id: 'lxc/120', vmid: 120, name: 'iobroker', node: 'pve2' }),
    ];

    for (const newTreeStructure of [false, true]) {
        const prefix = `proxmox.0.lxc${newTreeStructure ? '.' : '_'}`;

        describe(`newTreeStructure=${newTreeStructure}`, () => {
            it('legt für jede Maschine eigene Objekte an', async () => {
                const adapter = makeAdapter(twins(), { config: { newTreeStructure } });
                await adapter.createVM();

                assert.ok(adapter.objects[`${prefix}iobroker_113`]);
                assert.ok(adapter.objects[`${prefix}iobroker_120`]);
                assert.ok(!adapter.objects[`${prefix}iobroker`]);
            });

            it('jeder Button zeigt auf seine eigene VMID und seinen Node', async () => {
                const adapter = makeAdapter(twins(), { config: { newTreeStructure } });
                await adapter.createVM();

                assert.deepEqual(adapter.objects[`${prefix}iobroker_113.stop`].native, { node: 'pve1', type: 'lxc', vmid: 113 });
                assert.deepEqual(adapter.objects[`${prefix}iobroker_120.stop`].native, { node: 'pve2', type: 'lxc', vmid: 120 });
            });

            it('setMachines schreibt in die eigenen States, ohne Neustart', async () => {
                const adapter = makeAdapter(twins(), { config: { newTreeStructure } });
                await adapter.createVM();
                adapter.proxmox.getResourceStatus = async (node, type, vmid) => ({ mem: vmid * 1024 * 1024, maxmem: 1024 * 1024 * 1024 });

                await adapter.setMachines();

                assert.equal(adapter._restarted, false);
                assert.equal(adapter._states[`${prefix}iobroker_113.mem`], 113);
                assert.equal(adapter._states[`${prefix}iobroker_120.mem`], 120);
                assert.equal(adapter._states[`${prefix}iobroker.mem`], undefined);
            });

            it('das bisher gemeinsame Objekt zählt nicht mehr als vorhanden', async () => {
                const adapter = makeAdapter(twins(), { config: { newTreeStructure } });
                adapter.objects[`${prefix}iobroker`] = { type: 'channel', common: { name: 'iobroker' }, native: { type: 'lxc' } };

                const keep = await adapter.createVM();

                assert.deepEqual(keep, ['iobroker_113', 'iobroker_120'].map(name => `lxc${newTreeStructure ? '.' : '_'}${name}`));
            });
        });
    }

    it('die Reihenfolge der Ressourcen ändert die IDs nicht', async () => {
        const adapter = makeAdapter(twins().reverse());
        await adapter.createVM();

        assert.equal(adapter.objects['proxmox.0.lxc_iobroker_113.stop'].native.vmid, 113);
        assert.equal(adapter.objects['proxmox.0.lxc_iobroker_120.stop'].native.vmid, 120);
    });

    it('der Offline-Status behält den echten Namen', async () => {
        const adapter = makeAdapter([
            makeLxcResource({ vmid: 113, name: 'iobroker', status: 'stopped' }),
            makeLxcResource({ vmid: 120, name: 'iobroker', status: 'stopped' }),
        ]);
        await adapter.createVM();

        assert.ok(adapter.objects['proxmox.0.lxc_iobroker_113']);
        assert.equal(adapter.offlineResourceStatus.name, 'iobroker');
    });

    it('ohne Kollision bleibt die ID beim Namen', async () => {
        const adapter = makeAdapter([makeLxcResource({ vmid: 113, name: 'a' }), makeLxcResource({ vmid: 120, name: 'b' })]);
        await adapter.createVM();

        assert.ok(adapter.objects['proxmox.0.lxc_a']);
        assert.ok(adapter.objects['proxmox.0.lxc_b']);
    });

    it('qemu und lxc mit gleichem Namen kollidieren nicht', async () => {
        const adapter = makeAdapter([makeQemuResource({ vmid: 100, name: 'same' }), makeLxcResource({ vmid: 200, name: 'same' })]);
        await adapter.createVM();

        assert.ok(adapter.objects['proxmox.0.qemu_same']);
        assert.ok(adapter.objects['proxmox.0.lxc_same']);
    });

    it('Maschinen ohne Namen bleiben bei "undefined"', async () => {
        const adapter = makeAdapter([
            makeLxcResource({ id: 'lxc/113', vmid: 113, name: undefined, status: 'unknown' }),
            makeLxcResource({ id: 'lxc/120', vmid: 120, name: undefined, status: 'unknown' }),
        ]);
        await adapter.setMachines();

        assert.equal(adapter._restarted, false);
        assert.deepEqual(JSON.parse(adapter._states['info.offlineMachines']), { 'lxc/113': 'offline', 'lxc/120': 'offline' });
    });

    it('die ID bleibt, wenn Proxmox den Namen der anderen Maschine nicht mehr liefert', async () => {
        const adapter = makeAdapter(twins());
        await adapter.createVM();

        const onlyOneNamed = twins();
        onlyOneNamed[1].name = undefined;
        adapter.proxmox.getClusterResources = async () => onlyOneNamed;
        await adapter.setMachines();

        assert.equal(adapter._restarted, false);
        assert.ok(adapter._states['proxmox.0.lxc_iobroker_113.status']);
        assert.equal(adapter._states['proxmox.0.lxc_iobroker.status'], undefined);
    });

    it('die ID bleibt beim Neustart, auch wenn die andere Maschine entfernt wurde', async () => {
        const adapter = makeAdapter(twins());
        await adapter.createVM();

        adapter.proxmox.getClusterResources = async () => [twins()[0]];
        const keep = await adapter.createVM();

        assert.deepEqual(keep, ['lxc_iobroker_113']);
        assert.ok(!adapter.objects['proxmox.0.lxc_iobroker']);
    });

    it('eine zweite Maschine mit gleichem Namen führt zum Neustart', async () => {
        const adapter = makeAdapter([twins()[0]]);
        await adapter.createVM();
        assert.ok(adapter.objects['proxmox.0.lxc_iobroker']);

        adapter.proxmox.getClusterResources = async () => twins();
        await adapter.setMachines();

        assert.equal(adapter._restarted, true);
    });

    it('ein echter Name wie "web_100" fällt nicht mit "web" + VMID 100 zusammen', async () => {
        const adapter = makeAdapter([
            makeLxcResource({ vmid: 100, name: 'web' }),
            makeLxcResource({ vmid: 200, name: 'web' }),
            makeLxcResource({ vmid: 7, name: 'web_100' }),
        ]);
        await adapter.createVM();

        assert.equal(adapter.objects['proxmox.0.lxc_web_100.stop'].native.vmid, 100);
        assert.equal(adapter.objects['proxmox.0.lxc_web_200.stop'].native.vmid, 200);
        assert.equal(adapter.objects['proxmox.0.lxc_web_100_7.stop'].native.vmid, 7);
    });

    it('ein vorhandener Channel "web_100" einer anderen Maschine wird nicht übernommen', async () => {
        const adapter = makeAdapter([makeLxcResource({ vmid: 100, name: 'web' }), makeLxcResource({ vmid: 7, name: 'web_100' })]);
        adapter.objects['proxmox.0.lxc_web_100'] = { type: 'channel', common: { name: 'web_100' }, native: { type: 'lxc' } };

        await adapter.createVM();

        assert.equal(adapter.objects['proxmox.0.lxc_web.stop'].native.vmid, 100);
        assert.equal(adapter.objects['proxmox.0.lxc_web_100.stop'].native.vmid, 7);
    });
});

// ─── Abos (#703) ──────────────────────────────────────────────────────────────

describe('Button-Abos (#703)', () => {
    it('createVM abonniert keine einzelnen Buttons, subscribeStates("*") deckt sie ab', async () => {
        const subscribed = [];
        const adapter = makeAdapter([makeQemuResource()], { subscribeForeignStates: id => subscribed.push(id) });

        await adapter.createVM();

        assert.deepEqual(subscribed, []);
    });
});
