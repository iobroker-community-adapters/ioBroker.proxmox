'use strict';

/**
 * Ausführliche Tests für main.js – Proxmox ioBroker Adapter
 *
 * Ausführen: node --test test/main.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Adapter-Mock ─────────────────────────────────────────────────────────────

/**
 * Erstellt einen vollständigen ioBroker-Adapter-Mock der alle
 * relevanten API-Methoden als spyable Stubs bereitstellt.
 */
function makeAdapter(configOverrides = {}) {
    const calls   = {};
    const objects = {};
    const states  = {};
    const logs    = { debug: [], info: [], warn: [], error: [] };
    const timers  = [];

    const track = (name, ...args) => {
        calls[name] = calls[name] || [];
        calls[name].push(args);
    };

    const defaultConfig = {
        tableDevices: [
            { enabled: true, realmIp: '10.0.0.1', realmPort: 8006,
              realmUser: 'root', realmPassword: 'secret', realm: 'pam' },
        ],
        requestInterval:              30,
        requestDiskInformation:       false,
        requestCephInformation:       false,
        requestHAInformation:         false,
        requestStorageInformation:    false,
        requestStorageInformationBackup: false,
        newTreeStructure:             false,
    };

    const adapter = {
        namespace: 'proxmox.0',
        config:    { ...defaultConfig, ...configOverrides },
        _calls:    calls,
        _objects:  objects,
        _states:   states,
        _logs:     logs,
        _timers:   timers,

        log: {
            debug: (m) => logs.debug.push(m),
            info:  (m) => logs.info.push(m),
            warn:  (m) => logs.warn.push(m),
            error: (m) => logs.error.push(m),
        },

        // State-Methoden
        setStateAsync: async (id, val) => {
            track('setStateAsync', id, val);
            states[id] = val;
        },
        setStateChangedAsync: async (id, val) => {
            track('setStateChangedAsync', id, val);
            states[id] = val;
        },
        getStateAsync: async (id) => states[id] ?? null,
        getForeignObjectAsync: async (id) => objects[id] ?? null,
        getForeignObjectsAsync: async (pattern, type) => {
            track('getForeignObjectsAsync', pattern, type);
            // Gibt alle Objekte zurück die zum Muster passen
            const result = {};
            for (const [k, v] of Object.entries(objects)) {
                if (!type || v.type === type) result[k] = v;
            }
            return result;
        },

        // Objekt-Methoden
        setObjectNotExistsAsync: async (id, obj) => {
            track('setObjectNotExistsAsync', id, obj);
            if (!objects[id]) objects[id] = obj;
        },
        extendObjectAsync: async (id, obj) => {
            track('extendObjectAsync', id, obj);
            objects[id] = { ...objects[id], ...obj };
        },
        delObjectAsync: async (id, opts) => {
            track('delObjectAsync', id, opts);
            // Rekursiv alle Childs löschen
            for (const k of Object.keys(objects)) {
                if (k === `proxmox.0.${id}` || k.startsWith(`proxmox.0.${id}.`)) {
                    delete objects[k];
                }
            }
        },
        delForeignObjectAsync: async (id) => {
            track('delForeignObjectAsync', id);
            delete objects[id];
        },

        // Subscribe
        subscribeForeignStates:  (...a) => track('subscribeForeignStates', ...a),
        subscribeStatesAsync:    async (...a) => track('subscribeStatesAsync', ...a),

        // Timer
        setTimeout: (fn, delay) => {
            const id = timers.length;
            timers.push({ fn, delay, id, cancelled: false });
            track('setTimeout', delay);
            return id;
        },
        clearTimeout: (id) => {
            track('clearTimeout', id);
            if (timers[id]) timers[id].cancelled = true;
        },

        // Lifecycle
        restart: () => track('restart'),
        terminate: (code) => track('terminate', code),
        sendTo: (...a) => track('sendTo', ...a),
    };

    return adapter;
}

/**
 * Erzeugt eine Proxmox-Instanz OHNE echten Adapter-Elternkonstruktor.
 * Wir laden main.js als Funktion und injizieren den Mock.
 */
