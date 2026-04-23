'use strict';

/**
 * Tests für ProxmoxUtils._getTicket und ticket()
 *
 * Ausführen: node --test test/proxmox.getTicket.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

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
 * Erstellt ProxmoxUtils-Instanz mit gemocktem axios.
 * @param {Function} axiosMock
 */
function makeInstance(axiosMock) {
    const axiosPath = require.resolve('axios');
    const realAxios = require.cache[axiosPath];

    const fakeModule = { exports: axiosMock };
    fakeModule.exports.default    = axiosMock;
    fakeModule.exports.isAxiosError = axiosMock.isAxiosError ?? (() => false);
    require.cache[axiosPath] = fakeModule;

    const utilsPath = require.resolve('../lib/proxmox');
    delete require.cache[utilsPath];
    const ProxmoxUtils = require('../lib/proxmox');

    require.cache[axiosPath] = realAxios;

    const nodeList = [{
        realmIp:       '192.168.1.100',
        realmPort:     8006,
        realmUser:     'root',
        realmPassword: 'geheim123',
        realm:         'pam',
    }];

    const adapter = makeAdapter();
    const inst = new ProxmoxUtils(adapter, nodeList);
    return { inst, adapter };
}

/** axios liefert feste Response */
function axiosReturns(status, data) {
    const fn = async () => ({ status, data });
    fn.isAxiosError = () => false;
    return fn;
}

/** axios wirft Netzwerk-/HTTP-Fehler */
function axiosThrowsWithResponse(status, responseData) {
    const err = new Error(`Request failed with status ${status}`);
    err.response = { status, data: responseData };
    const fn = async () => { throw err; };
    fn.isAxiosError = () => true;
    return fn;
}

function axiosThrowsWithRequest() {
    const err = new Error('timeout');
    err.request  = {};   // request gesetzt, response nicht
    const fn = async () => { throw err; };
    fn.isAxiosError = () => true;
    return fn;
}

