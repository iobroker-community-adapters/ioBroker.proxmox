'use strict';

/**
 * createHA – legt HA-Objekte beim Adapter-Start an.
 *
 */
async function createHA() {
    const haid = `${this.namespace}.ha`;

    try {
        await this.setObjectNotExistsAsync(haid, {
            type: 'channel',
            common: { name: 'ha' },
            native: {},
        });

        const haInformation = await this.proxmox.getHAStatusInformation();

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('createHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        for (const lpData of haInformation.data) {
            if (typeof lpData !== 'object' || lpData === null) {
continue;
}
            if (!lpData.id) {
                this.log.debug('createHA: HA-Eintrag ohne id übersprungen');
                continue;
            }

            const lpData2Id = String(lpData.id).replace(/[:/.\s]/g, '_');

            for (const lpEntry2 of Object.keys(lpData)) {
                if (lpEntry2 === 'id') {
continue;
}

                const lpData2 = lpData[lpEntry2];
                if (lpData2 === null || lpData2 === undefined) {
continue;
}

                await this.extendObjectAsync(`${haid}.${lpData2Id}_${lpEntry2}`, {
                    type: 'state',
                    common: { name: lpEntry2, type: typeof lpData2, read: true, write: false, role: 'value' },
                    native: {},
                });
                await this.setStateChangedAsync(`${haid}.${lpData2Id}_${lpEntry2}`, lpData2, true);
            }
        }
    } catch (err) {
        this.log.warn(`createHA: Fehler beim Verarbeiten der HA-Informationen: ${err.message}`);
    }
}

/**
 * setHA – aktualisiert HA-States im laufenden Betrieb.
 *
 */
async function setHA() {
    const haid = `${this.namespace}.ha`;
    try {
        const haInformation = await this.proxmox.getHAStatusInformation();
        this.log.debug(`haInformation: ${JSON.stringify(haInformation)}`);

        if (!haInformation || !Array.isArray(haInformation.data) || haInformation.data.length === 0) {
            this.log.debug('setHA: keine HA-Daten verfügbar (HA nicht konfiguriert?)');
            return;
        }

        for (const lpData of haInformation.data) {
            if (typeof lpData !== 'object' || lpData === null) {
continue;
}
            if (!lpData.id) {
                this.log.debug('setHA: HA-Eintrag ohne id übersprungen');
                continue;
            }

            const lpData2Id = String(lpData.id).replace(/[:/.\s]/g, '_');

            for (const lpEntry2 of Object.keys(lpData)) {
                if (lpEntry2 === 'id') {
continue;
}

                const lpData2 = lpData[lpEntry2];
                if (lpData2 === null || lpData2 === undefined) {
continue;
}

                await this.setStateChangedAsync(`${haid}.${lpData2Id}_${lpEntry2}`, lpData2, true);
            }
        }
    } catch (err) {
        this.log.warn(`setHA: Fehler beim Abrufen der HA-Informationen: ${err.message}`);
    }
}

module.exports = { createHA, setHA };
