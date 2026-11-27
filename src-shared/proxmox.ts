/**
 * What the widgets of all three UIs share: the vis-2 widget set (`src-widgets`), the devices widgets
 * (`src-devices`) and the web components (`src-webcomponents`). The states they read, the commands, the formats
 * and the symbols. No React and no MUI, every build compiles this file into its own bundle.
 *
 * The widgets only work on the states of the adapter: a command is a button state, so it behaves like every
 * other way to press it, and no widget needs a `sendTo` handler.
 */

/** `native.type` of the channel of a VM or container */
export const MACHINE_TYPES = ['qemu', 'lxc'];

/** `native.type` of the channel of a node */
export const NODE_TYPES = ['node'];

/** The command of a machine, also the name of its button state */
export type Command = 'start' | 'shutdown' | 'stop';

/** `shutdown` stops cleanly, `stop` powers off at once */
export type StopCommand = 'shutdown' | 'stop';

/** How the updates of a node appear: with the refresh button, only the indicator, or not at all */
export type UpdatesMode = 'control' | 'show' | 'hidden';

/** The states of a VM or container, below its channel */
export const MACHINE_STATES = ['status', 'cpu', 'cpus', 'mem', 'maxmem', 'mem_lev', 'uptime'];

/** The states of a node, below its channel. `updates.*` only exist with "Request available updates" */
export const NODE_STATES = [
    'status',
    'cpu',
    'cpu_max',
    'memory.used',
    'memory.total',
    'memory.used_lev',
    'uptime',
    'updates.count',
    'updates.list',
    'updates.refresh',
];

/** The button state that refreshes the package index of a node. The adapter confirms it with `ack` when done */
export const REFRESH_STATE = 'updates.refresh';

/** The status a command leads to */
export const TARGET_STATUS: Record<Command, string> = { start: 'running', shutdown: 'stopped', stop: 'stopped' };

/**
 * If the status does not change, the controls are released again after this time. A failed command is only
 * logged by the adapter, and a clean shutdown can take a while.
 */
export const PENDING_TIMEOUT_MS = 60000;

/**
 * If the adapter does not confirm the refresh button, it is released again after this time. The adapter waits up
 * to 2 minutes for `apt-get update`.
 */
export const REFRESH_TIMEOUT_MS = 150000;

/** At most this many packages are listed */
export const MAX_LISTED = 15;

/** The status values of a machine that have a word (`proxmox_status_<status>`) */
export const KNOWN_MACHINE_STATUS = ['running', 'stopped', 'paused', 'suspended', 'offline'];

/** The status values of a node that have a word */
export const KNOWN_NODE_STATUS = ['online', 'offline'];

/** The color group of a status */
export type StatusKind = 'success' | 'warning' | 'error' | 'neutral' | 'unknown';

/**
 * @param status value of the state `status` of a machine or node
 * @returns its color group: running and online green, paused yellow, offline red, stopped grey
 */
export function getStatusKind(status: string): StatusKind {
    switch (status) {
        case 'running':
        case 'online':
            return 'success';
        case 'paused':
        case 'suspended':
            return 'warning';
        case 'offline':
            return 'error';
        case 'stopped':
            return 'neutral';
        default:
            return 'unknown';
    }
}

/** The colors of the symbol behind the icon, like the chips of vis-2 */
export const STATUS_COLORS: Record<StatusKind, string> = {
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    neutral: '#757575',
    unknown: '#9e9e9e',
};

/**
 * @param status value of the state `status`
 * @returns whether the machine can be started
 */
export function canStart(status: string): boolean {
    return status === 'stopped';
}

/**
 * @param status value of the state `status`
 * @returns whether the machine can be stopped
 */
export function canStop(status: string): boolean {
    return status === 'running' || status === 'paused' || status === 'suspended';
}

/**
 * @param seconds uptime in seconds
 * @returns for example `3 d 4 h`. Empty while the machine does not run. Like `formatUptime` of the adapter.
 */
export function formatUptime(seconds: unknown): string {
    if (typeof seconds !== 'number' || seconds <= 0) {
        return '';
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) {
        return `${days} d ${hours} h`;
    }
    if (hours) {
        return `${hours} h ${minutes} min`;
    }
    return minutes ? `${minutes} min` : '< 1 min';
}

const MIB_PER_GIB = 1024;

/**
 * @param mib size in MiB
 * @returns for example `4 GiB`
 */
export function formatSize(mib: number): string {
    return mib < MIB_PER_GIB ? `${mib} MiB` : `${Math.round((mib / MIB_PER_GIB) * 10) / 10} GiB`;
}

