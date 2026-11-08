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
        assert.equal(vm.model, 'QEMU');
        assert.equal(vm.group.key, 'qemu');
        assert.equal(byId(devices, 'proxmox.0.node_pve').identifier, '10-0-0-1');
    });

    it('der Status kommt live aus dem State', async () => {
        const { devices } = await loadDevices(makeAdapter());

        const vm = byId(devices, 'proxmox.0.qemu_web').status.connection;
        assert.equal(vm.stateId, 'proxmox.0.qemu_web.status');
        assert.equal(vm.mapping.running, 'connected');
        assert.equal(vm.mapping.stopped, 'disconnected');
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