function makeProxmoxInstance(configOverrides = {}, proxmoxApiMock = null) {
    // main.js exportiert eine Fabrik-Funktion wenn module.parent gesetzt ist
    // Wir mocken @iobroker/adapter-core
    const adapterCorePath = require.resolve('@iobroker/adapter-core');
    const realAdapterCore = require.cache[adapterCorePath];

    const adapter = makeAdapter(configOverrides);

    // utils.Adapter-Mock: Proxmox erbt davon → wir machen eine flache Klasse
    const FakeAdapter = class {
        constructor() {
            Object.assign(this, adapter);
            this._eventHandlers = {};
        }
        on(event, fn) { this._eventHandlers[event] = fn; }
        emit(event, ...args) {
            if (this._eventHandlers[event]) return this._eventHandlers[event](...args);
        }
    };

    const fakeCore = { Adapter: FakeAdapter };
    require.cache[adapterCorePath] = { exports: fakeCore };

    // main.js neu laden
    const mainPath = require.resolve('../main.js');
    delete require.cache[mainPath];
    const mainFactory = require('../main.js');

    // Adapter-Core wiederherstellen
    require.cache[adapterCorePath] = realAdapterCore;
    delete require.cache[mainPath];

    // Instanz erzeugen
    const inst = mainFactory({});

    // Alle Adapter-Mock-Methoden auf die Instanz kopieren
    Object.assign(inst, adapter);
    inst._adapter = adapter;

    // ProxmoxUtils-Mock injizieren
    if (proxmoxApiMock) {
        inst.proxmox = proxmoxApiMock;
    }

    return inst;
}

// ─── ProxmoxUtils-Mock Fabrik ─────────────────────────────────────────────────

