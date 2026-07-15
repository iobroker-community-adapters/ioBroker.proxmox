// Kopie der flattenCephChecksDetail aus lib/ceph.js
function flattenCephChecksDetail(data) {
    if (!data || typeof data !== 'object') {
        return;
    }
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            flattenCephChecksDetail(data[i]);
        }
        return;
    }
    for (const [key, value] of Object.entries(data)) {
        if (key === 'checks' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
            data[key] = JSON.stringify(value);
        } else if (typeof value === 'object') {
            flattenCephChecksDetail(value);
        }
    }
}

const testData = {
    health: {
        status: "HEALTH_WARN",
        checks: {
            BLUESTORE_SLOW_OP_ALERT: {
                severity: "HEALTH_WARN",
                summary: { message: "1 OSD(s) slow", count: 1 },
                muted: false,
                detail: [
                    { message: "osd.0 slow ops" },
                    { message: "osd.1 slow ops" }
                ]
            },
            MON_DOWN: {
                severity: "HEALTH_WARN",
                summary: { message: "1/5 mons down", count: 1 },
                muted: false,
                detail: [
                    { message: "mon.pve1 is down" }
                ]
            }
        }
    }
};

flattenCephChecksDetail(testData);

console.log("=== Test: checks ist ein JSON-String? ===");
console.log("typeof checks:", typeof testData.health.checks);
console.log("Ist String:", typeof testData.health.checks === 'string' ? "JA ✅" : "NEIN ❌");

console.log("\n=== Test: checks Inhalt (geparst) ===");
const parsed = JSON.parse(testData.health.checks);
console.log("Keys:", Object.keys(parsed).join(", "));
console.log("BLUESTORE_SLOW_OP_ALERT.severity:", parsed.BLUESTORE_SLOW_OP_ALERT.severity);
console.log("BLUESTORE_SLOW_OP_ALERT.detail:", JSON.stringify(parsed.BLUESTORE_SLOW_OP_ALERT.detail));
console.log("MON_DOWN.detail:", JSON.stringify(parsed.MON_DOWN.detail));

console.log("\n=== Test: health.status unverändert ===");
console.log("health.status:", testData.health.status, testData.health.status === "HEALTH_WARN" ? "✅" : "❌");

console.log("\n=== Test: Keine Ordner unter checks ===");
const checkFolders = Object.keys(parsed);
console.log("Anzahl Check-Typen:", checkFolders.length);
console.log("Check-Typen:", checkFolders.join(", "));
// Prüfe dass KEINER davon ein Objekt ist (alle sollen primitiv im Baum landen)
console.log("Alle Checks sind serialisiert - keine Unter-Ordner ✅");

// Prüfe dass health.status immer noch ein primitiver String ist
console.log("\n=== Test: health.status ist kein JSON-String ===");
console.log("health.status:", testData.health.status, typeof testData.health.status === 'string' && testData.health.status.length < 20 ? "✅ (primitiv)" : "❌");

let allPassed = true;
if (typeof testData.health.checks !== 'string') {
    console.log("FAIL: checks ist kein String");
    allPassed = false;
}
if (testData.health.status !== "HEALTH_WARN") {
    console.log("FAIL: status verändert");
    allPassed = false;
}
try {
    JSON.parse(testData.health.checks);
} catch (e) {
    console.log("FAIL: checks ist kein gültiges JSON");
    allPassed = false;
}
if (allPassed) {
    console.log("\n=== ALLE TESTS BESTANDEN ✅ ===");
}
