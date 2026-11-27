'use strict';

/**
 * Tests für src/lib/updates.ts und die Update-Prüfung in createNodes/setNodes
 *
 * Ausführen:  node --test test/updates.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createNodes, setNodes } = require('../build/lib/nodes');
const { refreshUpdates } = require('../build/lib/updates');
const { bytetoMb, used_level, prepareNameForId } = require('../build/lib/methods');

const SID = 'proxmox.0.node_pve';

const UPDATES = [
    { Package: 'pve-manager', OldVersion: '9.0.1', Version: '9.0.2', Origin: 'Proxmox', Title: 'Proxmox VE' },
    { Package: 'libc6', OldVersion: '2.41-11', Version: '2.41-12', Origin: 'Debian' },
];

/** Fehler, wie ihn axios bei einer von Proxmox abgelehnten Anfrage wirft */
function forbidden(right) {
    const err = new Error('Request failed with status code 403');
    err.response = { status: 403, statusText: `Permission check failed (/nodes/pve, ${right})` };
    return err;
}

function makeAdapter(config = {}, proxmoxOverrides = {}) {
    const states = {};
    const objects = {};
    const logs = { debug: [], info: [], warn: [], error: [] };
    const calls = { getNodeUpdates: 0, getTaskStatus: 0 };

    const proxmox = {
        hostId: 'cluster',
        getNodeStatus: async () => null,
        getNodeDisks: async () => [],
        getNodeDisksSmart: async () => null,
        getNodeUpdates: async () => {
            calls.getNodeUpdates++;
            return UPDATES;
        },
        refreshNodeUpdates: async () => ({ data: 'UPID:pve:00001234:aptupdate::root@pam:' }),
        getTaskStatus: async () => {
            calls.getTaskStatus++;
            return { status: 'stopped', exitstatus: 'OK' };
        },
        ...proxmoxOverrides,
    };

    const adapter = {
        namespace: 'proxmox.0',
        config: { requestUpdateInformation: true, updateCheckInterval: 60, ...config },
        objects,
        instanceIds: new Map(),
        // Kurze Wartezeiten (Abfrage der Aufgabe) sofort, lange (withTimeout) als echte Timer
        setTimeout: (fn, ms) => (ms <= 5000 ? (setImmediate(fn), { immediate: true }) : setTimeout(fn, ms)),
        clearTimeout: t => {
            if (t && !t.immediate) clearTimeout(t);
        },
        log: {
            debug: m => logs.debug.push(m),
            info: m => logs.info.push(m),
            warn: m => logs.warn.push(m),
            error: m => logs.error.push(m),
        },
        proxmox,
        _states: states,
        _logs: logs,
        _calls: calls,

        setObjectNotExistsAsync: async (id, obj) => {
            if (!objects[id]) objects[id] = obj;
        },
        extendObjectAsync: async (id, obj) => {
            objects[id] = { ...(objects[id] || {}), ...obj };
        },
        getForeignObjectAsync: async id => objects[id] ?? null,
        delForeignObjectAsync: async id => {
            for (const key of Object.keys(objects)) {
                if (key === id || key.startsWith(`${id}.`)) delete objects[key];
            }
        },
        setStateChangedAsync: async (id, val) => {
            states[id] = val.val;
        },
        restart: () => {},

        bytetoMb,
        used_level,
        prepareNameForId,
        createCustomState: async function (sid, name, type, val) {
            await this.setObjectNotExistsAsync(`${sid}.${name}`, { type: 'state', common: { name }, native: {} });
            await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
        },
        createCeph: async () => {},
        createHA: async () => {},
        createVM: async () => [],
    };

    adapter.createNodes = createNodes.bind(adapter);
    adapter.setNodes = setNodes.bind(adapter);
    return adapter;
}

const online = { node: 'pve', type: 'node', status: 'online', cpu: 0.05, maxcpu: 8 };

/** Wie nach createNodes: setNodes startet sonst neu, weil es den Node nicht kennt */
async function created(adapter, node = online) {
    await adapter.createNodes([node]);
    return adapter;
}

describe('createNodes – Objekte der Updates', () => {
    it('legt updates.count, updates.list und den Button updates.refresh an', async () => {
        const adapter = await created(makeAdapter());

        assert.equal(adapter.objects[`${SID}.updates`].type, 'folder');
        assert.equal(adapter.objects[`${SID}.updates.count`].common.type, 'number');
        assert.equal(adapter.objects[`${SID}.updates.list`].common.role, 'json');
        const button = adapter.objects[`${SID}.updates.refresh`];
        assert.equal(button.common.role, 'button');
        assert.deepEqual(button.native, { node: 'pve', type: 'node', host: 'cluster' });
    });

    it('legt die Objekte auch für einen Node an, der gerade offline ist', async () => {
        const adapter = await created(makeAdapter(), { ...online, status: 'offline' });
        assert.ok(adapter.objects[`${SID}.updates.count`]);
    });

    it('entfernt die Objekte, wenn die Option abgeschaltet wurde', async () => {
        const adapter = await created(makeAdapter());
        adapter.config.requestUpdateInformation = false;

        await adapter.createNodes([online]);

        assert.equal(Object.keys(adapter.objects).filter(id => id.startsWith(`${SID}.updates`)).length, 0);
        assert.ok(adapter.objects[`${SID}.reboot`], 'die anderen Objekte des Nodes bleiben');
    });

    it('legt ohne die Option nichts an und löscht nichts', async () => {
        const adapter = await created(makeAdapter({ requestUpdateInformation: false }));
        assert.equal(adapter.objects[`${SID}.updates`], undefined);
        assert.equal(adapter._logs.info.filter(m => m.includes('Removed')).length, 0);
    });
});

