'use strict';

/**
 * Tests für lib/vms.js (createVM + setMachines)
 *
 * Ausführen:  node --test test/vms.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createVM, setMachines } = require('../lib/vms');
const { findState, bytetoMb, used_level, prepareNameForId, removeNamespace } = require('../lib/methods');

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

        it('löscht veraltete Ressourcen', async () => {
            const adapter = makeAdapter([makeQemuResource()]);
            // Altes Objekt vorab eintragen
            adapter.objects['proxmox.0.qemu_oldvm'] = { type: 'channel', common: { name: 'oldvm' }, native: { type: 'qemu' } };

            await adapter.createVM();

            assert.ok(!adapter.objects['proxmox.0.qemu_oldvm'], 'Altes Objekt soll gelöscht sein');
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

        it('BUG FIX: löscht veraltete Ressourcen auch bei Punkt-Format', async () => {
            const adapter = makeAdapter([makeQemuResource()], { config: { newTreeStructure: true } });
            // Altes Punkt-Format-Objekt vorab eintragen
            adapter.objects['proxmox.0.qemu.oldvm'] = { type: 'channel', common: { name: 'oldvm' }, native: { type: 'qemu' } };

            await adapter.createVM();

            assert.ok(!adapter.objects['proxmox.0.qemu.oldvm'], 'Altes Punkt-Objekt soll gelöscht sein');
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
    });
});
