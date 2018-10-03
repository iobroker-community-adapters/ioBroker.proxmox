
const request = require('request');


var URL = "https://192.168.178.100:8006" + '/api2/json';
var HOST = "https://192.168.178.100:8006";
var NODE = ['pve'];
var STORAGE = 'local';
var DISTRIBUTION = 'LOAD';
var TICKET = '';
var CSRF = '';

function proxmox(adapter, callback) {
    this.adapter = adapter;
    this.name = adapter.config.name;
    this.password = adapter.config.pwd;
    this.ip = adapter.config.ip;
    this.port = adapter.config.port;

    URL = "https://" + this.ip + ":" + this.port + "/api2/json";
    HOST = "https://" + this.ip + ":" + this.port;


    //callback();
};


proxmox.prototype.status = function (callback) {
    this._get('/nodes', 'get').then(data => {
        callback(data);
    });
}

proxmox.prototype.all = function (callback) {
    this._get('/cluster/resources', 'get').then(data => {
        callback(data);
    });
}

proxmox.prototype.nodeStatus = function (node, callback) {
    this._get(`/nodes/${node}/status`, 'get').then(data => {
        callback(data);
    });
}

proxmox.prototype.qemuStatus = function (node,type,ID, callback) {
    this._get(`/nodes/${node}/${type}/${ID}/status/current`, 'get').then(data => {
        callback(data);
    });
}
proxmox.prototype.storageStatus = function (node,ID, callback) {
    this._get(`/nodes/${node}/storage/${ID}/status`, 'get').then(data => {
        callback(data,ID);
    });
}

// NODE ist not iplemented jet
proxmox.prototype.nodesStatus = function (cb) {

    var resp = {};
    var c = NODE.length;
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

proxmox.prototype.ticket = function (cb) {
    this._getTicket('/access/ticket').then((d) => {
        TICKET = "PVEAuthCookie=" + d.data.ticket;
        CSRF = d.data.CSRFPreventionToken;
        cb(d);
    });
}

proxmox.prototype._get = function (ur, verb, data, retry) {
    if (typeof data === 'undefined') data = null;
    if (typeof retry === 'undefined') retry = null;
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    var path = ur || '';
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
            this.adapter.log.error('ERROR:' + err);
            error(err);
        }
        else {

            if (res.statusCode == 401 && !retry) {
                //this.adapter.log.warn('401:' + body);
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

proxmox.prototype._getTicket = function (callback) {
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    request.post({
        url: URL + `/access/ticket?username=${this.name}@pam&password=${this.password}`,
        'strictSSL': false
    }, (err, res, body) => {
        if (err) {
            this.adapter.log.error('404:' + err);
            if (callback && typeof (callback) == "function") callback(404)
            error(err);
        }
        else {
            if (callback && typeof (callback) == "function") callback(res.statusCode);

            if (res.statusCode == 200) {
                success(JSON.parse(body));
                this.adapter.log.debug("dataticket :" + body);
            } else {
                
                this.adapter.log.error(res.statusCode + ": wrong User data, could not log in, please try again with correct user and pw" );
                error(res.statusCode);
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



module.exports = proxmox;