'use strict';

/**
 * Tests für src/lib/widgets.ts: die Listen der devices-Widgets
 *
 * Ausführen: node --test test/widgets.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getChannelOptions, MACHINE_CHANNEL_TYPES, NODE_CHANNEL_TYPES } = require('../build/lib/widgets');

function makeAdapter(channels) {
    const calls = [];
    return {
        namespace: 'proxmox.0',
        calls,
        getForeignObjectsAsync: async (pattern, type) => {
            calls.push([pattern, type]);
            return channels;
        },
    };
}

describe('getChannelOptions()', () => {
    it('liest nur die Kanäle der eigenen Instanz', async () => {
        const adapter = makeAdapter({});
        await getChannelOptions(adapter, MACHINE_CHANNEL_TYPES);
        assert.deepEqual(adapter.calls, [['proxmox.0.*', 'channel']]);
    });

    it('liefert value, label und Typ mit ID als zweite Zeile', async () => {
        const list = await getChannelOptions(
            makeAdapter({
                'proxmox.0.lxc_web': { type: 'channel', common: { name: 'web' }, native: { type: 'lxc' } },
            }),
            MACHINE_CHANNEL_TYPES,
        );
        assert.deepEqual(list, [
            { value: 'proxmox.0.lxc_web', label: 'web', description: { en: 'LXC · lxc_web' }, noTranslation: true },
        ]);
    });

    it('filtert nach native.type und lässt andere Objekte weg', async () => {
        const channels = {
            'proxmox.0.qemu_a': { type: 'channel', common: { name: 'a' }, native: { type: 'qemu' } },
            'proxmox.0.node_pve': { type: 'channel', common: { name: 'pve' }, native: { type: 'node' } },
            'proxmox.0.storage_local': { type: 'channel', common: { name: 'local' }, native: { type: 'storage' } },
            'proxmox.0.info': { type: 'channel', common: { name: 'info' }, native: {} },
            'proxmox.0.lxc_state': { type: 'state', common: { name: 'x' }, native: { type: 'lxc' } },
            'proxmox.0.lxc_null': null,
        };
        assert.deepEqual(
            (await getChannelOptions(makeAdapter(channels), MACHINE_CHANNEL_TYPES)).map(o => o.value),
            ['proxmox.0.qemu_a'],
        );
        assert.deepEqual(
            (await getChannelOptions(makeAdapter(channels), NODE_CHANNEL_TYPES)).map(o => o.value),
            ['proxmox.0.node_pve'],
        );
    });

    it('sortiert nach Name, gleiche Namen nach ID', async () => {
        const list = await getChannelOptions(
            makeAdapter({
                'proxmox.0.qemu_web_101': { type: 'channel', common: { name: 'web' }, native: { type: 'qemu' } },
                'proxmox.0.qemu_web_100': { type: 'channel', common: { name: 'web' }, native: { type: 'qemu' } },
                'proxmox.0.lxc_backup': { type: 'channel', common: { name: 'backup' }, native: { type: 'lxc' } },
            }),
            MACHINE_CHANNEL_TYPES,
        );
        assert.deepEqual(
            list.map(o => o.value),
            ['proxmox.0.lxc_backup', 'proxmox.0.qemu_web_100', 'proxmox.0.qemu_web_101'],
        );
        // gleiche Namen unterscheidet die zweite Zeile
        assert.equal(list[1].description.en, 'QEMU · qemu_web_100');
    });

    it('nimmt bei übersetzten Namen en und ohne Namen die ID', async () => {
        const list = await getChannelOptions(
            makeAdapter({
                'proxmox.0.node_a': { type: 'channel', common: { name: { en: 'alpha', de: 'Alpha' } }, native: { type: 'node' } },
                'proxmox.0.node_b': { type: 'channel', common: {}, native: { type: 'node' } },
            }),
            NODE_CHANNEL_TYPES,
        );
        assert.deepEqual(list.map(o => o.label), ['alpha', 'node_b']);
    });

    it('kommt mit null von getForeignObjectsAsync zurecht', async () => {
        assert.deepEqual(await getChannelOptions(makeAdapter(null), NODE_CHANNEL_TYPES), []);
    });
});
