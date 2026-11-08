import * as utils from '@iobroker/adapter-core';
import * as _ceph from './lib/ceph';
import * as _ha from './lib/ha';
import * as _methods from './lib/methods';
import * as _nodes from './lib/nodes';
import { ProxmoxUtils } from './lib/proxmox';
import * as translations from './lib/translations';
import type {
    CustomStateType,
    KnownObjects,
    NotificationInfo,
    OfflineResourceStatus,
    ProxmoxAdapterContext,
    ProxmoxClusterResource,
    ProxmoxNode,
    ProxmoxNodeConfig,
} from './lib/types';
import * as _vms from './lib/vms';

const ADAPTER_NAME = 'proxmox';

class Proxmox extends utils.Adapter implements ProxmoxAdapterContext {
    /** Die aktuell verarbeitete Instanz. Wird in sendRequest() und getNodes() umgesetzt. */
    public proxmox: ProxmoxUtils | null = null;
    public objects: KnownObjects = {};
    public nodesList: ProxmoxNodeConfig[] = [];

    /** Nodes die gemeinsam als Cluster fungieren (Failover-Gruppe) */
    public clusterNodesList: ProxmoxNodeConfig[] = [];
    /** Nodes die einzeln und unabhängig abgefragt werden */
    public individualNodesList: ProxmoxNodeConfig[] = [];

    /** Alle ProxmoxUtils-Instanzen (1 pro Gruppe/Einzelnode) */
    public proxmoxInstances: ProxmoxUtils[] = [];

    /**
     * Mapping: Node-Name (z.B. "pve") → ProxmoxUtils-Instanz
     * Wird nach getNodes() befüllt, damit onStateChange die richtige Instanz nutzt.
     */
    public nodeInstanceMap: Record<string, ProxmoxUtils> = {};

    public offlineResourceStatus: OfflineResourceStatus = {
        uptime: 0,
        disk: 0,
        netout: 0,
        netin: 0,
        diskread: 0,
        cpu: 0,
        diskwrite: 0,
        pid: 0,
        mem: 0,
        swap: 0,
        status: '',
        type: '',
        name: '',
        vmid: 0,
    };

    public requestInterval: ioBroker.Timeout | null | undefined = null;
    public stopping = false;

    private _systemLang: string | undefined;

    // lib/methods
    public used_level = _methods.used_level;
    public bytetoMb = _methods.bytetoMb;
    public removeNamespace = _methods.removeNamespace.bind(this);
    public prepareNameForId = _methods.prepareNameForId;
    public findState = _methods.findState;

    // lib/nodes
    public createNodes: (nodes: ProxmoxNode[]) => Promise<void> = _nodes.createNodes.bind(this);
    public setNodes: (nodes: ProxmoxNode[]) => Promise<void> = _nodes.setNodes.bind(this);

    // lib/vms
    public createVM: () => Promise<void> = _vms.createVM.bind(this);
    public setMachines: () => Promise<void> = _vms.setMachines.bind(this);

    // lib/ceph
    public createCeph: () => Promise<void> = _ceph.createCeph.bind(this);
    public setCeph: () => Promise<void> = _ceph.setCeph.bind(this);

