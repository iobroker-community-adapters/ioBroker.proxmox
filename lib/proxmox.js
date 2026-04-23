﻿'use strict';

const https = require('node:https');
const axios = require('axios').default;


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

        this._ticket = '';
        this._csrf = '';

        /** 'password' | 'token' */
        this.authType = 'password';
        this.tokenId  = '';
        this.tokenSecret = '';

        this.currentIpId = -1;
        this._initUrlMain(); // stiller Initialaufruf – kein warn-Log

        this.responseCache = {};
        this.sharedMap = {};
        this.stopped = false;

        this.httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
    }

    /**
     * Setzt URL/Credentials ohne Log-Ausgabe (nur für den Konstruktor).
     */
    _initUrlMain() {
        this.currentIpId = 0;
        this._applyNodeConfig(this.currentIpId);
    }

    /**
     * Wechselt auf den nächsten Proxmox-Knoten (Round-Robin Failover).
     * Wird nur aufgerufen wenn nodeList.length >= 2 (gesichert durch _getData).
     */
    setNextUrlMain() {

        const previousId  = this.currentIpId;
        this.currentIpId  = (this.currentIpId + 1) % this.nodeList.length;
        this._applyNodeConfig(this.currentIpId);

        this.adapter.log.warn(
            `Failover: Wechsel von Knoten ${previousId} → ${this.currentIpId} (${this.nodeURL})`,
        );
        return true;
    }

    /**
     * Übernimmt die Verbindungsparameter eines Knotens aus der nodeList.
     *
     * @param {number} index
     */
    _applyNodeConfig(index) {
        const node = this.nodeList[index];
        this.name        = node.realmUser;
        this.password    = node.realmPassword || '';
        this.server      = node.realm;
        this.nodeURL     = `https://${node.realmIp}:${node.realmPort}/api2/json`;
        this.authType    = node.authType || 'password';
        this.tokenId     = node.realmTokenId     || '';
        this.tokenSecret = node.realmTokenSecret || '';
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
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getNodes fehlgeschlagen: ${error.message}`);
        }
    }

    /**
     *
     * @param node
     * @param useCache
     */
    async getNodeStatus(node, useCache = false) {
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
            this._rethrowIfStopped(error);
            throw new Error(`getNodeStatus fehlgeschlagen für Node "${node}": ${error.message}`);
        }
    }

    /**
     *
     * @param node
     * @param useCache
     */
    async getNodeDisks(node, useCache = false) {
        const cacheKey = `/nodes/${node}/disks/list`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'nodeDisks');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getNodeDisks failed for node "${node}": ${error.message}`);
        }
    }

    /**
     *
     * @param node
     * @param disk
     */
    async getNodeDisksSmart(node, disk) {
        const cacheKey = `/nodes/${node}/disks/smart?disk=${disk}`;
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'disk');
            if (data && typeof data === 'object') {
                return data;
            }
            return null;
        } catch (error) {
            this.adapter.log.debug(`getNodeDisksSmart failed for "${disk}" on node "${node}": ${error.message}`);
            return null;
        }
    }

    /**
     *
     */
    async getCephInformation() {
        const cacheKey = `/cluster/ceph/status`;
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'ceph');
            if (data && typeof data === 'object' && data.data !== undefined) {
                return data;
            }
            return null;
        } catch (error) {
            this._rethrowIfStopped(error);
            return null;
        }
    }

    /**
     *
     */
    async getHAStatusInformation() {
        const cacheKey = `/cluster/ha/status/current`;
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'ha');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data;
            }
            return null;
        } catch (error) {
            this._rethrowIfStopped(error);
            return null;
        }
    }

    /**
     *
     * @param useCache
     */
    async getClusterResources(useCache = false) {
        const cacheKey = '/cluster/resources';
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }
        try {
            const data = await this._getData(cacheKey, 'get', null, false, 'cluster');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getClusterResources fehlgeschlagen: ${error.message}`);
        }
    }

    /**
     *
     * @param node
     * @param type
     * @param ID
     * @param useCache
     */
    async getResourceStatus(node, type, ID, useCache = false) {
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
            return null;
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getResourceStatus fehlgeschlagen für ${type}/${ID} auf ${node}: ${error.message}`);
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
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getBackupStatus fehlgeschlagen für ${storage} auf ${node}: ${error.message}`);
        }
    }

    /**
     *
     * @param node
     * @param ID
     * @param shared
     * @param useCache
     */
    async getStorageStatus(node, ID, shared, useCache = true) {
        const cacheKey = `/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey]));
        }
        if (shared) {
            node = this.sharedMap[cacheKey] || (this.sharedMap[cacheKey] = node);
        }
        try {
            const storageKey = `/nodes/${node}/storage/${ID}/status`;
            const data = await this._getData(storageKey, 'get', null, false, 'storage');
            if (data && typeof data === 'object' && data.data != null) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            throw new Error(`Leere Antwort für Storage "${ID}" auf Node "${node}" (HTTP 200 aber data=null)`);
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getStorageStatus für "${ID}" auf "${node}" fehlgeschlagen: ${error.message}`);
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
     * @param {string|null} url
     * @param {string} method
     * @param {any} data
     * @param {boolean} retry
     * @param {string|null} additional
     * @param {number} failoverAttempts  – Anzahl bereits durchgeführter Knoten-Wechsel
     */
    async _getData(url, method, data = null, retry = false, additional = null, failoverAttempts = 0) {
        if (this.stopped) {
            throw new Error('STOPPED');
        }

        const pathU = url || '';

        try {
            const isTokenAuth = this.authType === 'token';

            const headers = isTokenAuth
                ? { Authorization: this._ticket }
                : {
                    CSRFPreventionToken: this._csrf,
                    Cookie: this._ticket,
                };

            const response = await axios({
                method,
                baseURL: this.nodeURL,
                url: pathU,
                data,
                timeout: 10000,
                headers,
                validateStatus: (status) => [200, 401, 500, 595, 599].includes(status),
                httpsAgent: this.httpsAgent,
            });

            this.adapter.log.debug(`received ${response.status} response from ${pathU} with content: ${JSON.stringify(response.data)}`);

            if ([500, 595, 599].includes(response.status)) {
                // Proxmox liefert bei Fehlern oft eine Meldung in response.data.errors oder response.data.message
                const proxmoxMsg = response.data?.errors
                    ? Object.values(response.data.errors).join(', ')
                    : (response.data?.message || response.data?.data || '');
                const errMsg = proxmoxMsg ? `HTTP ${response.status}: ${proxmoxMsg}` : `HTTP ${response.status}`;
                const err = new Error(errMsg);
                err.response = response;
                throw err;
            }

            if (response.status === 401 && !retry) {
                if (isTokenAuth) {
                    // Token ist ungültig – kein Retry sinnvoll
                    this.adapter.log.error('API-Token auth fehlgeschlagen (401). Bitte Token-ID und Secret prüfen.');
                    throw new Error('TOKEN_AUTH_FAILED');
                }
                // Session abgelaufen → neues Ticket holen, einmal wiederholen
                this.adapter.log.debug('_getData: Session abgelaufen (401), hole neues Ticket...');
                await this.ticket();
                return this._getData(url, method, data, true, additional, failoverAttempts);
            }

            return response.data;
        } catch (error) {
            // Netzwerkfehler (Timeout, ECONNREFUSED, ENOTFOUND …) → Failover
            if (axios.isAxiosError(error) && !error.response) {
                const maxFailovers = this.nodeList.length - 1;

                if (failoverAttempts >= maxFailovers) {
                    // Alle Knoten wurden versucht – aufgeben
                    const msg = `Failover erschöpft: Alle ${this.nodeList.length} Proxmox-Knoten nicht erreichbar (${error.message})`;
                    this.adapter.log.error(msg);
                    throw new Error(msg);
                }

                this.setNextUrlMain();

                this.adapter.log.warn(`_getData: Netzwerkfehler auf "${pathU}" (${error.message}) – versuche nächsten Knoten...`);
                await this.ticket();
                return this._getData(url, method, data, false, additional, failoverAttempts + 1);
            }

            throw error;
        }
    }

    /**
     *
     */
    async ticket() {
        if (this.authType === 'token') {
            // API-Token auth: kein HTTP-Call nötig – Authorization-Header direkt setzen
            // Format: PVEAPIToken=USER@REALM!TOKENID=SECRET
            this._ticket = `PVEAPIToken=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}!${this.tokenId}=${this.tokenSecret}`;
            this._csrf   = ''; // kein CSRF bei Token-Auth
            this.adapter.log.debug(`Token-Auth: Authorization Header gesetzt für ${this.name}@${this.server}!${this.tokenId}`);
            return;
        }

        const data = await this._getTicket();

        this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

        this._ticket = `PVEAuthCookie=${data.ticket}`;
        this._csrf = data.CSRFPreventionToken;
    }

    /**
     *
     */
    async _getTicket() {
        const url = `/access/ticket?username=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}&password=${encodeURIComponent(this.password)}`;

        let response;
        try {
            response = await axios({
                method: 'post',
                baseURL: this.nodeURL,
                url,
                timeout: 5000,
                httpsAgent: this.httpsAgent,
            });
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

        this.adapter.log.debug(`received ${response.status} response from proxmox with content: ${JSON.stringify(response.data)}`);

        if (!response?.data?.data?.ticket || !response?.data?.data?.CSRFPreventionToken) {
            this.adapter.log.error(`${response.status}: wrong User data, could not log in, please try again with correct user and pw`);
            throw new Error('INVALID_RESPONSE');
        }

        return response.data.data;
    }

    /**
     * Wirft den Fehler unverändert weiter, wenn der Adapter gestoppt wurde.
     * Verhindert, dass STOPPED in einen neuen Error eingewickelt wird.
     * @param {Error} error
     */
    _rethrowIfStopped(error) {
        if (error.message === 'STOPPED' || this.stopped) {
            throw error;
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