function makeProxmoxMock(overrides = {}) {
    return {
        ticket:             async () => {},
        stop:               () => {},
        resetResponseCache: () => {},
        getNodes:           async () => [],
        getNodeStatus:      async () => null,
        getNodeDisks:       async () => [],
        getNodeDisksSmart:  async () => null,
        getCephInformation: async () => null,
        getHAStatusInformation: async () => null,
        getClusterResources: async () => [],
        getResourceStatus:   async () => ({}),
        getStorageStatus:    async () => ({}),
        getBackupStatus:     async () => [],
        qemuStart:           async () => ({ data: 'UPID:...' }),
        qemuStop:            async () => ({ data: 'UPID:...' }),
        qemuShutdown:        async () => ({ data: 'UPID:...' }),
        qemuReset:           async () => ({ data: 'UPID:...' }),
        qemuSuspend:         async () => ({ data: 'UPID:...' }),
        qemuResume:          async () => ({ data: 'UPID:...' }),
        qemuReboot:          async () => ({ data: 'UPID:...' }),
        nodeShutdown:        async () => ({ data: 'UPID:...' }),
        nodeReboot:          async () => ({ data: 'UPID:...' }),
        ...overrides,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── initConfig ───────────────────────────────────────────────────────────────

describe('initConfig()', () => {
    it('gibt false zurück wenn tableDevices leer', async () => {
        const inst = makeProxmoxInstance({ tableDevices: [] });
        const result = await inst.initConfig();
        assert.equal(result, false);
    });

    it('gibt true zurück bei gültiger Konfiguration', async () => {
        const inst = makeProxmoxInstance();
        const result = await inst.initConfig();
        assert.equal(result, true);
    });

    it('fügt nur aktivierte Geräte zur nodesList hinzu', async () => {
        const inst = makeProxmoxInstance({
            tableDevices: [
                { enabled: true,  realmIp: '1.1.1.1', realmPort: 8006, realmUser: 'root', realmPassword: 'pw', realm: 'pam' },
                { enabled: false, realmIp: '2.2.2.2', realmPort: 8006, realmUser: 'root', realmPassword: 'pw', realm: 'pam' },
                { enabled: true,  realmIp: '3.3.3.3', realmPort: 8006, realmUser: 'admin', realmPassword: 'pw2', realm: 'ldap' },
            ],
        });
        await inst.initConfig();
        assert.equal(inst.nodesList.length, 2);
        assert.equal(inst.nodesList[0].realmIp, '1.1.1.1');
        assert.equal(inst.nodesList[1].realmIp, '3.3.3.3');
    });

    it('korrigiert requestInterval < 5 auf 5', async () => {
        const inst = makeProxmoxInstance({ requestInterval: 2 });
        await inst.initConfig();
        assert.equal(inst.config.requestInterval, 5);
    });

    it('lässt requestInterval >= 5 unverändert', async () => {
        const inst = makeProxmoxInstance({ requestInterval: 60 });
        await inst.initConfig();
        assert.equal(inst.config.requestInterval, 60);
    });

    it('loggt info wenn Intervall korrigiert wird', async () => {
        const inst = makeProxmoxInstance({ requestInterval: 3 });
        await inst.initConfig();
        assert.ok(inst._logs.info.some(m => m.includes('5s')));
    });

    it('mappt alle Felder eines nodeDevice korrekt', async () => {
        const inst = makeProxmoxInstance({
            tableDevices: [
                { enabled: true, realmIp: '192.168.1.5', realmPort: 8007,
                  realmUser: 'admin', realmPassword: 'geheim', realm: 'ldap' },
            ],
        });
        await inst.initConfig();
        const node = inst.nodesList[0];
        assert.equal(node.realmIp,       '192.168.1.5');
        assert.equal(node.realmPort,     8007);
        assert.equal(node.realmUser,     'admin');
        assert.equal(node.realmPassword, 'geheim');
        assert.equal(node.realm,         'ldap');
    });
});

// ─── parseNotificationInfo ────────────────────────────────────────────────────

describe('parseNotificationInfo()', () => {
    let inst;
    beforeEach(() => { inst = makeProxmoxInstance(); });

    it('gibt null-Felder zurück bei nicht-String-Eingabe', async () => {
        for (const val of [null, undefined, 42, {}, []]) {
            const r = await inst.parseNotificationInfo(val);
            assert.equal(r.severity,  null);
            assert.equal(r.title,     null);
            assert.equal(r.message,   null);
            assert.equal(r.timestamp, null);
        }
    });

    it('gibt message zurück wenn kein Trenner vorhanden', async () => {
        const r = await inst.parseNotificationInfo('Einfache Nachricht ohne Trenner');
        assert.equal(r.severity,  null);
        assert.equal(r.title,     null);
        assert.equal(r.message,   'Einfache Nachricht ohne Trenner');
        assert.equal(r.timestamp, null);
    });

    it('parst vollständiges Format: severity***title***message***timestamp', async () => {
        const r = await inst.parseNotificationInfo('warning*** Backup failed ***Disk full on pve1***1700000000');
        assert.equal(r.severity,  'warning');
        assert.equal(r.title,     'Backup failed');
        assert.ok(r.message.includes('Disk full'));
        assert.equal(r.timestamp, 1700000000);
    });

    it('gibt null für timestamp zurück wenn nicht numerisch', async () => {
        const r = await inst.parseNotificationInfo('error***Titel***Meldung***kein-timestamp');
        assert.equal(r.timestamp, null);
    });

    it('gibt message zurück und severity=null wenn nur ein Trenner vorhanden', async () => {
        const r = await inst.parseNotificationInfo('info***Rest der Nachricht');
        // firstSep === lastSep → ungültiges Format → severity bleibt null
        assert.equal(r.severity, null);
        assert.equal(r.title,    null);
        assert.ok(r.message.length > 0);
    });

    it('trimmt Whitespace von severity und title', async () => {
        const r = await inst.parseNotificationInfo('  critical  ***  My Title  ***body***1234');
        assert.equal(r.severity, 'critical');
        assert.equal(r.title,    'My Title');
    });

    it('entfernt \\r aus message', async () => {
        const r = await inst.parseNotificationInfo('sev***title***line1\r\nline2***9999');
        assert.ok(!r.message?.includes('\r'), 'message enthält noch \\r');
    });
});

// ─── createCustomState ────────────────────────────────────────────────────────

describe('createCustomState()', () => {
    let inst;
    beforeEach(() => { inst = makeProxmoxInstance(); });

    const cases = [
        { type: 'time',        unit: 'sec.',  jsType: 'number', val: 3600  },
        { type: 'size',        unit: 'MiB',   jsType: 'number', val: 1024  },
        { type: 'sizeb',       unit: 'byte',  jsType: 'number', val: 65536 },
        { type: 'level',       unit: '%',     jsType: 'number', val: 75.5  },
        { type: 'default_num', unit: undefined, jsType: 'number', val: 42  },
        { type: 'text',        unit: undefined, jsType: 'string', val: 'ok' },
    ];

    for (const { type, unit, jsType, val } of cases) {
        it(`erstellt Objekt und setzt State für Typ "${type}"`, async () => {
            await inst.createCustomState('proxmox.0.node_pve', `test_${type}`, type, val);

            // Objekt wurde angelegt
            const objCalls = inst._calls['setObjectNotExistsAsync'] || [];
            const objCall  = objCalls.find(c => c[0].includes(`test_${type}`));
            assert.ok(objCall, `setObjectNotExistsAsync nicht aufgerufen für ${type}`);
            assert.equal(objCall[1].common.type, jsType);
            if (unit) assert.equal(objCall[1].common.unit, unit);

            // State wurde gesetzt
            const stateCalls = inst._calls['setStateChangedAsync'] || [];
            const stateCall  = stateCalls.find(c => c[0].includes(`test_${type}`));
            assert.ok(stateCall, `setStateChangedAsync nicht aufgerufen für ${type}`);
            assert.equal(stateCall[1].val, val);
            assert.equal(stateCall[1].ack, true);
        });
    }

    it('loggt warn und macht nichts bei unbekanntem Typ', async () => {
        await inst.createCustomState('proxmox.0.node_pve', 'x', 'unbekannt', 1);
        assert.ok(inst._logs.warn.some(m => m.includes('unknown type')));
        assert.equal((inst._calls['setObjectNotExistsAsync'] || []).length, 0);
        assert.equal((inst._calls['setStateChangedAsync'] || []).length, 0);
    });

    it('setzt role immer auf "value"', async () => {
        await inst.createCustomState('proxmox.0.node_pve', 'mystate', 'level', 50);
        const obj = inst._calls['setObjectNotExistsAsync'][0][1];
        assert.equal(obj.common.role, 'value');
    });

    it('setzt read=true und write=false', async () => {
        await inst.createCustomState('proxmox.0.node_pve', 'mystate', 'text', 'ok');
        const obj = inst._calls['setObjectNotExistsAsync'][0][1];
        assert.equal(obj.common.read,  true);
        assert.equal(obj.common.write, false);
    });
});

// ─── onUnload ─────────────────────────────────────────────────────────────────

describe('onUnload()', () => {
    it('ruft callback auf', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [];
        inst.objects = {};
        let called = false;
        await new Promise(resolve => inst.onUnload(() => { called = true; resolve(); }));
        assert.equal(called, true);
    });

    it('ruft proxmox.stop() auf wenn proxmox vorhanden', async () => {
        const inst = makeProxmoxInstance();
        let stopped = false;
        const mockProxmox = makeProxmoxMock({ stop: () => { stopped = true; } });
        inst.proxmox = mockProxmox;
        inst.proxmoxInstances = [mockProxmox];
        inst.objects = {};
        await new Promise(resolve => inst.onUnload(resolve));
        assert.equal(stopped, true);
    });

    it('löscht requestInterval wenn gesetzt', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [];
        inst.objects = {};
        inst.requestInterval = 42;
        await new Promise(resolve => inst.onUnload(resolve));
        assert.ok((inst._calls['clearTimeout'] || []).some(c => c[0] === 42));
    });

    it('ruft callback auch bei Exception auf', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [{ stop: () => { throw new Error('crash'); } }];
        inst.objects = {};
        let called = false;
        // Exception im try-Block → catch → callback()
        inst.onUnload(() => { called = true; });
        assert.equal(called, true);
    });

    it('setzt info.connection auf false beim Stopp', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [];
        inst.objects = {};
        await new Promise(resolve => inst.onUnload(resolve));
        const calls = inst._calls['setStateAsync'] || [];
        assert.ok(
            calls.some(c => c[0] === 'info.connection' && c[1]?.val === false),
            'info.connection soll auf false gesetzt werden'
        );
    });

    it('setzt available=false für alle qemu/lxc-Objekte beim Stopp', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [];
        inst.objects = {
            'proxmox.0.qemu_myvm':  { type: 'channel', native: { type: 'qemu' } },
            'proxmox.0.lxc_myct':   { type: 'channel', native: { type: 'lxc'  } },
            'proxmox.0.node_pve':    { type: 'channel', native: { type: 'node' } },
        };
        await new Promise(resolve => inst.onUnload(resolve));
        const calls = inst._calls['setStateAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('qemu_myvm.available') && c[1]?.val === false));
        assert.ok(calls.some(c => c[0].includes('lxc_myct.available')  && c[1]?.val === false));
        // Node soll NICHT auf available=false gesetzt werden
        assert.ok(!calls.some(c => c[0].includes('node_pve.available')));
    });

    it('setzt available NICHT für node/storage/ceph/ha Objekte', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmoxInstances = [];
        inst.objects = {
            'proxmox.0.node_pve':      { type: 'channel', native: { type: 'node'    } },
            'proxmox.0.storage_local': { type: 'channel', native: { type: 'storage' } },
            'proxmox.0.ceph':          { type: 'channel', native: {}                  },
        };
        await new Promise(resolve => inst.onUnload(resolve));
        const calls = inst._calls['setStateAsync'] || [];
        const availableCalls = calls.filter(c => String(c[0]).includes('.available'));
        assert.equal(availableCalls.length, 0, 'Keine available-States für node/storage/ceph');
    });
});

