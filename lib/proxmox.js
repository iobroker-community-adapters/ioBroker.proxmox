﻿const https = require('node:https');
const axios = require('axios').default;

let TICKET = '';
let CSRF = '';

class ProxmoxUtils {
    constructor(adapter, nodeList) {
        this.adapter = adapter;
        this.nodeList = nodeList;

        this.name = '';
        this.server = '';
        this.password = '';
        this.nodeURL = '';

        this.currentIpId = -1;   // damit wir den ersten host nehmen
        this.setNextUrlMain();

        this.responseCache = {};
        this.sharedMap = {};
        this.stopped = false;
    }

    setNextUrlMain() {

        this.currentIpId++;

        if (this.currentIpId >= this.nodeList.length) {
            this.currentIpId = 0;
        }

        this.name = this.nodeList[this.currentIpId].realmUser;
        this.password = this.nodeList[this.currentIpId].realmPassword;
        this.server = this.nodeList[this.currentIpId].realm;

        const realmIp = this.nodeList[this.currentIpId].realmIp;
        const realmPort = this.nodeList[this.currentIpId].realmPort;

        this.nodeURL = `https://${realmIp}:${realmPort}/api2/json`;

        this.adapter.log.info(`Using Proxmox API: ${this.nodeURL}`);
    }

    resetResponseCache() {
        this.responseCache = {};
        this.sharedMap = {};
    }

    async getNodes() {
        if (this.responseCache['/nodes']) {
            return JSON.parse(JSON.stringify(this.responseCache['/nodes']));
        }

        try {
            const data = await this._getData('/nodes', 'get');

            if (data && typeof data === 'object') {
                this.responseCache['/nodes'] = data.data;
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }


    async getNodeStatus(node, useCache) {
        const cacheKey = `/nodes/${node}/status`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }

    async getNodeDisks(node, useCache) {
        const cacheKey = `/nodes/${node}/disks/list`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }

    async getNodeDisksSmart(node, disk) {
        return this._getData(`/nodes/${node}/disks/smart?disk=${disk}`, 'get', '', '', 'disk');
    }

    async getCephInformation() {
        return this._getData(`/cluster/ceph/status`, 'get', '', '', 'ceph');
    }

    async getHAStatusInformation() {
        return this._getData(`/cluster/ha/status/current`, 'get', '', '', 'ha');
    }

    async getClusterResources(useCache) {
        const cacheKey = '/cluster/resources';

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }

    async getResourceStatus(node, type, ID, useCache) {
        const cacheKey = `/nodes/${node}/${type}/${ID}/status/current`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }

    async getBackupStatus(node, storage) {
        try {
            const data = await this._getData(`/nodes/${node}/storage/${storage}/content`, 'get', '', '', 'storage');

            if (data && typeof data === 'object') {
                return data.data;
            } else {
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
    }

    async getStorageStatus(node, ID, shared, useCache) {
        const cacheKey = `/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        if (shared) {
            node = this.sharedMap[cacheKey] || (this.sharedMap[cacheKey] = node);
        }

        try {
            const data = await this._getData(`/nodes/${node}/storage/${ID}/status`, 'get', '', '', 'storage');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            } else {
                this.adapter.log.error(`Problem with getStorageStatus. ${JSON.stringify(data)}`);
                throw new Error('Invalid data received');
            }
        } catch (error) {
            throw error;
        }
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

    async ticket() {
        const data = await this._getTicket();

        this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

        TICKET = `PVEAuthCookie=${data.ticket}`;
        CSRF = data.CSRFPreventionToken;
    }

    async _getData(url, method, data = null, retry = false, additional = null) {
        if (this.stopped) {
            throw 'STOPPED';
        }

        const pathU = url || '';

        try {
            const response = await axios({
                method,
                baseURL: this.nodeURL,
                url: pathU,
                data,
                timeout: 10000,
                headers: {
                    CSRFPreventionToken: CSRF,
                    Cookie: TICKET,
                },
                validateStatus: (status) => [200, 401, 500, 595, 599].includes(status),
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            });

            this.adapter.log.debug(`received ${response.status} response from ${pathU} with content: ${JSON.stringify(response.data)}`);

            if ([500, 595, 599].includes(response.status)) {
                throw `code: ${response.status}${JSON.stringify(response.data ? ` - data: ${JSON.stringify(response.data)}` : '')}`;
            }

            if (response.status === 401 && !retry) {
                if (!additional) {
                    await this.ticket();
                    return this._getData(url, method, data, true);
                }
            }

            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            if (additional !== 'storage') {
                if (additional !== 'disk') {   // kann sein dass die platte aus ist dann ignoriere es und schmeisse nur error message
                    this.adapter.log.warn(`${additional}  --  Use Next Proxmox Host because of communication failure ${this.nodeURL}${url}`);

                    this.setNextUrlMain();
                    await this.ticket();
                    return this._getData(url, method, data, true);
                }
            }
            /*
            if (additional === 'storage') {
                this.adapter.log.error(`Check ${additional} -- Problem found.. maybe offline check path ${this.nodeURL}${url}`);
            }

            if (additional === 'disk') {
                this.adapter.log.error(`Check ${additional} -- Problem found.. maybe is backup storage offline `);
            }
*/
            throw error;
        }
    }

    async _getTicket() {
        const url = `/access/ticket?username=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}&password=${encodeURIComponent(this.password)}`;

        try {
            const response = await axios({
                method: 'post',
                baseURL: this.nodeURL,
                url,
                timeout: 5000,
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            });

            this.adapter.log.debug(`received ${response.status} response from proxmox with content: ${JSON.stringify(response.data)}`);

            if (response.status === 200) {
                this.adapter.log.debug(`dataticket: ${JSON.stringify(response.data)}`);
                return response.data.data; // "data" is an attribute in the response JSON
            } else {
                this.adapter.log.error(`${response.status}: wrong User data, could not log in, please try again with correct user and pw`);
                throw new Error(response.status);
            }
        } catch (error) {
            if (error.response) {
                this.adapter.log.warn(`Error received ${error.response.status} response from proxmox with content: ${JSON.stringify(error.response.data)}`);
                throw new Error(error.response.status);
            } else if (error.request) {
                this.adapter.log.warn(`No response received from proxmox`);
                throw new Error(-1);
            } else {
                this.adapter.log.error(`Request setup error: ${error.message}`);
                throw new Error(-2);
            }
        }
    }

    stop() {
        this.stopped = true;
    }
}

module.exports = ProxmoxUtils;
