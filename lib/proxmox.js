const https = require('node:https');
const axios = require('axios').default;

const NODE = ['pve'];
let TICKET = '';
let CSRF = '';

class ProxmoxUtils {
    constructor(adapter) {
        this.adapter = adapter;
        this.name = adapter.config.name;
        this.server = adapter.config.server || 'pam';
        this.password = adapter.config.pwd;

        this.port = adapter.config.port;
        this.ipList = adapter.config.ip
            .split(',')
            .map((el) => el.trim())
            .filter((el) => el.length);

        this.currentIpId = 0

        this.setNextUrl(0);
        this.adapter.log.debug(`Using Proxmox API: ${this.URL}`);

        this.responseCache = {};
        this.sharedMap = {};
        this.runningRequests = {};

        this.stopped = false;

        this.communicationErrorCounter = 0;
    }

    setNextUrl(id) {
        if (typeof id === 'number') {
            this.currentIpId = id - 1;
        }

        this.currentIpId++;
        if (this.currentIpId === this.ipList.length) {
            this.currentIpId = 0;
        }
        if (this.ipList[this.currentIpId]) {
            this.currentIpId = 0;
        }

        this.URL = `https://${this.ipList[this.currentIpId]}:${this.port}/api2/json`;
        return this.URL;
    }

    resetResponseCache() {
        this.responseCache = {};
        this.sharedMap = {};
    }

    status(callback) {
        if (this.responseCache['/nodes']) {
            return void callback(JSON.parse(JSON.stringify(this.responseCache['/nodes'])));
        }
        this._get('/nodes', 'get').then((data) => {
            if (data !== null && typeof data === 'object') {
                this.responseCache['/nodes'] = data;
            }
            callback(data);
        });
    }

    all(useCache, callback) {
        if (typeof useCache === 'function') {
            callback = useCache;
            useCache = true;
        }
        if (useCache && this.responseCache['/cluster/resources']) {
            return void callback(JSON.parse(JSON.stringify(this.responseCache['/cluster/resources'])));
        }
        this._get('/cluster/resources', 'get').then((data) => {
            if (data !== null && typeof data === 'object') {
                this.responseCache['/cluster/resources'] = data;
            }
            callback(data);
        });
    }