// ─── onStateChange ────────────────────────────────────────────────────────────

describe('onStateChange()', () => {
    it('ignoriert States mit ack=true', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        await inst.onStateChange('proxmox.0.qemu_vm1.start', { val: true, ack: true });
        assert.equal((inst._calls['sendTo'] || []).length, 0);
    });

    it('ignoriert State=null', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        await inst.onStateChange('proxmox.0.qemu_vm1.start', null);
        // Kein Fehler, kein Aufruf
        assert.equal((inst._calls['setTimeout'] || []).length, 0);
    });

    describe('qemu/lxc Aktionen', () => {
        const vmActions = ['start', 'stop', 'shutdown', 'reset', 'suspend', 'resume', 'reboot'];

        for (const cmd of vmActions) {
            it(`ruft qemu${cmd.charAt(0).toUpperCase() + cmd.slice(1)}() für Kommando "${cmd}" auf`, async () => {
                const inst = makeProxmoxInstance();
                let called = false;
                const mock = makeProxmoxMock({
                    [`qemu${cmd.charAt(0).toUpperCase() + cmd.slice(1)}`]: async () => {
                        called = true;
                        return { data: 'UPID' };
                    },
                });
                inst.proxmox = mock;

                inst._objects['proxmox.0.qemu_vm1'] = {
                    native: { type: 'qemu', node: 'pve', vmid: 100 },
                };
                inst.getForeignObjectAsync = async () => ({
                    native: { type: 'qemu', node: 'pve', vmid: 100 },
                });

                const id = `proxmox.0.qemu_vm1.${cmd}`;
                await inst.onStateChange(id, { val: true, ack: false });

                assert.equal(called, true, `qemu${cmd} wurde nicht aufgerufen`);
            });
        }

        it('loggt warn wenn qemu-Aktion fehlschlägt', async () => {
            const inst = makeProxmoxInstance();
            inst.proxmox = makeProxmoxMock({
                qemuStart: async () => { throw new Error('Proxmox unreachable'); },
            });
            inst.getForeignObjectAsync = async () => ({
                native: { type: 'qemu', node: 'pve', vmid: 100 },
            });
            inst.sendRequest = async () => {};

            await inst.onStateChange('proxmox.0.qemu_vm1.start', { val: true, ack: false });
            assert.ok(inst._logs.warn.some(m => m.includes('Unable to execute')));
        });

        it('ignoriert unbekannte Kommandos ohne Fehler', async () => {
            const inst = makeProxmoxInstance();
            inst.proxmox = makeProxmoxMock();
            inst.getForeignObjectAsync = async () => ({
                native: { type: 'qemu', node: 'pve', vmid: 100 },
            });
            // "unbekannt" ist kein gültiges Kommando
            await inst.onStateChange('proxmox.0.qemu_vm1.unbekannt', { val: true, ack: false });
            assert.equal(inst._logs.warn.length, 0);
        });
    });

    describe('node Aktionen', () => {
        for (const cmd of ['shutdown', 'reboot']) {
            it(`ruft node${cmd.charAt(0).toUpperCase() + cmd.slice(1)}() für Kommando "${cmd}" auf`, async () => {
                const inst = makeProxmoxInstance();
                let called = false;
                const mock = makeProxmoxMock({
                    [`node${cmd.charAt(0).toUpperCase() + cmd.slice(1)}`]: async () => {
                        called = true;
                        return { data: 'UPID' };
                    },
                });
                inst.proxmox = mock;
                inst.getForeignObjectAsync = async () => ({
                    native: { type: 'node', node: 'pve' },
                });

                await inst.onStateChange(`proxmox.0.node_pve.${cmd}`, { val: true, ack: false });
                assert.equal(called, true);
            });
        }
    });

    describe('webhookNotification', () => {
        it('verarbeitet gültige Webhook-Notification', async () => {
            const inst = makeProxmoxInstance();
            inst.getForeignObjectAsync = async () => null;
            inst.parseNotificationInfo = async () => ({ severity: 'info', title: 'Test', message: 'ok', timestamp: 1234 });

            await inst.onStateChange('proxmox.0.info.webhookNotification',
                { val: 'info***Test***ok***1234', ack: false });

            const calls = inst._calls['setStateAsync'] || [];
            assert.ok(calls.some(c => c[0].includes('webhookNotificationArray')));
        });

        it('setzt webhookNotificationArray auf [] bei Parse-Fehler', async () => {
            const inst = makeProxmoxInstance();
            inst.getForeignObjectAsync = async () => null;
            inst.parseNotificationInfo = async () => { throw new Error('parse failed'); };

            await inst.onStateChange('proxmox.0.info.webhookNotification',
                { val: 'kaputt', ack: false });

            const calls = inst._calls['setStateAsync'] || [];
            const arrayCall = calls.find(c => c[0].includes('webhookNotificationArray'));
            assert.ok(arrayCall);
            assert.equal(arrayCall[1].val, '[]');
        });
    });
});

