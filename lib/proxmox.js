
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
    this.sharedMap = {};
    this.runningRequests = {};

    this.stopped = false;

    this.communicationErrorCounter = 0;
}

proxmox.prototype.stop = function() {
    this.stopped = true;
};

proxmox.prototype.setNextUrl = function(id) {
    if (typeof id === 'number') {
        currentIpId = id - 1;
    }
    currentIpId++;
    if (currentIpId === this.ipList.length) {
        currentIpId = 0;
    }
    if (this.ipList[currentIpId]) {
        currentIpId = 0;
    }
    this.URL = 'https://' + this.ipList[currentIpId] + ':' + this.port + '/api2/json';
    return this.URL;
};


proxmox.prototype.resetResponseCache = function() {
    this.responseCache = {};
    this.sharedMap = {};
};

proxmox.prototype.status = function (callback) {
    if (this.responseCache['/nodes']) {
        return void callback(JSON.parse(JSON.stringify(this.responseCache['/nodes'])));
    }
    this._get('/nodes', 'get').then(data => {
        if (data !== null && typeof data === 'object') this.responseCache['/nodes'] = data;
        callback(data);
    });
};

proxmox.prototype.all = function (useCache, callback) {
    if (typeof useCache === 'function') {
        callback = useCache;
        useCache = true;
    }
    if (useCache && this.responseCache['/cluster/resources']) {
        return void callback(JSON.parse(JSON.stringify(this.responseCache['/cluster/resources'])));
    }
    this._get('/cluster/resources', 'get').then(data => {
        if (data !== null && typeof data === 'object') this.responseCache['/cluster/resources'] = data;
        callback(data);
    });
};

proxmox.prototype.nodeStatus = function (node, useCache, callback) {
    if (typeof useCache === 'function') {
        callback = useCache;
        useCache = true;
    }
    if (useCache && this.responseCache[`/nodes/${node}/status`]) {
        return void callback(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${node}/status`])));
    }
    this._get(`/nodes/${node}/status`, 'get').then(data => {
        if (data !== null && typeof data === 'object') this.responseCache[`/nodes/${node}/status`] = data;
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
        return void callback(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`])));
    }
    if (shared) {
        if (this.sharedMap[`/nodes/SHARED/storage/${ID}/status`]) {
            node = this.sharedMap[`/nodes/SHARED/storage/${ID}/status`];
        }
        else {
            this.sharedMap[`/nodes/SHARED/storage/${ID}/status`] = node;
        }
    };
    this._get(`/nodes/${node}/storage/${ID}/status`, 'get').then(data => {
        if (data !== null && typeof data === 'object') this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`] = data;
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
    if (this.stopped) return;

    if (typeof data === 'undefined') data = null;
    if (typeof retry === 'undefined') retry = null;

    var path = ur || '';

    const success = (data) => {
        if (!this.runningRequests[path]) return;
        const successCallbacks = this.runningRequests[path].success;
        delete this.runningRequests[path];
        successCallbacks.forEach(callback => setImmediate(callback, data));
    };
    const error = (err) => {
        if (!this.runningRequests[path]) return;
        const errorCallbacks = this.runningRequests[path].error;
        delete this.runningRequests[path];
        errorCallbacks.forEach(callback => setImmediate(callback, err));
    };

    if (!this.runningRequests[path] || retry) {
        if (!retry) this.runningRequests[path] = {success: [], error: []};
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
                this.setNextUrl();
                if (this.communicationErrorCounter >= this.ipList.length) {
                    return void error(err);
                }
                this.adapter.log.info('Use Next Proxmox Host because of communication failure (' + this.communicationErrorCounter + '): ' + this.URL);

                this._get(ur, verb, data, true);
            } else {
                this.communicationErrorCounter = 0;
                if (res.statusCode == 401 && !retry) {
                    //this.adapter.log.warn('401:' + body);
                    this.ticket(() => {
                        this._get(ur, verb, data, true);
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
    }

    const that = this;
    //Promise
    return {
        then: function (cb) {
            that.runningRequests[path].success.push(cb);
            return this;
        },
        error: function (cb) {
            that.runningRequests[path].error.push(cb);
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