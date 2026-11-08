import type { ProxmoxUtils } from './proxmox';

// ─── Konfiguration ───────────────────────────────────────────────────────────

/** Eine Zeile aus `native.tableDevices` (siehe admin/jsonConfig.json) */
export interface ProxmoxDeviceConfig {
    enabled: boolean;
    clusterNode: boolean;
    realmIp: string;
    realmPort: number;
    realmUser: string;
    realmPassword: string;
    realm: string;
    authType?: ProxmoxAuthType;
    realmTokenId?: string;
    realmTokenSecret?: string;
}

export type ProxmoxAuthType = 'password' | 'token';

/** Verbindungsparameter eines Knotens, wie sie an ProxmoxUtils übergeben werden */
export type ProxmoxNodeConfig = Omit<ProxmoxDeviceConfig, 'enabled' | 'clusterNode'>;

// ─── Proxmox-API ─────────────────────────────────────────────────────────────

/** Hülle jeder Proxmox-API-Antwort */
export interface ProxmoxApiResponse<T = unknown> {
    data?: T;
    errors?: Record<string, string>;
    message?: string;
}

/** GET /access/ticket */
export interface ProxmoxTicket {
    ticket: string;
    CSRFPreventionToken: string;
}

/** GET /nodes */
export interface ProxmoxNode {
    node: string;
    type: string;
    status: string;
    cpu?: number;
    maxcpu?: number;
}

export interface ProxmoxMemoryInfo {
    used?: number;
    total?: number;
    free?: number;
}

/** GET /nodes/{node}/status */
export interface ProxmoxNodeStatus {
    uptime?: number;
    wait?: number;
    memory?: ProxmoxMemoryInfo;
    swap?: ProxmoxMemoryInfo;
    /** Proxmox liefert die Load-Werte als Strings */
    loadavg?: string[];
}

/** GET /nodes/{node}/disks/list */
export interface ProxmoxDisk {
    devpath?: string;
    type?: string;
    size?: number;
    health?: string;
    /** Bei HDDs liefert Proxmox hier 'N/A' */
    wearout?: number | string;
    model?: string;
}

/** GET /nodes/{node}/disks/smart */
export type ProxmoxDiskSmart = ProxmoxApiResponse<{ text?: string }>;

/** GET /cluster/resources */
export interface ProxmoxClusterResource {
    id: string;
    type: string;
    status: string;
    name?: string;
    node: string;
    vmid: number;
    storage: string;
    shared?: number | boolean;
}

/** GET /nodes/{node}/storage/{storage}/content */
export interface ProxmoxBackupEntry {
    volid: string;
    [key: string]: unknown;
}

/** GET /cluster/ha/status/current */
export interface ProxmoxHAEntry {
    id?: string | number;
    [key: string]: unknown;
}

/** Status-Antwort, deren Felder durch findState() auf States abgebildet werden */
export type StatusRecord = Record<string, unknown>;

/** Platzhalter-Status einer nicht laufenden Maschine */
export type OfflineResourceStatus = {
    uptime: number;
    disk: number;
    netout: number;
    netin: number;
    diskread: number;
    cpu: number;
    diskwrite: number;
    pid: number;
    mem: number;
    swap: number;
    status: string;
    type: string;
    name: string;
    vmid: number | undefined;
};

/** Ergebnis von parseNotificationInfo() */
export interface NotificationInfo {
    severity: string | null;
    title: string | null;
    message: string | null;
    timestamp: number | null;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export type CustomStateType = 'time' | 'size' | 'sizeb' | 'level' | 'default_num' | 'text';

/** [sid, key, type, value] */
export type StateDefinition = [string, string, CustomStateType, ioBroker.StateValue];

/** Objekte, die der Adapter im RAM hält. Neu angelegte Channels haben noch keine `_id`. */
export type KnownObjects = Record<string, ioBroker.SettableChannelObject>;

/**
 * Was die an die Adapterklasse gebundenen Funktionen aus lib/ als `this` erwarten.
 * Die Klasse in main.ts erfüllt dieses Interface.
 */
export interface ProxmoxAdapterContext extends ioBroker.Adapter {
    /** Die aktuell verarbeitete Instanz. Wird in sendRequest() und getNodes() umgesetzt. */
    proxmox: ProxmoxUtils | null;
    objects: KnownObjects;
    /** Objekt-IDs, die jede Instanz ohne Host-Zusatz belegen würde. Erkennt Kollisionen zwischen Instanzen. */
    instanceIds: Map<ProxmoxUtils, Set<string>>;
    offlineResourceStatus: OfflineResourceStatus;

    used_level(vala: number, valb: number): number;
    bytetoMb(val: number): number;
    removeNamespace(id: string): string;
    prepareNameForId(val: unknown): string;
    findState(sid: string, states: StatusRecord): StateDefinition[];

    createCustomState(sid: string, name: string, type: CustomStateType, val: ioBroker.StateValue): Promise<void>;

    /** Liefert den Befehl eines Buttons, siehe `native` der Button-Objekte */
    getButtonAction(native: Record<string, unknown>, command: string): (() => Promise<unknown> | undefined) | undefined;
    /** Adresse des Hosts zu einem Button, siehe `native` der Button-Objekte. Bei einem Cluster `undefined`. */
    getHostAddress(native: Record<string, unknown>): string | undefined;
    sendRequest(nextRunTimeout?: number): void;

    createCeph(): Promise<void>;
    createHA(): Promise<void>;
    createVM(): Promise<string[] | null>;
}
