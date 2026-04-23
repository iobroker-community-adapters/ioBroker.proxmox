'use strict';

/**
 * createCeph – legt Ceph-Objekte beim Adapter-Start an.
 *
 */
async function createCeph() {
    const cephid = `${this.namespace}.ceph`;

    try {
        await this.setObjectNotExistsAsync(cephid, {
            type: 'channel',
            common: { name: 'ceph' },
            native: {},
        });

        const cephInformation = await this.proxmox.getCephInformation();

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('createCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        for (const [lpEntry, lpData] of Object.entries(cephInformation.data)) {
            if (lpData === null || lpData === undefined) {
continue;
}

            if (typeof lpData === 'object') {
                await this.setObjectNotExistsAsync(`${cephid}.${lpEntry}`, {
                    type: 'folder',
                    common: { name: lpEntry },
                    native: {},
                });

                for (const [lpEntry2, lpData2] of Object.entries(lpData)) {
                    if (lpData2 === null || lpData2 === undefined) {
continue;
}

                    if (typeof lpData2 === 'object') {
                        await this.setObjectNotExistsAsync(`${cephid}.${lpEntry}.${lpEntry2}`, {
                            type: 'folder',
                            common: { name: lpEntry2 },
                            native: {},
                        });
                        for (const [lpEntry3, lpData3] of Object.entries(lpData2)) {
                            if (lpData3 === null || lpData3 === undefined || typeof lpData3 === 'object') {
continue;
}
                            await this.extendObjectAsync(`${cephid}.${lpEntry}.${lpEntry2}.${lpEntry3}`, {
                                type: 'state',
                                common: { name: lpEntry3, type: typeof lpData3, read: true, write: false, role: 'value' },
                                native: {},
                            });
                            await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}.${lpEntry3}`, lpData3, true);
                        }
                        continue;
                    }

                    await this.extendObjectAsync(`${cephid}.${lpEntry}.${lpEntry2}`, {
                        type: 'state',
                        common: { name: lpEntry2, type: typeof lpData2, read: true, write: false, role: 'value' },
                        native: {},
                    });
                    await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}`, lpData2, true);
                }
            } else {
                await this.extendObjectAsync(`${cephid}.${lpEntry}`, {
                    type: 'state',
                    common: { name: lpEntry, type: typeof lpData, read: true, write: false, role: 'value' },
                    native: {},
                });
                await this.setStateChangedAsync(`${cephid}.${lpEntry}`, lpData, true);
            }
        }
    } catch (err) {
        this.log.warn(`createCeph: Fehler beim Verarbeiten der Ceph-Informationen: ${err.message}`);
    }
}

/**
 * setCeph – aktualisiert Ceph-States im laufenden Betrieb.
 *
 */
async function setCeph() {
    const cephid = `${this.namespace}.ceph`;
    try {
        const cephInformation = await this.proxmox.getCephInformation();
        this.log.debug(`cephInformation: ${JSON.stringify(cephInformation)}`);

        if (!cephInformation || !cephInformation.data || typeof cephInformation.data !== 'object') {
            this.log.debug('setCeph: keine Ceph-Daten verfügbar (Ceph nicht installiert?)');
            return;
        }

        for (const [lpEntry, lpData] of Object.entries(cephInformation.data)) {
            if (lpData === null || lpData === undefined) {
continue;
}

            if (typeof lpData === 'object') {
                for (const [lpEntry2, lpData2] of Object.entries(lpData)) {
                    if (lpData2 === null || lpData2 === undefined) {
continue;
}

                    if (typeof lpData2 === 'object') {
                        for (const [lpEntry3, lpData3] of Object.entries(lpData2)) {
                            if (lpData3 === null || lpData3 === undefined || typeof lpData3 === 'object') {
continue;
}
                            await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}.${lpEntry3}`, lpData3, true);
                        }
                        continue;
                    }
                    await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}`, lpData2, true);
                }
            } else {
                await this.setStateChangedAsync(`${cephid}.${lpEntry}`, lpData, true);
            }
        }
    } catch (err) {
        this.log.warn(`setCeph: Fehler beim Abrufen der Ceph-Informationen: ${err.message}`);
    }
}

module.exports = { createCeph, setCeph };
