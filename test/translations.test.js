'use strict';

/**
 * Tests für lib/translations.js
 *
 * Ausführen: node --test test/translations.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    STATUS, SHUTDOWN, REBOOT, START, STOP, RESET, SUSPEND, RESUME, AVAILABLE,
    vmButtonLabels, nodeButtonLabels, stateNames,
    warnIndividualNodes, warnSingleClusterNode,
} = require('../lib/translations');

// ─── Alle unterstützten Sprachen ──────────────────────────────────────────────

const LANGUAGES = ['en', 'de', 'ru', 'fr', 'nl', 'pl', 'it', 'es', 'pt', 'uk', 'zh-cn'];

/**
 * Prüft ob ein Übersetzungs-Objekt alle Sprachen enthält und
 * keine leeren Strings hat.
 */
function assertAllLanguages(obj, label) {
    for (const lang of LANGUAGES) {
        assert.ok(
            typeof obj[lang] === 'string' && obj[lang].length > 0,
            `${label}: Sprache "${lang}" fehlt oder ist leer`,
        );
    }
}

// ─── Basis-Labels ─────────────────────────────────────────────────────────────

describe('Basis-Übersetzungsobjekte', () => {
    const entries = { STATUS, SHUTDOWN, REBOOT, START, STOP, RESET, SUSPEND, RESUME, AVAILABLE };

    for (const [name, obj] of Object.entries(entries)) {
        it(`${name} enthält alle 11 Sprachen ohne leere Werte`, () => {
            assertAllLanguages(obj, name);
        });
    }

    it('STATUS.en ist "Status"', () => {
        assert.equal(STATUS.en, 'Status');
    });

    it('START.de ist "Start"', () => {
        assert.equal(START.de, 'Start');
    });

    it('RESET.de ist "Zurücksetzen"', () => {
        assert.equal(RESET.de, 'Zurücksetzen');
    });

    it('SUSPEND.de ist "Anhalten"', () => {
        assert.equal(SUSPEND.de, 'Anhalten');
    });

    it('RESUME.de ist "Fortsetzen"', () => {
        assert.equal(RESUME.de, 'Fortsetzen');
    });

    it('AVAILABLE.en ist "Available"', () => {
        assert.equal(AVAILABLE.en, 'Available');
    });
});

// ─── vmButtonLabels ───────────────────────────────────────────────────────────

describe('vmButtonLabels', () => {
    const expectedCmds = ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume'];

    it('enthält alle 7 VM-Buttons', () => {
        for (const cmd of expectedCmds) {
            assert.ok(vmButtonLabels[cmd], `vmButtonLabels.${cmd} soll existieren`);
        }
    });

    for (const cmd of expectedCmds) {
        it(`vmButtonLabels.${cmd} enthält alle Sprachen`, () => {
            assertAllLanguages(vmButtonLabels[cmd], `vmButtonLabels.${cmd}`);
        });
    }

    it('vmButtonLabels.start ist identisch mit START', () => {
        assert.strictEqual(vmButtonLabels.start, START);
    });

    it('vmButtonLabels.shutdown ist identisch mit SHUTDOWN', () => {
        assert.strictEqual(vmButtonLabels.shutdown, SHUTDOWN);
    });

    it('vmButtonLabels.reset ist identisch mit RESET', () => {
        assert.strictEqual(vmButtonLabels.reset, RESET);
    });

    it('vmButtonLabels.suspend ist identisch mit SUSPEND', () => {
        assert.strictEqual(vmButtonLabels.suspend, SUSPEND);
    });

    it('vmButtonLabels.resume ist identisch mit RESUME', () => {
        assert.strictEqual(vmButtonLabels.resume, RESUME);
    });
});

// ─── nodeButtonLabels ─────────────────────────────────────────────────────────

describe('nodeButtonLabels', () => {
    it('enthält shutdown und reboot', () => {
        assert.ok(nodeButtonLabels.shutdown, 'shutdown soll existieren');
        assert.ok(nodeButtonLabels.reboot,   'reboot soll existieren');
    });

    it('enthält keine VM-spezifischen Buttons (start/stop/reset/suspend/resume)', () => {
        for (const cmd of ['start', 'stop', 'reset', 'suspend', 'resume']) {
            assert.equal(nodeButtonLabels[cmd], undefined, `nodeButtonLabels.${cmd} soll nicht existieren`);
        }
    });

    it('nodeButtonLabels.shutdown ist identisch mit SHUTDOWN', () => {
        assert.strictEqual(nodeButtonLabels.shutdown, SHUTDOWN);
    });

    it('nodeButtonLabels.reboot ist identisch mit REBOOT', () => {
        assert.strictEqual(nodeButtonLabels.reboot, REBOOT);
    });
});

// ─── stateNames ───────────────────────────────────────────────────────────────

describe('stateNames', () => {
    it('enthält status und available', () => {
        assert.ok(stateNames.status,    'stateNames.status soll existieren');
        assert.ok(stateNames.available, 'stateNames.available soll existieren');
    });

    it('stateNames.status ist identisch mit STATUS', () => {
        assert.strictEqual(stateNames.status, STATUS);
    });

    it('stateNames.available ist identisch mit AVAILABLE', () => {
        assert.strictEqual(stateNames.available, AVAILABLE);
    });
});

// ─── warnIndividualNodes ──────────────────────────────────────────────────────

describe('warnIndividualNodes(count)', () => {
    it('enthält alle Sprachen', () => {
        assertAllLanguages(warnIndividualNodes(3), 'warnIndividualNodes');
    });

    it('enthält die Anzahl im Text (en)', () => {
        const msg = warnIndividualNodes(5);
        assert.ok(msg.en.includes('5'), 'Anzahl 5 soll in der englischen Meldung vorkommen');
        assert.ok(msg.de.includes('5'), 'Anzahl 5 soll in der deutschen Meldung vorkommen');
    });

    it('erzeugt bei count=1 eine grammatisch korrekte Meldung (kein Absturz)', () => {
        assert.doesNotThrow(() => warnIndividualNodes(1));
    });
});

// ─── warnSingleClusterNode ───────────────────────────────────────────────────

describe('warnSingleClusterNode()', () => {
    it('enthält alle Sprachen', () => {
        assertAllLanguages(warnSingleClusterNode(), 'warnSingleClusterNode');
    });

    it('erwähnt "Cluster Node" in der englischen Meldung', () => {
        const msg = warnSingleClusterNode();
        assert.ok(msg.en.includes('Cluster Node'), '"Cluster Node" soll in der englischen Meldung stehen');
    });

    it('erwähnt "Cluster Node" in der deutschen Meldung', () => {
        const msg = warnSingleClusterNode();
        assert.ok(msg.de.includes('Cluster Node'));
    });
});
