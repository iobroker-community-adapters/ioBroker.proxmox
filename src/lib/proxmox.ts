import { Agent } from 'node:https';
import axios, { type AxiosResponse } from 'axios';
import type {
    ProxmoxApiResponse,
    ProxmoxAuthType,
    ProxmoxBackupEntry,
    ProxmoxClusterResource,
    ProxmoxDisk,
    ProxmoxDiskSmart,
    ProxmoxHAEntry,
    ProxmoxNode,
    ProxmoxNodeConfig,
    ProxmoxNodeStatus,
    ProxmoxTicket,
    StatusRecord,
} from './types';

/** Fehler, der die HTTP-Antwort für die Failover-Entscheidung in _getData() mitführt */
type RequestError = Error & { response?: AxiosResponse; request?: unknown };

export class ProxmoxUtils {
    private readonly adapter: ioBroker.Adapter;
    private readonly nodeList: ProxmoxNodeConfig[];

    private name = '';
    private server = '';
    private password = '';
    public nodeURL = '';

    /** Kennung dieser Instanz für Objekt-IDs und `native.host` der Buttons. Darf keine Punkte enthalten. */
    public readonly hostId: string;

    private _ticket = '';
    private _csrf = '';

    private authType: ProxmoxAuthType = 'password';
    private tokenId = '';
    private tokenSecret = '';

    private currentIpId = -1;

    private responseCache: Record<string, unknown> = {};
    private sharedMap: Record<string, string> = {};
    private stopped = false;

    private readonly httpsAgent: Agent;

    /**
     * @param adapter - Adapter-Instanz
     * @param nodeList - Knoten dieser Instanz. Mehrere nur bei einem Cluster (Failover).
     * @param hostId - feste Kennung. Ohne Angabe wird sie aus Adresse und Port des ersten Knotens gebildet.
     */
    public constructor(adapter: ioBroker.Adapter, nodeList: ProxmoxNodeConfig[], hostId?: string) {
        this.adapter = adapter;
        this.nodeList = nodeList;
        const { realmIp, realmPort } = nodeList[0];
        const address = Number(realmPort) === 8006 ? String(realmIp) : `${realmIp}-${realmPort}`;
        this.hostId = hostId ?? address.replace(/[^\w-]/g, '-');

        this._initUrlMain(); // stiller Initialaufruf – kein warn-Log

        // Proxmox läuft üblicherweise mit einem selbstsignierten Zertifikat
        this.httpsAgent = new Agent({ rejectUnauthorized: false, keepAlive: true });
    }

    /**
     * Setzt URL/Credentials ohne Log-Ausgabe (nur für den Konstruktor).
     */
    private _initUrlMain(): void {
        this.currentIpId = 0;
        this._applyNodeConfig(this.currentIpId);
    }

    /**
     * Wechselt auf den nächsten Proxmox-Knoten (Round-Robin Failover).
     * Wird nur aufgerufen wenn nodeList.length >= 2 (gesichert durch _getData).
     */
    public setNextUrlMain(): boolean {
        const previousId = this.currentIpId;
        this.currentIpId = (this.currentIpId + 1) % this.nodeList.length;
        this._applyNodeConfig(this.currentIpId);

        this.adapter.log.warn(`Failover: Wechsel von Knoten ${previousId} → ${this.currentIpId} (${this.nodeURL})`);
        return true;
    }

    /**
     * Übernimmt die Verbindungsparameter eines Knotens aus der nodeList.
     *
     * @param index - Index in der nodeList
     */
    private _applyNodeConfig(index: number): void {
        const node = this.nodeList[index];
        this.name = node.realmUser;
        this.password = node.realmPassword || '';
        this.server = node.realm;
        this.nodeURL = `https://${node.realmIp}:${node.realmPort}/api2/json`;
        this.authType = node.authType || 'password';
        this.tokenId = node.realmTokenId || '';
        this.tokenSecret = node.realmTokenSecret || '';
    }

