'use strict';

/**
 * Tests für src/lib/DeviceManagement.ts
 *
 * Ausführen:  node --test test/deviceManagement.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { default: ProxmoxDeviceManagement } = require('../build/lib/DeviceManagement');

const channel = (name, type) => ({ type: 'channel', common: { name }, native: type ? { type } : {} });

function makeAdapter() {
    const logs = { debug: [], info: [], warn: [], error: [] };
    const buttons = {
        'proxmox.0.node_pve.reboot': { native: { type: 'node', node: 'pve', host: '10-0-0-1' } },
        'proxmox.0.node_pve.shutdown': { native: { type: 'node', node: 'pve', host: '10-0-0-1' } },
        'proxmox.0.qemu_web.stop': { native: { type: 'qemu', node: 'pve', vmid: 100, host: '10-0-0-1' } },
        'proxmox.0.qemu_web.start': { native: { type: 'qemu', node: 'pve', vmid: 100, host: '10-0-0-1' } },
        'proxmox.0.lxc_db.stop': { native: { type: 'lxc', node: 'pve', vmid: 200, host: '10-0-0-1' } },
    };
    const states = {
        'proxmox.0.qemu_web.cpus': { val: 2 },
        'proxmox.0.qemu_web.maxmem': { val: 4096 },
        'proxmox.0.lxc_db.cpus': { val: 1 },
        'proxmox.0.lxc_db.maxmem': { val: 512 },
        'proxmox.0.node_pve.cpu_max': { val: 8 },
        'proxmox.0.node_pve.memory.total': { val: 32768 },
    };
    const stateObjects = {
        'proxmox.0.qemu_web.uptime_text': {},
        'proxmox.0.qemu_web.mem': {},
        'proxmox.0.node_pve.loadavg.0': {},
    };
    return {
        _logs: logs,
        _polls: [],
        namespace: 'proxmox.0',
        objects: {
            'proxmox.0.node_pve': channel('pve', 'node'),
            'proxmox.0.qemu_web': channel('web', 'qemu'),
            'proxmox.0.lxc_db': channel('db', 'lxc'),
            'proxmox.0.storage_local': channel('local', 'storage'),
            'proxmox.0.ceph': channel('ceph'),
        },
        log: {
            debug: m => logs.debug.push(m),
            info: m => logs.info.push(m),
            warn: m => logs.warn.push(m),
            error: m => logs.error.push(m),
        },
        on: () => {},
        getForeignObjectAsync: async id => buttons[id] ?? null,
        getForeignStateAsync: async id => states[id] ?? null,
        getForeignObjectsAsync: async pattern =>
            Object.fromEntries(
                Object.entries(stateObjects).filter(([id]) => id.startsWith(pattern.replace('*', ''))),
            ),
        getHostAddress: native => (native.host === '10-0-0-1' ? '10.0.0.1' : undefined),
        getButtonAction: () => async () => ({ data: 'UPID' }),
        sendRequest(delay) {
            this._polls.push(delay);
        },
    };
}

async function loadDevices(adapter) {
    const dm = new ProxmoxDeviceManagement(adapter);
    const devices = [];
    let total;
    await dm.loadDevices({
        addDevice: device => devices.push(device),
        setTotalDevices: count => {
            total = count;
        },
    });
    return { dm, devices, total };
}

const byId = (devices, id) => devices.find(device => device.id === id);
const action = (device, id) => device.actions.find(a => a.id === id);

describe('DeviceManagement', () => {
    it('listet Nodes, VMs und Container, aber weder Storage noch Ceph', async () => {
        const { devices, total } = await loadDevices(makeAdapter());

        assert.deepEqual(devices.map(device => device.id).sort(), ['proxmox.0.lxc_db', 'proxmox.0.node_pve', 'proxmox.0.qemu_web']);
        assert.equal(total, 3);
    });

    it('zeigt den Namen und die Kennung der Maschine', async () => {
        const { devices } = await loadDevices(makeAdapter());

        const vm = byId(devices, 'proxmox.0.qemu_web');
        assert.equal(vm.name, 'web');
        assert.equal(vm.identifier, 'VMID 100, pve');
        assert.equal(vm.group.key, 'qemu');
        assert.equal(byId(devices, 'proxmox.0.node_pve').identifier, '10.0.0.1');
    });

    it('das Modell nennt Typ, CPUs und RAM', async () => {
        const { devices } = await loadDevices(makeAdapter());

        assert.equal(byId(devices, 'proxmox.0.qemu_web').model, 'QEMU · 2 vCPU · 4 GiB');
        assert.equal(byId(devices, 'proxmox.0.lxc_db').model, 'LXC · 1 vCPU · 512 MiB');
        assert.equal(byId(devices, 'proxmox.0.node_pve').model, 'Proxmox VE · 8 CPU · 32 GiB');
    });

    it('das Modell lässt weg, was noch nicht bekannt ist', async () => {
        const adapter = makeAdapter();
        adapter.getForeignStateAsync = async () => null;
        const { devices } = await loadDevices(adapter);

        assert.equal(byId(devices, 'proxmox.0.qemu_web').model, 'QEMU');
    });

    it('jede Karte hat ein Symbol als Base64-SVG, das dem Status folgt', async () => {
        const { devices } = await loadDevices(makeAdapter());

        for (const device of devices) {
            assert.match(device.icon, /^data:image\/svg\+xml;base64,/);
            assert.ok(Buffer.from(device.icon.split(',')[1], 'base64').toString().includes('currentColor'));
            assert.equal(device.backgroundColor.stateId, `${device.id}.status`);
        }
        const vm = byId(devices, 'proxmox.0.qemu_web').backgroundColor.mapping;
        assert.notEqual(vm.running, vm.stopped);
    });

    it('keine Anzeige und kein Befehl nutzt einen fa-Namen, der Admin zeigt dafür ein Fragezeichen', async () => {
        const { devices } = await loadDevices(makeAdapter());

        for (const device of devices) {
            for (const item of [...device.indicators, ...device.actions]) {
                assert.ok(!String(item.icon).startsWith('fa-'), `${device.id}: ${item.id}`);
            }
        }
    });

    it('der Status hat je Wert eine Farbe und einen übersetzten Text', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const levels = device => device.indicators.find(i => i.id === 'status').levels;
        const level = (device, value) => levels(device).find(l => l.value === value);

        const vm = byId(devices, 'proxmox.0.qemu_web');
        assert.equal(level(vm, 'running').color, 'ok');
        assert.equal(level(vm, 'running').text.de, 'Läuft');
        assert.equal(level(vm, 'stopped').color, 'inactive');
        assert.equal(level(vm, 'paused').color, 'warning');
        assert.equal(level(vm, 'offline').color, 'error');

        const node = byId(devices, 'proxmox.0.node_pve');
        assert.equal(level(node, 'online').color, 'ok');
        assert.equal(level(node, 'offline').color, 'error');
    });

    it('die Laufzeit kommt aus dem lesbaren State', async () => {
        const { devices } = await loadDevices(makeAdapter());

        for (const device of devices) {
            assert.equal(device.indicators.find(i => i.id === 'uptime').value.stateId, `${device.id}.uptime_text`);
        }
    });

    it('Auslastungen werden bei hohen Werten gelb und rot', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const { levels } = byId(devices, 'proxmox.0.qemu_web').indicators.find(i => i.id === 'cpu');
        const colorOf = value =>
            levels.find(l => (l.min === undefined || value >= l.min) && (l.max === undefined || value <= l.max)).color;

        assert.equal(colorOf(0), 'inactive');
        assert.equal(colorOf(40), 'ok');
        assert.equal(colorOf(80), 'warning');
        assert.equal(colorOf(95), 'error');
    });

    it('nur Container und Nodes zeigen Disk und Swap, bei QEMU sind sie nicht verlässlich', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const ids = id => byId(devices, id).indicators.map(i => i.id);

        assert.deepEqual(ids('proxmox.0.qemu_web'), ['status', 'uptime', 'cpu', 'memory']);
        assert.deepEqual(ids('proxmox.0.lxc_db'), ['status', 'uptime', 'cpu', 'memory', 'disk', 'swap']);
        assert.deepEqual(ids('proxmox.0.node_pve'), ['status', 'uptime', 'cpu', 'memory', 'swap']);
    });

    it('die Details zeigen nur States, die es gibt', async () => {
        const { dm, devices } = await loadDevices(makeAdapter());
        assert.equal(byId(devices, 'proxmox.0.qemu_web').hasDetails, true);

        const { schema } = await dm.getDeviceDetails('proxmox.0.qemu_web');
        const oids = Object.values(schema.items).map(item => item.oid);
        assert.deepEqual(oids, ['proxmox.0.qemu_web.uptime_text', 'proxmox.0.qemu_web.mem']);
        assert.ok(Object.values(schema.items).every(item => item.type === 'state' && item.foreign && item.readOnly));
    });

    it('in den Details beginnt jede Gruppe eine neue Zeile', async () => {
        const { dm } = await loadDevices(makeAdapter());

        const { schema } = await dm.getDeviceDetails('proxmox.0.qemu_web');
        assert.deepEqual(Object.values(schema.items).map(item => item.newLine), [true, true]);
    });

    it('die Details lassen bei QEMU Disk und Swap weg, auch wenn es die States gibt', async () => {
        const adapter = makeAdapter();
        adapter.getForeignObjectsAsync = async () => ({
            'proxmox.0.qemu_web.disk': {},
            'proxmox.0.qemu_web.swap': {},
            'proxmox.0.qemu_web.maxdisk': {},
            'proxmox.0.lxc_db.disk': {},
        });
        const { dm } = await loadDevices(adapter);

        const oids = async id => Object.values((await dm.getDeviceDetails(id)).schema.items).map(item => item.oid);
        assert.deepEqual(await oids('proxmox.0.qemu_web'), ['proxmox.0.qemu_web.maxdisk']);
        assert.deepEqual(await oids('proxmox.0.lxc_db'), ['proxmox.0.lxc_db.disk']);
    });

    it('in den Details enthält kein Feldname einen Punkt', async () => {
        const { dm } = await loadDevices(makeAdapter());

        const { schema } = await dm.getDeviceDetails('proxmox.0.node_pve');
        assert.deepEqual(Object.values(schema.items).map(item => item.oid), ['proxmox.0.node_pve.loadavg.0']);
        assert.ok(Object.keys(schema.items).every(key => !key.includes('.')));
    });

    it('für einen unbekannten Channel gibt es keine Details', async () => {
        const { dm } = await loadDevices(makeAdapter());

        assert.equal(await dm.getDeviceDetails('proxmox.0.ceph'), null);
    });

    it('der Status kommt live aus dem State', async () => {
        const { devices } = await loadDevices(makeAdapter());

        const vm = byId(devices, 'proxmox.0.qemu_web').status.connection;
        assert.equal(vm.stateId, 'proxmox.0.qemu_web.status');
        assert.equal(vm.mapping.running, 'connected');
        assert.equal(vm.mapping.offline, 'disconnected');
        assert.equal(vm.mapping.stopped, undefined, 'Eine gestoppte VM ist kein Verbindungsfehler');
        assert.equal(byId(devices, 'proxmox.0.node_pve').status.connection.mapping.online, 'connected');
    });

    it('nutzt für den RAM die States des jeweiligen Typs', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const memory = device => device.indicators.find(i => i.id === 'memory').value.stateId;

        assert.equal(memory(byId(devices, 'proxmox.0.qemu_web')), 'proxmox.0.qemu_web.mem_lev');
        assert.equal(memory(byId(devices, 'proxmox.0.node_pve')), 'proxmox.0.node_pve.memory.used_lev');
    });

    it('nur Start läuft ohne Rückfrage', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const vm = byId(devices, 'proxmox.0.qemu_web');

        assert.deepEqual(vm.actions.map(a => a.id), ['start', 'shutdown', 'reboot', 'stop']);
        assert.equal(action(vm, 'start').confirmation, undefined);
        for (const id of ['shutdown', 'reboot', 'stop']) {
            assert.ok(action(vm, id).confirmation?.de, `${id} braucht eine Rückfrage`);
        }
        assert.match(action(vm, 'stop').confirmation.de, /ohne sauberes Herunterfahren/);
    });

    it('ein Node kann nur herunterfahren und neu starten', async () => {
        const { devices } = await loadDevices(makeAdapter());
        const node = byId(devices, 'proxmox.0.node_pve');

        assert.deepEqual(node.actions.map(a => a.id), ['shutdown', 'reboot']);
        assert.ok(node.actions.every(a => a.confirmation?.en));
    });

    it('führt den Befehl über getButtonAction aus und fragt danach neu ab', async () => {
        const adapter = makeAdapter();
        const calls = [];
        adapter.getButtonAction = (native, command) => {
            calls.push([native.vmid, command]);
            return async () => ({ data: 'UPID' });
        };
        const { devices } = await loadDevices(adapter);

        const vm = byId(devices, 'proxmox.0.qemu_web');
        const result = await action(vm, 'start').handler(vm.id, { showMessage: async () => {} });

        assert.deepEqual(calls, [[100, 'start']]);
        assert.deepEqual(adapter._polls, [10000]);
        assert.deepEqual(result, { refresh: 'none' });
    });

    it('zeigt einen Fehler an und fragt nicht neu ab', async () => {
        const adapter = makeAdapter();
        adapter.getButtonAction = () => async () => {
            throw new Error('HTTP 500');
        };
        const { devices } = await loadDevices(adapter);
        const messages = [];

        const vm = byId(devices, 'proxmox.0.qemu_web');
        const result = await action(vm, 'stop').handler(vm.id, { showMessage: async m => messages.push(m) });

        assert.deepEqual(messages, ['stop: HTTP 500']);
        assert.deepEqual(adapter._polls, []);
        assert.deepEqual(result, { refresh: 'none' });
        assert.ok(adapter._logs.warn.some(m => m.includes('HTTP 500')));
    });

    it('meldet einen Button, den es nicht mehr gibt', async () => {
        const adapter = makeAdapter();
        const { devices } = await loadDevices(adapter);
        const messages = [];

        const vm = byId(devices, 'proxmox.0.qemu_web');
        await action(vm, 'reboot').handler(vm.id, { showMessage: async m => messages.push(m) });

        assert.equal(messages.length, 1);
        assert.match(messages[0], /Unknown command/);
    });
});