// ─── readObjects ──────────────────────────────────────────────────────────────

describe('readObjects()', () => {
    it('füllt this.objects aus getForeignObjectsAsync', async () => {
        const inst = makeProxmoxInstance();
        inst._objects['proxmox.0.node_pve'] = { type: 'channel', common: { name: 'pve' }, native: {} };
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.node_pve': { type: 'channel', common: { name: 'pve' }, native: {} },
        });

        await inst.readObjects();
        assert.ok(inst.objects['proxmox.0.node_pve']);
    });

    it('loggt error ohne crash bei Exception', async () => {
        const inst = makeProxmoxInstance();
        inst.getForeignObjectsAsync = async () => { throw new Error('DB error'); };
        await inst.readObjects(); // soll nicht werfen
        assert.ok(inst._logs.error.length > 0);
    });
});

// ─── sendRequest ──────────────────────────────────────────────────────────────

describe('sendRequest()', () => {
    it('setzt info.lastUpdate', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.config.requestInterval = 60;

        await inst.sendRequest(999999); // langer Delay → Timer läuft nicht sofort

        const calls = inst._calls['setStateAsync'] || [];
        assert.ok(calls.some(c => c[0] === 'info.lastUpdate'));
    });

    it('löscht vorherigen requestInterval', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.requestInterval = 7;

        await inst.sendRequest(999999);

        assert.ok((inst._calls['clearTimeout'] || []).some(c => c[0] === 7));
    });

    it('nutzt config.requestInterval als Delay wenn kein Argument übergeben', async () => {
        const inst = makeProxmoxInstance({ requestInterval: 15 });
        inst.proxmox = makeProxmoxMock();

        await inst.sendRequest(undefined);

        const timeoutCalls = inst._calls['setTimeout'] || [];
        assert.ok(timeoutCalls.some(c => c[0] === 15000), `Kein setTimeout mit 15000ms`);
    });

    it('nutzt übergebenen Delay', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();

        await inst.sendRequest(1234);

        const timeoutCalls = inst._calls['setTimeout'] || [];
        assert.ok(timeoutCalls.some(c => c[0] === 1234));
    });
});

