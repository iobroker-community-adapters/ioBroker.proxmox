'use strict';

/**
 * Tests für ProxmoxUtils._getData
 *
 * Ausführen: node --test test/proxmox.getData.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Erstellt einen minimalen Adapter-Mock mit Log-Methoden.
 */
function makeAdapter() {
    const logs = { debug: [], warn: [], error: [], info: [] };
    return {
        _logs: logs,
        log: {
            debug: (m) => logs.debug.push(m),
            warn:  (m) => logs.warn.push(m),
            error: (m) => logs.error.push(m),
            info:  (m) => logs.info.push(m),
        },
    };
}

/**
 * Erstellt eine ProxmoxUtils-Instanz mit gemocktem axios.
 * @param {Function} axiosMock  – ersetzt das echte axios-Modul
 */
function makeInstance(axiosMock) {
    // axios im Modul-Cache temporär ersetzen
    const axiosPath = require.resolve('axios');
    const realAxios = require.cache[axiosPath];

    const fakeModule = { exports: axiosMock };
    fakeModule.exports.default = axiosMock;
    fakeModule.exports.isAxiosError = axiosMock.isAxiosError ?? (() => false);
    require.cache[axiosPath] = fakeModule;

    // ProxmoxUtils neu laden (ohne Cache)
    const utilsPath = require.resolve('../lib/proxmox');
    delete require.cache[utilsPath];
    const ProxmoxUtils = require('../lib/proxmox');

    // Cache wieder herstellen
    require.cache[axiosPath] = realAxios;

    const nodeList = [{
        realmIp:       '192.168.1.1',
        realmPort:     8006,
        realmUser:     'root',
        realmPassword: 'secret',
        realm:         'pam',
    }];

    const adapter = makeAdapter();
    const inst = new ProxmoxUtils(adapter, nodeList);

    // ticket()-Methode mocken damit _getData-Retry-Tests keine echte Auth brauchen
    inst.ticket = async () => {
        inst._ticket = 'PVEAuthCookie=mock-ticket';
        inst._csrf   = 'mock-csrf';
    };

    // setNextUrlMain() ist synchron – passt so
    return { inst, adapter };
}

/**
 * Erzeugt eine axios-ähnliche Funktion die eine feste Response liefert.
 */
function axiosReturns(status, data) {
    const fn = async () => ({ status, data });
    fn.isAxiosError = () => false;
    return fn;
}

/**
 * Erzeugt eine axios-ähnliche Funktion die einen Fehler wirft.
 * @param {boolean} isAxios   – simuliert einen Axios-Netzwerkfehler
 * @param {object}  [extra]   – zusätzliche Felder am Error (z.B. response, request)
 */
