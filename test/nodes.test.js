'use strict';

/**
 * Tests für src/lib/nodes.ts (createNodes + setNodes)
 *
 * Ausführen:  node --test test/nodes.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createNodes, setNodes } = require('../build/lib/nodes');
const { bytetoMb, used_level, prepareNameForId, removeNamespace } = require('../build/lib/methods');

// ─── Adapter-Mock ─────────────────────────────────────────────────────────────

function makeAdapter(overrides = {}) {
    const states  = {};
    const objects = {};
    const logs    = { debug: [], info: [], warn: [], error: [] };

    const proxmox = {
        getNodeStatus: async () => ({
            uptime: 86400,
            wait: 0.01,
            memory: { used: 4 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, free: 12 * 1024 * 1024 * 1024 },
            swap:   { used: 0, free: 2 * 1024 * 1024 * 1024, total: 2 * 1024 * 1024 * 1024 },
            loadavg: ['0.5', '0.4', '0.3'],
        }),
        getNodeDisks: async () => [],
        getNodeDisksSmart: async () => null,
    };

    const adapter = {
        namespace: 'proxmox.0',
        config: {
            requestCephInformation: false,
            requestHAInformation:   false,
            requestDiskInformation: false,
            ...overrides.config,
        },
        objects,
        instanceIds: new Map(),
        // Die lib-Module nutzen die Adapter-Timer, im Mock laufen sie als echte Timer
        setTimeout:   (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (t) => clearTimeout(t),
        log: {
            debug: (m) => logs.debug.push(m),
            info:  (m) => logs.info.push(m),
            warn:  (m) => logs.warn.push(m),
            error: (m) => logs.error.push(m),
        },
        proxmox,
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

        bytetoMb,
        used_level,
        prepareNameForId,
        removeNamespace: removeNamespace.bind({ namespace: 'proxmox.0' }),

        createCustomState: async function(sid, name, type, val) {
            const key = `${sid}.${name}`;
            await this.setObjectNotExistsAsync(key, { type: 'state', common: { name }, native: {} });
            await this.setStateChangedAsync(key, { val, ack: true });
        },

        createCeph: async () => {},
        createHA:   async () => {},
        createVM:   async () => [],

        ...overrides,
    };

    adapter.createNodes = createNodes.bind(adapter);
    adapter.setNodes    = setNodes.bind(adapter);

    return adapter;
}

function makeNode(overrides = {}) {
    return {
        node: 'pve',
        type: 'node',
        status: 'online',
        cpu: 0.05,
        maxcpu: 8,
        ...overrides,
    };
}

// ─── Tests createNodes ────────────────────────────────────────────────────────

describe('createNodes', () => {

    it('legt Node-Channel-Objekt an', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode()]);

        assert.ok(adapter.objects['proxmox.0.node_pve'], 'Channel soll existieren');
    });

    it('legt Shutdown- und Reboot-Button-States an', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode()]);

        assert.ok(adapter.objects['proxmox.0.node_pve.shutdown']);
        assert.ok(adapter.objects['proxmox.0.node_pve.reboot']);
    });

    it('setzt Status-State', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode()]);

        assert.equal(adapter._states['proxmox.0.node_pve.status'], 'online');
    });

    it('erstellt CPU-State für Online-Node', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode({ cpu: 0.1 })]);

        assert.ok(adapter._states['proxmox.0.node_pve.cpu'] !== undefined, 'CPU-State soll existieren');
        assert.equal(adapter._states['proxmox.0.node_pve.cpu'], 10.0); // 0.1 * 10000 / 100
    });

    it('erstellt Memory-States aus nodeStatus', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode()]);

        assert.ok(adapter._states['proxmox.0.node_pve.memory.used'] !== undefined);
        assert.ok(adapter._states['proxmox.0.node_pve.memory.total'] !== undefined);
        assert.ok(adapter._states['proxmox.0.node_pve.memory.used_lev'] !== undefined);
    });

    it('überspringt Memory-States für Offline-Node', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode({ status: 'offline' })]);

        assert.equal(adapter._states['proxmox.0.node_pve.memory.used'], undefined);
    });

    it('gibt nur vorhandene Nodes und VMs zurück und löscht selbst nichts', async () => {
        const adapter = makeAdapter({ createVM: async () => ['qemu_vm'] });
        adapter.objects['proxmox.0.node_oldpve'] = { type: 'channel', native: { type: 'node' } };

        const keep = await adapter.createNodes([makeNode()]);

        assert.deepEqual(keep, ['node_pve', 'qemu_vm']);
        assert.ok(adapter.objects['proxmox.0.node_oldpve'], 'Gelöscht wird erst in getNodes()');
    });

    it('gibt null zurück wenn createVM nicht vollständig war', async () => {
        const adapter = makeAdapter({ createVM: async () => null });

        assert.equal(await adapter.createNodes([makeNode()]), null);
    });

    it('verarbeitet mehrere Nodes', async () => {
        const adapter = makeAdapter();
        await adapter.createNodes([makeNode({ node: 'pve1' }), makeNode({ node: 'pve2' })]);

        assert.ok(adapter.objects['proxmox.0.node_pve1']);
        assert.ok(adapter.objects['proxmox.0.node_pve2']);
    });

    it('fängt getNodeStatus-Fehler ab ohne Crash', async () => {
        const adapter = makeAdapter();
        adapter.proxmox.getNodeStatus = async () => { throw new Error('Connection refused'); };

        await assert.doesNotReject(() => adapter.createNodes([makeNode()]));
        assert.ok(adapter._logs.error.some(m => m.includes('Fehler beim Abrufen des Node-Status')));
    });
});

// ─── Tests setNodes ───────────────────────────────────────────────────────────

describe('setNodes', () => {

    it('aktualisiert Status-State für bekannten Node', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        await adapter.setNodes([makeNode()]);

        assert.equal(adapter._states['proxmox.0.node_pve.status'], 'online');
    });

    it('ruft restart() auf bei unbekanntem Online-Node', async () => {
        const adapter = makeAdapter();
        // Kein Objekt für pve registriert

        await adapter.setNodes([makeNode({ status: 'online' })]);

        assert.equal(adapter._restarted, true);
    });

    it('BUG FIX: setzt offline-Status NUR einmal', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        const statusCallIds = [];
        const origFn = adapter.setStateChangedAsync.bind(adapter);
        adapter.setStateChangedAsync = async (id, val) => {
            if (id.includes('.status')) statusCallIds.push(id);
            return origFn(id, val);
        };

        await adapter.setNodes([makeNode({ status: 'offline' })]);

        const offlineStatusCalls = statusCallIds.filter(id => id === 'proxmox.0.node_pve.status');
        assert.equal(offlineStatusCalls.length, 1, 'Status soll genau 1× gesetzt werden (kein Doppel-Set)');
    });

    it('leert die Laufzeit als Text, wenn der Node offline geht', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        const calls = [];
        const origFn = adapter.setStateChangedAsync.bind(adapter);
        adapter.setStateChangedAsync = async (id, val) => {
            calls.push([id, val]);
            return origFn(id, val);
        };

        await adapter.setNodes([makeNode({ status: 'offline' })]);

        assert.deepEqual(
            calls.find(([id]) => id === 'proxmox.0.node_pve.uptime_text'),
            ['proxmox.0.node_pve.uptime_text', { val: '', ack: true }],
        );
    });

    it('aktualisiert CPU-State für Online-Node', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        await adapter.setNodes([makeNode({ cpu: 0.25 })]);

        assert.equal(adapter._states['proxmox.0.node_pve.cpu'], 25.0); // 0.25 * 10000 / 100
    });

    it('aktualisiert Uptime aus NodeStatus', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        await adapter.setNodes([makeNode()]);

        assert.equal(adapter._states['proxmox.0.node_pve.uptime'], 86400);
    });

    it('aktualisiert Memory aus NodeStatus', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };

        await adapter.setNodes([makeNode()]);

        assert.ok(adapter._states['proxmox.0.node_pve.memory.used'] !== undefined);
    });

    it('fängt getNodeStatus-Fehler ab ohne Crash', async () => {
        const adapter = makeAdapter();
        adapter.objects['proxmox.0.node_pve'] = { type: 'channel', native: { type: 'node' } };
        adapter.proxmox.getNodeStatus = async () => { throw new Error('timeout'); };

        await assert.doesNotReject(() => adapter.setNodes([makeNode()]));
        assert.ok(adapter._logs.error.some(m => m.includes('Fehler beim Abrufen des Node-Status')));
    });
});

// ─── Abos (#703) ──────────────────────────────────────────────────────────────

describe('Button-Abos (#703)', () => {
    it('createNodes abonniert keine einzelnen Buttons, subscribeStates("*") deckt sie ab', async () => {
        const subscribed = [];
        const adapter = makeAdapter({ subscribeForeignStates: id => subscribed.push(id) });

        await adapter.createNodes([makeNode()]);

        assert.deepEqual(subscribed, []);
    });
});