// ─── onMessage (cleanup) ──────────────────────────────────────────────────────

describe('onMessage() – cleanup', () => {
    it('macht nichts bei msg ohne command', async () => {
        const inst = makeProxmoxInstance();
        await inst.onMessage({});
        await inst.onMessage(null);
        assert.equal((inst._calls['sendTo'] || []).length, 0);
    });

    it('gibt error zurück wenn proxmox nicht initialisiert', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = null;
        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });
        assert.equal(response?.result, 'error');
        assert.ok(response?.error?.includes('nicht initialisiert'));
    });

    it('löscht verwaiste qemu/lxc-Channels und gibt ok zurück', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'vm-existing', node: 'pve', vmid: 100, status: 'running' },
            ],
        });

        // Vorhandene Channels: einer aktiv, einer veraltet
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.qemu_vm-existing': { type: 'channel', native: { type: 'qemu' } },
            'proxmox.0.qemu_old-vm':      { type: 'channel', native: { type: 'qemu' } },
        });
        inst.objects = {
            'proxmox.0.qemu_vm-existing': { type: 'channel', native: { type: 'qemu' } },
            'proxmox.0.qemu_old-vm':      { type: 'channel', native: { type: 'qemu' } },
        };

        let deleted = 0;
        inst.delObjectAsync = async () => { deleted++; };
        inst.restart = () => {};

        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal(response?.result, 'ok');
        assert.equal(response?.deleted, 1);
        assert.equal(deleted, 1);
    });

    it('gibt ok mit deleted=0 zurück wenn alles aktuell', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'running' },
            ],
        });
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.qemu_myvm': { type: 'channel', native: { type: 'qemu' } },
        });
        inst.objects = { 'proxmox.0.qemu_myvm': { type: 'channel', native: { type: 'qemu' } } };

        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal(response?.result, 'ok');
        assert.equal(response?.deleted, 0);
    });

    it('ignoriert node/storage/ceph/ha Channels beim Cleanup', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [],
        });
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.node_pve':          { type: 'channel', native: { type: 'node' } },
            'proxmox.0.storage_local':     { type: 'channel', native: { type: 'storage' } },
            'proxmox.0.ceph':              { type: 'channel', native: {} },
        });
        inst.objects = {};

        let deleted = 0;
        inst.delObjectAsync = async () => { deleted++; };

        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal(deleted, 0, 'node/storage/ceph sollen nicht gelöscht werden');
    });

    it('startet Adapter neu wenn Channels gelöscht wurden', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({ getClusterResources: async () => [] });
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.qemu_zombie': { type: 'channel', native: { type: 'qemu' } },
        });
        inst.objects = { 'proxmox.0.qemu_zombie': { type: 'channel', native: { type: 'qemu' } } };
        inst.delObjectAsync = async () => {};
        inst.sendTo = () => {};

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.ok((inst._calls['restart'] || []).length > 0, 'restart() soll aufgerufen werden');
    });

    it('startet Adapter NICHT neu wenn nichts gelöscht wurde', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({ getClusterResources: async () => [] });
        inst.getForeignObjectsAsync = async () => ({});
        inst.objects = {};
        inst.sendTo = () => {};

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal((inst._calls['restart'] || []).length, 0);
    });

    it('sendet kein sendTo wenn kein callback gesetzt', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({ getClusterResources: async () => [] });
        inst.getForeignObjectsAsync = async () => ({});
        inst.objects = {};

        let called = false;
        inst.sendTo = () => { called = true; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0' }); // kein callback
        assert.equal(called, false);
    });

    it('gibt error zurück wenn getClusterResources fehlschlägt', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => { throw new Error('API down'); },
        });

        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal(response?.result, 'error');
        assert.ok(response?.error?.includes('API down'));
    });

    it('berücksichtigt newTreeStructure bei Namensbildung', async () => {
        const inst = makeProxmoxInstance({ newTreeStructure: true });
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'running' },
            ],
        });
        // Mit newTreeStructure ist der Pfad qemu.myvm statt qemu_myvm
        inst.getForeignObjectsAsync = async () => ({
            'proxmox.0.qemu.myvm':     { type: 'channel', native: { type: 'qemu' } },
            'proxmox.0.qemu.old-vm':   { type: 'channel', native: { type: 'qemu' } },
        });
        inst.objects = {
            'proxmox.0.qemu.myvm':     { type: 'channel', native: { type: 'qemu' } },
            'proxmox.0.qemu.old-vm':   { type: 'channel', native: { type: 'qemu' } },
        };

        let deleted = 0;
        inst.delObjectAsync = async () => { deleted++; };
        inst.restart = () => {};

        let response = null;
        inst.sendTo = (from, cmd, data) => { response = data; };

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        assert.equal(response?.deleted, 1, 'old-vm soll gelöscht werden');
    });
});

