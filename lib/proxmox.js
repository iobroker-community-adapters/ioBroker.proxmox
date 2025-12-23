const https = require('node:https');
const axios = require('axios').default;

let TICKET = '';
let CSRF = '';

/**
 *
 */
class ProxmoxUtils {
    /**
     *
     * @param adapter
     * @param nodeList
     */
    constructor(adapter, nodeList) {
        this.adapter = adapter;
        this.nodeList = nodeList;

        this.name = '';
        this.server = '';
        this.password = '';
        this.nodeURL = '';

        this.currentIpId = -1; // damit wir den ersten host nehmen
        this.setNextUrlMain();

        this.responseCache = {};
        this.sharedMap = {};
        this.stopped = false;
    }

    /**
     *
     */
    async setNextUrlMain() {
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

        this.adapter.log.warn(`Using next Proxmox API: ${this.nodeURL}`);
    }

    /**
     *
     */
    resetResponseCache() {
        this.responseCache = {};
        this.sharedMap = {};
    }

    /**
     *
     */
    async getNodes() {
        const cacheKey = `/nodes`;
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'node');

            if (data && typeof data === 'object') {
                return data.data;
            }
        } catch (error) {
            throw new Error('getNodes Invalid data received in Nodes');
        }
    }

    /**
     *
     * @param node
     * @param useCache
     */
    async getNodeStatus(node, useCache) {
        const cacheKey = `/nodes/${node}/status`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'node');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            throw new Error('getNodeStatus Invalid data received NodeStatus');
        }
    }

    /**
     *
     * @param node
     * @param useCache
     */
    async getNodeDisks(node, useCache) {
        const cacheKey = `/nodes/${node}/disks/list`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'nodeDisks');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            throw new Error('getNodeDisks Invalid data received in NodeDisks');
        }
    }

    /**
     *
     * @param node
     * @param disk
     */
    async getNodeDisksSmart(node, disk) {
        const cacheKey = `/nodes/${node}/disks/smart?disk=${disk}`;
        const data = await this._getData(cacheKey, 'get', null, false, 'disk');
        return data;
    }

    /**
     *
     */
    async getCephInformation() {
        const cacheKey = `/cluster/ceph/status`;
        const data = await this._getData(cacheKey, 'get', null, false, 'ceph');
        return data;
    }

    /**
     *
     */
    async getHAStatusInformation() {
        const cacheKey = `/cluster/ha/status/current`;
        const data = await this._getData(cacheKey, 'get', null, false, 'ha');
        return data;
    }

    /**
     *
     * @param useCache
     */
    async getClusterResources(useCache) {
        const cacheKey = '/cluster/resources';

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'cluster');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            throw new Error('getClusterResources Invalid data received');
        }
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     * @param useCache
     */
    async getResourceStatus(node, type, ID, useCache) {
        const cacheKey = `/nodes/${node}/${type}/${ID}/status/current`;

        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'resource');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            throw new Error('getResourceStatus Invalid data received');
        }
    }

    /**
     *
     * @param node
     * @param storage
     */
    async getBackupStatus(node, storage) {
        const cacheKey = `/nodes/${node}/storage/${storage}/content`;
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'storage');

            if (data && typeof data === 'object') {
                return data.data;
            }
        } catch (error) {
            throw new Error('getBackupStatus Invalid data received');
        }
    }

    /**
     *
     * @param node
     * @param ID
     * @param shared
     * @param useCache
     */
    async getStorageStatus(node, ID, shared) {
        const cacheKey = `/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`;
        if (this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }

        if (shared) {
            node = this.sharedMap[cacheKey] || (this.sharedMap[cacheKey] = node);
        }

        try {
            const storageKey = `/nodes/${node}/storage/${ID}/status`;
            const data = await this._getData(storageKey, 'get', null, false, 'storage');

            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            throw new Error('getStorageStatus Invalid data received');
        }
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuStart(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/start`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuStop(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/stop`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuShutdown(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuReset(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reset`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuSuspend(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuResume(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/resume`, 'post');
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     */
    async qemuReboot(node, type, ID) {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post');
    }

    /**
     *
     * @param node
     */
    async nodeReboot(node) {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=reboot');
    }

    /**
     *
     * @param node
     */
    async nodeShutdown(node) {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=shutdown');
    }

    /**
     *
     * @param url
     * @param method
     * @param data
     * @param retry
     * @param additional
     */
    async _getData(url, method, data = null, retry = false, additional = null) {
        if (this.stopped) {
            throw new Error('STOPPED');
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
                const err = new Error(`HTTP ${response.status}`);
                err.response = response;
                throw err;
            }

            if (response.status === 401 && !retry) {
                // Nicht autorisiert oder Session abgelaufen
                await this.ticket();
                return this._getData(url, method, data, true, additional);
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && additional === 'node') {
                await this.setNextUrlMain();
                await this.ticket();
                return this._getData(url, method, data, true, 'node');
            }
            throw error;
        }
    }

    /**
     *
     */
    async ticket() {
        const data = await this._getTicket();

        this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

        TICKET = `PVEAuthCookie=${data.ticket}`;
        CSRF = data.CSRFPreventionToken;
    }

    /**
     *
     */
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

            if (!response?.data?.data) {
                this.adapter.log.error(`${response.status}: wrong User data, could not log in, please try again with correct user and pw`);
                throw new Error('INVALID_RESPONSE');
            }

            return response.data.data;
        } catch (error) {
            if (error.response) {
                this.adapter.log.warn(`Error received ${error.response.status} response from proxmox with content: ${JSON.stringify(error.response.data)}`);
                throw new Error(error.response.status);
            } else if (error.request) {
                this.adapter.log.warn('No response from Proxmox (timeout or network error)');
                throw new Error(-1);
            } else {
                this.adapter.log.error(`Response error: ${error.message}`);
                throw new Error(-2);
            }
        }
    }

    /**
     *
     */
    stop() {
        this.stopped = true;
    }
}

module.exports = ProxmoxUtils;