describe('setNodes – Update-Prüfung', () => {
    it('schreibt Anzahl und Liste, sortiert nach Paket', async () => {
        const adapter = await created(makeAdapter());
        await adapter.setNodes([online], true);

        assert.equal(adapter._states[`${SID}.updates.count`], 2);
        assert.deepEqual(JSON.parse(adapter._states[`${SID}.updates.list`]), [
            { package: 'libc6', oldVersion: '2.41-11', version: '2.41-12', origin: 'Debian' },
            { package: 'pve-manager', oldVersion: '9.0.1', version: '9.0.2', origin: 'Proxmox' },
        ]);
    });

    it('schreibt 0 und eine leere Liste, wenn es keine Updates gibt', async () => {
        const adapter = await created(makeAdapter({}, { getNodeUpdates: async () => [] }));
        await adapter.setNodes([online], true);

        assert.equal(adapter._states[`${SID}.updates.count`], 0);
        assert.equal(adapter._states[`${SID}.updates.list`], '[]');
    });

    it('fragt ohne checkUpdates nichts ab', async () => {
        const adapter = await created(makeAdapter());
        await adapter.setNodes([online]);
        assert.equal(adapter._calls.getNodeUpdates, 0);
    });

    it('überspringt einen Node, der offline ist', async () => {
        const adapter = await created(makeAdapter());
        await adapter.setNodes([{ ...online, status: 'offline' }], true);
        assert.equal(adapter._calls.getNodeUpdates, 0);
    });

    it('meldet ein fehlendes Recht als Warnung, ohne abzubrechen', async () => {
        const adapter = await created(
            makeAdapter({}, {
                getNodeUpdates: async () => {
                    throw forbidden('Sys.Audit');
                },
            }),
        );
        await adapter.setNodes([online], true);

        assert.ok(adapter._logs.warn.some(m => m.includes('HTTP 403') && m.includes('Sys.Audit')), adapter._logs.warn.join('\n'));
        assert.equal(adapter._states[`${SID}.updates.count`], undefined);
    });

    it('gibt STOPPED weiter, ohne zu loggen', async () => {
        const adapter = await created(
            makeAdapter({}, {
                getNodeUpdates: async () => {
                    throw new Error('STOPPED');
                },
            }),
        );
        await assert.rejects(adapter.setNodes([online], true), /STOPPED/);
        assert.equal(adapter._logs.warn.length, 0);
    });
});

describe('refreshUpdates – Button updates.refresh', () => {
    it('wartet auf apt-get update und liest danach die Updates', async () => {
        let polls = 0;
        const adapter = makeAdapter({}, {
            getTaskStatus: async () => (++polls < 3 ? { status: 'running' } : { status: 'stopped', exitstatus: 'OK' }),
        });

        await refreshUpdates(adapter, adapter.proxmox, SID, 'pve');

        assert.equal(polls, 3);
        assert.equal(adapter._states[`${SID}.updates.count`], 2);
        assert.equal(adapter._logs.warn.length, 0);
    });

    it('meldet, wenn apt-get update mit einem Fehler endet', async () => {
        const adapter = makeAdapter({}, {
            getTaskStatus: async () => ({ status: 'stopped', exitstatus: 'command apt-get update failed: exit code 100' }),
        });

        await refreshUpdates(adapter, adapter.proxmox, SID, 'pve');

        assert.ok(adapter._logs.warn.some(m => m.includes('exit code 100')));
        assert.equal(adapter._states[`${SID}.updates.count`], 2, 'die Liste wird trotzdem gelesen');
    });

    it('liest die Liste auch ohne das Recht Sys.Modify', async () => {
        const adapter = makeAdapter({}, {
            refreshNodeUpdates: async () => {
                throw forbidden('Sys.Modify');
            },
        });

        await refreshUpdates(adapter, adapter.proxmox, SID, 'pve');

        assert.ok(adapter._logs.warn.some(m => m.includes('Sys.Modify')));
        assert.equal(adapter._calls.getTaskStatus, 0);
        assert.equal(adapter._states[`${SID}.updates.count`], 2);
    });

    it('bleibt still, wenn der Adapter gestoppt wird', async () => {
        const adapter = makeAdapter({}, {
            refreshNodeUpdates: async () => {
                throw new Error('STOPPED');
            },
            getNodeUpdates: async () => {
                throw new Error('STOPPED');
            },
        });

        await refreshUpdates(adapter, adapter.proxmox, SID, 'pve');

        assert.equal(adapter._logs.warn.length, 0);
    });
});