function axiosThrows(message, isAxios = true, extra = {}) {
    const fn = async () => {
        const err = new Error(message);
        Object.assign(err, extra);
        throw err;
    };
    fn.isAxiosError = (e) => isAxios && e.message === message;
    return fn;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProxmoxUtils._getData', () => {

    // ── 1. stopped ────────────────────────────────────────────────────────────
    describe('wenn adapter gestoppt ist', () => {
        it('wirft Error("STOPPED")', async () => {
            const { inst } = makeInstance(axiosReturns(200, {}));
            inst.stopped = true;

            await assert.rejects(
                () => inst._getData('/nodes', 'get'),
                (err) => {
                    assert.equal(err.message, 'STOPPED');
                    return true;
                },
            );
        });
    });

    // ── 2. HTTP 200 ───────────────────────────────────────────────────────────
    describe('HTTP 200', () => {
        it('gibt response.data zurück', async () => {
            const payload = { data: [{ node: 'pve', status: 'online' }] };
            const { inst } = makeInstance(axiosReturns(200, payload));

            const result = await inst._getData('/nodes', 'get');
            assert.deepEqual(result, payload);
        });

        it('gibt leeres Objekt zurück wenn data leer', async () => {
            const { inst } = makeInstance(axiosReturns(200, {}));
            const result = await inst._getData('/nodes', 'get');
            assert.deepEqual(result, {});
        });
    });

    // ── 3. HTTP 500 / 595 / 599 ───────────────────────────────────────────────
    for (const code of [500, 595, 599]) {
        describe(`HTTP ${code}`, () => {
            it(`wirft Error("HTTP ${code}")`, async () => {
                const { inst } = makeInstance(axiosReturns(code, { errors: 'server error' }));

                await assert.rejects(
                    () => inst._getData('/nodes', 'get'),
                    (err) => {
                        assert.equal(err.message, `HTTP ${code}`);
                        assert.ok(err.response, 'err.response soll gesetzt sein');
                        return true;
                    },
                );
            });
        });
    }

    // ── 4. HTTP 401 ohne retry → ticket() + Retry → Erfolg ───────────────────
    describe('HTTP 401 (erster Versuch)', () => {
        it('ruft ticket() auf und wiederholt den Request', async () => {
            let callCount = 0;
            let ticketCalled = false;
            const successPayload = { data: { result: 'ok' } };

            const axiosMock = async () => {
                callCount++;
                if (callCount === 1) return { status: 401, data: {} };
                return { status: 200, data: successPayload };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            inst.ticket = async () => { ticketCalled = true; };

            const result = await inst._getData('/nodes', 'get', null, false, null);

            assert.equal(callCount, 2, 'axios soll genau 2× aufgerufen worden sein');
            assert.equal(ticketCalled, true, 'ticket() soll aufgerufen worden sein');
            assert.deepEqual(result, successPayload);
        });
    });

    // ── 5. HTTP 401 mit retry=true → kein weiterer Retry, gibt data zurück ────
    describe('HTTP 401 (retry=true)', () => {
        it('kein weiterer Retry – gibt response.data zurück', async () => {
            let callCount = 0;
            const axiosMock = async () => {
                callCount++;
                return { status: 401, data: { message: 'unauthorized' } };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);

            const result = await inst._getData('/nodes', 'get', null, true, null);
            assert.equal(callCount, 1);
            assert.deepEqual(result, { message: 'unauthorized' });
        });
    });

    // ── 6. AxiosError + additional='node' + retry=false → Failover ────────────
    describe('AxiosError mit additional="node" (erster Versuch)', () => {
        it('wechselt URL, holt neues Ticket und wiederholt (multi-node)', async () => {
            let callCount = 0;
            let ticketCalled = false;
            const successPayload = { data: 'pong' };

            const axiosMock = async () => {
                callCount++;
                if (callCount === 1) {
                    const err = new Error('connect ECONNREFUSED');
                    throw err;
                }
                return { status: 200, data: successPayload };
            };
            axiosMock.isAxiosError = (e) => !e.response;

            const { inst } = makeMultiNodeInstance(axiosMock, 2);
            inst.ticket = async () => { ticketCalled = true; };

            const result = await inst._getData('/nodes', 'get', null, false, 'node');

            assert.equal(callCount, 2);
            assert.equal(ticketCalled, true, 'ticket() soll aufgerufen worden sein');
            assert.deepEqual(result, successPayload);
        });
    });

    // ── 7. AxiosError + additional='node' + retry=true → kein Failover ────────
    describe('AxiosError mit additional="node" und retry=true', () => {
        it('kein Failover – wirft den Fehler durch', async () => {
            // Mit retry=true UND nur einem Knoten: single-node-guard greift nach setNextUrlMain
            // Der neue Code versucht Failover, aber kein weiterer Knoten → wirft Error
            const axiosMock = axiosThrows('connect ECONNREFUSED');

            const { inst } = makeInstance(axiosMock);

            await assert.rejects(
                () => inst._getData('/nodes', 'get', null, true, 'node'),
                (err) => {
                    // Mit retry=true wird 401-Retry verhindert, aber Netzwerkfehler
                    // triggert weiterhin Failover – bei nur 1 Node sofort erschöpft
                    assert.ok(err.message.length > 0);
                    return true;
                },
            );
        });
    });

    // ── 8. AxiosError ohne additional='node' → Failover erschöpft ────────────
    describe('AxiosError ohne additional="node"', () => {
        it('Netzwerkfehler ohne Response triggert Failover, bei 1 Node: erschöpft', async () => {
            // Failover greift jetzt für ALLE Netzwerkfehler ohne Response
            const axiosMock = axiosThrows('Network Error');

            const { inst } = makeInstance(axiosMock);

            await assert.rejects(
                () => inst._getData('/cluster/resources', 'get', null, false, 'cluster'),
                (err) => {
                    // 1 Node → Failover sofort erschöpft
                    assert.ok(
                        err.message.includes('Failover') || err.message.includes('Network Error'),
                        `Unerwarteter Fehler: ${err.message}`,
                    );
                    return true;
                },
            );
        });
    });

    // ── 9. Nicht-Axios-Fehler wird immer durchgeworfen ────────────────────────
    describe('Nicht-Axios-Fehler (z.B. JSON parse error)', () => {
        it('wirft den originalen Fehler durch', async () => {
            const axiosMock = axiosThrows('Unexpected token', false);

            const { inst } = makeInstance(axiosMock);

            await assert.rejects(
                () => inst._getData('/nodes', 'get', null, false, 'node'),
                (err) => {
                    assert.equal(err.message, 'Unexpected token');
                    return true;
                },
            );
        });
    });

    // ── 10. url=null/undefined → wird als leerer String behandelt ─────────────
    describe('url ist null/undefined', () => {
        it('nutzt leeren String als Pfad ohne Exception', async () => {
            const { inst } = makeInstance(axiosReturns(200, { data: 'root' }));

            const result = await inst._getData(null, 'get');
            assert.deepEqual(result, { data: 'root' });
        });
    });

    // ── 11. Korrekte Header werden übergeben ──────────────────────────────────
    describe('Request-Header', () => {
        it('sendet CSRF und Cookie aus Instanzvariablen', async () => {
            let capturedConfig = null;
            const axiosMock = async (config) => {
                capturedConfig = config;
                return { status: 200, data: {} };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            inst._csrf   = 'test-csrf-token';
            inst._ticket = 'PVEAuthCookie=test-cookie';

            await inst._getData('/nodes', 'get');

            assert.equal(capturedConfig.headers.CSRFPreventionToken, 'test-csrf-token');
            assert.equal(capturedConfig.headers.Cookie, 'PVEAuthCookie=test-cookie');
        });

        it('setzt timeout auf 10000ms', async () => {
            let capturedConfig = null;
            const axiosMock = async (config) => {
                capturedConfig = config;
                return { status: 200, data: {} };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            await inst._getData('/nodes', 'get');

            assert.equal(capturedConfig.timeout, 10000);
        });
    });

/**
 * Erstellt eine ProxmoxUtils-Instanz mit mehreren Knoten.
 */
function makeMultiNodeInstance(axiosMock, nodeCount = 2) {
    const axiosPath = require.resolve('axios');
    const realAxios = require.cache[axiosPath];

    const fakeModule = { exports: axiosMock };
    fakeModule.exports.default = axiosMock;
    fakeModule.exports.isAxiosError = axiosMock.isAxiosError ?? (() => false);
    require.cache[axiosPath] = fakeModule;

    const utilsPath = require.resolve('../lib/proxmox');
    delete require.cache[utilsPath];
    const ProxmoxUtils = require('../lib/proxmox');

    require.cache[axiosPath] = realAxios;

    const nodeList = Array.from({ length: nodeCount }, (_, i) => ({
        realmIp:       `192.168.1.${i + 1}`,
        realmPort:     8006,
        realmUser:     'root',
        realmPassword: 'secret',
        realm:         'pam',
    }));

    const adapter = makeAdapter();
    const inst = new ProxmoxUtils(adapter, nodeList);
    inst.ticket = async () => {
        inst._ticket = 'PVEAuthCookie=mock-ticket';
        inst._csrf   = 'mock-csrf';
    };
    return { inst, adapter };
}

describe('Failover – Mehrere Knoten', () => {

    it('wechselt zu Knoten 2 wenn Knoten 1 Netzwerkfehler hat', async () => {
        let callCount = 0;
        const axiosMock = async () => {
            callCount++;
            if (callCount === 1) {
                const err = new Error('connect ECONNREFUSED');
                throw err; // Knoten 1 tot
            }
            return { status: 200, data: { data: [{ node: 'pve' }] } };
        };
        axiosMock.isAxiosError = (e) => !e.response; // alle Netzwerkfehler

        const { inst, adapter } = makeMultiNodeInstance(axiosMock, 2);

        const result = await inst._getData('/nodes', 'get');

        assert.equal(callCount, 2, 'Soll 2× aufgerufen worden sein (1× fail, 1× success)');
        assert.ok(adapter._logs.warn.some(m => m.includes('Failover')), 'Kein Failover-Log');
        assert.deepEqual(result, { data: [{ node: 'pve' }] });
    });

    it('erschöpft alle Knoten und wirft klaren Fehler', async () => {
        const axiosMock = async () => {
            const err = new Error('ECONNREFUSED');
            throw err;
        };
        axiosMock.isAxiosError = () => true;

        const { inst, adapter } = makeMultiNodeInstance(axiosMock, 3);

        await assert.rejects(
            () => inst._getData('/nodes', 'get'),
            (err) => {
                assert.ok(err.message.includes('Failover erschöpft'), `Unerwarteter Fehler: ${err.message}`);
                assert.ok(err.message.includes('3'), 'Fehler soll Knotenanzahl (3) nennen');
                return true;
            },
        );

        assert.ok(
            adapter._logs.error.some(m => m.includes('Failover erschöpft')),
            'error-Log für erschöpften Failover fehlt',
        );
    });

    it('loggt warn pro Failover-Wechsel', async () => {
        let calls = 0;
        const axiosMock = async () => {
            calls++;
            if (calls < 3) throw Object.assign(new Error('timeout'), {});
            return { status: 200, data: {} };
        };
        axiosMock.isAxiosError = () => true;

        const { inst, adapter } = makeMultiNodeInstance(axiosMock, 3);

        await inst._getData('/nodes', 'get');

        const failoverLogs = adapter._logs.warn.filter(m => m.includes('Failover'));
        assert.ok(failoverLogs.length >= 2, `Erwartet ≥2 Failover-Logs, erhalten: ${failoverLogs.length}`);
    });

    it('setzt ticket() nach Failover-Wechsel neu', async () => {
        let ticketCalls = 0;
        let axisCalls = 0;
        const axiosMock = async () => {
            axisCalls++;
            if (axisCalls === 1) throw Object.assign(new Error('ECONNREFUSED'), {});
            return { status: 200, data: {} };
        };
        axiosMock.isAxiosError = () => true;

        const { inst } = makeMultiNodeInstance(axiosMock, 2);
        inst.ticket = async () => { ticketCalls++; };

        await inst._getData('/nodes', 'get');

        assert.ok(ticketCalls >= 1, 'ticket() soll nach Failover aufgerufen worden sein');
    });

    it('initialer Konstruktor loggt kein warn', () => {
        const axiosMock = async () => ({ status: 200, data: {} });
        axiosMock.isAxiosError = () => false;

        const { adapter } = makeMultiNodeInstance(axiosMock, 2);

        // Beim Konstruktor darf kein warn über Failover geloggt worden sein
        const failoverWarns = adapter._logs.warn.filter(m => m.includes('Failover'));
        assert.equal(failoverWarns.length, 0, `Unerwartete Failover-Warns beim Start: ${failoverWarns}`);
    });

    it('einzelner Knoten: erschöpft sofort und wirft Fehler mit klarer Meldung', async () => {
        const axiosMock = async () => { throw Object.assign(new Error('ECONNREFUSED'), {}); };
        axiosMock.isAxiosError = () => true;

        const { inst, adapter } = makeMultiNodeInstance(axiosMock, 1);

        await assert.rejects(
            () => inst._getData('/nodes', 'get'),
            (err) => {
                // 1 Knoten → failoverAttempts(0) >= maxFailovers(0) → sofort erschöpft
                assert.ok(err.message.includes('Failover erschöpft'), `Unerwartete Meldung: ${err.message}`);
                assert.ok(err.message.includes('1'), 'Soll Knotenanzahl (1) nennen');
                return true;
            },
        );

        // setNextUrlMain() wird NICHT aufgerufen (dead code für 1 Knoten)
        assert.equal(adapter._logs.warn.filter(m => m.includes('Failover')).length, 0,
            'setNextUrlMain() soll für 1 Knoten nicht aufgerufen werden');
        assert.ok(adapter._logs.error.some(m => m.includes('Failover erschöpft')));
    });
});

    describe('Logging', () => {
        it('schreibt debug log bei HTTP 200', async () => {
            const { inst, adapter } = makeInstance(axiosReturns(200, { data: 'test' }));

            await inst._getData('/nodes', 'get');

            assert.ok(
                adapter._logs.debug.some(m => m.includes('received 200 response')),
                'Kein debug-Log für 200 gefunden',
            );
        });
    });

});
