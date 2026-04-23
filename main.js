
'use strict';

const utils        = require('@iobroker/adapter-core');
const ProxmoxUtils = require('./lib/proxmox');
const adapterName  = require('./package.json').name.split('.').pop();
const _methods     = require('./lib/methods');
const _nodes       = require('./lib/nodes');
const _vms         = require('./lib/vms');
const _ceph        = require('./lib/ceph');
const _ha          = require('./lib/ha');
const translations = require('./lib/translations');

class Proxmox extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: adapterName });

        this.proxmox  = null;
        this.objects  = {};
        this.nodesList = [];

        /** Alle ProxmoxUtils-Instanzen (1 pro Gruppe/Einzelnode) */
        this.proxmoxInstances = [];

        /**
         * Mapping: Node-Name (z.B. "pve") → ProxmoxUtils-Instanz
         * Wird nach getNodes() befüllt, damit onStateChange die richtige Instanz nutzt.
         *
         */
        this.nodeInstanceMap = {};

        this.offlineResourceStatus = {
            uptime: 0, disk: 0, netout: 0, netin: 0, diskread: 0,
            cpu: 0, diskwrite: 0, pid: 0, mem: 0, swap: 0,
            status: '', type: '', name: '', vmid: 0,
        };

        this.requestInterval = null;

        // lib/methods
        this.used_level       = _methods.used_level.bind(this);
        this.bytetoMb         = _methods.bytetoMb.bind(this);
        this.removeNamespace  = _methods.removeNamespace.bind(this);
        this.prepareNameForId = _methods.prepareNameForId.bind(this);
        this.findState        = _methods.findState.bind(this);

        // lib/nodes
        this.createNodes = _nodes.createNodes.bind(this);
        this.setNodes    = _nodes.setNodes.bind(this);

        // lib/vms
        this.createVM    = _vms.createVM.bind(this);
        this.setMachines = _vms.setMachines.bind(this);

        // lib/ceph
        this.createCeph = _ceph.createCeph.bind(this);
        this.setCeph    = _ceph.setCeph.bind(this);

        // lib/ha
        this.createHA = _ha.createHA.bind(this);
        this.setHA    = _ha.setHA.bind(this);

        this.on('ready',       this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message',     this.onMessage.bind(this));
        this.on('unload',      this.onUnload.bind(this));
    }

    async onReady() {
        try {
            await this.setStateAsync('info.connection', { val: false, ack: true });
            await this.setStateAsync('info.webhookNotification', { val: '', ack: true });
            this.subscribeForeignStates('info.webhookNotification');

            if (await this.initConfig()) {
                this.log.debug(`Adapter settings successfully verified and initialized.`);
            } else {
                this.log.error(`Adapter settings initialization failed.  ---> Please check your adapter instance settings!`);
                return;
            }

            this.proxmoxInstances = [];

            // Cluster-Nodes → eine gemeinsame Instanz (Round-Robin Failover)
            if (this.clusterNodesList.length > 0) {
                this.proxmoxInstances.push(new ProxmoxUtils(this, this.clusterNodesList));
                this.log.debug(`Cluster-Instanz mit ${this.clusterNodesList.length} Node(s) erstellt`);
            }

            // Einzel-Nodes → je eine eigene Instanz (unabhängige Abfrage)
            for (const node of this.individualNodesList) {
                this.proxmoxInstances.push(new ProxmoxUtils(this, [node]));
                this.log.debug(`Einzel-Instanz für ${node.realmIp}:${node.realmPort} erstellt`);
            }

            if (this.proxmoxInstances.length === 0) {
                this.log.error('Keine Proxmox-Instanzen konfiguriert. Adapter gestoppt.');
                return;
            }

            // Tickets für alle Instanzen holen
            for (const inst of this.proxmoxInstances) {
                await inst.ticket();
            }

            // Primäre Instanz für Backward-Compat setzen
            this.proxmox = this.proxmoxInstances[0];

            await this.readObjects();
            await this.getNodes();

            // subscribe on all state changes
            await this.subscribeStatesAsync('*');

            await this.sendRequest(1); // start interval
        } catch (err) {
            this.log.error('Unable to authenticate with Proxmox host. Please check your credentials');
            typeof this.terminate === 'function' ? this.terminate(11) : process.exit(11);
        }
    }

    /**
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        if (state && !state.ack) {
            const obj = await this.getForeignObjectAsync(id);
            if (obj && obj?.native?.type) {
                const type = obj.native.type;
                const node = obj.native.node;

                let command = id.split('.')[3];

                if (this.config.newTreeStructure && type !== 'node') {
                    command = id.split('.')[4];
                }
                this.log.debug(`state changed: "${command}" type: "${type}" node: "${node}"`);

                if (type === 'lxc' || type === 'qemu') {
                    const vmid = obj.native?.vmid;
                    const inst = this.nodeInstanceMap[node] ?? this.proxmox;

                    const actions = {
                        start:    () => inst?.qemuStart(node, type, vmid),
                        stop:     () => inst?.qemuStop(node, type, vmid),
                        reset:    () => inst?.qemuReset(node, type, vmid),
                        resume:   () => inst?.qemuResume(node, type, vmid),
                        shutdown: () => inst?.qemuShutdown(node, type, vmid),
                        suspend:  () => inst?.qemuSuspend(node, type, vmid),
                        reboot:   () => inst?.qemuReboot(node, type, vmid),
                    };

                    const action = actions[command];
                    if (!action) {
                        return;
                    }

                    try {
                        const data = await action();
                        this.log.info(`${command} ${vmid}: ${JSON.stringify(data)}`);
                        await this.sendRequest(10000);
                    } catch (err) {
                        this.log.warn(`Unable to execute "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                    }
                } else if (type === 'node') {
                    const inst = this.nodeInstanceMap[node] ?? this.proxmox;

                    const actions = {
                        shutdown: () => inst?.nodeShutdown(node),
                        reboot:   () => inst?.nodeReboot(node),
                    };

                    const action = actions[command];
                    if (!action) {
                        return;
                    }
                    
                    try {
                        const data = await action();
                        this.log.info(`${command} ${node}: ${JSON.stringify(data)}`);
                        await this.sendRequest(10000);
                    } catch (err) {
                        this.log.warn(`Unable to execute "${command}" type: "${type}" node: "${node}": ${err}`);
                    }                                     
                }
            } else {
                if (id.includes('webhookNotification') && !state.ack) {
                    this.log.debug(`webhook Notif : ${state.val}`);
                    let notifArray;
                    try {
                        notifArray = await this.parseNotificationInfo(state.val);
                    } catch (err) {
                        notifArray = [];
                    }
                    await this.setStateAsync('info.webhookNotificationArray', { val: JSON.stringify(notifArray), ack: true });
                }
            }
        }
    }

    async sendRequest(nextRunTimeout) {
        await this.setStateAsync('info.lastUpdate', { val: Date.now(), ack: true });

        if (this.requestInterval) {
            this.clearTimeout(this.requestInterval);
            this.requestInterval = null;
        }

        const delay = nextRunTimeout ?? this.config.requestInterval * 1000;

        this.requestInterval = this.setTimeout(async () => {
            this.requestInterval = null;

            if (this.proxmoxInstances.length === 0) {
                return;
            }

            this.log.debug('sendRequest interval started');

            let anySuccess = false;

            for (const inst of this.proxmoxInstances) {
                inst.resetResponseCache();
                // this.proxmox zeigt auf die aktuell verarbeitete Instanz –
                // alle lib-Funktionen (createNodes, setMachines, …) nutzen this.proxmox
                this.proxmox = inst;

                try {
                    const nodes = await inst.getNodes();
                    this.log.debug(`Nodes [${inst.nodeURL}]: ${JSON.stringify(nodes)}`);

                    // Node→Instanz-Mapping aktualisieren (für onStateChange)
                    for (const n of nodes) {
                        this.nodeInstanceMap[n.node] = inst;
                    }

                    await this.setNodes(nodes);

                    if (this.config.requestCephInformation) {
await this.setCeph();
}
                    if (this.config.requestHAInformation)   {
await this.setHA();
}

                    await this.setMachines();
                    anySuccess = true;
                } catch (err) {
                    this.log.warn(`Cannot send request [${inst.nodeURL}]: ${err}`);
                }
            }

            await this.setStateAsync('info.connection', { val: anySuccess, ack: true });
            if (!anySuccess) {
                this.log.warn('Alle Proxmox-Instanzen nicht erreichbar');
            }

            // Schedule next run
            await this.sendRequest();
        }, delay);
    }

    async getNodes() {
        for (const inst of this.proxmoxInstances) {
            this.proxmox = inst;
            try {
                const nodes = await inst.getNodes();
                this.log.debug(`Nodes [${inst.nodeURL}]: ${JSON.stringify(nodes)}`);

                // Node→Instanz-Mapping aufbauen
                for (const n of nodes) {
                    this.nodeInstanceMap[n.node] = inst;
                }

                await this.createNodes(nodes);
            } catch (e) {
                this.log.error(`Could not create nodes [${inst.nodeURL}], please restart adapter: ${e.message}`);
            }
        }
    }

    /**
     * Reads all channel objects and saves them in RAM
     *
     * @returns {Promise<void>}
     */
    async readObjects() {
        try {
            this.objects = await this.getForeignObjectsAsync(`${this.namespace}.*`, 'channel');
            this.log.debug(`[readObjects] reading objects: ${JSON.stringify(this.objects)}`);
        } catch (err) {
            this.log.error(err);
        }
    }

    /**
     * Create state object if non existing and set states
     *
     * @param {string} sid - state id w/o name
     * @param {string} name - name of the state
     * @param {string} type - e.g., time
     * @param {any} val - state val
     * @returns {Promise<void>}
     */
    async createCustomState(sid, name, type, val) {
        const typeMap = {
            time:        { type: 'number', unit: 'sec.' },
            size:        { type: 'number', unit: 'MiB'  },
            sizeb:       { type: 'number', unit: 'byte' },
            level:       { type: 'number', unit: '%'    },
            default_num: { type: 'number'               },
            text:        { type: 'string'               },
        };

        const common = typeMap[type];
        if (!common) {
            this.log.warn(`createCustomState: unknown type "${type}" for state "${name}"`);
            return;
        }

        await this.setObjectNotExistsAsync(`${sid}.${name}`, {
            type: 'state',
            common: {
                name,
                role: 'value',
                write: false,
                read: true,
                ...common,
            },
            native: {},
        });
        await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
    }

    async parseNotificationInfo(info) {
        if (typeof info !== 'string') {
            return {
                severity: null,
                title: null,
                message: null,
                timestamp: null,
            };
        }

        // Ersten und letzten Trenner gezielt finden
        const firstSep = info.indexOf('***');
        const lastSep = info.lastIndexOf('***');

        if (firstSep === -1 || lastSep === firstSep) {
            // Ungültiges / unbekanntes Format
            return {
                severity: null,
                title: null,
                message: info.trim(),
                timestamp: null,
            };
        }

        const severity = info.slice(0, firstSep).trim();

        const restAfterSeverity = info.slice(firstSep + 3);
        const secondSep = restAfterSeverity.indexOf('***');

        if (secondSep === -1) {
            return {
                severity,
                title: null,
                message: restAfterSeverity.trim(),
                timestamp: null,
            };
        }

        const title = restAfterSeverity.slice(0, secondSep).trim();

        const messageAndTs = restAfterSeverity.slice(secondSep + 3);

        const message = messageAndTs
            .slice(0, lastSep - firstSep - secondSep - 6)
            .replace(/\r/g, '')
            .trim();

        const tsRaw = info.slice(lastSep + 3).trim();
        const timestamp = /^\d+$/.test(tsRaw) ? Number(tsRaw) : null;

        return {
            severity,
            title,
            message: message || null,
            timestamp,
        };
    }

    /**
     * Returns a translated string based on ioBroker system language.
     * Falls back to English if the language is not supported.
     *
     * @param {Record<string, string>} translations - Object with language codes as keys
     * @returns {Promise<string>}
     */
    async _t(translations) {
        if (!this._systemLang) {
            try {
                const sysConfig = await this.getForeignObjectAsync('system.config');
                this._systemLang = sysConfig?.common?.language || 'en';
            } catch {
                this._systemLang = 'en';
            }
        }
        return translations[this._systemLang] || translations['en'];
    }

    async initConfig() {
        if (this.config.tableDevices.length < 1) {
            return false;
        }

        if (this.config.requestInterval < 5) {
            this.log.info('Intervall configured < 5s, setting to 5s');
            this.config.requestInterval = 5;
        }

        /** Nodes die gemeinsam als Cluster fungieren (Failover-Gruppe) */
        this.clusterNodesList = [];
        /** Nodes die einzeln und unabhängig abgefragt werden */
        this.individualNodesList = [];

        for (const nodeDevice of this.config.tableDevices) {
            if (!nodeDevice.enabled) {
continue;
}

            const obj = {
                realmIp:       nodeDevice.realmIp,
                realmPort:     nodeDevice.realmPort,
                realmUser:     nodeDevice.realmUser,
                realmPassword: nodeDevice.realmPassword,
                realm:         nodeDevice.realm,
            };

            if (nodeDevice.clusterNode) {
                this.clusterNodesList.push(obj);
            } else {
                this.individualNodesList.push(obj);
            }
        }

        this.log.debug(
            `initConfig: ${this.clusterNodesList.length} Cluster-Node(s), ` +
            `${this.individualNodesList.length} Einzel-Node(s)`
        );

        // ── Warnung bei wahrscheinlich falsch konfiguriertem Cluster ──────
        if (this.individualNodesList.length > 1) {
            this.log.warn(await this._t(translations.warnIndividualNodes(this.individualNodesList.length)));
        }

        if (this.clusterNodesList.length === 1) {
            this.log.warn(await this._t(translations.warnSingleClusterNode()));
        }

        // Backward-Compat: nodesList enthält alle aktivierten Nodes
        this.nodesList = [...this.clusterNodesList, ...this.individualNodesList];

        return this.nodesList.length > 0;
    }

    /**
     * @param {ioBroker.Message} msg
     */
    async onMessage(msg) {
        if (!msg || !msg.command) {
            return;
        }

        if (msg.command === 'cleanup') {
            this.log.info('Smart-Cleanup gestartet: Verwaiste VM/LXC-Datenpunkte werden ermittelt...');
            try {
                if (!this.proxmox) {
                    throw new Error('Proxmox-Verbindung nicht initialisiert. Bitte Adapter neu starten.');
                }

                // Aktuelle Ressourcen von Proxmox holen
                const resources = await this.proxmox.getClusterResources();

                // Set der aktuell vorhandenen VM/LXC-Namen aufbauen
                const activeNames = new Set();
                for (const res of resources) {
                    if (res.type === 'qemu' || res.type === 'lxc') {
                        const resName = this.prepareNameForId(res.name);
                        if (this.config.newTreeStructure) {
                            activeNames.add(`${res.type}.${resName}`);
                        } else {
                            activeNames.add(`${res.type}_${resName}`);
                        }
                    }
                }

                this.log.debug(`Smart-Cleanup: ${activeNames.size} aktive VMs/LXC in Proxmox gefunden`);

                // Alle ioBroker-Channel-Objekte des Adapters lesen
                const allChannels = await this.getForeignObjectsAsync(`${this.namespace}.*`, 'channel');

                const toDelete = [];
                for (const fullId of Object.keys(allChannels)) {
                    const obj = allChannels[fullId];
                    const native = obj?.native;

                    // Nur qemu/lxc Channel-Objekte prüfen (keine storage/node/ceph/ha)
                    if (!native || (native.type !== 'qemu' && native.type !== 'lxc')) {
                        continue;
                    }

                    // Relativer Pfad ohne Namespace + führenden Punkt
                    const relId = fullId.replace(`${this.namespace}.`, '');

                    // Prüfen ob diese Maschine noch in Proxmox existiert
                    const stillActive = [...activeNames].some(name => relId === name || relId.startsWith(`${name}.`) || relId.startsWith(`${name}/`));

                    if (!stillActive) {
                        toDelete.push(fullId);
                    }
                }

                this.log.info(`Smart-Cleanup: ${toDelete.length} verwaiste Channel(s) gefunden`);

                // Verwaiste Channels rekursiv löschen
                let deleted = 0;
                for (const id of toDelete) {
                    const relId = id.replace(`${this.namespace}.`, '');
                    await this.delObjectAsync(relId, { recursive: true });
                    delete this.objects[id];
                    deleted++;
                    this.log.info(`Smart-Cleanup: Gelöscht → "${id}"`);
                }

                const resultMsg = deleted > 0
                    ? `${deleted} verwaiste VM/LXC-Datenpunkte erfolgreich gelöscht.`
                    : 'Keine verwaisten Datenpunkte gefunden – alles aktuell.';

                this.log.info(`Smart-Cleanup abgeschlossen: ${resultMsg}`);

                if (msg.callback) {
                    this.sendTo(msg.from, msg.command, { result: 'ok', deleted, message: resultMsg }, msg.callback);
                }

                if (deleted > 0) {
                    this.restart();
                }
            } catch (err) {
                this.log.error(`Smart-Cleanup fehlgeschlagen: ${err.message}`);
                if (msg.callback) {
                    this.sendTo(msg.from, msg.command, { result: 'error', error: err.message }, msg.callback);
                }
            }
        }
    }

    /**
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            for (const inst of this.proxmoxInstances) {
                inst.stop();
            }

            if (this.requestInterval) {
                this.log.debug('clearing request timeout');
                this.clearTimeout(this.requestInterval);
                this.requestInterval = null;
            }

            // Alle VM/LXC-available auf false und connection auf false setzen
            const statePromises = [];

            statePromises.push(
                this.setStateAsync('info.connection', { val: false, ack: true }).catch(() => {})
            );

            for (const fullId of Object.keys(this.objects)) {
                const obj = this.objects[fullId];
                const type = obj?.native?.type;
                if (type === 'qemu' || type === 'lxc') {
                    const relId = fullId.replace(`${this.namespace}.`, '');
                    statePromises.push(
                        this.setStateAsync(`${relId}.available`, { val: false, ack: true }).catch(() => {})
                    );
                }
            }

            Promise.all(statePromises)
                .catch(() => {})
                .finally(() => callback());

        } catch (e) {
            callback();
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options]
     */
    module.exports = (options) => new Proxmox(options);
} else {
    // otherwise start the instance directly
    new Proxmox();
}
