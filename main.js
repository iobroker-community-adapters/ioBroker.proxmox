
'use strict';

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = new utils.Adapter('proxmox');
var ProxmoxGet = require(__dirname + '/lib/proxmox');

var proxmox;
var devices = [];
var objects = {};
var connected = false;
var requestInterval;
var finish = false;

var deviceparam = ['uptime', ""]

//device constructor
function devices(name, status, type, id) {

    this.name = name;
    this.type = type;
    this.id = id;
    this.status = status;
}


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    //adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {

    proxmox = new ProxmoxGet(adapter);

    //check Intervall 
    adapter.config.param_requestInterval = parseInt(adapter.config.param_requestInterval, 10) || 30;

    if (adapter.config.param_requestInterval < 5) {
        adapter.log.info('Intervall <5, set to 5');
        adapter.config.param_requestInterval = 5;
    }

    proxmox._getTicket(function (result) {
        if (result === "200" || result === 200) {
            main();
            adapter.setState('info.connection', true, true);
        }
        else {
            adapter.setState('info.connection', false, true);
        }
    });

    
});

function main() {

    proxmox = new ProxmoxGet(adapter);

    /**
     *
     *      For every state in the system there has to be also an object of type state
     *
     *      Here a simple template for a boolean variable named "testVariable"
     *
     *      Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
     *
     */

    readObjects(_getNodes());

    adapter.setObject('blaubeere', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'string',
            role: 'indicator'
        },
        native: {}
    });


    sendRequest();
    // *1000 convert sek in MS.
    requestInterval = setInterval(sendRequest, adapter.config.param_requestInterval * 1000);

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
}

var requestTimeout = null;

function sendRequest() {

    requestTimeout = setTimeout(function () {
        requestTimeout = null;
        if (connected) {
            connected = false;
            adapter.log.debug('Disconnect');
            adapter.setState('info.connection', false, true);
        }
    }, 3000);
    if (finish) {
        try {
            proxmox.status(function (data) {

                devices = data.data;
                _setNodes(data.data);
                adapter.log.debug("Devices: " + JSON.stringify(data));
            });


        } catch (e) {
            adapter.log.warn('Cannot send request: ' + e);
            clearTimeout(requestTimeout);
            requestTimeout = null;
            if (connected) {
                connected = false;
                adapter.log.debug('Disconnect');
                adapter.setState('info.connection', false, true);
            }
        }

    }


}




function _getNodes(callback) {
    var n = 0;
    proxmox.status(function (data) {

        devices = data.data;
        _createNodes(data.data, callback);
        adapter.log.warn("Devices: " + JSON.stringify(data));
    });


};