    nodeStatus(node, useCache, callback) {
        if (typeof useCache === 'function') {
            callback = useCache;
            useCache = true;
        }
        if (useCache && this.responseCache[`/nodes/${node}/status`]) {
            return void callback(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${node}/status`])));
        }
        this._get(`/nodes/${node}/status`, 'get').then((data) => {
            if (data !== null && typeof data === 'object') {
                this.responseCache[`/nodes/${node}/status`] = data;
            }
            callback(data);
        });
    }

    qemuStatus(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/current`, 'get').then((data) => {
            callback(data);
        });
    }

    storageStatus(node, ID, shared, useCache, callback) {
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
            } else {
                this.sharedMap[`/nodes/SHARED/storage/${ID}/status`] = node;
            }
        }
        this._get(`/nodes/${node}/storage/${ID}/status`, 'get').then((data) => {
            if (data !== null && typeof data === 'object') {
                this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`] = data;
            }
            callback(data, ID);
        });
    }

    nodesStatus(cb) {
        const resp = {};
        let c = NODE.length;
        NODE.forEach((n) => {
            this._get(`/nodes/${n}/status`, 'get').then((data) => {
                c--;
                this.adapter.log.debug('dataticket :' + n);
                resp[n] = data;
                if (c === 0) {
                    cb(resp);
                }
            });
        });
    }

    qemuStart(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/start`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuStop(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/stop`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuShutdown(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuReset(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/reset`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuSuspend(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuResume(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/resume`, 'post').then((data) => {
            callback(data);
        });
    }

    qemuReboot(node, type, ID, callback) {
        this._get(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post').then((data) => {
            callback(data);
        });
    }

    nodeReboot(node, callback) {
        const data = 'command=reboot';
        this._get(`/nodes/${node}/status`, 'post', data).then((data) => {
            callback(data);
        });
    }

    nodeShutdown(node, callback) {
        const data = 'command=shutdown';
        this._get(`/nodes/${node}/status`, 'post', data).then((data) => {
            callback(data);
        });
    }

    ticket(cb) {
        this._getTicket().then((data) => {
            this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

            TICKET = 'PVEAuthCookie=' + data.ticket;
            CSRF = data.CSRFPreventionToken;

            cb();
        });
    }

    _get(ur, method, data, retry) {
        if (this.stopped) {
            return;
        }

        if (typeof data === 'undefined') {
            data = null;
        }
        if (typeof retry === 'undefined') {
            retry = null;
        }

        const path = ur || '';

        const success = (data) => {
            if (!this.runningRequests[path]) {
                return;
            }
            const successCallbacks = this.runningRequests[path].success;
            delete this.runningRequests[path];
            successCallbacks.forEach((callback) => setImmediate(callback, data));
        };
        const error = (err) => {
            if (!this.runningRequests[path]) {
                return;
            }
            const errorCallbacks = this.runningRequests[path].error;
            delete this.runningRequests[path];
            errorCallbacks.forEach((callback) => setImmediate(callback, err));
        };

        if (!this.runningRequests[path] || retry) {
            if (!retry) {
                this.runningRequests[path] = { success: [], error: [] };
            }

            axios({
                method,
                baseURL: this.URL,
                url: path,
                data,
                headers: {
                    CSRFPreventionToken: CSRF,
                    Cookie: TICKET,
                },
                validateStatus: (status) => {
                    return [200, 401].indexOf(status) > -1;
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            })
            .then((response) => {
                this.adapter.log.debug(`received ${response.status} response from ${path} with content: ${JSON.stringify(response.data)}`);

                this.communicationErrorCounter = 0;
                if (response.status === 401 && !retry) {
                    this.ticket(() => {
                        // Retry with new ticket
                        this._get(ur, method, data, true);
                    });
                } else {
                    if (response.status === 200) {
                        success(response.data);
                    } else {
                        error(response.status + ' - ' + response.data);
                    }
                }
            })
            .catch((error) => {
                this.adapter.log.error(`received ${error.response.status} response from ${url} with content: ${JSON.stringify(error.response.data)}`);

                this.communicationErrorCounter++;
                // We experienced error the same as we have servers available, so no chance to retry another server
                this.setNextUrl();
                if (this.communicationErrorCounter >= this.ipList.length) {
                    return void error(error.response.data);
                }
                this.adapter.log.info(`Use Next Proxmox Host because of communication failure (${this.communicationErrorCounter}): ${this.URL}`);

                this._get(ur, method, data, true);
            });
        }

        //Promise
        return {
            then: (cb) => {
                this.runningRequests[path].success.push(cb);
                return this;
            },
            error: (cb) => {
                this.runningRequests[path].error.push(cb);
                return this;
            },
        };
    }

    async _getTicket() {
        return new Promise((resolve, reject) => {
            const url = `/access/ticket?username=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}&password=${encodeURIComponent(this.password)}`;

            axios({
                method: 'post',
                baseURL: this.URL,
                url,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            })
            .then((response) => {
                this.adapter.log.debug(`received ${response.status} response from ${url} with content: ${JSON.stringify(response.data)}`);

                if (response.status === 200) {
                    this.adapter.log.debug(`dataticket: ${JSON.stringify(response.data)}`);

                    resolve(response.data.data); // "data" is an attribute in the response json
                } else {
                    this.adapter.log.error(`${response.status}: wrong User data, could not log in, please try again with correct user and pw`);

                    reject(response.status);
                }
            })
            .catch((error) => {
                if (error.response) {
                    // The request was made and the server responded with a status code
                    this.adapter.log.warn(`received ${error.response.status} response from ${url} with content: ${JSON.stringify(error.response.data)}`);

                    reject(error.response.status);
                } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js

                    reject(-1);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    this.adapter.log.error(error.message);

                    reject(-2);
                }
            });
        });
    }

    stop() {
        this.stopped = true;
    }
}

module.exports = ProxmoxUtils;
