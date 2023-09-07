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

        this.config.requestInterval = parseInt(this.config.requestInterval, 10) || 30;

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

                await this.setStateAsync('info.connection', { val: true, ack: true });
            });
        } catch (err) {
            await this.setStateAsync('info.connection', { val: false, ack: true });

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
                const command = id.split('.')[3];

                this.log.debug(`state changed: "${command}" type: "${type}" node: "${node}"`);

                if (type === 'lxc' || type === 'qemu') {
                    const vmid = obj.native?.vmid;

                    switch (command) {
                        case 'start':
                            this.proxmox?.qemuStart(node, type, vmid).then((data) => {
                                this.log.info(`Starting ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });

                            break;
                        case 'stop':
                            this.proxmox?.qemuStop(node, type, vmid).then((data) => {
                                this.log.info(`Stopping ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reset':
                            this.proxmox?.qemuReset(node, type, vmid).then((data) => {
                                this.log.info(`Resetting ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'resume':
                            this.proxmox?.qemuResume(node, type, vmid).then((data) => {
                                this.log.info(`Resuming ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'shutdown':
                            this.proxmox?.qemuShutdown(node, type, vmid).then((data) => {
                                this.log.info(`Shutting down ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'suspend':
                            this.proxmox?.qemuSuspend(node, type, vmid).then((data) => {
                                this.log.info(`Supspended ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reboot':
                            this.proxmox?.qemuReboot(node, type, vmid).then((data) => {
                                this.log.info(`Reboot ${vmid}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                    }
                } else if (type === 'node') {
                    this.log.debug('sending shutdown/reboot command');
                    switch (command) {
                        case 'shutdown':
                            this.proxmox?.nodeShutdown(node).then((data) => {
                                this.log.info(`Shutting down node ${node}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reboot':
                            this.proxmox?.nodeReboot(node).then((data) => {
                                this.log.info(`Rebooting node ${node}: ${JSON.stringify(data)}`);
                                this.sendRequest(10000);
                            });
                            break;
                    }
                }
            }
        }
    }

    sendRequest(nextRunTimeout) {
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

        /**
            {
                "uptime": 4912093,
                "id": "node/proxmox",
                "node": "myname",
                "maxcpu": 16,
                "mem": 4394840064,
                "level": "",
                "maxdisk": 100861726720,
                "status": "online",
                "ssl_fingerprint": "8E:7E:...",
                "maxmem": 16489639936,
                "type": "node",
                "cpu": 0.0126589945487583,
                "disk": 12904448000
            }
        */
        for (const node of nodes) {
            const nodeName = String(node.node).replace('.', '-');

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

            await this.extendObjectAsync(`${sid}.shutdown`, {
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

            await this.extendObjectAsync(`${sid}.reboot`, {
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

            // type has changed so extend no matter if yet exists
            await this.extendObjectAsync(`${sid}.status`, {
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

            if (node.cpu) {
                await this.createCustomState(sid, 'cpu', 'level', parseInt(node.cpu * 10000) / 100);
            }
            if (node.maxcpu) {
                await this.createCustomState(sid, 'cpu_max', 'default_num', node.maxcpu);
            }

            this.log.debug(`Requesting states for node ${node.node}`);
            const nodeStatus = await this.proxmox?.getNodeStatus(node.node);
            if (nodeStatus) {
                if (nodeStatus.uptime !== undefined) {
                    await this.createCustomState(sid, 'uptime', 'time', nodeStatus.uptime);
                }
                if (nodeStatus.wait !== undefined) {
                    await this.createCustomState(sid, 'iowait', 'level', parseInt(nodeStatus.wait * 10000) / 100);
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
                if (nodeStatus.swap.free !== undefined) {
                    await this.createCustomState(sid, 'swap.used_lev', 'level', p(nodeStatus.swap.used, nodeStatus.swap.total));
                }
            }

            await this.createVM();
        }

        // Delete non existent nodes
        for (const node of nodesAll) {
            if (!nodesKeep.includes(node)) {
                await this.delObjectAsync(node, { recursive: true });
                delete this.objects[`${this.namespace}.${node}`]; // del from RAM too
                this.log.info(`Deleted old node "${node}"`);
            }
        }
    }

    async createVM() {
        const resourcesAll = Object.keys(this.objects)
            .map(this.removeNamespace.bind(this))
            .filter((id) => id.startsWith('lxc_') || id.startsWith('qemu_') || id.startsWith('storage_'));
        const resourcesKeep = [];

        const resources = await this.proxmox?.getClusterResources();
        for (const res of resources) {
            let sid = '';
            if (res.type === 'qemu' || res.type === 'lxc') {
                const type = res.type;

                const resourceStatus = await this.proxmox?.getResourceStatus(res.node, type, res.vmid);
                const resName = String(resourceStatus.name).replace('.', '-');

                resourcesKeep.push(`${type}_${resName}`);
                sid = `${this.namespace}.${type}_${resName}`;

                this.log.debug(`new ${type}: ${resourceStatus.name} - ${JSON.stringify(resourceStatus)}`);

                if (!this.objects[sid]) {
                    // add to objects in RAM
                    this.objects[sid] = {
                        type: 'channel',
                        common: {
                            name: resourceStatus.name,
                        },
                        native: {
                            type: type,
                        },
                    };

                    await this.setObjectNotExistsAsync(sid, this.objects[sid]);
                }

                await this.extendObjectAsync(`${sid}.start`, {
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

                await this.extendObjectAsync(`${sid}.stop`, {
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

                await this.extendObjectAsync(`${sid}.shutdown`, {
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

                await this.extendObjectAsync(`${sid}.reboot`, {
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

                // type was boolean but has been corrected to string -> extend
                await this.extendObjectAsync(`${sid}.status`, {
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

                this.findState(sid, resourceStatus, async (states) => {
                    for (const s of states) {
                        try {
                            await this.createCustomState(s[0], s[1], s[2], s[3]);
                        } catch (e) {
                            this.log.error(`Could not create state for ${JSON.stringify(s)}: ${e.message}`);
                        }
                    }
                });
            } else if (res.type === 'storage') {
                const type = res.type;

                const storageStatus = await this.proxmox?.getStorageStatus(res.node, res.storage, !!res.shared);
                const storageName = String(res.storage).replace('.', '-');

                resourcesKeep.push(`${type}_${storageName}`);
                sid = `${this.namespace}.${type}_${storageName}`;

                this.log.debug(`new storage: ${res.storage} - ${JSON.stringify(storageStatus)}`);

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

                this.findState(sid, storageStatus, async (states) => {
                    for (const s of states) {
                        try {
                            await this.createCustomState(s[0], s[1], s[2], s[3]);
                        } catch (e) {
                            this.log.error(`Could not create state for ${JSON.stringify(s)}: ${e.message}`);
                        }
                    }
                });
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
    }

    async setNodes(nodes) {
        const knownObjIds = Object.keys(this.objects);

        for (const node of nodes) {
            this.log.debug(`Node: ${JSON.stringify(node)}`);

            const sid = `${this.namespace}.${node.type}_${node.node}`;

            // check if the item is already in RAM - if not it's newly created
            if (!knownObjIds.includes(sid)) {
                // new node restart adapter to create objects
                this.log.info(`Detected new node "${node.node}" - restarting instance`);
                return void this.restart();
            }

            this.setState(`${sid}.cpu`, parseInt(node.cpu * 10000) / 100, true);
            if (node.maxcpu) {
                await this.setStateChangedAsync(`${sid}.cpu_max`, node.maxcpu, true);
            }
            await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

            this.log.debug(`Requesting states for node ${node.node}`);
            const nodeStatus = await this.proxmox?.getNodeStatus(node.node, true);
            if (nodeStatus) {
                if (nodeStatus.uptime !== undefined) {
                    await this.setStateChangedAsync(sid + '.uptime', { val: nodeStatus.uptime, ack: true });
                }
                if (nodeStatus.wait !== undefined) {
                    await this.setStateChangedAsync(sid + '.iowait', { val: parseInt(nodeStatus.wait * 10000) / 100, ack: true });
                }

                if (nodeStatus.memory.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.used', { val: BtoMb(nodeStatus.memory.used), ack: true });
                }
                if (nodeStatus.memory.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.used_lev', { val: p(nodeStatus.memory.used, nodeStatus.memory.total), ack: true });
                }
                if (nodeStatus.memory.total !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.total', { val: BtoMb(nodeStatus.memory.total), ack: true });
                }
                if (nodeStatus.memory.free !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.free', { val: BtoMb(nodeStatus.memory.free), ack: true });
                }

                if (nodeStatus.loadavg[0] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.0', { val: parseFloat(nodeStatus.loadavg[0]), ack: true });
                }
                if (nodeStatus.loadavg[1] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.1', { val: parseFloat(nodeStatus.loadavg[1]), ack: true });
                }
                if (nodeStatus.loadavg[2] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.2', { val: parseFloat(nodeStatus.loadavg[2]), ack: true });
                }

                if (nodeStatus.swap.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.used', { val: BtoMb(nodeStatus.swap.used), ack: true });
                }
                if (nodeStatus.swap.free !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.free', { val: BtoMb(nodeStatus.swap.free), ack: true });
                }
                if (nodeStatus.swap.total !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.total', { val: BtoMb(nodeStatus.swap.total), ack: true });
                }
                if (nodeStatus.swap.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.used_lev', { val: p(nodeStatus.swap.used, nodeStatus.swap.total), ack: true });
                }
            }
        }

        await this.setVM();
    }

    async setVM() {
        const resources = await this.proxmox?.getClusterResources();
        const knownObjIds = Object.keys(this.objects);

        for (const res of resources) {
            let sid = '';

            if (res.type === 'qemu' || res.type === 'lxc') {
                const type = res.type;

                const resourceStatus = await this.proxmox?.getResourceStatus(res.node, type, res.vmid, true);
                const resName = String(resourceStatus.name).replace('.', '-');

                sid = `${this.namespace}.${type}_${resName}`;

                if (!knownObjIds.includes(sid)) {
                    // new node restart adapter to create objects
                    this.log.info(`Detected new VM/storage "${resourceStatus.name}" (${resName}) - restarting instance`);
                    return void this.restart();
                }

                this.findState(sid, resourceStatus, (states) => {
                    for (const element of states) {
                        this.setStateChangedAsync(element[0] + '.' + element[1], element[3], true);
                    }
                });
            } else if (res.type === 'storage') {
                const type = res.type;

                const storageStatus = await this.proxmox?.getStorageStatus(res.node, res.storage, !!res.shared);

                sid = this.namespace + '.' + type + '_' + res.storage;

                this.findState(sid, storageStatus, (states) => {
                    for (const element of states) {
                        this.setStateChangedAsync(element[0] + '.' + element[1], element[3], true);
                    }
                });
            }
        }
    }

    findState(sid, states, cb) {
        const result = [];

        for (const key of Object.keys(states)) {
            const value = states[key];
            this.log.debug(`search state "${key}": ${value}`);

            if (key === 'mem') {
                result.push([sid, key + '_lev', 'level', p(states.mem, states.maxmem)]);
            }
            if (key === 'disk') {
                result.push([sid, key + '_lev', 'level', p(states.disk, states.maxdisk)]);
            }
            if (key === 'used') {
                result.push([sid, key + '_lev', 'level', p(states.used, states.total)]);
            }
            if (key === 'mem' || key === 'disk' || key === 'balloon_min' || key === 'maxdisk' || key === 'maxmem' || key === 'diskwrite' || key === 'used' || key === 'total' || key === 'avail') {
                result.push([sid, key, 'size', BtoMb(value)]);
            } else if (key === 'uptime') {
                result.push([sid, key, 'time', value]);
            } else if (key === 'netin' || key === 'netout') {
                result.push([sid, key, 'sizeb', value]);
            } else if (key === 'cpu') {
                result.push([sid, key, 'level', parseInt(value * 10000) / 100]);
            } else if (key === 'pid' || key === 'cpus' || key === 'shared' || key === 'enabled' || key === 'active' || key === 'shared') {
                result.push([sid, key, 'default_num', parseInt(value)]); // parseInt, because pid would be string
            } else if (key === 'content' || key === 'type' || key === 'status') {
                result.push([sid, key, 'text', value]);
            }
        }

        this.log.debug('found states: ' + JSON.stringify(result));

        cb(result);
    }

    /**
     * Reads all channel objects and saves them in RAM
     * @returns {Promise<void>}
     */
    async readObjects() {
        try {
            this.objects = await this.getForeignObjectsAsync(`${this.namespace}.*`, 'channel');
            this.log.debug(`reading objects: ${JSON.stringify(this.objects)}`);
        } catch (err) {
            this.log.error(err);
        }
    }

    /**
     * Create state object if non existing and set states
     *
     * @param {string} sid - state id w/o name
     * @param {string} name - name of the state
     * @param {string} type - e.g. time
     * @param {any} val - state val
     * @return {Promise<void>}
     * @private
     */
    async createCustomState(sid, name, type, val) {
        this.log.debug(`creating state: ${name}`);

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
        const re = new RegExp(this.namespace + '*\\.', 'g');
        return id.replace(re, '');
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