function _createNodes(devices, callback) {


    devices.forEach(function (element) {
        adapter.log.debug("Node :  " + JSON.stringify(element));


        var sid = adapter.namespace + '.' + element.type + '_' + element.node;
        if (!objects[sid]) {
            adapter.setObjectNotExists(sid, {
                type: 'channel',
                common: {
                    name: element.node,

                },
                native: {

                    type: element.type
                }
            });

            adapter.setObjectNotExists(sid + '.status', {
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


        }
        if (element.cpu) _createState(sid, 'cpu', 'level', parseInt(element.cpu * 10000) / 100);
        if (element.maxcpu) _createState(sid, 'cpu_max', 'default_num', element.maxcpu);

        proxmox.nodeStatus(element.node, function (data) {

            adapter.log.debug("Request states for node " + element.node);

            var node_vals = data.data;
            adapter.setState('blaubeere', JSON.stringify(data));
            if (node_vals.uptime) _createState(sid, 'uptime', 'time', node_vals.uptime);

            if (node_vals.memory.used) _createState(sid, 'memory.used', 'size', BtoMb(node_vals.memory.used));
            if (node_vals.memory.used) _createState(sid, 'memory.used_lev', 'level', p(node_vals.memory.used, node_vals.memory.total));
            if (node_vals.memory.total) _createState(sid, 'memory.total', 'size', BtoMb(node_vals.memory.total));
            if (node_vals.memory.free) _createState(sid, 'memory.free', 'size', BtoMb(node_vals.memory.free));

            if (node_vals.loadavg[0]) _createState(sid, 'loadavg.0', 'default_num', parseFloat(node_vals.loadavg[0]));
            if (node_vals.loadavg[1]) _createState(sid, 'loadavg.1', 'default_num', parseFloat(node_vals.loadavg[1]));
            if (node_vals.loadavg[2]) _createState(sid, 'loadavg.2', 'default_num', parseFloat(node_vals.loadavg[2]));

            if (node_vals.swap.used) _createState(sid, 'swap.used', 'size', BtoMb(node_vals.swap.used));
            if (node_vals.swap.free) _createState(sid, 'swap.free', 'size', BtoMb(node_vals.swap.free));
            if (node_vals.swap.total) _createState(sid, 'swap.total', 'size', BtoMb(node_vals.swap.total));
            if (node_vals.swap.free) _createState(sid, 'swap.used_lev', 'level', p(node_vals.swap.used, node_vals.swap.total));

            _createVM(element.node, callback)
        });


    });
}

function _setNodes(devices, callback) {


    devices.forEach(function (element) {
        adapter.log.debug("Node :  " + JSON.stringify(element));


        var sid = adapter.namespace + '.' + element.type + '_' + element.node;


        adapter.setState(sid + '.cpu', parseInt(element.cpu * 10000) / 100, true);
        adapter.setState(sid + '.cpu_max', element.maxcpu, true);

        proxmox.nodeStatus(element.node, function (data) {

            adapter.log.debug("Request states for node " + element.node);

            var node_vals = data.data;
            adapter.setState('blaubeere', JSON.stringify(data), true);

            adapter.setState(sid + '.uptime', node_vals.uptime, true);
            // adapter.setState(sid + '.' + name, val, true)

            adapter.setState(sid + '.memory.used', BtoMb(node_vals.memory.used), true);
            adapter.setState(sid + '.memory.used_lev', p(node_vals.memory.used, node_vals.memory.total), true);
            adapter.setState(sid + '.memory.total', BtoMb(node_vals.memory.total), true);
            adapter.setState(sid + '.memory.free', BtoMb(node_vals.memory.free), true);

            adapter.setState(sid + '.loadavg.0', parseFloat(node_vals.loadavg[0]), true);
            adapter.setState(sid + '.loadavg.1', parseFloat(node_vals.loadavg[1]), true);
            adapter.setState(sid + '.loadavg.2', parseFloat(node_vals.loadavg[2]), true);

            adapter.setState(sid + '.swap.used', BtoMb(node_vals.swap.used), true);
            adapter.setState(sid + '.swap.free', BtoMb(node_vals.swap.free), true);
            adapter.setState(sid + '.swap.total', BtoMb(node_vals.swap.total), true);
            adapter.setState(sid + '.swap.used_lev', p(node_vals.swap.used, node_vals.swap.total), true);

            _setVM(element.node);
        });


    });
}


function _setVM(node, callback) {
    proxmox.qemuStatus(node, function (data) {
        var qemus = data.data;

        for (var i = 0; i < qemus.length; i++) {

            var sid = adapter.namespace + '.' + "qemu" + '_' + qemus[i].name;

            var obj = qemus[i];
            for (var key in obj) {
                var value = obj[key];
                adapter.log.debug("new state: " + key + ": " + value);
                if (key === "mem") {
                    adapter.setState(sid + '.' + 'mem_lev', p(obj.mem, obj.maxmem), true);
                }
                if (key === "mem" || key === "netin" || key === "balloon_min" || key === "maxdisk" || key === "netout" || key === "maxmem") {
                    adapter.setState(sid + '.' + key, BtoMb(value), true);
                }
                else if (key === "uptime") {
                    adapter.setState(sid + '.' + key, value, true);
                }
                else if (key === "cpu") {
                    adapter.setState(sid + '.' + key, parseInt(value * 10000) / 100, true);
                }
                else {

                    adapter.setState(sid + '.' + key, value, true);
                }
            }
            if (i === qemus.length - 1) {
                adapter.setState('info.connection', true, true);

            }
        }

        //callback

    });

}


function _createVM(node, callback) {
    proxmox.qemuStatus(node, function (data) {
        var qemus = data.data;

        for (var i = 0; i < qemus.length; i++) {

            adapter.log.debug("new quemu: " + qemus[i].name);

            var sid = adapter.namespace + '.' + "qemu" + '_' + qemus[i].name;
            if (!objects[sid]) {
                adapter.setObjectNotExists(sid, {
                    type: 'channel',
                    common: {
                        name: qemus[i].name,

                    },
                    native: {

                        type: "qemu"
                    }
                });

            }

            var obj = qemus[i];
            for (var key in obj) {
                var value = obj[key];
                adapter.log.debug("new state: " + key + ": " + value);

                if (key === "mem") {
                    _createState(sid, 'mem_lev', 'level', p(obj.mem, obj.maxmen));
                }

                if (key === "mem" || key === "netin" || key === "balloon_min" || key === "maxdisk" || key === "netout" || key === "maxmem") {
                    _createState(sid, key, 'size', BtoMb(value));
                }
                else if (key === "uptime") {
                    _createState(sid, key, 'time', value);
                }
                else if (key === "cpu") {
                    _createState(sid, key, 'level', parseInt(value * 10000) / 100);
                }
                else {

                    _createState(sid, key, 'default_num', value);
                }
            }
            if (i === qemus.length - 1) {
                adapter.setState('info.connection', true, true);
                finish = true;
            }
        }

        //callback

    });

}
function readObjects(callback) {
    adapter.getForeignObjects(adapter.namespace + ".*", 'channel', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.subscribeStates('*');
            objects = list;
            adapter.log.debug("readin objects: " + JSON.stringify(list));
            //updateConnect();
            callback && callback();
        }
    });
};


function _createState(sid, name, type, val, callback) {
    adapter.log.debug('create state: ' + name);
    var state = type;
    switch (state) {
        case 'time':
            adapter.setObjectNotExists(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'indicator.uptime',
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
            adapter.setObjectNotExists(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'indicator.size',
                    write: false,
                    read: true,
                    type: 'number',
                    unit: 'Mb'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        case 'level':
            adapter.setObjectNotExists(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'indicator.level',
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
            adapter.setObjectNotExists(sid + '.' + name, {
                common: {
                    name: name,
                    role: 'indicator.load',
                    write: false,
                    read: true,
                    type: 'number'
                },
                type: 'state',
                native: {}
            }, adapter.setState(sid + '.' + name, val, true));

            break;
        default:

    }

};

function BtoMb(val) {

    return Math.round(val / 1048576)
}

function p(vala, valb) {
    return Math.round(vala / valb * 10000) / 100
}
