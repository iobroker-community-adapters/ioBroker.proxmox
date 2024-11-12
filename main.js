'use strict';

const utils = require('@iobroker/adapter-core');
const ProxmoxUtils = require('./lib/proxmox');
const adapterName = require('./package.json').name.split('.').pop();

function BtoMb(val) {
    return Math.round(val / 1048576);
}

function p(vala, valb) {
    return Math.round((vala / valb) * 10000) / 100;
}

class Proxmox extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: adapterName,
        });

        this.proxmox;
        this.objects = {};

        // reference for all offline container
        this.offlineResourceStatus = {
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

        this.requestInterval = null;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        if (!this.config.ip || this.config.ip === '192.000.000.000') {
            this.log.error('Please set the IP of your Proxmox host.');
            typeof this.terminate === 'function' ? this.terminate(11) : process.exit(11);
            return;
        }

        this.proxmox = new ProxmoxUtils(this);

        // this.config.requestInterval ist schon vom typ number
        //this.config.requestInterval = parseInt(this.config.requestInterval, 10) || 30;

        if (this.config.requestInterval < 5) {
            this.log.info('Intervall configured < 5s, setting to 5s');
            this.config.requestInterval = 5;
        }

        try {
            // Get a new ticket (login)
            this.proxmox.ticket(async () => {
                await this.readObjects();
                await this.getNodes();

                // subscribe on all state changes
                await this.subscribeStatesAsync('*');

                this.sendRequest(); // start interval

                await this.setState('info.connection', { val: true, ack: true });
            });
        } catch (err) {
            await this.setState('info.connection', { val: false, ack: true });

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

                    switch (command) {
                        case 'start':
                            this.proxmox
                                ?.qemuStart(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Starting ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'stop':
                            this.proxmox
                                ?.qemuStop(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Stopping ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'reset':
                            this.proxmox
                                ?.qemuReset(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Resetting ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'resume':
                            this.proxmox
                                ?.qemuResume(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Resuming ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'shutdown':
                            this.proxmox
                                ?.qemuShutdown(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Shutting down ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'suspend':
                            this.proxmox
                                ?.qemuSuspend(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Supspended ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                        case 'reboot':
                            this.proxmox
                                ?.qemuReboot(node, type, vmid)
                                .then((data) => {
                                    this.log.info(`Reboot ${vmid}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}", vmid: "${vmid}": ${err}`);
                                });
                            break;
                    }
                } else if (type === 'node') {
                    this.log.debug('sending shutdown/reboot command');
                    switch (command) {
                        case 'shutdown':
                            this.proxmox
                                ?.nodeShutdown(node)
                                .then((data) => {
                                    this.log.info(`Shutting down node ${node}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}": ${err}`);
                                });
                            break;
                        case 'reboot':
                            this.proxmox
                                ?.nodeReboot(node)
                                .then((data) => {
                                    this.log.info(`Rebooting node ${node}: ${JSON.stringify(data)}`);
                                    this.sendRequest(10000);
                                })
                                .catch((err) => {
                                    this.log.warn(`Unable to execure "${command}" type: "${type}" node: "${node}": ${err}`);
                                });
                            break;
                    }
                }
            }
        }
    }

    sendRequest(nextRunTimeout) {
        this.setState('info.lastUpdate', { val: Date.now(), ack: true });
        this.requestInterval && this.clearTimeout(this.requestInterval);
        this.requestInterval = this.setTimeout(
            async () => {
                this.requestInterval = null;

                if (this.proxmox) {
                    this.log.debug('sendRequest interval started');
                    this.proxmox.resetResponseCache(); // Clear cache to start fresh

                    try {
                        const nodes = await this.proxmox.getNodes();
                        this.log.debug(`Nodes: ${JSON.stringify(nodes)}`);
                        await this.setNodes(nodes);
                    } catch (e) {
                        this.log.warn(`Cannot send request: ${e}`);
                        this.setState('info.connection', { val: false, ack: true });
                    }
                }

                this.sendRequest();
            },
            nextRunTimeout || this.config.requestInterval * 1000,
        );
    }

    async getNodes() {
        try {
            const nodes = await this.proxmox?.getNodes();
            this.log.debug(`Nodes: ${JSON.stringify(nodes)}`);

            await this.createNodes(nodes);
        } catch (e) {
            this.log.error(`Could not create nodes, please restart adapter: ${e.message}`);
        }
    }

    /**
     * Create all node channels
     * @param {any[]} nodes - array of nodes
     * @return {Promise<void>}
     * @private
     */
    async createNodes(nodes) {
        const nodesAll = Object.keys(this.objects)
            .map(this.removeNamespace.bind(this))
            .filter((id) => id.startsWith('node_'));

        const nodesKeep = [];

        for (const node of nodes) {
            const nodeName = this.prepareNameForId(node.node);

            this.log.debug(`Node: ${JSON.stringify(node)}`);

            nodesKeep.push(`node_${nodeName}`);

            const sid = `${this.namespace}.${node.type}_${nodeName}`;

            if (!this.objects[sid]) {
                // add to channels in RAM
                this.objects[sid] = {
                    type: 'channel',
                    common: {
                        name: node.node,
                    },
                    native: {
                        type: node.type, // node
                    },
                };

                await this.setObjectNotExistsAsync(sid, this.objects[sid]);
            }

            await this.extendObject(`${sid}.shutdown`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Shutdown',
                        de: 'Herunterfahren',
                        ru: 'Закрыть',
                        pt: 'Desligamento',
                        nl: 'Vertaling',
                        fr: 'Tais-toi',
                        it: 'Chiusura',
                        es: 'Apago',
                        pl: 'Shutdown',
                        uk: 'Відправити',
                        'zh-cn': '舒适',
                    },
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: true,
                },
                native: {
                    node: node.node,
                    type: node.type,
                },
            });

            this.subscribeForeignStates(`${sid}.shutdown`);

            await this.extendObject(`${sid}.reboot`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Reboot',
                        de: 'Neustart',
                        ru: 'Перезагрузка',
                        pt: 'Reiniciar',
                        nl: 'Reboot',
                        fr: 'Reboot',
                        it: 'Reboot',
                        es: 'Reboot',
                        pl: 'Reboot',
                        uk: 'Перезавантаження',
                        'zh-cn': 'Reboot',
                    },
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: true,
                },
                native: {
                    node: node.node,
                    type: node.type,
                },
            });

            this.subscribeForeignStates(`${sid}.reboot`);

            // type has changed so extend no matter if yet exists
            await this.extendObject(`${sid}.status`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Status',
                        de: 'Status',
                        ru: 'Статус',
                        pt: 'Estado',
                        nl: 'Status',
                        fr: 'État',
                        it: 'Stato',
                        es: 'Situación',
                        pl: 'Status',
                        uk: 'Статус на сервери',
                        'zh-cn': '现状',
                    },
                    type: 'string',
                    role: 'indicator.status',
                    write: false,
                    read: true,
                },
                native: {},
            });

            await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

            if (node.status === 'online') {
                // node is offline no infomration available
                if (node.cpu) {
                    await this.createCustomState(sid, 'cpu', 'level', parseInt(node.cpu) * 10000 / 100);
                }
                if (node.maxcpu) {
                    await this.createCustomState(sid, 'cpu_max', 'default_num', node.maxcpu);
                }

                this.log.debug(`Requesting states for node ${node.node}`);
                try {
                    const nodeStatus = await this.proxmox?.getNodeStatus(node.node);
                    if (nodeStatus) {
                        if (nodeStatus.uptime !== undefined) {
                            await this.createCustomState(sid, 'uptime', 'time', nodeStatus.uptime);
                        }
                        if (nodeStatus.wait !== undefined) {
                            await this.createCustomState(sid, 'iowait', 'level', parseInt(nodeStatus.wait) * 10000 / 100);
                        }

                        if (nodeStatus.memory.used !== undefined) {
                            await this.createCustomState(sid, 'memory.used', 'size', BtoMb(nodeStatus.memory.used));
                        }
                        if (nodeStatus.memory.used !== undefined) {
                            await this.createCustomState(sid, 'memory.used_lev', 'level', p(nodeStatus.memory.used, nodeStatus.memory.total));
                        }
                        if (nodeStatus.memory.total !== undefined) {
                            await this.createCustomState(sid, 'memory.total', 'size', BtoMb(nodeStatus.memory.total));
                        }
                        if (nodeStatus.memory.free !== undefined) {
                            await this.createCustomState(sid, 'memory.free', 'size', BtoMb(nodeStatus.memory.free));
                        }

                        if (nodeStatus.loadavg[0] !== undefined) {
                            await this.createCustomState(sid, 'loadavg.0', 'default_num', parseFloat(nodeStatus.loadavg[0]));
                        }
                        if (nodeStatus.loadavg[1] !== undefined) {
                            await this.createCustomState(sid, 'loadavg.1', 'default_num', parseFloat(nodeStatus.loadavg[1]));
                        }
                        if (nodeStatus.loadavg[2] !== undefined) {
                            await this.createCustomState(sid, 'loadavg.2', 'default_num', parseFloat(nodeStatus.loadavg[2]));
                        }

                        if (nodeStatus.swap.used !== undefined) {
                            await this.createCustomState(sid, 'swap.used', 'size', BtoMb(nodeStatus.swap.used));
                        }
                        if (nodeStatus.swap.free !== undefined) {
                            await this.createCustomState(sid, 'swap.free', 'size', BtoMb(nodeStatus.swap.free));
                        }
                        if (nodeStatus.swap.total !== undefined) {
                            await this.createCustomState(sid, 'swap.total', 'size', BtoMb(nodeStatus.swap.total));
                        }
                        if (nodeStatus.swap.free !== undefined && nodeStatus.swap.total !== undefined) {
                            await this.createCustomState(sid, 'swap.used_lev', 'level', p(nodeStatus.swap.used, nodeStatus.swap.total));
                        }
                    }
                } catch (err) {
                    this.log.warn(`Unable to get status of node ${node.node}: ${err}`);
                }

                if (this.config.requestDiskInformation) {
                    try {
                        const nodeDisks = await this.proxmox?.getNodeDisks(node.node);
                        if (nodeDisks) {
                            for (const disk of nodeDisks) {
                                const diskPath = `disk_${String(disk.devpath).replace('/dev/', '')}`;

                                await this.setObjectNotExistsAsync(`${sid}.${diskPath}`, {
                                    type: 'folder',
                                    common: {
                                        name: disk.devpath,
                                    },
                                    native: {},
                                });

                                if (disk.type !== undefined) {
                                    await this.createCustomState(sid, `${diskPath}.type`, 'text', disk.type);
                                }else{
                                    this.log.debug(`disk ${disk.devpath} get type for node ${node.node} undefined`);
                                }
                                if (disk.size !== undefined) {
                                    await this.createCustomState(sid, `${diskPath}.size`, 'size', disk.size);
                                }else{
                                    this.log.debug(`disk ${disk.devpath} get size for node ${node.node} undefined`);
                                }
                                if (disk.health !== undefined) {
                                    await this.createCustomState(sid, `${diskPath}.health`, 'text', disk.health);
                                }else{
                                    this.log.debug(`disk ${disk.devpath} get health for node ${node.node} undefined`);
                                }
                                if (disk.wearout !== undefined && !isNaN(disk.wearout)) {
                                    await this.createCustomState(sid, `${diskPath}.wearout`, 'level', disk.wearout);
                                }else{
                                    this.log.debug(`disk ${disk.devpath} get wearout for node ${node.node} undefined`);
                                }
                                if (disk.model !== undefined) {
                                    await this.createCustomState(sid, `${diskPath}.model`, 'text', disk.model);
                                }else{
                                    this.log.debug(`disk ${disk.devpath} get model for node ${node.node} undefined`);
                                }
                                const nodeDiskSmart = await this.proxmox?.getNodeDisksSmart(node.node, disk.devpath);
                                this.log.debug('resolve getNodeDisksSmart => ' + JSON.stringify(nodeDiskSmart.data));
                                //if (nodeDiskSmart?.data?.text) {
                                if (nodeDiskSmart.data !== undefined) {
                                    await this.createCustomState(sid, `${diskPath}.smart`, 'text', nodeDiskSmart.data.attributes);
                                }
                            }
                        }
                    } catch (err) {
                        this.log.warn(`"function createNodes" Unable to get disk for node ${node.node}: ${err}`);
                    }
                }
            }
        }

        if (this.config.requestCephInformation) {
            await this.createCeph();
        }

        if (this.config.requestHAInformation) {
            await this.createHA();
        }

        await this.createVM();

        // Delete non existent nodes
        for (const node of nodesAll) {
            if (!nodesKeep.includes(node)) {
                await this.delObjectAsync(node, { recursive: true });
                delete this.objects[`${this.namespace}.${node}`]; // del from RAM too
                this.log.info(`Deleted old node "${node}"`);
            }
        }
    }

    /**
     * Create CEPH
     * @private
     */
    async createHA() {
        const haid = `${this.namespace}.ha`;

        await this.setObjectNotExistsAsync(`${haid}`, {
            type: 'channel',
            common: {
                name: 'ha',
            },
            native: {},
        });

        const haInformation = await this.proxmox?.getHAStatusInformation();

        for (const lpEntry in haInformation.data) {
            const lpType = typeof haInformation.data[lpEntry]; // get Type of Variable as String, like string/number/boolean
            const lpData = haInformation.data[lpEntry];
            if (lpType === 'object') {
                for (const lpEntry2 in lpData) {
                    const lpType2 = typeof lpData[lpEntry2];
                    const lpData2 = lpData[lpEntry2];
                    let lpData2Id = lpData.id;

                    if (lpEntry2 === 'id') {
                        continue;
                    }

                    lpData2Id = lpData2Id.replace(/:/g, '_');

                    await this.extendObject(`${haid}.${lpData2Id}_${lpEntry2}`, {
                        type: 'state',
                        common: {
                            name: lpEntry2,
                            type: lpType2,
                            read: true,
                            write: false,
                            role: 'value',
                        },
                        native: {},
                    });
                    await this.setStateChangedAsync(`${haid}.${lpData2Id}_${lpEntry2}`, lpData2, true);
                }
            }
        }
    }

    async createCeph() {
        const cephid = `${this.namespace}.ceph`;

        await this.setObjectNotExistsAsync(`${cephid}`, {
            type: 'channel',
            common: {
                name: 'ceph',
            },
            native: {},
        });

        const cephInformation = await this.proxmox?.getCephInformation();

        for (const lpEntry in cephInformation.data) {
            const lpType = typeof cephInformation.data[lpEntry]; // get Type of Variable as String, like string/number/boolean
            const lpData = cephInformation.data[lpEntry];
            if (lpType === 'object') {
                await this.setObjectNotExistsAsync(`${cephid}.${lpEntry}`, {
                    type: 'folder',
                    common: {
                        name: lpEntry,
                    },
                    native: {},
                });

                for (const lpEntry2 in cephInformation.data[lpEntry]) {
                    const lpType2 = typeof cephInformation.data[lpEntry][lpEntry2];
                    const lpData2 = cephInformation.data[lpEntry][lpEntry2];
                    if (lpType2 === 'object') {
                        continue;
                    }

                    await this.extendObject(`${cephid}.${lpEntry}.${lpEntry2}`, {
                        type: 'state',
                        common: {
                            name: lpEntry2,
                            type: lpType2,
                            read: true,
                            write: false,
                            role: 'value',
                        },
                        native: {},
                    });
                    await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}`, lpData2, true);
                }
            } else {
                await this.extendObject(`${cephid}.${lpEntry}`, {
                    type: 'state',
                    common: {
                        name: lpEntry,
                        type: lpType,
                        read: true,
                        write: false,
                        role: 'value',
                    },
                    native: {},
                });
                await this.setStateChangedAsync(`${cephid}.${lpEntry}`, lpData, true);
            }
        }
    }

    async createVM() {
        const resourcesAll = Object.keys(this.objects)
            .map(this.removeNamespace.bind(this))
            .filter((id) => id.startsWith('lxc_') || id.startsWith('qemu_') || id.startsWith('storage_'));

        const resourcesKeep = [];

        try {
            const resources = await this.proxmox?.getClusterResources();
            for (const res of resources) {
                let sid = '';
                const type = res.type;
                const resName = this.prepareNameForId(res.name);

                if (this.config.newTreeStructure) {
                    sid = `${this.namespace}.${type}.${resName}`;
                } else {
                    sid = `${this.namespace}.${type}_${resName}`;
                }

                if (res.status == 'unknown') {
                    res.status = 'offline';
                }

                if (res.type === 'qemu' || res.type === 'lxc') {
                    // if status offline or stopped no infos available

                    resourcesKeep.push(`${type}_${resName}`);

                    if (!this.objects[sid]) {
                        // add to objects in RAM
                        this.objects[sid] = {
                            type: 'channel',
                            common: {
                                name: res.name,
                                statusStates: {
                                    onlineId: `${sid}.available`
                                }
                            },
                            native: {
                                type: type,
                            },
                        };

                        await this.setObjectNotExistsAsync(sid, this.objects[sid]);
                    }

                    await this.extendObject(`${sid}.start`, {
                        type: 'state',
                        common: {
                            name: {
                                en: 'Start',
                                de: 'Start',
                                ru: 'Начало',
                                pt: 'Começar',
                                nl: 'Begin',
                                fr: 'Commencez',
                                it: 'Inizio',
                                es: 'Comienzo',
                                pl: 'Start',
                                uk: 'Почати',
                                'zh-cn': '导 言',
                            },
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                        },
                        native: {
                            node: res.node,
                            type: res.type,
                            vmid: res.vmid,
                        },
                    });

                    this.subscribeForeignStates(`${sid}.start`);

                    await this.extendObject(`${sid}.stop`, {
                        type: 'state',
                        common: {
                            name: {
                                en: 'Stop',
                                de: 'Stopp',
                                ru: 'Стоп',
                                pt: 'Pára',
                                nl: 'Stop',
                                fr: 'Arrête',
                                it: 'Fermati',
                                es: 'Para',
                                pl: 'Stop',
                                uk: 'Зареєструватися',
                                'zh-cn': '禁止',
                            },
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                        },
                        native: {
                            node: res.node,
                            type: res.type,
                            vmid: res.vmid,
                        },
                    });

                    this.subscribeForeignStates(`${sid}.stop`);

                    await this.extendObject(`${sid}.shutdown`, {
                        type: 'state',
                        common: {
                            name: {
                                en: 'Shutdown',
                                de: 'Herunterfahren',
                                ru: 'Закрыть',
                                pt: 'Desligamento',
                                nl: 'Vertaling',
                                fr: 'Tais-toi',
                                it: 'Chiusura',
                                es: 'Apago',
                                pl: 'Shutdown',
                                uk: 'Відправити',
                                'zh-cn': '舒适',
                            },
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                        },
                        native: {
                            node: res.node,
                            type: res.type,
                            vmid: res.vmid,
                        },
                    });

                    this.subscribeForeignStates(`${sid}.shutdown`);

                    await this.extendObject(`${sid}.reboot`, {
                        type: 'state',
                        common: {
                            name: {
                                en: 'Reboot',
                                de: 'Neustart',
                                ru: 'Перезагрузка',
                                pt: 'Reiniciar',
                                nl: 'Reboot',
                                fr: 'Reboot',
                                it: 'Reboot',
                                es: 'Reboot',
                                pl: 'Reboot',
                                uk: 'Перезавантаження',
                                'zh-cn': 'Reboot',
                            },
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                        },
                        native: {
                            node: res.node,
                            type: res.type,
                            vmid: res.vmid,
                        },
                    });

                    this.subscribeForeignStates(`.${sid}.reboot`);
                    // type was boolean but has been corrected to string -> extend
                    await this.extendObject(`${sid}.status`, {
                        type: 'state',
                        common: {
                            name: {
                                en: 'Status',
                                de: 'Status',
                                ru: 'Статус',
                                pt: 'Estado',
                                nl: 'Status',
                                fr: 'État',
                                it: 'Stato',
                                es: 'Situación',
                                pl: 'Status',
                                uk: 'Статус на сервери',
                                'zh-cn': '现状',
                            },
                            type: 'string',
                            role: 'indicator.status',
                            read: true,
                            write: false,
                        },
                        native: {},
                    });

                    await this.setStateChangedAsync(`${sid}.status`, { val: res.status, ack: true });

                    await this.extendObject(`${sid}.available`, {
                        type: 'state',
                        common: {
                            name: 'Available',
                            type: 'boolean',
                            role: 'state',
                            read: true,
                            write: false,
                        },
                        native: {},
                    });

                    let available = false;
                    let resourceStatus;

                    if (res.status === 'running') {
                        resourceStatus = await this.proxmox?.getResourceStatus(res.node, type, res.vmid);
                        available = true;
                        this.log.debug(`new ${type}: ${resourceStatus.name} - ${JSON.stringify(resourceStatus)}`);
                    } else {
                        this.offlineResourceStatus.status = res.status;
                        this.offlineResourceStatus.type = res.type;
                        this.offlineResourceStatus.name = resName;
                        this.offlineResourceStatus.vmid = res.vmid;
                        resourceStatus = this.offlineResourceStatus;
                    }

                    await this.setStateChangedAsync(`${sid}.available`, { val: available, ack: true });

                    await this.findState(sid, resourceStatus, async (states) => {
                        for (const s of states) {
                            try {
                                await this.createCustomState(s[0], s[1], s[2], s[3]);
                            } catch (e) {
                                this.log.error(`Could not create state for ${JSON.stringify(s)}: ${e.message}`);
                            }
                        }
                    });
                }
                if (res.type === 'storage' && this.config.requestStorageInformation) {
                    const type = res.type;

                    let storageName;

                    if (res.shared == 0) {
                        storageName = res.node + '_' + this.prepareNameForId(res.storage);
                    } else {
                        storageName = this.prepareNameForId(res.storage);
                    }

                    if (!resourcesKeep.includes(`${type}_${storageName}`)) {
                        resourcesKeep.push(`${type}_${storageName}`);

                        if (this.config.newTreeStructure) {
                            sid = `${this.namespace}.${type}.${storageName}`;
                        } else {
                            sid = `${this.namespace}.${type}_${storageName}`;
                        }

                        if (!this.objects[sid]) {
                            // add to objects in RAM
                            this.objects[sid] = {
                                type: 'channel',
                                common: {
                                    name: res.storage,
                                },
                                native: {
                                    type,
                                },
                            };
                            this.setObjectNotExists(sid, this.objects[sid]);
                        }

                        try {
                            if (res.status !== 'unknown') {
                                const storageStatus = await this.proxmox?.getStorageStatus(res.node, res.storage, !!res.shared);

                                this.log.debug(`new storage: ${res.storage} - ${JSON.stringify(storageStatus)}`);

                                await this.findState(sid, storageStatus, async (states) => {
                                    for (const s of states) {
                                        try {
                                            await this.createCustomState(s[0], s[1], s[2], s[3]);
                                        } catch (e) {
                                            this.log.error(`Could not create state for ${JSON.stringify(s)}: ${e.message}`);
                                        }
                                    }
                                    if (this.config.requestStorageInformationBackup) {
                                        await this.extendObject(`${sid}.backupJson`, {
                                            type: 'state',
                                            common: {
                                                name: {
                                                    en: 'Status',
                                                    de: 'Status',
                                                    ru: 'Статус',
                                                    pt: 'Estado',
                                                    nl: 'Status',
                                                    fr: 'État',
                                                    it: 'Stato',
                                                    es: 'Situación',
                                                    pl: 'Status',
                                                    uk: 'Статус на сервери',
                                                    'zh-cn': '现状',
                                                },
                                                type: 'string',
                                                role: 'indicator.status',
                                                read: true,
                                                write: false,
                                            },
                                            native: {},
                                        });

                                        await this.setStateChangedAsync(`${sid}.backupJson`, { val: '{}', ack: true });
                                    }
                                });
                            }
                        } catch (err) {
                            this.log.error(`Storage: ${res.storage} on  ${res.storage} not available`);
                        }
                    }
                }
            }

            // Delete non existent nodes
            for (const res of resourcesAll) {
                if (!resourcesKeep.includes(res)) {
                    await this.delObjectAsync(res, { recursive: true });
                    delete this.objects[`${this.namespace}.${res}`]; // del from RAM too
                    this.log.info(`Deleted old resource "${res}"`);
                }
            }
        } catch (err) {
            this.log.debug(`Unable to get cluster resources: ${err}`);
        }
    }

    async setNodes(nodes) {
        const knownObjIds = Object.keys(this.objects);

        for (const node of nodes) {
            this.log.debug(`Node: ${JSON.stringify(node)}`);

            const sid = `${this.namespace}.${node.type}_${node.node}`;

            // check if the item is already in RAM - if not it's newly created

            if (!knownObjIds.includes(sid) && node.status === 'online') {
                // new node restart adapter to create objects
                this.log.info(`Detected new node "${node.node}" - restarting instance`);
                return void this.restart();
            }

            await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

            if (node.status !== 'offline') {
                if (this.config.requestCephInformation) {
                    await this.setCeph();
                }

                await this.setStateChangedAsync(`${sid}.cpu`, { val: parseInt(node.cpu) * 10000 / 100, ack: true });
                if (node.maxcpu) {
                    await this.setStateChangedAsync(`${sid}.cpu_max`, { val: node.maxcpu, ack: true });
                }

                this.log.debug(`Requesting states for node ${node.node}`);
                try {
                    const nodeStatus = await this.proxmox?.getNodeStatus(node.node, true);
                    if (nodeStatus) {
                        if (nodeStatus.uptime !== undefined) {
                            await this.setStateChangedAsync(`${sid}.uptime`, { val: nodeStatus.uptime, ack: true });
                        }
                        if (nodeStatus.wait !== undefined) {
                            await this.setStateChangedAsync(`${sid}.iowait`, {
                                val: parseInt(nodeStatus.wait) * 10000 / 100,
                                ack: true,
                            });
                        }

                        if (nodeStatus.memory.used !== undefined) {
                            await this.setStateChangedAsync(`${sid}.memory.used`, {
                                val: BtoMb(nodeStatus.memory.used),
                                ack: true,
                            });
                        }
                        if (nodeStatus.memory.used !== undefined) {
                            await this.setStateChangedAsync(`${sid}.memory.used_lev`, {
                                val: p(nodeStatus.memory.used, nodeStatus.memory.total),
                                ack: true,
                            });
                        }
                        if (nodeStatus.memory.total !== undefined) {
                            await this.setStateChangedAsync(`${sid}.memory.total`, {
                                val: BtoMb(nodeStatus.memory.total),
                                ack: true,
                            });
                        }
                        if (nodeStatus.memory.free !== undefined) {
                            await this.setStateChangedAsync(`${sid}.memory.free`, {
                                val: BtoMb(nodeStatus.memory.free),
                                ack: true,
                            });
                        }

                        if (nodeStatus.loadavg[0] !== undefined) {
                            await this.setStateChangedAsync(`${sid}.loadavg.0`, {
                                val: parseFloat(nodeStatus.loadavg[0]),
                                ack: true,
                            });
                        }
                        if (nodeStatus.loadavg[1] !== undefined) {
                            await this.setStateChangedAsync(`${sid}.loadavg.1`, {
                                val: parseFloat(nodeStatus.loadavg[1]),
                                ack: true,
                            });
                        }
                        if (nodeStatus.loadavg[2] !== undefined) {
                            await this.setStateChangedAsync(`${sid}.loadavg.2`, {
                                val: parseFloat(nodeStatus.loadavg[2]),
                                ack: true,
                            });
                        }

                        if (nodeStatus.swap.used !== undefined) {
                            await this.setStateChangedAsync(`${sid}.swap.used`, {
                                val: BtoMb(nodeStatus.swap.used),
                                ack: true,
                            });
                        }
                        if (nodeStatus.swap.free !== undefined) {
                            await this.setStateChangedAsync(`${sid}.swap.free`, {
                                val: BtoMb(nodeStatus.swap.free),
                                ack: true,
                            });
                        }
                        if (nodeStatus.swap.total !== undefined) {
                            await this.setStateChangedAsync(`${sid}.swap.total`, {
                                val: BtoMb(nodeStatus.swap.total),
                                ack: true,
                            });
                        }
                        if (nodeStatus.swap.used !== undefined && nodeStatus.swap.total !== undefined) {
                            await this.setStateChangedAsync(`${sid}.swap.used_lev`, {
                                val: p(nodeStatus.swap.used, nodeStatus.swap.total),
                                ack: true,
                            });
                        }
                    }
                } catch (err) {
                    this.log.warn(`Unable to get status of node ${node.node}: ${err}`);
                }
            } else {
                await this.setStateChangedAsync(`${sid}.status`, { val: 'offline', ack: true });
            }

            if (this.config.requestDiskInformation) {
                try {
                    if (node.status !== 'offline') {
                        const nodeDisks = await this.proxmox?.getNodeDisks(node.node);
                        if (nodeDisks) {
                            for (const disk of nodeDisks) {
                                const diskPath = `disk_${String(disk.devpath).replace('/dev/', '')}`;
                                if (disk.type !== undefined) {
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.type`, {
                                        val: disk.type,
                                        ack: true,
                                    });
                                }
                                if (disk.size !== undefined) {
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.size`, {
                                        val: disk.size,
                                        ack: true,
                                    });
                                }
                                if (disk.health !== undefined) {
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.health`, {
                                        val: disk.health,
                                        ack: true,
                                    });
                                }
                                if (disk.wearout !== undefined && !isNaN(disk.wearout)) {
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.wearout`, {
                                        val: disk.wearout,
                                        ack: true,
                                    });
                                }
                                if (disk.model !== undefined) {
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.model`, {
                                        val: disk.model,
                                        ack: true,
                                    });
                                }

                                const nodeDiskSmart = await this.proxmox?.getNodeDisksSmart(node.node, disk.devpath);
                                this.log.debug(`getNodeDisksSmart from ${disk.devpath} => ${JSON.stringify(nodeDiskSmart.data)}`);
                                // if (nodeDiskSmart?.data?.text) {
                                if (nodeDiskSmart.data !== undefined){
                                    await this.setStateChangedAsync(`${sid}.${diskPath}.smart`, {
                                        // val: nodeDiskSmart.data.text,
                                        val: nodeDiskSmart.data.attributes,
                                        ack: true,
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.log.warn(`"function setNodes" Unable to get disk for node ${node.node}: ${err}`);
                }
            }
        }

        if (this.config.requestHAInformation) {
            await this.setHA();
        }

        await this.setVM();
    }
    async setCeph() {
        try {
            const cephid = `${this.namespace}.ceph`;

            const cephInformation = await this.proxmox?.getCephInformation();

            if (cephInformation !== null) {
                for (const lpEntry in cephInformation.data) {
                    const lpType = typeof cephInformation.data[lpEntry]; // get Type of Variable as String, like string/number/boolean
                    const lpData = cephInformation.data[lpEntry];
                    if (lpType === 'object') {
                        for (const lpEntry2 in cephInformation.data[lpEntry]) {
                            const lpType2 = typeof cephInformation.data[lpEntry][lpEntry2];
                            const lpData2 = cephInformation.data[lpEntry][lpEntry2];
                            if (lpType2 === 'object') {
                                continue;
                            }
                            await this.setStateChangedAsync(`${cephid}.${lpEntry}.${lpEntry2}`, lpData2, true);
                        }
                    } else {
                        await this.setStateChangedAsync(`${cephid}.${lpEntry}`, lpData, true);
                    }
                }
            }
        } catch (err) {
            this.log.error(`Unable to get Ceph resources: ${err.message} `);
        }
    }

    async setHA() {
        try {
            const haid = `${this.namespace}.ha`;
            const haInformation = await this.proxmox?.getHAStatusInformation();

            for (const lpEntry in haInformation.data) {
                const lpType = typeof haInformation.data[lpEntry]; // get Type of Variable as String, like string/number/boolean
                const lpData = haInformation.data[lpEntry];
                if (lpType === 'object') {
                    for (const lpEntry2 in lpData) {
                        // const lpType2 = typeof lpData[lpEntry2];
                        const lpData2 = lpData[lpEntry2];
                        let lpData2Id = lpData.id;

                        if (lpEntry2 === 'id') {
                            continue;
                        }

                        lpData2Id = lpData2Id.replace(/:/g, '_');

                        await this.setStateChangedAsync(`${haid}.${lpData2Id}_${lpEntry2}`, lpData2, true);
                    }
                }
            }
        } catch (err) {
            this.log.debug(`Unable to get HA resources: ${err.message} `);
        }
    }

    async setVM() {
        try {
            const resources = await this.proxmox?.getClusterResources();
            const knownObjIds = Object.keys(this.objects);
            const offlineMachines = {};
            const storageKeep = [];

            this.setState(`info.offlineMachines`, JSON.stringify(offlineMachines), true);

            for (const res of resources) {
                let sid = '';

                if (res.type === 'qemu' || res.type === 'lxc') {
                    const resName = this.prepareNameForId(res.name);

                    if (this.config.newTreeStructure) {
                        sid = `${this.namespace}.${res.type}.${resName}`;
                    } else {
                        sid = `${this.namespace}.${res.type}_${resName}`;
                    }

                    if (res.status === 'unknown') {
                        res.status = 'offline';
                    }

                    if (resName === 'undefined') {
                        // überspringe maschine falls knoten offline und diese auf dem knoten liegt
                        offlineMachines[res.id]++;
                        offlineMachines[res.id] = 'offline';
                        this.setState(`info.offlineMachines`, JSON.stringify(offlineMachines), true);
                        continue;
                    }

                    await this.setStateChangedAsync(`${sid}.status`, { val: res.status, ack: true });

                    let resourceStatus;
                    let available = false;

                    if (res.status === 'running') {
                        resourceStatus = await this.proxmox?.getResourceStatus(res.node, res.type, res.vmid, true);
                        available = true;
                    } else {
                        this.offlineResourceStatus.status = res.status;
                        this.offlineResourceStatus.type = res.type;
                        this.offlineResourceStatus.name = resName;
                        this.offlineResourceStatus.vmid = res.vmid;
                        resourceStatus = this.offlineResourceStatus;
                    }

                    if (!knownObjIds.includes(sid)) {
                        // new node restart adapter to create objects
                        this.log.info(`Detected new VM/storage "${resourceStatus.name}" (${resName}) - restarting instance`);
                        return void this.restart();
                    }

                    await this.setStateChangedAsync(`${sid}.available`, { val: available, ack: true });

                    await this.findState(sid, resourceStatus, async (states) => {
                        for (const element of states) {
                            await this.setStateChangedAsync(`${element[0]}.${element[1]}`, element[3], true);
                        }
                    });
                }

                if (res.type === 'storage' && this.config.requestStorageInformation) {
                    let storageName;

                    if (res.shared == 0) {
                        storageName = res.node + '_' + this.prepareNameForId(res.storage);
                    } else {
                        storageName = this.prepareNameForId(res.storage);
                    }

                    if (!storageKeep.includes(`${storageName}`)) {
                        storageKeep.push(`${storageName}`);

                        const type = res.type;

                        if (this.config.newTreeStructure) {
                            sid = `${this.namespace}.${type}.${storageName}`;
                        } else {
                            sid = `${this.namespace}.${type}_${storageName}`;
                        }

                        if (res.status !== 'unknown') {
                            try {
                                const storageStatus = await this.proxmox?.getStorageStatus(res.node, res.storage, !!res.shared);
                                await this.findState(sid, storageStatus, async (states) => {
                                    for (const element of states) {
                                        if (element[0] == '') {
                                            continue;
                                        } else {
                                            await this.setStateChangedAsync(`${element[0]}.${element[1]}`, element[3], true);
                                        }
                                    }
                                });

                                if (this.config.requestStorageInformationBackup) {
                                    const allBackupStatus = await this.proxmox?.getBackupStatus(res.node, res.storage);

                                    const backupJson = {};

                                    for (const backupStatus of allBackupStatus) {
                                        const volid = backupStatus.volid;

                                        backupJson[volid] = backupStatus;
                                    }

                                    await this.setStateChangedAsync(`${sid}.backupJson`, {
                                        val: JSON.stringify(backupJson),
                                        ack: true,
                                    });
                                }
                            } catch (err) {
                                this.log.error(`Storage: ${res.storage} on  ${res.id} not available`);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            this.log.debug(`Unable to get cluster resources: ${err.message} `);
        }
    }

    async findState(sid, states, cb) {
        const result = [];

        for (const key of Object.keys(states)) {
            const value = states[key];

            if (key === 'mem') {
                result.push([sid, `${key}_lev`, 'level', p(states.mem, states.maxmem)]);
            }
            if (key === 'disk') {
                result.push([sid, `${key}_lev`, 'level', p(states.disk, states.maxdisk)]);
            }
            if (key === 'used') {
                result.push([sid, `${key}_lev`, 'level', p(states.used, states.total)]);
            }
            if (key === 'mem' || key === 'disk' || key === 'balloon_min' || key === 'maxdisk' || key === 'maxmem' || key === 'diskwrite' || key === 'used' || key === 'total' || key === 'avail') {
                result.push([sid, key, 'size', BtoMb(value)]);
            } else if (key === 'uptime' || key === 'cttime') {
                result.push([sid, key, 'time', value]);
            } else if (key === 'netin' || key === 'netout') {
                result.push([sid, key, 'sizeb', value]);
            } else if (key === 'cpu') {
                result.push([sid, key, 'level', parseInt(value) * 10000 / 100]);
            } else if (key === 'pid' || key === 'vmid' || key === 'cpus' || key === 'shared' || key === 'enabled' || key === 'active' || key === 'shared') {
                result.push([sid, key, 'default_num', parseInt(value)]); // parseInt, because pid would be string
            } else if (key === 'content' || key === 'type' || key === 'status' || key === 'volid' || key === 'parent' || key === 'format') {
                result.push([sid, key, 'text', value]);
            }
        }

        this.log.debug(`found states: ${JSON.stringify(result)}`);

        await cb(result);
    }

    /**
     * Reads all channel objects and saves them in RAM
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
     * @return {Promise<void>}
     * @private
     */
    async createCustomState(sid, name, type, val) {
        // this.log.debug(`creating state: ${name}`);

        switch (type) {
            case 'time':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'number',
                        unit: 'sec.',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
            case 'size':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'number',
                        unit: 'MiB',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
            case 'sizeb':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'number',
                        unit: 'byte',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
            case 'level':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'number',
                        unit: '%',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
            case 'default_num':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'number',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
            case 'text':
                await this.setObjectNotExistsAsync(`${sid}.${name}`, {
                    common: {
                        name: name,
                        role: 'value',
                        write: false,
                        read: true,
                        type: 'string',
                    },
                    type: 'state',
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.${name}`, { val, ack: true });
                break;
        }
    }

    removeNamespace(id) {
        const re = new RegExp(`${this.namespace}*\\.`, 'g');
        return id.replace(re, '');
    }

    prepareNameForId(val) {
        return String(val).replace('.', '-');
    }

    /**
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.proxmox && this.proxmox.stop();

            if (this.requestInterval) {
                this.log.debug('clearing request timeout');
                this.clearTimeout(this.requestInterval);
            }

            callback();
        } catch (e) {
            callback();
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Proxmox(options);
} else {
    // otherwise start the instance directly
    new Proxmox();
}
