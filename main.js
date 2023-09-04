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
        this.connected = false;
        this.finish = false;

        this.requestInterval = null;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        if (this.config.ip === '192.000.000.000') {
            this.log.error('Please set the IP of your Proxmox host.');
            typeof this.terminate === 'function' ? this.terminate(11) : process.exit(11);
            return;
        }

        this.proxmox = new ProxmoxUtils(this);

        this.config.requestInterval = parseInt(this.config.requestInterval, 10) || 30;

        if (this.config.requestInterval < 5) {
            this.log.info('Intervall < 5s, setting to 5s');
            this.config.requestInterval = 5;
        }

        try {
            // Get a new ticket (login)
            this.proxmox.ticket(async () => {
                await this.readObjects();

                // subscribe on all state changes
                await this.subscribeStatesAsync('*');

                this.getNodes();

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
            const vmdata = id.split('.')[2]; // <type>_<name>
            const type = vmdata.split('_')[0]; // e.g. lxc, qemu, node, storage, ...
            let vmname, node;

            if (type === 'lxc' || type === 'qemu') {
                vmname = vmdata.split('_')[1];
            } else if (type === 'node') {
                node = vmdata.split('_')[1];
            }

            const command = id.split('.')[3];
            let vmid;

            this.log.debug(`state changed: "${command}" type: "${type}" vmname: "${vmname}"`);
            this.proxmox.all((data) => {
                this.log.debug(`all data for vm - node: ${node} | type: ${type} | vid: ${vmid}`);

                if (type === 'lxc' || type === 'qemu') {
                    // get vm vid
                    const vms = data.data;
                    const vm = vms.find((vm) => vm.name === vmname);
                    if (vm) {
                        this.log.debug(`Find name in VMs: ${JSON.stringify(vm)}`);
                        vmid = vm.vmid;
                        node = vm.node;
                    } else {
                        this.log.error(`could not Find name in VMs: ${JSON.stringify(data)}`);
                        return;
                    }

                    this.log.debug(`all data for vm - node: ${node} | type: ${type} | vid: ${vmid}`);

                    switch (command) {
                        case 'start':
                            this.proxmox.qemuStart(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'stop':
                            this.proxmox.qemuStop(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reset':
                            this.proxmox.qemuReset(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'resume':
                            this.proxmox.qemuResume(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'shutdown':
                            this.proxmox.qemuShutdown(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'suspend':
                            this.proxmox.qemuSuspend(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reboot':
                            this.proxmox.qemuReboot(node, type, vmid, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                    }
                } else if (type === 'node') {
                    this.log.debug('sending shutdown/reboot command');
                    switch (command) {
                        case 'shutdown':
                            this.proxmox.nodeShutdown(node, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                        case 'reboot':
                            this.proxmox.nodeReboot(node, (data) => {
                                this.log.info(data);
                                this.sendRequest(10000);
                            });
                            break;
                    }
                }
            });

            //this.proxmox.qemuStart("home", "qemu", "103", (data) => {
            //    this.log.info(JSON.stringify(data  ))
            //})
        }
    }

    sendRequest(nextRunTimeout) {
        this.requestInterval && this.clearTimeout(this.requestInterval);
        this.requestInterval = this.setTimeout(this.sendRequest.bind(this), nextRunTimeout || this.config.requestInterval * 1000);

        if (this.finish) {
            this.proxmox.resetResponseCache(); // Clear cache to start fresh

            try {
                this.proxmox.status((data) => {
                    this.setNodes(data.data);
                    this.log.debug(`Devices: ${JSON.stringify(data)}`);
                });
            } catch (e) {
                this.log.warn(`Cannot send request: ${e}`);
                if (this.connected) {
                    this.connected = false;
                    this.log.debug('Disconnect');
                    this.setState('info.connection', { val: false, ack: true });
                }
            }
        }
    }

    getNodes() {
        this.proxmox.status(async (data) => {
            if (!data.data) {
                this.log.error('Can not get Proxmox nodes! please restart adapter');
                return;
            }

            try {
                await this.createNodes(data.data);
            } catch (e) {
                this.log.error(`Could not create nodes, please restart adapter: ${e.message}`);
            }
            this.log.debug(`Devices: ${JSON.stringify(data)}`);
        });
    }

    /**
     * Create all node channels
     * @param {any[]} devices - array of devices
     * @return {Promise<void>}
     * @private
     */
    async createNodes(devices) {
        // get all known hosts to check if we have nodes in RAM which no longer exist
        const nodesToDelete = [];

        for (const objId of Object.keys(this.objects)) {
            const channel = objId.split('.')[2];
            if (channel.startsWith('node_')) {
                nodesToDelete.push(channel.substr(5));
            }
        }

        for (const element of devices) {
            this.log.debug(`Node: ${JSON.stringify(element)}`);

            // remove from nodesToDelete if still exists
            const idx = nodesToDelete.indexOf(element.node);
            if (idx !== -1) {
                nodesToDelete.splice(idx, 1);
            }

            const sid = `${this.namespace}.${element.type}_${element.node}`;
            if (!this.objects[sid]) {
                // add to channels in RAM
                this.objects[sid] = {
                    type: 'channel',
                    common: {
                        name: element.node,
                    },
                    native: {
                        type: element.type,
                    },
                };

                await this.setObjectNotExistsAsync(sid, this.objects[sid]);

                await this.setObjectNotExistsAsync(`${sid}.shutdown`, {
                    type: 'state',
                    common: {
                        name: 'shutdown',
                        type: 'boolean',
                        role: 'button',
                        read: true,
                        write: true,
                        desc: 'shutdown node',
                    },
                    native: {},
                });

                await this.setObjectNotExistsAsync(`${sid}.reboot`, {
                    type: 'state',
                    common: {
                        name: 'reboot',
                        type: 'boolean',
                        role: 'button',
                        read: true,
                        write: true,
                        desc: 'reboot node',
                    },
                    native: {},
                });
            }

            // type has changed so extend no matter if yet exists
            await this.extendObjectAsync(
                `${sid}.status`,
                {
                    common: {
                        name: 'Status',
                        role: 'indicator.status',
                        write: false,
                        read: true,
                        type: 'string',
                    },
                    type: 'state',
                    native: {},
                },
                { preserve: { common: ['name'] } },
            );

            if (element.cpu) {
                await this.createCustomState(sid, 'cpu', 'level', parseInt(element.cpu * 10000) / 100);
            }
            if (element.maxcpu) {
                await this.createCustomState(sid, 'cpu_max', 'default_num', element.maxcpu);
            }

            this.proxmox.nodeStatus(element.node, async (data) => {
                this.log.debug('Request states for node ' + element.node);

                const node_vals = data.data;
                if (node_vals) {
                    if (node_vals.uptime !== undefined) {
                        await this.createCustomState(sid, 'uptime', 'time', node_vals.uptime);
                    }

                    if (node_vals.wait !== undefined) {
                        await this.createCustomState(sid, 'iowait', 'level', parseInt(node_vals.wait * 10000) / 100);
                    }

                    if (node_vals.memory.used !== undefined) {
                        await this.createCustomState(sid, 'memory.used', 'size', BtoMb(node_vals.memory.used));
                    }
                    if (node_vals.memory.used !== undefined) {
                        await this.createCustomState(sid, 'memory.used_lev', 'level', p(node_vals.memory.used, node_vals.memory.total));
                    }
                    if (node_vals.memory.total !== undefined) {
                        await this.createCustomState(sid, 'memory.total', 'size', BtoMb(node_vals.memory.total));
                    }
                    if (node_vals.memory.free !== undefined) {
                        await this.createCustomState(sid, 'memory.free', 'size', BtoMb(node_vals.memory.free));
                    }

                    if (node_vals.loadavg[0] !== undefined) {
                        await this.createCustomState(sid, 'loadavg.0', 'default_num', parseFloat(node_vals.loadavg[0]));
                    }
                    if (node_vals.loadavg[1] !== undefined) {
                        await this.createCustomState(sid, 'loadavg.1', 'default_num', parseFloat(node_vals.loadavg[1]));
                    }
                    if (node_vals.loadavg[2] !== undefined) {
                        await this.createCustomState(sid, 'loadavg.2', 'default_num', parseFloat(node_vals.loadavg[2]));
                    }

                    if (node_vals.swap.used !== undefined) {
                        await this.createCustomState(sid, 'swap.used', 'size', BtoMb(node_vals.swap.used));
                    }
                    if (node_vals.swap.free !== undefined) {
                        await this.createCustomState(sid, 'swap.free', 'size', BtoMb(node_vals.swap.free));
                    }
                    if (node_vals.swap.total !== undefined) {
                        await this.createCustomState(sid, 'swap.total', 'size', BtoMb(node_vals.swap.total));
                    }
                    if (node_vals.swap.free !== undefined) {
                        await this.createCustomState(sid, 'swap.used_lev', 'level', p(node_vals.swap.used, node_vals.swap.total));
                    }
                }

                this.createVM();
            });
        }

        // remove nodes
        for (const node of nodesToDelete) {
            try {
                await this.delObjectAsync(`node_${node}`, { recursive: true });
                delete this.objects[`${this.namespace}.node_${node}`]; // del from RAM too
                this.log.info(`Deleted old node "${node}"`);
            } catch (e) {
                this.log.warn(`Could not delete old node "${node}": ${e.message}`);
            }
        }
    }

    async setNodes(devices) {
        const knownObjIds = Object.keys(this.objects);

        for (const element of devices) {
            this.log.debug(`Node: ${JSON.stringify(element)}`);

            const sid = `${this.namespace}.${element.type}_${element.node}`;

            // check if the item is already in RAM - if not it's newly created
            if (!knownObjIds.includes(sid)) {
                // new node restart adapter to create objects
                this.log.info(`Detected new node "${element.node}" - restarting instance`);
                return void this.restart();
            }

            this.setState(`${sid}.cpu`, parseInt(element.cpu * 10000) / 100, true);
            if (element.maxcpu) {
                this.setState(`${sid}.cpu_max`, element.maxcpu, true);
            }
            this.setState(`${sid}.status`, element.status, true);

            this.proxmox.nodeStatus(element.node, async (data) => {
                this.log.debug(`Request states for node ${element.node}`);

                const node_vals = data.data;

                //check if node is empty
                if (!node_vals || typeof node_vals.uptime === 'undefined') {
                    return;
                }

                if (node_vals.uptime !== undefined) {
                    await this.setStateChangedAsync(sid + '.uptime', node_vals.uptime, true);
                }
                // await this.setStateChangedAsync(sid + '.' + name, val, true)

                if (node_vals.wait !== undefined) {
                    await this.setStateChangedAsync(sid + '.iowait', parseInt(node_vals.wait * 10000) / 100, true);
                }

                if (node_vals.memory.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.used', BtoMb(node_vals.memory.used), true);
                }
                if (node_vals.memory.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.used_lev', p(node_vals.memory.used, node_vals.memory.total), true);
                }
                if (node_vals.memory.total !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.total', BtoMb(node_vals.memory.total), true);
                }
                if (node_vals.memory.free !== undefined) {
                    await this.setStateChangedAsync(sid + '.memory.free', BtoMb(node_vals.memory.free), true);
                }

                if (node_vals.loadavg[0] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.0', parseFloat(node_vals.loadavg[0]), true);
                }
                if (node_vals.loadavg[1] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.1', parseFloat(node_vals.loadavg[1]), true);
                }
                if (node_vals.loadavg[2] !== undefined) {
                    await this.setStateChangedAsync(sid + '.loadavg.2', parseFloat(node_vals.loadavg[2]), true);
                }

                if (node_vals.swap.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.used', BtoMb(node_vals.swap.used), true);
                }
                if (node_vals.swap.free !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.free', BtoMb(node_vals.swap.free), true);
                }
                if (node_vals.swap.total !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.total', BtoMb(node_vals.swap.total), true);
                }
                if (node_vals.swap.used !== undefined) {
                    await this.setStateChangedAsync(sid + '.swap.used_lev', p(node_vals.swap.used, node_vals.swap.total), true);
                }
            });
        }

        this.setVM();
    }

    setVM() {
        this.proxmox.all((data) => {
            const qemuArr = data.data;
            const knownObjIds = Object.keys(this.objects);

            for (const qemu of qemuArr) {
                let sid = '';

                if (qemu.type === 'qemu' || qemu.type === 'lxc') {
                    const type = qemu.type;

                    this.proxmox.qemuStatus(qemu.node, type, qemu.vmid, (data) => {
                        const aktQemu = data.data;

                        //check if vm is empty
                        if (!aktQemu || !aktQemu.name) {
                            return;
                        }

                        sid = `${this.namespace}.${type}_${aktQemu.name}`;
                        if (!knownObjIds.includes(sid)) {
                            // new node restart adapter to create objects
                            this.log.info(`Detected new VM/storage "${aktQemu.name}" - restarting instance`);
                            return void this.restart();
                        }

                        this.findState(sid, aktQemu, (states) => {
                            for (const element of states) {
                                this.setStateChanged(element[0] + '.' + element[1], element[3], true);
                            }
                        });
                    });
                } else if (qemu.type === 'storage') {
                    const type = qemu.type;

                    this.proxmox.storageStatus(qemu.node, qemu.storage, !!qemu.shared, (data, name) => {
                        const aktQemu = data.data;

                        sid = this.namespace + '.' + type + '_' + name;
                        this.log.debug('storage reload: ' + name + ' for node ' + qemu.node);

                        this.findState(sid, aktQemu, (states) => {
                            for (const element of states) {
                                this.setStateChanged(element[0] + '.' + element[1], element[3], true);
                            }
                        });
                    });
                }
            }
        });
    }

    createVM() {
        const vmsToDelete = [];

        const createDone = async () => {
            this.setState('info.connection', { val: true, ack: true });
            if (!this.finish) {
                this.finish = true;

                // remove old vms/storage
                for (const vm of vmsToDelete) {
                    try {
                        await this.delObjectAsync(vm, { recursive: true });
                        delete this.objects[`${this.namespace}.${vm}`]; // del from RAM too
                        this.log.info(`Deleted old VM/storage "${vm}"`);
                    } catch (e) {
                        this.log.warn(`Could not delete old VM/storage "${vm}": ${e.message}`);
                    }
                }

                this.requestInterval && this.clearTimeout(this.requestInterval);
                this.requestInterval = this.setTimeout(this.sendRequest.bind(this), 5000);
            }
        };

        for (const objId of Object.keys(this.objects)) {
            const channel = objId.split('.')[2];
            if (channel.startsWith('lxc_') || channel.startsWith('qemu_') || channel.startsWith('storage_')) {
                vmsToDelete.push(channel);
            }
        }

        this.proxmox.all((data) => {
            let callbackCnt = 0;

            const qemuArr = data.data;

            if (!qemuArr || !Array.isArray(qemuArr)) {
                return;
            }

            for (const qemu of qemuArr) {
                let sid = '';
                if (qemu.type === 'qemu' || qemu.type === 'lxc') {
                    const type = qemu.type;

                    callbackCnt++;
                    this.proxmox.qemuStatus(qemu.node, type, qemu.vmid, async (data) => {
                        const aktQemu = data.data;

                        if (!aktQemu) {
                            return;
                        }

                        // remove from vmsToDelete if still exists
                        const idx = vmsToDelete.indexOf(`${type}_${aktQemu.name}`);
                        if (idx !== -1) {
                            vmsToDelete.splice(idx, 1);
                        }

                        sid = `${this.namespace}.${type}_${aktQemu.name}`;

                        this.log.debug(`new ${type}: ${aktQemu.name}`);

                        if (!this.objects[sid]) {
                            // add to objects in RAM
                            this.objects[sid] = {
                                type: 'channel',
                                common: {
                                    name: aktQemu.name,
                                },
                                native: {
                                    type: type,
                                },
                            };

                            await this.setObjectNotExistsAsync(sid, this.objects[sid]);
                        }

                        await this.setObjectNotExistsAsync(`${sid}.start`, {
                            type: 'state',
                            common: {
                                name: 'start',
                                type: 'boolean',
                                role: 'button',
                                read: true,
                                write: true,
                                desc: 'Start VM',
                            },
                            native: {},
                        });

                        await this.setObjectNotExistsAsync(`${sid}.stop`, {
                            type: 'state',
                            common: {
                                name: 'stop',
                                type: 'boolean',
                                role: 'button',
                                read: true,
                                write: true,
                                desc: 'stop VM',
                            },
                            native: {},
                        });

                        await this.setObjectNotExistsAsync(`${sid}.shutdown`, {
                            type: 'state',
                            common: {
                                name: 'shutdown',
                                type: 'boolean',
                                role: 'button',
                                read: true,
                                write: true,
                                desc: 'shutdown VM',
                            },
                            native: {},
                        });

                        await this.setObjectNotExistsAsync(`${sid}.reboot`, {
                            type: 'state',
                            common: {
                                name: 'reboot',
                                type: 'boolean',
                                role: 'button',
                                read: true,
                                write: true,
                                desc: 'reboot VM',
                            },
                            native: {},
                        });

                        // type was boolean but has been corrected to string -> extend
                        await this.extendObjectAsync(
                            `${sid}.status`,
                            {
                                type: 'state',
                                common: {
                                    name: 'status',
                                    type: 'string',
                                    role: 'indicator.status',
                                    read: true,
                                    write: false,
                                    desc: 'Status of VM',
                                },
                                native: {},
                            },
                            { preserve: { common: ['name'] } },
                        );

                        this.findState(sid, aktQemu, async (states) => {
                            for (const element of states) {
                                try {
                                    await this.createCustomState(element[0], element[1], element[2], element[3]);
                                } catch (e) {
                                    this.log.error(`Could not create state for ${JSON.stringify(element)}: ${e.message}`);
                                }
                            }
                            if (!--callbackCnt) {
                                createDone();
                            }
                        });
                    });
                } else if (qemu.type === 'storage') {
                    const type = qemu.type;

                    callbackCnt++;
                    this.proxmox.storageStatus(qemu.node, qemu.storage, !!qemu.shared, (data, name) => {
                        const aktQemu = data.data;

                        if (!aktQemu) {
                            return;
                        }

                        // remove from vmsToDelete if still exists
                        const idx = vmsToDelete.indexOf(`${type}_${name}`);
                        if (idx !== -1) {
                            vmsToDelete.splice(idx, 1);
                        }

                        sid = `${this.namespace}.${type}_${name}`;
                        this.log.debug('new storage: ' + name);

                        if (!this.objects[sid]) {
                            // add to objects in RAM
                            this.objects[sid] = {
                                type: 'channel',
                                common: {
                                    name: name,
                                },
                                native: {
                                    type: type,
                                },
                            };
                            this.setObjectNotExists(sid, this.objects[sid]);
                        }

                        this.findState(sid, aktQemu, async (states) => {
                            for (const element of states) {
                                try {
                                    await this.createCustomState(element[0], element[1], element[2], element[3]);
                                } catch (e) {
                                    this.log.error(`Could not create state for ${JSON.stringify(element)}: ${e.message}`);
                                }
                            }
                            if (!--callbackCnt) {
                                createDone();
                            }
                        });
                    });
                }
            }
        });
    }

    findState(sid, states, cb) {
        const result = [];

        for (const key of Object.keys(states)) {
            const value = states[key];
            this.log.debug('search state' + key + ': ' + value);

            if (key === 'mem') {
                result.push([sid, key + '_lev', 'level', p(states.mem, states.maxmem)]);
                this.log.debug(states.mem, states.maxmem);
            }
            if (key === 'disk') {
                result.push([sid, key + '_lev', 'level', p(states.disk, states.maxdisk)]);
                this.log.debug(states.mem, states.maxmem);
            }
            if (key === 'used') {
                result.push([sid, key + '_lev', 'level', p(states.used, states.total)]);
            }
            if (key === 'mem' || key === 'disk' || key === 'balloon_min' || key === 'maxdisk' || key === 'maxmem' || key === 'diskwrite' || key === 'used' || key === 'total' || key === 'avail') {
                result.push([sid, key, 'size', BtoMb(value)]);
            } else if (key === 'uptime') {
                result.push([sid, key, 'time', value]);
            } else if (key === 'status') {
                result.push([sid, key, 'status', value]);
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
        this.log.debug('found states:_' + JSON.stringify(result));
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
        } catch (e) {
            this.log.error(e.message);
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

    /**
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.proxmox.stop();

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