/**
 * @param used used memory in MiB
 * @param total memory in MiB
 * @param level used memory in percent
 * @returns for example `2 GiB / 4 GiB`, or the percentage if the sizes are not known
 */
export function formatMemory(used: unknown, total: unknown, level: unknown): string {
    if (typeof used === 'number' && typeof total === 'number' && total > 0) {
        return `${formatSize(used)} / ${formatSize(total)}`;
    }
    return typeof level === 'number' ? `${level} %` : '–';
}

/**
 * @param percent load in percent, if known
 * @returns the color group of a usage bar: grey without load, red above 90 %, yellow above 75 %
 */
export function getUsageKind(percent: number | undefined): StatusKind {
    if (!percent || percent <= 0) {
        return 'unknown';
    }
    return percent > 90 ? 'error' : percent > 75 ? 'warning' : 'success';
}

/**
 * @param type `native.type` of the channel
 * @returns the name of the type in a widget
 */
export function getTypeName(type: string): string {
    switch (type) {
        case 'lxc':
            return 'LXC';
        case 'qemu':
            return 'QEMU';
        case 'node':
            return 'Proxmox VE';
        default:
            return '';
    }
}

/** An entry of `updates.list` */
export interface UpdateEntry {
    package?: string;
    oldVersion?: string;
    version?: string;
}

/**
 * @param value value of `updates.list`
 * @returns the updates, empty if the value is not a list
 */
export function parseUpdateList(value: unknown): UpdateEntry[] {
    if (typeof value !== 'string') {
        return [];
    }
    try {
        const list: unknown = JSON.parse(value);
        return Array.isArray(list) ? (list as UpdateEntry[]) : [];
    } catch {
        return [];
    }
}

/**
 * @param entry an update
 * @returns for example `pve-manager 9.0.1 → 9.0.2`
 */
export function formatUpdate(entry: UpdateEntry): string {
    if (!entry.version) {
        return entry.package || '';
    }
    return `${entry.package || ''} ${entry.oldVersion ? `${entry.oldVersion} → ` : ''}${entry.version}`;
}

/**
 * The channel of a machine or node: `native.type` says which one it is.
 *
 * @param obj object of the chosen ID
 * @returns `qemu`, `lxc`, `node`, or empty if the object is no such channel
 */
export function getChannelType(obj: { type?: string; native?: Record<string, unknown> } | null | undefined): string {
    const type = obj?.native?.type;
    return obj?.type === 'channel' && typeof type === 'string' ? type : '';
}

/**
 * The symbols, paths of Material icons in a 24 × 24 box. The devices widgets and the web components cannot rely
 * on an icon library of their host, so they draw these.
 */
export const ICON_PATHS = {
    qemu: ['M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2zM4 6h16v10H4z'],
    lxc: [
        'm18.25 7.6-5.5-3.18c-.46-.27-1.04-.27-1.5 0L5.75 7.6c-.46.27-.75.76-.75 1.3v6.35c0 .54.29 1.03.75 1.3l5.5 3.18c.46.27 1.04.27 1.5 0l5.5-3.18c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3M7 14.96v-4.62l4 2.32v4.61zm5-4.03L8 8.61l4-2.31 4 2.31zm1 6.34v-4.61l4-2.32v4.62zM7 2H3.5C2.67 2 2 2.67 2 3.5V7h2V4h3zm10 0h3.5c.83 0 1.5.67 1.5 1.5V7h-2V4h-3zM7 22H3.5c-.83 0-1.5-.67-1.5-1.5V17h2v3h3zm10 0h3.5c.83 0 1.5-.67 1.5-1.5V17h-2v3h-3z',
    ],
    node: [
        'M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1M7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1M7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2',
    ],
    start: ['M8 5v14l11-7z'],
    stop: ['M6 6h12v12H6z'],
    refresh: [
        'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
    ],
    uptime: [
        'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8',
        'M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    ],
    update: [
        'm12 16.5 4-4h-3v-9h-2v9H8zm9-13h-6v1.99h6v14.03H3V5.49h6V3.5H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2',
    ],
    upToDate: [
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z',
    ],
};

export type IconName = keyof typeof ICON_PATHS;

/**
 * @param type `native.type` of the channel
 * @returns the symbol of the type
 */
export function getTypeIcon(type: string): IconName {
    return type === 'node' ? 'node' : type === 'lxc' ? 'lxc' : 'qemu';
}
