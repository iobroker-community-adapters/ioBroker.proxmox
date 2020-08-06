
const request = require('request');

var NODE = ['pve'];
var STORAGE = 'local';
var DISTRIBUTION = 'LOAD';
var TICKET = '';
var CSRF = '';

function proxmox(adapter) {
    this.adapter = adapter;
    this.name = adapter.config.name;
    this.server = adapter.config.server || 'pam';
    this.password = adapter.config.pwd;

    this.port = adapter.config.port;

    this.ipList = adapter.config.ip.split(',').map(el => el.trim()).filter(el => el.length);
    this.ip = this.ipList[0];
    this.ipCount = this.ipList.length;
    this.currentIpId = null;
    this.URL = '';
    this.setNextUrl(0);
    this.adapter.log.debug('Use Proxmox API: ' + this.URL);

    this.responseCache = {};

    this.communicationErrorCounter = 0;
}

proxmox.prototype.setNextUrl = function(id) {
    if (id === undefined) {
        id++;
        if (id === this.ipList.length) {
            id = 0;
        }
    }
    if (this.ipList[id]) {
        id = 0;
    }
    currentIpId = id;
    this.URL = 'https://' + this.ipList[id] + ':' + this.port + '/api2/json';
    return this.URL;
};


proxmox.prototype.resetResponseCache = function() {
    this.responseCache = {};
};

proxmox.prototype.status = function (callback) {
    if (this.responseCache['/nodes']) {
        return void callback(this.responseCache['/nodes']);
    }
    this._get('/nodes', 'get').then(data => {
        this.responseCache['/nodes'] = data;
        callback(data);
    });
};

proxmox.prototype.all = function (useCache, callback) {
    if (typeof useCache === 'function') {
        callback = useCache;
        useCache = true;
    }
    if (useCache && this.responseCache['/cluster/resources']) {
        return void callback(this.responseCache['/cluster/resources']);
    }
    this._get('/cluster/resources', 'get').then(data => {
        this.responseCache['/cluster/resources'] = data;
        callback(data);
    });
};

proxmox.prototype.nodeStatus = function (node, useCache, callback) {
    if (typeof useCache === 'function') {
        callback = useCache;
        useCache = true;
    }
    if (useCache && this.responseCache[`/nodes/${node}/status`]) {
        return void callback(this.responseCache[`/nodes/${node}/status`]);
    }
    this._get(`/nodes/${node}/status`, 'get').then(data => {
        this.responseCache[`/nodes/${node}/status`] = data;
        callback(data);
    });
};

proxmox.prototype.qemuStatus = function (node, type, ID, callback) {
    this._get(`/nodes/${node}/${type}/${ID}/status/current`, 'get').then(data => {
        callback(data);
    });
};

proxmox.prototype.storageStatus = function (node, ID, shared, useCache, callback) {
    if (typeof useCache === 'function') {
        callback = useCache;
        useCache = true;
    }
    if (useCache && this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`]) {
        return void callback(this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`]);
    }
    this._get(`/nodes/${node}/storage/${ID}/status`, 'get').then(data => {
        this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`] = data;
        callback(data, ID);
    });
};

// NODE ist not implemented jet
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
};

proxmox.prototype.qemuStart = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/start`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuStop = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/stop`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuShutdown = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuReset = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/reset`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuSuspend = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuResume = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/resume`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.qemuReboot = function (node,type,ID, callback) {
    let data = {};
    this._get(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post').then(data => {
        callback(data);
    });
};

proxmox.prototype.nodeReboot = function (node, callback) {
    let data = 'reboot';
    this._get(`/nodes/${node}/status`, 'post',data).then(data => {
        callback(data);
    });
};

proxmox.prototype.nodeShutdown = function (node, callback) {
    let data = 'shutdown';
    this._get(`/nodes/${node}/status`, 'post',data).then(data => {
        callback(data);
    });
};

proxmox.prototype.ticket = function (cb) {
    this._getTicket('/access/ticket').then((d) => {
        TICKET = "PVEAuthCookie=" + d.data.ticket;
        CSRF = d.data.CSRFPreventionToken;
        cb(d);
    });
};

proxmox.prototype._get = function (ur, verb, data, retry) {
    if (typeof data === 'undefined') data = null;
    if (typeof retry === 'undefined') retry = null;
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    var path = ur || '';
    request({
        method: verb,
        uri: this.URL + path,
        form: data,
        strictSSL: false,
        headers: {
            'CSRFPreventionToken': CSRF,
            'Cookie': TICKET
        }
    }, (err, res, body) => {

        if (err || !res) {
            if (!res && !err) {
                err = 'No Response';
            }
            this.adapter.log.error('ERROR:' + err);

            this.communicationErrorCounter++;
            // We experienced error the same as we have servers available, so no chance to retry another server
            if (this.communicationErrorCounter >= this.ipList.length) {
                return void error(err);
            }
            this.setNextUrl();
            this.adapter.log.info('Use Next Proxmox Host because of communication failure (' + this.communicationErrorCounter + '): ' + this.URL);

            this._get(ur, verb, data)
                .then(data => success(data))
                .error(err => error(err));
        }
        else {
            this.communicationErrorCounter = 0;
            if (res.statusCode == 401 && !retry) {
                //this.adapter.log.warn('401:' + body);
                this.ticket(() => {
                    this._get(ur, verb, data, true)
                        .then(data => success(data))
                        .error(err => error(err));
                });
            } else {
                if (res.statusCode == 200) {
                    success(JSON.parse(body));
                } else {
                    error(res.statusMessage + ' - ' + body);
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

};

proxmox.prototype._getTicket = function (callback) {
    var success = function (c) { };
    var error = function (c) { };
    //Promise

    request.post({
        url: `${this.URL}/access/ticket?username=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}&password=${encodeURIComponent(this.password)}`,
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
};

module.exports = proxmox;