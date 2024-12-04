﻿const https = require('node:https');
const axios = require('axios').default;

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

        this.setNextUrlMain(0);

        this.adapter.log.info(`Using Node: ${this.URL}`);

        this.responseCache = {};
        this.sharedMap = {};

        this.stopped = false;

        this.communicationErrorCounter = 0;
    }

    setNextUrlMain(id) {
        if (typeof id === 'number') {
            this.currentIpId = id - 1;
        }

        this.currentIpId++;

        if (this.currentIpId == this.ipList.length) {
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
                this._getData('/nodes', 'get', '', '', 'getNodes')
                    .then((data) => {
                        if (data !== '' && data !== null && typeof data === 'object') {
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
                this._getData(`/nodes/${node}/status`, 'get', '', '', 'getNodeStatus')
                    .then((data) => {
                        if (data !== '' && data !== null && typeof data === 'object') {
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
                this._getData(`/nodes/${node}/disks/list`, 'get', '', '', 'getNodeDisks')
                    .then((data) => {
                        if (data !== '' && data !== null && typeof data === 'object') {
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
        return this._getData(`/nodes/${node}/disks/smart?disk=${disk}`, 'get', '', '', 'getNodeDisksSmart');
    }

    async getCephInformation() {
        return this._getData(`/cluster/ceph/status`, 'get', '', '', 'getCephInformation');
    }

    async getHAStatusInformation() {
        return this._getData(`/cluster/ha/status/current`, 'get', '', '', 'getHAStatusInformation');
    }

    async getClusterResources(useCache) {
        return new Promise((resolve, reject) => {
            if (useCache && this.responseCache['/cluster/resources']) {
                resolve(JSON.parse(JSON.stringify(this.responseCache['/cluster/resources'])));
            } else {
                return this._getData('/cluster/resources', 'get', '', '', 'getClusterResources')
                    .then((data) => {
                        if (data !== '' && data !== null && typeof data === 'object') {
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
                this._getData(`/nodes/${node}/${type}/${ID}/status/current`, 'get', '', '', 'ResourceStatus')
                    .then((data) => {
                        if (data !== '' && data !== null && typeof data === 'object') {
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

    async getBackupStatus(node, storage) {
        return new Promise((resolve, reject) => {
            this._getData(`/nodes/${node}/storage/${storage}/content`, 'get', '', '', 'storage')
                .then((data) => {
                    if (data !== '' && data !== null && typeof data === 'object') {
                        resolve(data.data);
                    } else {
                        reject();
                    }
                })
                .catch(reject);
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

            this._getData(`/nodes/${node}/storage/${ID}/status`, 'get', '','', 'storage')
                .then((data) => {
                    if (data !== '' && data !== null && typeof data === 'object') {
                        this.responseCache[`/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`] = data.data;
                        resolve(data.data);
                    } else {
                        this.adapter.log.error(`Problem with getStorageStatus.  ${JSON.stringify(data)}`);
                    }
                    reject();
                })
                .catch(reject);
        });
    }

    async qemuStart(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/start`, 'post');
    }

    async qemuStop(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/stop`, 'post');
    }

    async qemuShutdown(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post');
    }

    async qemuReset(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reset`, 'post');
    }

    async qemuSuspend(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post');
    }

    async qemuResume(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/resume`, 'post');
    }

    async qemuReboot(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post');
    }

    async nodeReboot(node) {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=reboot');
    }

    async nodeShutdown(node) {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=shutdown');
    }

    ticket(cb) {
        this._getTicket()
            .then((data) => {
                this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

                TICKET = 'PVEAuthCookie=' + data.ticket;
                CSRF = data.CSRFPreventionToken;
                cb();
            })
            .catch((_error) => {
                //this.adapter.log.error(`Unable to update ticket: ${error}`);
                cb();
            });
    }

    async _getData(url, method, data, retry, additional) {
        return new Promise((resolve, reject) => {
            if (this.stopped) {
                reject('STOPPED');
            }

            if (typeof data == 'undefined') {
                data = null;
            }
            if (typeof retry == 'undefined') {
                retry = null;
            }

            const pathU = url || '';
            //this.adapter.log.error(`starting request to --> ${this.URL}${pathU} ...`);

            axios({
                method,
                baseURL: this.URL,
                url: pathU,
                data,
                timeout: 5000, // only wait for 2s
                headers: {
                    CSRFPreventionToken: CSRF,
                    Cookie: TICKET,
                },
                validateStatus: (status) => {
                    return [200, 401, 500, 595, 599].indexOf(status) > -1;
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            })
                .then((response) => {
                    this.adapter.log.debug(`received ${response.status} response from ${pathU} with content: ${JSON.stringify(response.data)}`);
                    this.communicationErrorCounter = 0;

                    if (response.status === 500 || response.status === 595 || response.status === 599) {
                        reject(response.status + ' - ' + JSON.stringify(response.data));
                    }

                    if (response.status === 401 && !retry) {
                        if (additional == undefined) {
                            this.ticket(async () => {
                                // Retry with new ticket
                                this._getData(url, method, data, true).then(resolve).catch(reject);
                            });
                        }
                    }
                    if (response.status === 200) {
                        resolve(response.data);
                    }
                })
                .catch((_error) => {
                    if (additional == 'storage') {
                        this.adapter.log.error(`Check ${additional} -- Problem found.. storage is offline ??`);
                    } else {

                        this.adapter.log.warn(`${additional}  --  Use Next Proxmox Node because of communication failure ${this.URL}${url}`);

                        this.communicationErrorCounter++;
                        // We experienced error the same as we have servers available, so no chance to retry another server
                        this.setNextUrlMain();

                        if (this.communicationErrorCounter >= this.ipList.length) {
                            this.setNextUrlMain(0);
                            this.communicationErrorCounter = 0;
                        }

                        this.ticket(async () => {
                            // Retry with new ticket
                            this._getData(url, method, data, true).then(resolve).catch(reject);
                        });
                    }
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
                timeout: 5000, // only wait for 2s
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            })
                .then((response) => {
                    this.adapter.log.debug(`received ${response.status} response from proxmox with content: ${JSON.stringify(response.data)}`);

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
                        this.adapter.log.warn(`Error received ${error.response.status} response from proxmox with content: ${JSON.stringify(error.response.data)}`);

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