// ─── createNodes ──────────────────────────────────────────────────────────────

describe('createNodes()', () => {
    it('erstellt Channel-Objekt für neuen Node', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.objects = {};

        await inst.createNodes([
            { node: 'pve', type: 'node', status: 'offline' },
        ]);

        assert.ok(inst._objects['proxmox.0.node_pve'],
            'Channel-Objekt für node_pve soll angelegt werden');
    });

    it('legt shutdown und reboot States an', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.objects = {};

        await inst.createNodes([{ node: 'pve', type: 'node', status: 'offline' }]);

        assert.ok(inst._objects['proxmox.0.node_pve.shutdown']);
        assert.ok(inst._objects['proxmox.0.node_pve.reboot']);
    });

    it('legt status State an und setzt ihn', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.objects = {};

        await inst.createNodes([{ node: 'pve', type: 'node', status: 'online' }]);

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('.status') && c[1].val === 'online'));
    });

    it('löscht nicht mehr vorhandene Nodes', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        // pve2 ist in objects aber nicht mehr in nodes-Liste
        inst.objects = {
            'proxmox.0.node_pve2': { type: 'channel', common: { name: 'pve2' }, native: {} },
        };

        await inst.createNodes([{ node: 'pve', type: 'node', status: 'offline' }]);

        const delCalls = inst._calls['delObjectAsync'] || [];
        assert.ok(delCalls.some(c => c[0] === 'node_pve2'),
            'node_pve2 soll gelöscht werden');
    });

    it('fragt NodeStatus bei online-Node ab', async () => {
        const inst = makeProxmoxInstance();
        let nodeStatusCalled = false;
        inst.proxmox = makeProxmoxMock({
            getNodeStatus: async () => {
                nodeStatusCalled = true;
                return { uptime: 3600, wait: 0.01,
                    memory: { used: 1024*1024*1024, total: 4*1024*1024*1024, free: 3*1024*1024*1024 },
                    loadavg: ['0.5', '0.3', '0.2'],
                    swap: { used: 0, free: 1024*1024*1024, total: 1024*1024*1024 } };
            },
        });
        inst.objects = {};

        await inst.createNodes([{ node: 'pve', type: 'node', status: 'online', cpu: 0.1, maxcpu: 4 }]);
        assert.equal(nodeStatusCalled, true);
    });

    it('fragt bei offline-Node keinen NodeStatus ab', async () => {
        const inst = makeProxmoxInstance();
        let nodeStatusCalled = false;
        inst.proxmox = makeProxmoxMock({
            getNodeStatus: async () => { nodeStatusCalled = true; return {}; },
        });
        inst.objects = {};

        await inst.createNodes([{ node: 'pve', type: 'node', status: 'offline' }]);
        assert.equal(nodeStatusCalled, false);
    });
});