    // lib/ha
    public createHA: () => Promise<void> = _ha.createHA.bind(this);
    public setHA: () => Promise<void> = _ha.setHA.bind(this);

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: ADAPTER_NAME });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        try {
            await this.setStateAsync('info.connection', { val: false, ack: true });
            await this.setStateAsync('info.webhookNotification', { val: '', ack: true });
            this.subscribeForeignStates('info.webhookNotification');

            if (await this.initConfig()) {
                this.log.debug(`Adapter settings successfully verified and initialized.`);
            } else {
                this.log.error(
                    `Adapter settings initialization failed.  ---> Please check your adapter instance settings!`,
                );
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

            // Tickets für alle Instanzen holen – einzelne Fehler sollen nicht den Start abbrechen
            for (const inst of this.proxmoxInstances) {
                try {
                    await inst.ticket();
                } catch (ticketErr) {
                    this.log.warn(
                        `Ticket für Instanz [${inst.nodeURL}] fehlgeschlagen: ${(ticketErr as Error).message} – Instanz wird im Polling-Zyklus erneut versucht`,
                    );
                }
            }

            // Primäre Instanz für Backward-Compat setzen
            this.proxmox = this.proxmoxInstances[0];

            await this.readObjects();
            await this.getNodes();

            // Deckt auch alle Buttons ab. Nicht zusätzlich einzeln abonnieren: Redis liefert je passendem
            // Muster eine Nachricht, Befehle würden doppelt ausgeführt.
            await this.subscribeStatesAsync('*');

            this.sendRequest(); // start interval with configured delay
        } catch (e) {
            const err = e as Error | undefined;
            const reason = err?.message || String(err);
            this.log.error(`Unable to authenticate with Proxmox host. Please check your credentials. Error: ${reason}`);
            this.log.debug(`Auth error stack: ${err?.stack || 'n/a'}`);
            this.terminate(11);
        }
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (state && !state.ack) {
            const obj = await this.getForeignObjectAsync(id);
            if (obj?.native?.type) {
                const type = obj.native.type as string;
                const node = obj.native.node as string;

                let command = id.split('.')[3];

                if (this.config.newTreeStructure && type !== 'node') {
                    command = id.split('.')[4];
                }
                this.log.debug(`state changed: "${command}" type: "${type}" node: "${node}"`);

                if (type === 'lxc' || type === 'qemu') {
                    const vmid = obj.native?.vmid as number;
                    const inst = this.nodeInstanceMap[node] ?? this.proxmox;

                    const actions: Record<string, () => Promise<unknown> | undefined> = {
                        start: () => inst?.qemuStart(node, type, vmid),
                        stop: () => inst?.qemuStop(node, type, vmid),
                        reset: () => inst?.qemuReset(node, type, vmid),
                        resume: () => inst?.qemuResume(node, type, vmid),
                        shutdown: () => inst?.qemuShutdown(node, type, vmid),
                        suspend: () => inst?.qemuSuspend(node, type, vmid),
                        reboot: () => inst?.qemuReboot(node, type, vmid),
                    };

                    const action = actions[command];
                    if (!action) {
                        return;
                    }

                    try {
                        const data = await action();
                        this.log.info(`${command} ${vmid}: ${JSON.stringify(data)}`);
                        this.sendRequest(10000);
                    } catch (err) {
                        this.log.warn(
                            `Unable to execute "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err as string}`,
                        );
                    }
                } else if (type === 'node') {
                    const inst = this.nodeInstanceMap[node] ?? this.proxmox;

                    const actions: Record<string, () => Promise<unknown> | undefined> = {
                        shutdown: () => inst?.nodeShutdown(node),
                        reboot: () => inst?.nodeReboot(node),
                    };

                    const action = actions[command];
                    if (!action) {
                        return;
                    }

                    try {
                        const data = await action();
                        this.log.info(`${command} ${node}: ${JSON.stringify(data)}`);
                        this.sendRequest(10000);
                    } catch (err) {
                        this.log.warn(
                            `Unable to execute "${command}" type: "${type}" node: "${node}": ${err as string}`,
                        );
                    }
                }
            } else {
                if (id.includes('webhookNotification')) {
                    this.log.debug(`webhook Notif : ${String(state.val)}`);
                    let notifArray: NotificationInfo | never[];
                    try {
                        notifArray = await this.parseNotificationInfo(state.val);
                    } catch {
                        notifArray = [];
                    }
                    await this.setStateAsync('info.webhookNotificationArray', {
                        val: JSON.stringify(notifArray),
                        ack: true,
                    });
                }
            }
        }
    }

    public sendRequest(nextRunTimeout?: number): void {
        if (this.requestInterval) {
            this.clearTimeout(this.requestInterval);
            this.requestInterval = null;
        }

        const delay = nextRunTimeout ?? this.config.requestInterval * 1000;

        this.requestInterval = this.setTimeout(async () => {
            this.requestInterval = null;

            if (this.proxmoxInstances.length === 0) {
                this.log.warn('sendRequest: Keine Proxmox-Instanzen vorhanden – warte auf nächsten Zyklus');
                if (!this.stopping) {
                    this.sendRequest();
                }
                return;
            }

            this.log.debug('sendRequest interval started');
            await this.setStateAsync('info.lastUpdate', { val: Date.now(), ack: true });

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
                    if (this.config.requestHAInformation) {
                        await this.setHA();
                    }

                    await this.setMachines();
                    anySuccess = true;
                } catch (err) {
                    if ((err as Error).message !== 'STOPPED') {
                        this.log.warn(`Cannot send request [${inst.nodeURL}]: ${err as string}`);
                    }
                }
            }

            await this.setStateChangedAsync('info.connection', { val: anySuccess, ack: true });

            // Collect connected node info as "ip:port" strings from the currently active nodeURL
            const nodeAddresses: string[] = [];
            for (const inst of this.proxmoxInstances) {
                if (inst?.nodeURL) {
                    // nodeURL format: https://{ip}:{port}/api2/json
                    const hostPort = inst.nodeURL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                    nodeAddresses.push(hostPort);
                }
            }
            await this.setStateAsync('info.node', { val: nodeAddresses.join(', '), ack: true });

            if (!anySuccess) {
                this.log.warn('Alle Proxmox-Instanzen nicht erreichbar');
            }

            // Schedule next run – nur wenn Adapter noch läuft
            if (!this.stopping) {
                this.sendRequest();
            }
        }, delay);
    }

    public async getNodes(): Promise<void> {
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
                if ((e as Error).message === 'STOPPED') {
                    return; // Adapter wird beendet – kein Logging nötig
                }
                this.log.error(
                    `Could not create nodes [${inst.nodeURL}], please restart adapter: ${(e as Error).message}`,
                );
            }
        }
    }

    /**
     * Reads all channel objects and saves them in RAM
     */
    public async readObjects(): Promise<void> {
        try {
            this.objects = await this.getForeignObjectsAsync(`${this.namespace}.*`, 'channel');
            this.log.debug(`[readObjects] reading objects: ${JSON.stringify(this.objects)}`);
        } catch (err) {
            this.log.error(err as string);
        }
    }

    /**
     * Create state object if non existing and set states
     *
     * @param sid - state id w/o name
     * @param name - name of the state
     * @param type - e.g., time
     * @param val - state val
     */
    public async createCustomState(
        sid: string,
        name: string,
        type: CustomStateType,
        val: ioBroker.StateValue,
    ): Promise<void> {
        const typeMap: Record<string, { type: ioBroker.CommonType; unit?: string }> = {
            time: { type: 'number', unit: 'sec.' },
            size: { type: 'number', unit: 'MiB' },
            sizeb: { type: 'number', unit: 'byte' },
            level: { type: 'number', unit: '%' },
            default_num: { type: 'number' },
            text: { type: 'string' },
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

    // eslint-disable-next-line @typescript-eslint/require-await -- Fehler landen als Rejection im catch von onStateChange
    public async parseNotificationInfo(info: unknown): Promise<NotificationInfo> {
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
     * @param texts - Object with language codes as keys
     */
    public async _t(texts: translations.Translations): Promise<string> {
        if (!this._systemLang) {
            try {
                const sysConfig = await this.getForeignObjectAsync('system.config');
                this._systemLang = sysConfig?.common?.language || 'en';
            } catch {
                this._systemLang = 'en';
            }
        }
        return texts[this._systemLang] || texts.en;
    }

    public async initConfig(): Promise<boolean> {
        if (this.config.tableDevices.length < 1) {
            return false;
        }

        if (this.config.requestInterval < 5) {
            this.log.info('Intervall configured < 5s, setting to 5s');
            this.config.requestInterval = 5;
        }

        this.clusterNodesList = [];
        this.individualNodesList = [];

        for (const nodeDevice of this.config.tableDevices) {
            if (!nodeDevice.enabled) {
                continue;
            }

            const obj: ProxmoxNodeConfig = {
                realmIp: nodeDevice.realmIp,
                realmPort: nodeDevice.realmPort,
                realmUser: nodeDevice.realmUser,
                realmPassword: nodeDevice.realmPassword,
                realm: nodeDevice.realm,
                authType: nodeDevice.authType || 'password',
                realmTokenId: nodeDevice.realmTokenId || '',
                realmTokenSecret: nodeDevice.realmTokenSecret || '',
            };

            if (nodeDevice.clusterNode) {
                this.clusterNodesList.push(obj);
            } else {
                this.individualNodesList.push(obj);
            }
        }

        this.log.debug(
            `initConfig: ${this.clusterNodesList.length} Cluster-Node(s), ` +
                `${this.individualNodesList.length} Einzel-Node(s)`,
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

    private async onMessage(msg: ioBroker.Message): Promise<void> {
        if (!msg || !msg.command) {
            return;
        }

        if (msg.command === 'cleanup') {
            this.log.info('Smart-Cleanup gestartet: Verwaiste VM/LXC-Datenpunkte werden ermittelt...');
            try {
                if (!this.proxmoxInstances || this.proxmoxInstances.length === 0) {
                    throw new Error('Proxmox-Verbindung nicht initialisiert. Bitte Adapter neu starten.');
                }

                // Aktuelle Ressourcen von ALLEN Proxmox-Instanzen holen
                let resources: ProxmoxClusterResource[] = [];
                const idNames = new Map<ProxmoxClusterResource, string>();
                for (const inst of this.proxmoxInstances) {
                    try {
                        const r = await inst.getClusterResources();
                        resources = resources.concat(r);
                        // Je Instanz ermitteln, genau wie createVM() und setMachines()
                        for (const [res, name] of _vms.getMachineIdNames(this, r)) {
                            idNames.set(res, name);
                        }
                    } catch (instErr) {
                        this.log.warn(
                            `Smart-Cleanup: Instanz [${inst.nodeURL}] nicht erreichbar – wird übersprungen: ${(instErr as Error).message}`,
                        );
                    }
                }
                if (resources.length === 0) {
                    throw new Error('Keine Ressourcen von Proxmox erhalten. Sind alle Instanzen erreichbar?');
                }

                // Set der aktuell vorhandenen VM/LXC-Namen aufbauen (Duplikate via Set vermeiden)
                const activeNames = new Set<string>();
                for (const res of resources) {
                    if (res.type === 'qemu' || res.type === 'lxc') {
                        const resName = idNames.get(res) ?? this.prepareNameForId(res.name);
                        if (this.config.newTreeStructure) {
                            activeNames.add(`${res.type}.${resName}`);
                        } else {
                            activeNames.add(`${res.type}_${resName}`);
                        }
                    }
                }

                this.log.debug(
                    `Smart-Cleanup: ${activeNames.size} aktive VMs/LXC in Proxmox gefunden: ${JSON.stringify([...activeNames])}`,
                );

                // Alle ioBroker-Channel-Objekte des Adapters lesen
                const allChannels = await this.getForeignObjectsAsync(`${this.namespace}.*`, 'channel');

                const toDelete: string[] = [];
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
                    // relId ist z.B. "qemu.myvm" oder "qemu_myvm"
                    const stillActive = [...activeNames].some(
                        name => relId === name || relId.startsWith(`${name}.`) || relId.startsWith(`${name}/`),
                    );

                    if (!stillActive) {
                        toDelete.push(fullId);
                        this.log.debug(`Smart-Cleanup: Markiert für Löschung: "${fullId}" (relId="${relId}")`);
                    }
                }

                this.log.info(`Smart-Cleanup: ${toDelete.length} verwaiste Channel(s) gefunden`);

                // Verwaiste Channels rekursiv löschen
                let deleted = 0;
                for (const id of toDelete) {
                    const relId = id.replace(`${this.namespace}.`, '');
                    try {
                        await this.delObjectAsync(relId, { recursive: true });
                        delete this.objects[id];
                        deleted++;
                        this.log.info(`Smart-Cleanup: Gelöscht → "${id}"`);
                    } catch (delErr) {
                        this.log.warn(`Smart-Cleanup: Fehler beim Löschen von "${id}": ${(delErr as Error).message}`);
                    }
                }

                const resultMsg =
                    deleted > 0
                        ? `${deleted} verwaiste VM/LXC-Datenpunkte erfolgreich gelöscht.`
                        : 'Keine verwaisten Datenpunkte gefunden – alles aktuell.';

                this.log.info(`Smart-Cleanup abgeschlossen: ${resultMsg}`);

                if (msg.callback) {
                    this.sendTo(msg.from, msg.command, { result: 'ok', deleted, message: resultMsg }, msg.callback);
                }

                // Kleines Delay, damit die sendTo-Antwort vor dem Neustart übertragen wird
                if (deleted > 0) {
                    this.setTimeout(() => this.restart(), 1500);
                }
            } catch (err) {
                this.log.error(`Smart-Cleanup fehlgeschlagen: ${(err as Error).message}`);
                if (msg.callback) {
                    this.sendTo(
                        msg.from,
                        msg.command,
                        { result: 'error', error: (err as Error).message },
                        msg.callback,
                    );
                }
            }
        }
    }

    private onUnload(callback: () => void): void {
        try {
            this.stopping = true;

            for (const inst of this.proxmoxInstances) {
                inst.stop();
            }

            if (this.requestInterval) {
                this.log.debug('clearing request timeout');
                this.clearTimeout(this.requestInterval);
                this.requestInterval = null;
            }

            // Alle VM/LXC-available auf false und connection auf false setzen
            const statePromises: Promise<unknown>[] = [];

            statePromises.push(this.setStateAsync('info.connection', { val: false, ack: true }).catch(() => {}));

            for (const fullId of Object.keys(this.objects)) {
                const obj = this.objects[fullId];
                const type = obj?.native?.type;
                if (type === 'qemu' || type === 'lxc') {
                    const relId = fullId.replace(`${this.namespace}.`, '');
                    statePromises.push(
                        this.setStateAsync(`${relId}.available`, { val: false, ack: true }).catch(() => {}),
                    );
                }
            }

            void Promise.all(statePromises)
                .catch(() => {})
                .finally(() => callback());
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Proxmox(options);
} else {
    // otherwise start the instance directly
    (() => new Proxmox())();
}