function axiosThrowsGeneric(message) {
    const fn = async () => { throw new Error(message); };
    fn.isAxiosError = () => false;
    return fn;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProxmoxUtils._getTicket', () => {

    // ── 1. Erfolgreicher Login ─────────────────────────────────────────────────
    describe('erfolgreicher Login', () => {
        it('gibt ticket und CSRFPreventionToken zurück', async () => {
            const ticketData = { ticket: 'PVE:root@pam:ABCDEF', CSRFPreventionToken: 'csrf-xyz' };
            const { inst } = makeInstance(axiosReturns(200, { data: ticketData }));

            const result = await inst._getTicket();

            assert.equal(result.ticket, ticketData.ticket);
            assert.equal(result.CSRFPreventionToken, ticketData.CSRFPreventionToken);
        });

        it('schreibt debug log mit Status und Response', async () => {
            const ticketData = { ticket: 'PVE:root@pam:XYZ', CSRFPreventionToken: 'csrf-abc' };
            const { inst, adapter } = makeInstance(axiosReturns(200, { data: ticketData }));

            await inst._getTicket();

            assert.ok(
                adapter._logs.debug.some(m => m.includes('received 200 response')),
                'Kein debug-Log für 200 gefunden',
            );
        });
    });

    // ── 2. Leere / ungültige Antwort → INVALID_RESPONSE ──────────────────────
    describe('ungültige Antwort (kein data.data)', () => {
        const invalidCases = [
            { label: 'leerer Body {}',                    body: {} },
            { label: 'data ist null',                     body: { data: null } },
            { label: 'data ist leeres Objekt {}',         body: { data: {} } },
            { label: 'data ist false',                    body: { data: false } },
            { label: 'data fehlt komplett',               body: { x: 1 } },
            { label: 'ticket fehlt',                      body: { data: { CSRFPreventionToken: 'csrf' } } },
            { label: 'CSRFPreventionToken fehlt',         body: { data: { ticket: 'PVE:root:TOKEN' } } },
            { label: 'ticket ist leer string',            body: { data: { ticket: '', CSRFPreventionToken: 'csrf' } } },
            { label: 'CSRFPreventionToken ist leer string', body: { data: { ticket: 'PVE:root:TOKEN', CSRFPreventionToken: '' } } },
        ];

        for (const { label, body } of invalidCases) {
            it(`wirft Error('INVALID_RESPONSE') wenn ${label}`, async () => {
                const { inst, adapter } = makeInstance(axiosReturns(200, body));

                await assert.rejects(
                    () => inst._getTicket(),
                    (err) => {
                        assert.equal(err.message, 'INVALID_RESPONSE',
                            `Erwartet INVALID_RESPONSE, erhalten: ${err.message}`);
                        return true;
                    },
                );

                // Muss error geloggt werden
                assert.ok(
                    adapter._logs.error.some(m => m.includes('wrong User data')),
                    'Kein error-Log "wrong User data" gefunden',
                );
            });

            it(`loggt NICHT doppelt error wenn ${label}`, async () => {
                // Sicherstellt den Bug-Fix: früher wurde error zweimal geloggt
                // (einmal beim throw, einmal im catch-Handler)
                const { inst, adapter } = makeInstance(axiosReturns(200, body));

                await assert.rejects(() => inst._getTicket(), () => true);

                const errorCount = adapter._logs.error.filter(m => m.includes('wrong User data')).length;
                assert.equal(errorCount, 1, `error-Log wurde ${errorCount}× geschrieben, erwartet 1×`);
            });
        }
    });

    // ── 3. Axios-Fehler mit HTTP-Response (z.B. 401, 403, 500) ───────────────
    describe('Axios-Fehler mit HTTP-Response', () => {
        for (const status of [401, 403, 500]) {
            it(`HTTP ${status} → wirft Error(${status}) und loggt warn`, async () => {
                const { inst, adapter } = makeInstance(
                    axiosThrowsWithResponse(status, { message: 'unauthorized' }),
                );

                await assert.rejects(
                    () => inst._getTicket(),
                    (err) => {
                        assert.equal(err.message, String(status));
                        return true;
                    },
                );

                assert.ok(
                    adapter._logs.warn.some(m => m.includes(`Error received ${status}`)),
                    `Kein warn-Log für HTTP ${status} gefunden`,
                );
                // error-Log darf NICHT geschrieben werden
                assert.equal(adapter._logs.error.length, 0, 'error-Log soll leer sein');
            });
        }
    });

    // ── 4. Netzwerkfehler / Timeout (kein Response) ───────────────────────────
    describe('Netzwerkfehler / Timeout', () => {
        it('wirft Error(-1) und loggt warn', async () => {
            const { inst, adapter } = makeInstance(axiosThrowsWithRequest());

            await assert.rejects(
                () => inst._getTicket(),
                (err) => {
                    assert.equal(err.message, '-1');
                    return true;
                },
            );

            assert.ok(
                adapter._logs.warn.some(m => m.includes('No response from Proxmox')),
                'Kein warn-Log für Timeout gefunden',
            );
        });
    });

    // ── 5. Generischer Fehler (kein axios, kein response, kein request) ───────
    describe('generischer Fehler (z.B. DNS, SSL)', () => {
        it('wirft Error(-2) und loggt error', async () => {
            const { inst, adapter } = makeInstance(axiosThrowsGeneric('getaddrinfo ENOTFOUND'));

            await assert.rejects(
                () => inst._getTicket(),
                (err) => {
                    assert.equal(err.message, '-2');
                    return true;
                },
            );

            assert.ok(
                adapter._logs.error.some(m => m.includes('Response error')),
                'Kein error-Log für generischen Fehler gefunden',
            );
        });
    });

    // ── 6. URL-Konstruktion mit Sonderzeichen ─────────────────────────────────
    describe('URL-Konstruktion', () => {
        it('kodiert Sonderzeichen in Username, Realm und Passwort korrekt', async () => {
            let capturedUrl = null;
            const axiosMock = async (config) => {
                capturedUrl = config.url;
                return { status: 200, data: { data: { ticket: 't', CSRFPreventionToken: 'c' } } };
            };
            axiosMock.isAxiosError = () => false;

            const axiosPath = require.resolve('axios');
            const realAxios = require.cache[axiosPath];
            const fakeModule = { exports: axiosMock };
            fakeModule.exports.default = axiosMock;
            fakeModule.exports.isAxiosError = () => false;
            require.cache[axiosPath] = fakeModule;

            const utilsPath = require.resolve('../lib/proxmox');
            delete require.cache[utilsPath];
            const ProxmoxUtils = require('../lib/proxmox');
            require.cache[axiosPath] = realAxios;

            // Sonderzeichen: @ im User, Leerzeichen im Passwort, Umlaute im Realm
            const nodeList = [{
                realmIp:       '10.0.0.1',
                realmPort:     8006,
                realmUser:     'admin@corp',
                realmPassword: 'pass word!',
                realm:         'pam',
            }];

            const adapter = makeAdapter();
            const inst = new ProxmoxUtils(adapter, nodeList);
            await inst._getTicket();

            assert.ok(capturedUrl.includes('admin%40corp'), `Username nicht korrekt kodiert: ${capturedUrl}`);
            assert.ok(capturedUrl.includes('pass%20word!'), `Passwort nicht korrekt kodiert: ${capturedUrl}`);
        });

        it('baut URL im Format /access/ticket?username=USER@REALM&password=PW auf', async () => {
            let capturedUrl = null;
            const axiosMock = async (config) => {
                capturedUrl = config.url;
                return { status: 200, data: { data: { ticket: 't', CSRFPreventionToken: 'c' } } };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            inst.name     = 'root';
            inst.server   = 'pam';
            inst.password = 'secret';
            await inst._getTicket();

            // Das @ zwischen Username und Realm ist Proxmox-API-Format und wird NICHT kodiert
            assert.ok(capturedUrl.startsWith('/access/ticket'), `URL startet falsch: ${capturedUrl}`);
            assert.ok(capturedUrl.includes('username=root@pam'),  `username fehlt: ${capturedUrl}`);
            assert.ok(capturedUrl.includes('password=secret'),    `password fehlt: ${capturedUrl}`);
        });
    });

    // ── 7. Request-Parameter ──────────────────────────────────────────────────
    describe('Request-Parameter', () => {
        it('nutzt POST-Methode', async () => {
            let capturedMethod = null;
            const axiosMock = async (config) => {
                capturedMethod = config.method;
                return { status: 200, data: { data: { ticket: 't', CSRFPreventionToken: 'c' } } };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            await inst._getTicket();

            assert.equal(capturedMethod, 'post');
        });

        it('setzt timeout auf 5000ms', async () => {
            let capturedTimeout = null;
            const axiosMock = async (config) => {
                capturedTimeout = config.timeout;
                return { status: 200, data: { data: { ticket: 't', CSRFPreventionToken: 'c' } } };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            await inst._getTicket();

            assert.equal(capturedTimeout, 5000);
        });

        it('übergibt den gemeinsamen httpsAgent', async () => {
            let capturedAgent = null;
            const axiosMock = async (config) => {
                capturedAgent = config.httpsAgent;
                return { status: 200, data: { data: { ticket: 't', CSRFPreventionToken: 'c' } } };
            };
            axiosMock.isAxiosError = () => false;

            const { inst } = makeInstance(axiosMock);
            await inst._getTicket();

            assert.equal(capturedAgent, inst.httpsAgent, 'httpsAgent ist nicht die Instanz-Variable');
        });
    });
});

// ─── Tests für ticket() ───────────────────────────────────────────────────────

describe('ProxmoxUtils.ticket()', () => {

    it('setzt this._ticket und this._csrf aus _getTicket-Ergebnis', async () => {
        const { inst } = makeInstance(axiosReturns(200, {
            data: { ticket: 'PVE:root@pam:TOKEN123', CSRFPreventionToken: 'csrf-TOKEN' },
        }));

        await inst.ticket();

        assert.equal(inst._ticket, 'PVEAuthCookie=PVE:root@pam:TOKEN123');
        assert.equal(inst._csrf,   'csrf-TOKEN');
    });

    it('schreibt debug log mit neuem Ticket und CSRF', async () => {
        const { inst, adapter } = makeInstance(axiosReturns(200, {
            data: { ticket: 'TICKET-XYZ', CSRFPreventionToken: 'CSRF-XYZ' },
        }));

        await inst.ticket();

        assert.ok(
            adapter._logs.debug.some(m => m.includes('Updating ticket')),
            'Kein debug-Log "Updating ticket" gefunden',
        );
    });

    it('wirft wenn _getTicket fehlschlägt', async () => {
        const { inst } = makeInstance(axiosReturns(200, {})); // kein data.data

        await assert.rejects(
            () => inst.ticket(),
            (err) => {
                assert.equal(err.message, 'INVALID_RESPONSE');
                return true;
            },
        );
    });

    it('überschreibt vorherige Ticket-Werte', async () => {
        const { inst } = makeInstance(axiosReturns(200, {
            data: { ticket: 'NEW-TICKET', CSRFPreventionToken: 'NEW-CSRF' },
        }));

        inst._ticket = 'PVEAuthCookie=OLD-TICKET';
        inst._csrf   = 'OLD-CSRF';

        await inst.ticket();

        assert.equal(inst._ticket, 'PVEAuthCookie=NEW-TICKET');
        assert.equal(inst._csrf,   'NEW-CSRF');
    });
});

// ─── Token-Auth Tests ─────────────────────────────────────────────────────────

/**
 * Erstellt ProxmoxUtils-Instanz für Token-Auth ohne echten axios-Call.
 */
function makeTokenInstance(axiosMock) {
    const axiosPath = require.resolve('axios');
    const realAxios = require.cache[axiosPath];

    const fakeModule = { exports: axiosMock };
    fakeModule.exports.default      = axiosMock;
    fakeModule.exports.isAxiosError = axiosMock.isAxiosError ?? (() => false);
    require.cache[axiosPath] = fakeModule;

    const utilsPath = require.resolve('../lib/proxmox');
    delete require.cache[utilsPath];
    const ProxmoxUtils = require('../lib/proxmox');

    require.cache[axiosPath] = realAxios;

    const nodeList = [{
        realmIp:          '192.168.1.100',
        realmPort:        8006,
        realmUser:        'root',
        realm:            'pam',
        authType:         'token',
        realmTokenId:     'mytoken',
        realmTokenSecret: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    }];

    const adapter = makeAdapter();
    const inst    = new ProxmoxUtils(adapter, nodeList);
    return { inst, adapter };
}

describe('ProxmoxUtils.ticket() – Token-Auth', () => {

    it('kein HTTP-Call bei Token-Auth', async () => {
        let axiosCalled = false;
        const axiosMock = async () => { axiosCalled = true; return {}; };
        axiosMock.isAxiosError = () => false;

        const { inst } = makeTokenInstance(axiosMock);
        await inst.ticket();

        assert.ok(!axiosCalled, 'axios sollte bei Token-Auth NICHT aufgerufen werden');
    });

    it('setzt Authorization-Header im PVEAPIToken-Format', async () => {
        const { inst } = makeTokenInstance(async () => ({}));
        await inst.ticket();

        assert.ok(inst._ticket.startsWith('PVEAPIToken='),
            `Erwartete PVEAPIToken=..., bekam: ${inst._ticket}`);
        assert.ok(inst._ticket.includes('mytoken'),
            'Token-ID fehlt im Header');
        assert.ok(inst._ticket.includes('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
            'Token-Secret fehlt im Header');
    });

    it('CSRF ist leer bei Token-Auth', async () => {
        const { inst } = makeTokenInstance(async () => ({}));
        await inst.ticket();

        assert.equal(inst._csrf, '');
    });

    it('loggt debug-Meldung bei Token-Auth', async () => {
        const { inst, adapter } = makeTokenInstance(async () => ({}));
        await inst.ticket();

        assert.ok(
            adapter._logs.debug.some(m => m.includes('Token-Auth')),
            'Kein debug-Log für Token-Auth gefunden',
        );
    });

    it('_getData sendet Authorization-Header statt Cookie+CSRF bei Token-Auth', async () => {
        let capturedHeaders = null;
        const axiosMock = async (cfg) => {
            capturedHeaders = cfg.headers;
            return { status: 200, data: { data: [] } };
        };
        axiosMock.isAxiosError = () => false;

        const { inst } = makeTokenInstance(axiosMock);
        await inst.ticket();
        await inst.getNodes();

        assert.ok(capturedHeaders?.Authorization,
            'Authorization-Header fehlt');
        assert.ok(!capturedHeaders?.Cookie,
            'Cookie-Header darf bei Token-Auth nicht gesetzt sein');
        assert.ok(!capturedHeaders?.CSRFPreventionToken,
            'CSRFPreventionToken-Header darf bei Token-Auth nicht gesetzt sein');
        assert.ok(capturedHeaders.Authorization.startsWith('PVEAPIToken='),
            `Falsches Header-Format: ${capturedHeaders.Authorization}`);
    });

    it('wirft TOKEN_AUTH_FAILED bei 401 – kein Retry', async () => {
        let callCount = 0;
        const axiosMock = async () => {
            callCount++;
            return { status: 401, data: 'Unauthorized' };
        };
        axiosMock.isAxiosError = () => false;

        const { inst } = makeTokenInstance(axiosMock);
        inst._ticket  = 'PVEAPIToken=root@pam!mytoken=secret';
        inst.authType = 'token';

        await assert.rejects(
            () => inst.getNodes(),
            (err) => {
                assert.ok(err.message.includes('TOKEN_AUTH_FAILED'),
                    `Erwartete TOKEN_AUTH_FAILED im Fehler, bekam: ${err.message}`);
                return true;
            },
        );
        assert.equal(callCount, 1, 'Bei Token-Auth darf kein Retry erfolgen');
    });

    it('enthält User, Realm und Token-ID im Authorization-Header', async () => {
        const { inst } = makeTokenInstance(async () => ({}));
        await inst.ticket();

        // PVEAPIToken=USER@REALM!TOKENID=SECRET
        const header = inst._ticket;
        assert.ok(header.includes('@pam'),    `Realm fehlt: ${header}`);
        assert.ok(header.includes('!mytoken'), `Token-ID fehlt: ${header}`);
    });
});


