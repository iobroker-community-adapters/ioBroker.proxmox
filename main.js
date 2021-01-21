/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapter = new utils.Adapter('proxmox');
const ProxmoxGet = require('./lib/proxmox');

let proxmox;
let objects = {};
let connected = false;
let requestInterval;
let finish = false;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        proxmox.stop();
        clearTimeout(requestInterval);
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    //adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        //adapter.log.info('ack is not set!');
        let vmdata = id.split('.')[2];
        let type = vmdata.split('_')[0];
        let vmname, node;
        if (type === 'lxc' || type === 'qemu') {
            vmname = vmdata.split('_')[1];
        } else if (type === 'node') {
            node = vmdata.split('_')[1];
        }  
        let command = id.split('.')[3];
        let vmid;

        adapter.log.debug('state changed ' + command + ' : type:  ' + type + ' vmname: ' + vmname)
        proxmox.all(function (data) {
            
            adapter.log.debug('all data for vm start: node: ' + node + '| type: ' + type + '| vid: ' + vmid)
            if (type === 'lxc' || type === 'qemu') {
                // get vm vid
                let vms = data.data;
                let vm = vms.find(vm => vm.name === vmname);
                if (vm) {
                    adapter.log.debug('Find name in VMs: ' + JSON.stringify(vm))
                    vmid = vm.vmid;
                    node = vm.node;
                } else {
                    adapter.log.error('could not Find name in VMs: ' + JSON.stringify(data))
                    return
                }
                adapter.log.debug('all data for vm start: node: ' + node + '| type: ' + type + '| vid: ' + vmid)
                switch (command) {
                    case 'start':
                        proxmox.qemuStart(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'stop':
                        proxmox.qemuStop(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'reset':
                        proxmox.qemuReset(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'resume':
                        proxmox.qemuResume(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'shutdown':
                        proxmox.qemuShutdown(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'suspend':
                        proxmox.qemuSuspend(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'reboot':
                        proxmox.qemuReboot(node, type, vmid, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;

                    default:
                        break;
                }
            } else if (type === 'node') {
                adapter.log.debug('sending shutdown/reboot command')
                switch (command) {
                    case 'shutdown':
                        proxmox.nodeShutdown(node, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                    case 'reboot':
                        proxmox.nodeReboot(node, function (data) {
                            adapter.log.info(data)
                            sendRequest(10000);
                        });
                        break;
                }
            }
        });


        //proxmox.qemuStart("home","qemu","103",function (data) {
        //    adapter.log.info(JSON.stringify(data  ))
        //})
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    adapter.getForeignObject('system.config', (err, obj) => {
        if (obj && obj.native && obj.native.secret) {
            //noinspection JSUnresolvedVariable
            adapter.config.pwd = decrypt(obj.native.secret, adapter.config.pwd);
        } else {
            //noinspection JSUnresolvedVariable
            adapter.config.pwd = decrypt('Zgfr56gFe87jJOM', adapter.config.pwd);
        }

        if (adapter.config.ip === "192.000.000.000") {
            adapter.log.error('Please set the IP of your Proxmox host.');
            typeof adapter.terminate === 'function' ? adapter.terminate(11): process.exit(11);
            return;
        }

        adapter.config.ip = adapter.config.ip || '';
        proxmox = new ProxmoxGet(adapter);

        //check Interval
        adapter.config.param_requestInterval = parseInt(adapter.config.param_requestInterval, 10) || 30;

        if (adapter.config.param_requestInterval < 5) {
            adapter.log.info('Intervall <5s, set to 5s');
            adapter.config.param_requestInterval = 5;
        }

        proxmox._getTicket(function (result) {
            if (result === "200" || result === 200) {
                main();
                adapter.setState('info.connection', true, true);
            } else {
                adapter.setState('info.connection', false, true);
                adapter.log.error('Unable to authenticate with Proxmox host. Please check your credentials');
                typeof adapter.terminate === 'function' ? adapter.terminate(11): process.exit(11);
            }
        });
    });
});

function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function main() {

    readObjects(_getNodes());

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
}

function sendRequest(nextRunTimeout) {
    requestInterval && clearTimeout(requestInterval);
    requestInterval = setTimeout(sendRequest, nextRunTimeout || adapter.config.param_requestInterval * 1000);

    if (finish) {
        proxmox.resetResponseCache(); // Clear cache to start fresh

        try {
            proxmox.status(function (data) {
                _setNodes(data.data);
                adapter.log.debug("Devices: " + JSON.stringify(data));
            });


        } catch (e) {
            adapter.log.warn('Cannot send request: ' + e);
            if (connected) {
                connected = false;
                adapter.log.debug('Disconnect');
                adapter.setState('info.connection', false, true);
            }
        }
    }
}


function _getNodes(callback) {
    proxmox.status(function (data) {
        if (!data.data) {
            adapter.log.error('Can not get Proxmox nodes! please restart adapter');
            return
        }
        _createNodes(data.data, callback);
        adapter.log.debug("Devices: " + JSON.stringify(data));
    });
};

function _createNodes(devices, callback) {
    let callbackCnt = 0;
    devices.forEach(function (element) {
        adapter.log.debug("Node :  " + JSON.stringify(element));

        const sid = adapter.namespace + '.' + element.type + '_' + element.node;
        if (!objects[sid]) {
            adapter.setObjectNotExistsAsync(sid, {
                type: 'channel',
                common: {
                    name: element.node,

                },
                native: {
                    type: element.type
                }
            });
            adapter.setObjectNotExistsAsync(sid + '.status', {
                common: {
                    name: 'Status',
                    role: 'indicator.status',
                    write: false,
                    read: true,
                    type: 'boolean'
                },
                type: 'state',
                native: {}
            });
            adapter.setObjectNotExistsAsync(sid + '.shutdown', {
                type: 'state',
                common: {
                    name: 'shutdown',
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: true,
                    desc: 'shutdown node'

                },
                native: {}
            });
            adapter.setObjectNotExistsAsync(sid + '.reboot', {
                type: 'state',
                common: {
                    name: 'reboot',
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: true,
                    desc: 'reboot node'

                },
                native: {}
            });
        }

        if (element.cpu) _createState(sid, 'cpu', 'level', parseInt(element.cpu * 10000) / 100);
        if (element.maxcpu) _createState(sid, 'cpu_max', 'default_num', element.maxcpu);

        callbackCnt++;
        proxmox.nodeStatus(element.node, function (data) {

            adapter.log.debug("Request states for node " + element.node);

            const node_vals = data.data;
            if (node_vals) {
                if (node_vals.uptime !== undefined) _createState(sid, 'uptime', 'time', node_vals.uptime);

                if (node_vals.wait !== undefined) _createState(sid, 'iowait', 'level', parseInt(node_vals.wait * 10000) / 100);

                if (node_vals.memory.used !== undefined) _createState(sid, 'memory.used', 'size', BtoMb(node_vals.memory.used));
                if (node_vals.memory.used !== undefined) _createState(sid, 'memory.used_lev', 'level', p(node_vals.memory.used, node_vals.memory.total));
                if (node_vals.memory.total !== undefined) _createState(sid, 'memory.total', 'size', BtoMb(node_vals.memory.total));
                if (node_vals.memory.free !== undefined) _createState(sid, 'memory.free', 'size', BtoMb(node_vals.memory.free));

                if (node_vals.loadavg[0] !== undefined) _createState(sid, 'loadavg.0', 'default_num', parseFloat(node_vals.loadavg[0]));
                if (node_vals.loadavg[1] !== undefined) _createState(sid, 'loadavg.1', 'default_num', parseFloat(node_vals.loadavg[1]));
                if (node_vals.loadavg[2] !== undefined) _createState(sid, 'loadavg.2', 'default_num', parseFloat(node_vals.loadavg[2]));

                if (node_vals.swap.used !== undefined) _createState(sid, 'swap.used', 'size', BtoMb(node_vals.swap.used));
                if (node_vals.swap.free !== undefined) _createState(sid, 'swap.free', 'size', BtoMb(node_vals.swap.free));
                if (node_vals.swap.total !== undefined) _createState(sid, 'swap.total', 'size', BtoMb(node_vals.swap.total));
                if (node_vals.swap.free !== undefined) _createState(sid, 'swap.used_lev', 'level', p(node_vals.swap.used, node_vals.swap.total));
            }

            if (!--callbackCnt) {
                _createVM(callback)
            }
        });
    });
}

function _setNodes(devices, callback) {

    devices.forEach(function (element) {
        adapter.log.debug("Node :  " + JSON.stringify(element));

        const sid = adapter.namespace + '.' + element.type + '_' + element.node;

        adapter.setState(sid + '.cpu', parseInt(element.cpu * 10000) / 100, true);
        adapter.setState(sid + '.cpu_max', element.maxcpu, true);
        adapter.setState(sid + '.status', element.status, true);

        proxmox.nodeStatus(element.node, function (data) {

            adapter.log.debug("Request states for node " + element.node);

            const node_vals = data.data;

            //check if node is empty
            if (!node_vals || typeof node_vals.uptime === 'undefined') return;

            if (node_vals.uptime !== undefined) adapter.setState(sid + '.uptime', node_vals.uptime, true);
            // adapter.setState(sid + '.' + name, val, true)

            if (node_vals.wait !== undefined) adapter.setState(sid + '.iowait', parseInt(node_vals.wait * 10000) / 100, true);

            if (node_vals.memory.used !== undefined) adapter.setState(sid + '.memory.used', BtoMb(node_vals.memory.used), true);
            if (node_vals.memory.used !== undefined) adapter.setState(sid + '.memory.used_lev', p(node_vals.memory.used, node_vals.memory.total), true);
            if (node_vals.memory.total !== undefined) adapter.setState(sid + '.memory.total', BtoMb(node_vals.memory.total), true);
            if (node_vals.memory.free !== undefined) adapter.setState(sid + '.memory.free', BtoMb(node_vals.memory.free), true);

            if (node_vals.loadavg[0] !== undefined) adapter.setState(sid + '.loadavg.0', parseFloat(node_vals.loadavg[0]), true);
            if (node_vals.loadavg[1] !== undefined) adapter.setState(sid + '.loadavg.1', parseFloat(node_vals.loadavg[1]), true);
            if (node_vals.loadavg[2] !== undefined) adapter.setState(sid + '.loadavg.2', parseFloat(node_vals.loadavg[2]), true);

            if (node_vals.swap.used !== undefined) adapter.setState(sid + '.swap.used', BtoMb(node_vals.swap.used), true);
            if (node_vals.swap.free !== undefined) adapter.setState(sid + '.swap.free', BtoMb(node_vals.swap.free), true);
            if (node_vals.swap.total !== undefined) adapter.setState(sid + '.swap.total', BtoMb(node_vals.swap.total), true);
            if (node_vals.swap.used !== undefined) adapter.setState(sid + '.swap.used_lev', p(node_vals.swap.used, node_vals.swap.total), true);

        });
    });
    _setVM();
}


function _setVM(callback) {
    let sid = '';

    proxmox.all(function (data) {
        const qemu = data.data;

        for (let i = 0; i < qemu.length; i++) {

            if (qemu[i].type === "qemu" || qemu[i].type === "lxc") {
                let type = qemu[i].type;

                proxmox.qemuStatus(qemu[i].node, type, qemu[i].vmid, function (data) {
                    const aktQemu = data.data;

                    //check if vm is empty
                    if (!aktQemu || !aktQemu.name) return

                    sid = adapter.namespace + '.' + type + '_' + aktQemu.name;

                    findState(sid, aktQemu, (states) => {
                        states.forEach(function (element) {
                            adapter.setState(element[0] + '.' + element[1], element[3], true);
                        });
                    });

                });

            } else if (qemu[i].type === "storage") {
                let type = qemu[i].type;

                proxmox.storageStatus(qemu[i].node, qemu[i].storage, !!qemu[i].shared, function (data, name) {
                    const aktQemu = data.data;

                    sid = adapter.namespace + '.' + type + '_' + name;
                    adapter.log.debug("storage reload: " + name + ' for node ' + qemu[i].node);

                    findState(sid, aktQemu, (states) => {
                        states.forEach(function (element) {
                            adapter.setState(element[0] + '.' + element[1], element[3], true);
                        });
                    });
                });
            }
        }
    });
}


function _createVM(callback) {
    let sid = '';

    const createDone = () => {
        adapter.setState('info.connection', true, true);
        if (!finish) {
            requestInterval && clearTimeout(requestInterval);
            requestInterval = setTimeout(sendRequest, 5000);
        }
        finish = true;
    };

    proxmox.all(function (data) {
        let callbackCnt = 0;

        const qemu = data.data;

        if (!qemu || !Array.isArray(qemu)) return

        for (let i = 0; i < qemu.length; i++) {

            if (qemu[i].type === "qemu" || qemu[i].type === "lxc") {
                let type = qemu[i].type;

                callbackCnt++;
                proxmox.qemuStatus(qemu[i].node, type, qemu[i].vmid, function (data) {

                    const aktQemu = data.data;

                    if (!aktQemu) return

                    sid = adapter.namespace + '.' + type + '_' + aktQemu.name;

                    adapter.log.debug("new " + type + ": " + aktQemu.name);

                    if (!objects[sid]) {
                        adapter.setObjectNotExistsAsync(sid, {
                            type: 'channel',
                            common: {
                                name: aktQemu.name

                            },
                            native: {

                                type: type
                            }
                        });

                    }
                    adapter.setObjectNotExistsAsync(sid + '.start', {
                        type: 'state',
                        common: {
                            name: 'start',
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                            desc: 'Start VM'

                        },
                        native: {}
                    });
                    adapter.setObjectNotExistsAsync(sid + '.stop', {
                        type: 'state',
                        common: {
                            name: 'stop',
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                            desc: 'stop VM'

                        },
                        native: {}
                    });
                    adapter.setObjectNotExistsAsync(sid + '.shutdown', {
                        type: 'state',
                        common: {
                            name: 'shutdown',
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                            desc: 'shutdown VM'

                        },
                        native: {}
                    });
                    adapter.setObjectNotExistsAsync(sid + '.reboot', {
                        type: 'state',
                        common: {
                            name: 'reboot',
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                            desc: 'reboot VM'

                        },
                        native: {}
                    });

                    findState(sid, aktQemu, (states) => {
                        states.forEach(function (element) {
                            _createState(element[0], element[1], element[2], element[3]);
                        });
                        if (!--callbackCnt) createDone();
                    });
                });
            } else if (qemu[i].type === "storage") {
                let type = qemu[i].type;

                callbackCnt++;
                proxmox.storageStatus(qemu[i].node, qemu[i].storage, !!qemu[i].shared, function (data, name) {
                    const aktQemu = data.data;

                    if (!aktQemu) return

                    sid = adapter.namespace + '.' + type + '_' + name;
                    adapter.log.debug("new  storage: " + name);

                    if (!objects[sid]) {
                        adapter.setObjectNotExistsAsync(sid, {
                            type: 'channel',
                            common: {
                                name: name
                            },
                            native: {
                                type: type
                            }
                        });
                    }
                    findState(sid, aktQemu, (states) => {
                        states.forEach(function (element) {
                            _createState(element[0], element[1], element[2], element[3]);
                        });
                        if (!--callbackCnt) createDone();
                    });
                });
            }
        }
    });
}

function findState(sid, states, cb) {
    let result = [];

    for (let key in states) {
        let value = states[key];
        adapter.log.debug("search state" + key + ": " + value);

        if (key === "mem") {
            result.push([sid, key + '_lev', 'level', p(states.mem, states.maxmem)])
            adapter.log.debug(states.mem, states.maxmem)
        }
        if (key === "disk") {
            result.push([sid, key + '_lev', 'level', p(states.disk, states.maxdisk)])
            adapter.log.debug(states.mem, states.maxmem)
        }
        if (key === "used") {
            result.push([sid, key + '_lev', 'level', p(states.used, states.total)])
        }
        if (key === "mem" || key === "disk" || key === "balloon_min" || key === "maxdisk" || key === "maxmem" || key === "diskwrite" || key === "used" || key === "total" || key === "avail") {
            result.push([sid, key, 'size', BtoMb(value)])
        } else if (key === "uptime") {
            result.push([sid, key, 'time', value])
        } else if (key === "status") {
            result.push([sid, key, 'status', value])            
        } else if (key === "netin" || key === "netout") {
            result.push([sid, key, 'sizeb', value]);
        } else if (key === "cpu") {
            result.push([sid, key, 'level', parseInt(value * 10000) / 100]);
        } else if (key === "pid" || key === "cpus" || key === "shared" || key === "enabled" || key === "active" || key === "shared") {
            result.push([sid, key, 'default_num', value]);
        } else if (key === "content" || key === "type" || key === "status") {
            result.push([sid, key, 'text', value]);
        }
    }
    adapter.log.debug('found states:_' + JSON.stringify(result))
    cb(result);
}

function readObjects(callback) {
    adapter.getForeignObjects(adapter.namespace + ".*", 'channel', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.subscribeStates('*');
            objects = list;
            adapter.log.debug("reading objects: " + JSON.stringify(list));
            //updateConnect();
            callback && callback();
        }
    });
}


function _createState(sid, name, type, val, callback) {
    adapter.log.debug('create state: ' + name);
    switch (type) {
        case 'time':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'number',
                    unit: 'sec.'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'size':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'number',
                    unit: 'MiB'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'sizeb':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'number',
                    unit: 'byte'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'level':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'number',
                    unit: '%'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'default_num':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'number'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'text':
            adapter.setObjectNotExistsAsync(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'value',
                    write: false,
                    read: true,
                    type: 'string'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
    }
}

function BtoMb(val) {
    return Math.round(val / 1048576)
}

function p(vala, valb) {
    return Math.round(vala / valb * 10000) / 100
}
