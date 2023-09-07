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

        this.currentIpId = 0;

        this.setNextUrl(0);
        this.adapter.log.debug(`Using Proxmox API: ${this.URL}`);

        this.responseCache = {};
        this.sharedMap = {};

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

    async getNodes() {
        return new Promise((resolve, reject) => {
            if (this.responseCache['/nodes']) {
                resolve(JSON.parse(JSON.stringify(this.responseCache['/nodes'])));
            } else {
                this._get('/nodes', 'get')
                    .then((data) => {
                        if (data !== null && typeof data === 'object') {
                            this.responseCache['/nodes'] = data.data;
                            resolve(data.data);
                        } else {
                            reject();
                        }
                    })
                    .catch(reject);
            }
        });
    }

    async getNodeStatus(node, useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache[`/nodes/${node}/status`]) {
                resolve(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${node}/status`])));
            } else {
                this._get(`/nodes/${node}/status`, 'get')
                    .then((data) => {
                        if (data !== null && typeof data === 'object') {
                            this.responseCache[`/nodes/${node}/status`] = data.data;
                            resolve(data.data);
                        } else {
                            reject();
                        }
                    })
                    .catch(reject);
            }
        });
    }

    async getNodeDisks(node, useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache[`/nodes/${node}/disks/list`]) {
                resolve(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${node}/disks/list`])));
            } else {
                this._get(`/nodes/${node}/disks/list`, 'get')
                    .then((data) => {
                        if (data !== null && typeof data === 'object') {
                            this.responseCache[`/nodes/${node}/disks/list`] = data.data;
                            resolve(data.data);
                        } else {
                            reject();
                        }
                    })
                    .catch(reject);
            }
        });
    }

    async getNodeDisksSmart(node, disk) {
        return this._get(`/nodes/${node}/disks/smart?disk=${disk}`, 'get');
    }

    async getClusterResources(useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache['/cluster/resources']) {
                resolve(JSON.parse(JSON.stringify(this.responseCache['/cluster/resources'])));
            } else {
                return this._get('/cluster/resources', 'get')
                    .then((data) => {
                        if (data !== null && typeof data === 'object') {
                            this.responseCache['/cluster/resources'] = data.data;
                            resolve(data.data);
                        } else {
                            reject();
                        }
                    })
                    .catch(reject);
            }
        });
    }

    async getResourceStatus(node, type, ID, useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache[`/nodes/${node}/${type}/${ID}/status/current`]) {
                resolve(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${node}/${type}/${ID}/status/current`])));
            } else {
                this._get(`/nodes/${node}/${type}/${ID}/status/current`, 'get')
                    .then((data) => {
                        if (data !== null && typeof data === 'object') {
                            this.responseCache[`/nodes/${node}/${type}/${ID}/status/current`] = data.data;
                            resolve(data.data);
                        } else {
                            reject();
                        }
                    })
                    .catch(reject);
            }
        });
    }

    async getStorageStatus(node, ID, shared, useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`]) {
                resolve(JSON.parse(JSON.stringify(this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`])));
            } else if (shared) {
                if (this.sharedMap[`/nodes/SHARED/storage/${ID}/status`]) {
                    node = this.sharedMap[`/nodes/SHARED/storage/${ID}/status`];
                } else {
                    this.sharedMap[`/nodes/SHARED/storage/${ID}/status`] = node;
                }
            }
            this._get(`/nodes/${node}/storage/${ID}/status`, 'get')
                .then((data) => {
                    if (data !== null && typeof data === 'object') {
                        this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`] = data.data;
                        resolve(data.data);
                    }
                    reject();
                })
                .catch(reject);
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

    async qemuStart(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/start`, 'post');
    }

    async qemuStop(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/stop`, 'post');
    }

    async qemuShutdown(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post');
    }

    async qemuReset(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/reset`, 'post');
    }

    async qemuSuspend(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post');
    }

    async qemuResume(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/resume`, 'post');
    }

    async qemuReboot(node, type, ID) {
        return this._get(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post');
    }

    async nodeReboot(node) {
        return this._get(`/nodes/${node}/status`, 'post', 'command=reboot');
    }

    async nodeShutdown(node) {
        return this._get(`/nodes/${node}/status`, 'post', 'command=shutdown');
    }

    ticket(cb) {
        this._getTicket().then((data) => {
            this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

            TICKET = 'PVEAuthCookie=' + data.ticket;
            CSRF = data.CSRFPreventionToken;

            cb();
        });
    }

    async _get(url, method, data, retry) {
        return new Promise((resolve, reject) => {
            if (this.stopped) {
                reject('STOPPED');
            }

            if (typeof data === 'undefined') {
                data = null;
            }
            if (typeof retry === 'undefined') {
                retry = null;
            }

            const path = url || '';
            this.adapter.log.debug(`starting request to ${path} ...`);

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
                            this._get(url, method, data, true).then(resolve).catch(reject);
                        });
                    } else {
                        if (response.status === 200) {
                            resolve(response.data);
                        } else {
                            reject(response.status + ' - ' + response.data);
                        }
                    }
                })
                .catch((error) => {
                    this.adapter.log.error(`received ${error.response.status} response from ${url} with content: ${JSON.stringify(error.response.data)}`);

                    this.communicationErrorCounter++;
                    // We experienced error the same as we have servers available, so no chance to retry another server
                    this.setNextUrl();
                    if (this.communicationErrorCounter >= this.ipList.length) {
                        reject(error.response.data);
                    }
                    this.adapter.log.info(`Use Next Proxmox Host because of communication failure (${this.communicationErrorCounter}): ${this.URL}`);

                    this._get(url, method, data, true);
                });
        });
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
