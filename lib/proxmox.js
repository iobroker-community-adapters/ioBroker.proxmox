
const request = require('request');


var URL = "https://192.168.178.100:8006" + '/api2/json';
var HOST = "https://192.168.178.100:8006";
//const USER = options.user;
//onst PASS = options.password;
let NODE = ['pve'];
const STORAGE = 'local';
const DISTRIBUTION = 'LOAD';
const NET = `name=eth0,ip=dhcp,bridge=vmbr0`;
let TICKET = '';
let CSRF = '';

function proxmox(adapter) {
    this.adapter = adapter;
    this.name = adapter.config.name;
    this.password = adapter.config.pwd;
    this.ip = adapter.config.ip;
    this.port = adapter.config.port;
    this.adapter.log.warn("UUID: " + this.ip);

    URL = "https://" + this.ip + ":" + this.port + "/api2/json";
    HOST = "https://" + this.ip + ":" + this.port;
};


proxmox.prototype.status = function (callback) {
    this._get('/nodes', 'get').then(data => {
        callback(data);
    });
}

proxmox.prototype.nodeStatus = function (node,callback) {
    this._get(`/nodes/${node}/status`, 'get').then(data => {
        callback(data);
    });
}

proxmox.prototype.qemuStatus = function (node, callback) {
    this._get(`/nodes/${node}/qemu`, 'get').then(data => {
        callback(data);
    });
}


// NODE ist not iplemented jet
proxmox.prototype.nodesStatus = function(cb) {
    
    let resp = {};
    let c = NODE.length;
    NODE.forEach(n => {
        this._get(`/nodes/${n}/status`, 'get').then(data => {
            c--
            this.adapter.log.debug("dataticket :" + n);
            resp[n] = data;
            if (c == 0) {
                cb(resp);
            }
        });
    });
}


proxmox.prototype.ghticket = function (cb) {
    _getTicket('/access/ticket').then((d) => {
        cb({
            ticket: d.data.ticket,
            CSRF: d.data.CSRFPreventionToken
        });
    });
}

proxmox.prototype.ticket = function (cb) {
    this._getTicket('/access/ticket').then((d) => {
        TICKET = "PVEAuthCookie=" + d.data.ticket;
        CSRF = d.data.CSRFPreventionToken;
        cb(d);
    });
}

proxmox.prototype._get = function (ur, verb, data = null, retry = false) {
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    const path = ur || '';
    request({
        method: verb,
        uri: URL + path,
        form: data,
        strictSSL: false,
        headers: {
            'CSRFPreventionToken': CSRF,
            'Cookie': TICKET
        }
    }, (err, res, body) => {
        if (err) {
            console.log('ERROR:', err);
            error(err);
        }

        if (res.statusCode == 401 && !retry) {
            this.ticket(() => {
                this._get(ur, verb, data, true).then(data => {
                    success(data);
                });
            });
        } else {
            if (res.statusCode == 200) {
                success(JSON.parse(body));
            } else {
                success(res.statusMessage + ' - ' + body);
            }
        }
    });

    //Promise
    return {
        then: function (cb) {
            success = cb;
            return this;
        },
        error: function (cb) {
            error = cb;
            return this;
        }
    };
}

proxmox.prototype._getTicket = function () {
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    request.post({
        url: URL + `/access/ticket?username=${this.name}@pam&password=${this.password}`,
        'strictSSL': false
    }, (err, res, body) => {
        if (err) {
            console.log('ERROR:', err);
            error(err);
        }


        if (res.statusCode == 200) {
            success(JSON.parse(body));
            this.adapter.log.debug("dataticket :" + body);
        } else {
            //throw new Error(`Auth failed! ${URL} - ${this.name} - ${this.password}`, body);
            this.adapter.log.debug("wrong dataticket :" + body);
        }
    });


    //Promise
    return {
        then: function (cb) {
            success = cb;
            return this;
        },
        error: function (cb) {
            error = cb;
            return this;
        }
    };
}



module.exports = proxmox;