    public resetResponseCache(): void {
        this.responseCache = {};
        this.sharedMap = {};
    }

    public async getNodes(): Promise<ProxmoxNode[]> {
        const cacheKey = `/nodes`;
        try {
            const data = await this._getData<ProxmoxNode[]>(cacheKey, 'get', null, false, 'node');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getNodes fehlgeschlagen: ${(error as Error).message}`);
        }
    }

    public async getNodeStatus(node: string, useCache = false): Promise<ProxmoxNodeStatus | undefined> {
        const cacheKey = `/nodes/${node}/status`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey])) as ProxmoxNodeStatus;
        }
        try {
            const data = await this._getData<ProxmoxNodeStatus>(cacheKey, 'get', null, false, 'node');
            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getNodeStatus fehlgeschlagen für Node "${node}": ${(error as Error).message}`);
        }
    }

    public async getNodeDisks(node: string, useCache = false): Promise<ProxmoxDisk[]> {
        const cacheKey = `/nodes/${node}/disks/list`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey])) as ProxmoxDisk[];
        }
        try {
            const data = await this._getData<ProxmoxDisk[]>(cacheKey, 'get', null, false, 'nodeDisks');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getNodeDisks failed for node "${node}": ${(error as Error).message}`);
        }
    }

    public async getNodeDisksSmart(node: string, disk: string): Promise<ProxmoxDiskSmart | null> {
        const cacheKey = `/nodes/${node}/disks/smart?disk=${disk}`;
        try {
            const data = await this._getData<{ text?: string }>(cacheKey, 'get', null, false, 'disk');
            if (data && typeof data === 'object') {
                return data;
            }
            return null;
        } catch (error) {
            this.adapter.log.debug(
                `getNodeDisksSmart failed for "${disk}" on node "${node}": ${(error as Error).message}`,
            );
            return null;
        }
    }

    public async getCephInformation(): Promise<ProxmoxApiResponse | null> {
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

    public async getHAStatusInformation(): Promise<ProxmoxApiResponse<ProxmoxHAEntry[]> | null> {
        const cacheKey = `/cluster/ha/status/current`;
        try {
            const data = await this._getData<ProxmoxHAEntry[]>(cacheKey, 'get', null, false, 'ha');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data;
            }
            return null;
        } catch (error) {
            this._rethrowIfStopped(error);
            return null;
        }
    }

    public async getClusterResources(useCache = false): Promise<ProxmoxClusterResource[]> {
        const cacheKey = '/cluster/resources';
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey])) as ProxmoxClusterResource[];
        }
        try {
            const data = await this._getData<ProxmoxClusterResource[]>(cacheKey, 'get', null, false, 'cluster');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getClusterResources fehlgeschlagen: ${(error as Error).message}`);
        }
    }

    public async getResourceStatus(
        node: string,
        type: string,
        ID: number,
        useCache = false,
    ): Promise<StatusRecord | null> {
        const cacheKey = `/nodes/${node}/${type}/${ID}/status/current`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey])) as StatusRecord;
        }
        try {
            const data = await this._getData<StatusRecord>(cacheKey, 'get', null, false, 'resource');
            if (data && typeof data === 'object') {
                this.responseCache[cacheKey] = data.data;
                return data.data as StatusRecord;
            }
            return null;
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(
                `getResourceStatus fehlgeschlagen für ${type}/${ID} auf ${node}: ${(error as Error).message}`,
            );
        }
    }

    public async getBackupStatus(node: string, storage: string): Promise<ProxmoxBackupEntry[]> {
        const cacheKey = `/nodes/${node}/storage/${storage}/content`;
        try {
            const data = await this._getData<ProxmoxBackupEntry[]>(cacheKey, 'get', null, false, 'storage');
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getBackupStatus fehlgeschlagen für ${storage} auf ${node}: ${(error as Error).message}`);
        }
    }

    public async getStorageStatus(node: string, ID: string, shared: boolean, useCache = true): Promise<StatusRecord> {
        const cacheKey = `/nodes/${shared ? 'SHARED' : node}/storage/${ID}/status`;
        if (useCache && this.responseCache[cacheKey]) {
            return JSON.parse(JSON.stringify(this.responseCache[cacheKey])) as StatusRecord;
        }
        if (shared) {
            node = this.sharedMap[cacheKey] || (this.sharedMap[cacheKey] = node);
        }
        try {
            const storageKey = `/nodes/${node}/storage/${ID}/status`;
            const data = await this._getData<StatusRecord>(storageKey, 'get', null, false, 'storage');
            if (data && typeof data === 'object' && data.data != null) {
                this.responseCache[cacheKey] = data.data;
                return data.data;
            }
            throw new Error(`Leere Antwort für Storage "${ID}" auf Node "${node}" (HTTP 200 aber data=null)`);
        } catch (error) {
            this._rethrowIfStopped(error);
            throw new Error(`getStorageStatus für "${ID}" auf "${node}" fehlgeschlagen: ${(error as Error).message}`);
        }
    }

    public async qemuStart(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/start`, 'post');
    }

    public async qemuStop(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/stop`, 'post');
    }

    public async qemuShutdown(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/shutdown`, 'post');
    }

    public async qemuReset(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reset`, 'post');
    }

    public async qemuSuspend(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/suspend`, 'post');
    }

    public async qemuResume(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/resume`, 'post');
    }

    public async qemuReboot(node: string, type: string, ID: number): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/${type}/${ID}/status/reboot`, 'post');
    }

    public async nodeReboot(node: string): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=reboot');
    }

    public async nodeShutdown(node: string): Promise<ProxmoxApiResponse> {
        return this._getData(`/nodes/${node}/status`, 'post', 'command=shutdown');
    }

    /**
     * Wartet über einen Adapter-Timer. Fährt der Adapter gerade herunter, liefert setTimeout() keinen
     * Timer. Dann geht es sofort weiter, und der nächste _getData()-Aufruf bricht mit STOPPED ab.
     *
     * @param ms - Wartezeit in Millisekunden
     */
    private _delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            if (!this.adapter.setTimeout(resolve, ms)) {
                resolve();
            }
        });
    }

    /**
     * @param url - Pfad relativ zur API-Basis-URL
     * @param method - HTTP-Methode
     * @param data - Request-Body
     * @param retry - true, wenn nach einem 401 bereits ein neues Ticket geholt wurde
     * @param additional - Herkunft der Anfrage (wird nur durchgereicht)
     * @param failoverAttempts - Anzahl bereits durchgeführter Knoten-Wechsel
     * @param _retryAttempts5xx - Anzahl bereits durchgeführter 5xx-Retries
     */
    public async _getData<T = unknown>(
        url: string | null,
        method: 'get' | 'post',
        data: unknown = null,
        retry = false,
        additional: string | null = null,
        failoverAttempts = 0,
        _retryAttempts5xx = 0,
    ): Promise<ProxmoxApiResponse<T>> {
        if (this.stopped) {
            throw new Error('STOPPED');
        }

        const pathU = url || '';

        try {
            const isTokenAuth = this.authType === 'token';

            const headers: Record<string, string> = isTokenAuth
                ? { Authorization: this._ticket }
                : {
                      CSRFPreventionToken: this._csrf,
                      Cookie: this._ticket,
                  };

            const response = await axios<ProxmoxApiResponse<T>>({
                method,
                baseURL: this.nodeURL,
                url: pathU,
                data,
                timeout: 10000,
                headers,
                validateStatus: status => status === 200 || status === 401 || (status >= 500 && status <= 599),
                httpsAgent: this.httpsAgent,
            });

            this.adapter.log.debug(
                `received ${response.status} response from ${pathU} with content: ${JSON.stringify(response.data)}`,
            );

            if (response.status >= 500 && response.status <= 599) {
                // Proxmox liefert bei Fehlern oft eine Meldung in response.data.errors oder response.data.message
                const proxmoxMsg = response.data?.errors
                    ? Object.values(response.data.errors).join(', ')
                    : response.data?.message || response.data?.data || '';
                const errMsg = proxmoxMsg
                    ? `HTTP ${response.status}: ${String(proxmoxMsg)}`
                    : `HTTP ${response.status}`;
                const err: RequestError = new Error(errMsg);
                err.response = response;

                // Retry-Logik für HTTP 5xx Fehler (konfigurierbar via adapter.config)
                const maxRetries5xx = this.adapter?.config?.retryCount5xx ?? 2;
                const baseDelay5xx = this.adapter?.config?.retryDelay5xx ?? 1000;

                if (_retryAttempts5xx < maxRetries5xx) {
                    const delay = baseDelay5xx * 2 ** _retryAttempts5xx;
                    this.adapter.log.warn(
                        `_getData: HTTP ${response.status} auf "${pathU}", ` +
                            `Retry ${_retryAttempts5xx + 1}/${maxRetries5xx} in ${delay}ms...`,
                    );
                    await this._delay(delay);
                    return this._getData<T>(
                        url,
                        method,
                        data,
                        retry,
                        additional,
                        failoverAttempts,
                        _retryAttempts5xx + 1,
                    );
                }

                // Alle Retries erschöpft → Fehler werfen, der im catch-Block Failover triggert
                this.adapter.log.warn(
                    `_getData: HTTP ${response.status} auf "${pathU}" – ` +
                        `alle ${maxRetries5xx} Retries erschöpft, versuche Failover...`,
                );
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
                return this._getData<T>(url, method, data, true, additional, failoverAttempts);
            }

            return response.data;
        } catch (e) {
            const error = e as RequestError;
            // Prüfen ob Failover in Frage kommt:
            //   Fall A: Axios-Netzwerkfehler ohne Response (Timeout, ECONNREFUSED, ENOTFOUND …)
            //   Fall B: HTTP-5xx-Fehler nach erschöpften Retries (err.response mit status >= 500)
            const isAxiosNetError = axios.isAxiosError(error) && !error.response;
            const isHttp5xxError = error.response && error.response.status >= 500 && error.response.status <= 599;

            if (isAxiosNetError || isHttp5xxError) {
                // Node-spezifische Endpunkte: Failover ist sinnlos, da alle Cluster-Nodes
                // die API intern zum Ziel-Node proxieren. Wenn der Ziel-Node offline ist,
                // liefert pveproxy HTTP 595 ("target node unreachable") – alle Cluster-Nodes
                // antworten gleich, weil sie zur selben Ziel-Node proxieren.
                // → Für Netzwerkfehler UND HTTP 5xx (inkl. 595) sofort Fehler werfen.
                const nodeSpecificPattern = /^\/nodes\/(?!SHARED\b)[^/]+\/.+/;
                if (nodeSpecificPattern.test(url as string)) {
                    this.adapter.log.debug(
                        `_getData: Node-spezifischer Endpunkt "${url}" - kein Failover möglich, Ziel-Node nicht erreichbar`,
                    );
                    throw error;
                }

                const maxFailovers = this.nodeList.length - 1;

                if (failoverAttempts >= maxFailovers) {
                    // Alle Knoten wurden versucht – aufgeben
                    const errorType = isHttp5xxError ? `HTTP ${error.response!.status}` : error.message;
                    const msg = `Failover erschöpft: Alle ${this.nodeList.length} Proxmox-Knoten nicht erreichbar (${errorType})`;
                    this.adapter.log.error(msg);
                    throw new Error(msg);
                }

                this.setNextUrlMain();

                const errorDesc = isHttp5xxError ? `HTTP ${error.response!.status}` : error.message;
                this.adapter.log.warn(
                    `_getData: Fehler auf "${pathU}" (${errorDesc}) – versuche nächsten Knoten [${this.currentIpId}] ${this.nodeURL}...`,
                );
                try {
                    await this.ticket();
                } catch (ticketErr) {
                    // Ticket für neuen Knoten fehlgeschlagen → weiter zur nächsten Failover-Iteration
                    this.adapter.log.warn(
                        `_getData: Ticket für Knoten [${this.currentIpId}] fehlgeschlagen (${(ticketErr as Error).message}) – nächste Iteration...`,
                    );
                    return this._getData<T>(url, method, data, false, additional, failoverAttempts + 1);
                }
                return this._getData<T>(url, method, data, false, additional, failoverAttempts + 1);
            }

            throw error;
        }
    }

    public async ticket(): Promise<void> {
        if (this.authType === 'token') {
            // API-Token auth: kein HTTP-Call nötig – Authorization-Header direkt setzen
            // Format: PVEAPIToken=USER@REALM!TOKENID=SECRET
            this._ticket = `PVEAPIToken=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}!${this.tokenId}=${this.tokenSecret}`;
            this._csrf = ''; // kein CSRF bei Token-Auth
            this.adapter.log.debug(
                `Token-Auth: Authorization Header gesetzt für ${this.name}@${this.server}!${this.tokenId}`,
            );
            return;
        }

        const data = await this._getTicket();

        this.adapter.log.debug(`Updating ticket to "${data.ticket}" and CSRF to "${data.CSRFPreventionToken}"`);

        this._ticket = `PVEAuthCookie=${data.ticket}`;
        this._csrf = data.CSRFPreventionToken;
    }

    public async _getTicket(): Promise<ProxmoxTicket> {
        const url = `/access/ticket?username=${encodeURIComponent(this.name)}@${encodeURIComponent(this.server)}&password=${encodeURIComponent(this.password)}`;

        let response: AxiosResponse<ProxmoxApiResponse<ProxmoxTicket>>;
        try {
            response = await axios<ProxmoxApiResponse<ProxmoxTicket>>({
                method: 'post',
                baseURL: this.nodeURL,
                url,
                timeout: 5000,
                httpsAgent: this.httpsAgent,
            });
        } catch (e) {
            const error = e as RequestError;
            if (error.response) {
                this.adapter.log.warn(
                    `Error received ${error.response.status} response from proxmox with content: ${JSON.stringify(error.response.data)}`,
                );
                throw new Error(`HTTP_${error.response.status}`);
            } else if (error.request) {
                this.adapter.log.warn(
                    `No response from Proxmox [${this.nodeURL}] (timeout or network error): ${error.message}`,
                );
                throw new Error(`NETWORK_ERROR: ${error.message}`);
            } else {
                this.adapter.log.error(`Response error: ${error.message}`);
                throw new Error(`REQUEST_ERROR: ${error.message}`);
            }
        }

        this.adapter.log.debug(
            `received ${response.status} response from proxmox with content: ${JSON.stringify(response.data)}`,
        );

        if (!response?.data?.data?.ticket || !response?.data?.data?.CSRFPreventionToken) {
            this.adapter.log.error(
                `${response.status}: wrong User data, could not log in, please try again with correct user and pw`,
            );
            throw new Error('INVALID_RESPONSE');
        }

        return response.data.data;
    }

    /**
     * Wirft den Fehler unverändert weiter, wenn der Adapter gestoppt wurde.
     * Verhindert, dass STOPPED in einen neuen Error eingewickelt wird.
     *
     * @param error - gefangener Fehler
     */
    private _rethrowIfStopped(error: unknown): void {
        if ((error as Error).message === 'STOPPED' || this.stopped) {
            throw error;
        }
    }

    public stop(): void {
        this.stopped = true;
    }
}