// ─── setNodes ─────────────────────────────────────────────────────────────────

describe('setNodes()', () => {
    it('setzt status State für jeden Node', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({ getNodeStatus: async () => ({
            uptime: 100, wait: 0,
            memory: { used: 512, total: 1024, free: 512 },
            loadavg: ['0', '0', '0'],
            swap: { used: 0, free: 0, total: 0 },
        }) });
        inst.objects = { 'proxmox.0.node_pve': {} };

        await inst.setNodes([{ node: 'pve', type: 'node', status: 'online', cpu: 0.2, maxcpu: 4 }]);

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('node_pve.status')));
    });

    it('startet Adapter-Neustart bei neuem Node', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.objects = {}; // node_newnode ist NICHT bekannt

        await inst.setNodes([{ node: 'newnode', type: 'node', status: 'online', cpu: 0 }]);

        assert.ok((inst._calls['restart'] || []).length > 0);
    });

    it('setzt offline-Status korrekt', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock();
        inst.objects = { 'proxmox.0.node_pve': {} };

        await inst.setNodes([{ node: 'pve', type: 'node', status: 'offline' }]);

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('node_pve.status') && c[1].val === 'offline'));
    });
});

// ─── setMachines – VM/LXC ─────────────────────────────────────────────────────

describe('setMachines() – qemu/lxc', () => {
    it('setzt status State für laufende VM', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'running' },
            ],
            getResourceStatus: async () => ({
                name: 'myvm', status: 'running', cpu: 0.1, mem: 512, maxmem: 2048,
                disk: 10, maxdisk: 50, uptime: 3600, pid: 1234, vmid: 100, type: 'qemu',
            }),
        });
        inst.objects = { 'proxmox.0.qemu_myvm': { type: 'channel', native: { type: 'qemu' } } };

        await inst.setMachines();

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('qemu_myvm.status')));
    });

    it('setzt available=true für laufende VM', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'running' },
            ],
            getResourceStatus: async () => ({
                name: 'myvm', status: 'running', cpu: 0, mem: 0, maxmem: 1,
                disk: 0, maxdisk: 1, uptime: 0, pid: 1, vmid: 100, type: 'qemu',
            }),
        });
        inst.objects = { 'proxmox.0.qemu_myvm': {} };

        await inst.setMachines();

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('qemu_myvm.available') && c[1]?.val === true));
    });

    it('setzt available=false für gestoppte VM', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'stopped' },
            ],
        });
        inst.objects = { 'proxmox.0.qemu_myvm': {} };

        await inst.setMachines();

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('qemu_myvm.available') && c[1]?.val === false));
    });

    it('überspringt VMs mit name=undefined (offline Node)', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: undefined, node: 'pve', vmid: 100, status: 'stopped' },
            ],
        });
        inst.objects = {};

        await inst.setMachines(); // soll nicht crashen

        const calls = inst._calls['setStateChangedAsync'] || [];
        // Kein State mit 'qemu_undefined' setzen
        assert.ok(!calls.some(c => c[0].includes('qemu_undefined')));
    });

    it('wandelt status unknown in offline um', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'myvm', node: 'pve', vmid: 100, status: 'unknown' },
            ],
        });
        inst.objects = { 'proxmox.0.qemu_myvm': {} };

        await inst.setMachines();

        const calls = inst._calls['setStateChangedAsync'] || [];
        assert.ok(calls.some(c => c[0].includes('qemu_myvm.status') && c[1].val === 'offline'));
    });

    it('startet Neustart bei neuer VM', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({
            getClusterResources: async () => [
                { type: 'qemu', name: 'newvm', node: 'pve', vmid: 200, status: 'running' },
            ],
        });
        inst.objects = {}; // newvm unbekannt

        await inst.setMachines();

        assert.ok((inst._calls['restart'] || []).length > 0);
    });
});

// ─── Alle Tests – Abschluss-Statuscheck ───────────────────────────────────────

describe('Integrations-Smoke-Test', () => {
    it('onUnload nach onMessage wirft keinen Fehler', async () => {
        const inst = makeProxmoxInstance();
        inst.proxmox = makeProxmoxMock({ getClusterResources: async () => [] });
        inst.getForeignObjectsAsync = async () => ({});
        inst.objects = {};
        inst.proxmoxInstances = [];
        inst.sendTo = () => {};

        await inst.onMessage({ command: 'cleanup', from: 'admin.0', callback: true });

        let ok = false;
        await new Promise(resolve => inst.onUnload(() => { ok = true; resolve(); }));
        assert.equal(ok, true);
    });
});
