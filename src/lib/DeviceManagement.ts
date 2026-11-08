import {
    DeviceManagement,
    type ActionContext,
    type DeviceAction,
    type DeviceDetails,
    type DeviceInfo,
    type DeviceLoadContext,
    type InstanceDetails,
} from '@iobroker/dm-utils';
import { ICONS } from './icons';
import {
    CONFIRM_REBOOT,
    CONFIRM_SHUTDOWN,
    CONFIRM_STOP,
    DEVICE_GROUPS,
    DEVICE_STATUS,
    UPTIME,
    nodeButtonLabels,
    vmButtonLabels,
} from './translations';
import type { ProxmoxAdapterContext } from './types';

type DeviceType = keyof typeof DEVICE_GROUPS;

type Indicators = NonNullable<DeviceInfo<string>['indicators']>;
type IndicatorLevels = NonNullable<Indicators[number]['levels']>;

/** dm-utils verlangt seinen eigenen Adapter-Typ, die lib-Funktionen hier das Interface aus types.ts */
type DeviceManagementAdapter = ConstructorParameters<typeof DeviceManagement>[0] & ProxmoxAdapterContext;

/** Nach einem Befehl fragt der Adapter so schnell neu ab wie bei einem Button in onStateChange */
const POLL_AFTER_COMMAND_MS = 10000;

const COLOR_GREEN = '#2e7d32';
const COLOR_GREY = '#757575';
const COLOR_ORANGE = '#ed6c02';
const COLOR_RED = '#d32f2f';

/** Farbe des Symbols einer Karte, je nach Status */
const VM_COLORS = {
    running: COLOR_GREEN,
    stopped: COLOR_GREY,
    paused: COLOR_ORANGE,
    suspended: COLOR_ORANGE,
    offline: COLOR_RED,
};

const NODE_COLORS = { online: COLOR_GREEN, offline: COLOR_RED, unknown: COLOR_GREY };

/**
 * LED am Symbol. Eine gestoppte VM ist kein Verbindungsfehler und bekäme sonst eine rote LED und eine rote
 * Anzeige. Ohne Eintrag zeigt der Device Manager beides nicht an, der Status steht dann in seiner Anzeige.
 */
const VM_CONNECTION = { running: 'connected', offline: 'disconnected' } as const;

const NODE_CONNECTION = { online: 'connected', offline: 'disconnected' } as const;

const VM_STATUS_LEVELS: IndicatorLevels = [
    { value: 'running', color: 'ok', icon: ICONS.ok, text: DEVICE_STATUS.running },
    { value: 'stopped', color: 'inactive', icon: ICONS.stopped, text: DEVICE_STATUS.stopped },
    { value: 'paused', color: 'warning', icon: ICONS.paused, text: DEVICE_STATUS.paused },
    { value: 'suspended', color: 'warning', icon: ICONS.paused, text: DEVICE_STATUS.suspended },
    { value: 'offline', color: 'error', icon: ICONS.error, text: DEVICE_STATUS.offline },
];

const NODE_STATUS_LEVELS: IndicatorLevels = [
    { value: 'online', color: 'ok', icon: ICONS.ok, text: DEVICE_STATUS.online },
    { value: 'offline', color: 'error', icon: ICONS.error, text: DEVICE_STATUS.offline },
    { value: 'unknown', color: 'inactive', icon: ICONS.unknown, text: DEVICE_STATUS.unknown },
];

/** Farbe einer Auslastung in Prozent. 0 % zeigt vor allem eine gestoppte Maschine: Sie bleibt grau. */
const USAGE_LEVELS: IndicatorLevels = [
    { max: 0, color: 'inactive' },
    { max: 75, color: 'ok' },
    { max: 90, color: 'warning' },
    { color: 'error' },
];

const COLOR_START = '#4caf50';
const COLOR_HARD_STOP = '#f44336';

const NODE_COMMANDS: { command: 'shutdown' | 'reboot'; icon: string; confirmation: ioBroker.Translated }[] = [
    { command: 'shutdown', icon: ICONS.power, confirmation: CONFIRM_SHUTDOWN },
    { command: 'reboot', icon: 'refresh', confirmation: CONFIRM_REBOOT },
];

const VM_COMMANDS: {
    command: 'start' | 'stop' | 'shutdown' | 'reboot';
    icon: string;
    color?: string;
    confirmation?: ioBroker.Translated;
}[] = [
    { command: 'start', icon: 'play', color: COLOR_START },
    { command: 'shutdown', icon: ICONS.power, confirmation: CONFIRM_SHUTDOWN },
    { command: 'reboot', icon: 'refresh', confirmation: CONFIRM_REBOOT },
    { command: 'stop', icon: 'stop', color: COLOR_HARD_STOP, confirmation: CONFIRM_STOP },
];

type DetailGroup = [string, string | ioBroker.Translated][];

/**
 * States in den Details einer Karte, mit Beschriftung. Fachbegriffe, wie sie auch Proxmox anzeigt.
 *
 * Jede Gruppe beginnt eine neue Zeile: States in Prozent zeichnet der Admin als Balken und damit höher als
 * die anderen, gemischt stünden die Spalten versetzt.
 */
const VM_DETAILS: DetailGroup[] = [
    [
        ['uptime_text', UPTIME],
        ['vmid', 'VMID'],
        ['cpus', 'vCPU'],
        ['pid', 'PID'],
    ],
    [
        ['cpu', 'CPU'],
        ['mem_lev', 'RAM'],
        ['disk_lev', 'Disk'],
        ['swap_lev', 'Swap'],
    ],
    [
        ['mem', 'RAM'],
        ['maxmem', 'RAM max.'],
        ['disk', 'Disk'],
        ['maxdisk', 'Disk max.'],
        ['swap', 'Swap'],
        ['maxswap', 'Swap max.'],
    ],
    [
        ['netin', 'Network in'],
        ['netout', 'Network out'],
        ['diskread', 'Disk read'],
        ['diskwrite', 'Disk write'],
    ],
];

const NODE_DETAILS: DetailGroup[] = [
    [
        ['uptime_text', UPTIME],
        ['cpu_max', 'CPU cores'],
    ],
    [
        ['cpu', 'CPU'],
        ['iowait', 'IO wait'],
        ['memory.used_lev', 'RAM'],
        ['swap.used_lev', 'Swap'],
    ],
    [
        ['loadavg.0', 'Load 1 min'],
        ['loadavg.1', 'Load 5 min'],
        ['loadavg.2', 'Load 15 min'],
    ],
    [
        ['memory.used', 'RAM'],
        ['memory.free', 'RAM free'],
        ['memory.total', 'RAM max.'],
        ['swap.used', 'Swap'],
        ['swap.free', 'Swap free'],
        ['swap.total', 'Swap max.'],
    ],
];

/** Für QEMU-Gäste liefert Proxmox diese Werte nicht verlässlich, sie stünden meist auf 0 */
const QEMU_UNRELIABLE = new Set(['disk', 'disk_lev', 'swap', 'maxswap', 'swap_lev']);

const MIB_PER_GIB = 1024;

/**
 * @param mib - Größe in MiB
 * @returns lesbare Größe, zum Beispiel `4 GiB`
 */
function formatSize(mib: number): string {
    return mib < MIB_PER_GIB ? `${mib} MiB` : `${Math.round((mib / MIB_PER_GIB) * 10) / 10} GiB`;
}

/**
 * Zeigt Nodes, VMs und Container im Device Manager. Die Objekte bleiben die Quelle: Der Device Manager
 * liest dieselben States und führt dieselben Befehle aus wie die Buttons in den Objekten.
 */
export default class ProxmoxDeviceManagement extends DeviceManagement<DeviceManagementAdapter> {
    protected getInstanceInfo(): InstanceDetails {
        return { apiVersion: 'v3', actions: [] };
    }

    protected async loadDevices(context: DeviceLoadContext<string>): Promise<void> {
        const ids = Object.keys(this.adapter.objects).filter(id => this.getDeviceType(id));
        context.setTotalDevices(ids.length);
        for (const id of ids) {
            context.addDevice(await this.getDeviceInfo(id));
        }
    }

    protected async getDeviceInfo(id: string): Promise<DeviceInfo<string>> {
        const type = this.getDeviceType(id);
        if (!type) {
            throw new Error(`Unknown device "${id}"`);
        }

        const isNode = type === 'node';
        const button = await this.adapter.getForeignObjectAsync(`${id}.${isNode ? 'reboot' : 'stop'}`);
        const native: Record<string, unknown> = button?.native ?? {};
        const typeName = type === 'lxc' ? 'LXC' : type === 'qemu' ? 'QEMU' : 'Proxmox VE';

        return {
            id,
            name: this.adapter.objects[id].common.name,
            identifier: isNode
                ? this.adapter.getHostAddress(native)
                : `VMID ${String(native.vmid)}, ${String(native.node)}`,
            icon: ICONS[type],
            color: '#ffffff',
            backgroundColor: { stateId: `${id}.status`, mapping: isNode ? NODE_COLORS : VM_COLORS },
            model: await this.getModel(id, type, typeName),
            group: { key: type, name: DEVICE_GROUPS[type], icon: ICONS[type] },
            status: {
                connection: {
                    stateId: `${id}.status`,
                    mapping: isNode ? NODE_CONNECTION : VM_CONNECTION,
                },
            },
            indicators: this.getIndicators(id, type),
            hasDetails: true,
            actions: isNode
                ? NODE_COMMANDS.map(item => this.getAction(item, nodeButtonLabels[item.command]))
                : VM_COMMANDS.map(item => this.getAction(item, vmButtonLabels[item.command])),
        };
    }

    /**
     * Die Details zeigen die States, die es für diese Maschine gibt.
     *
     * @param id - volle ID eines Channels
     */
    protected async getDeviceDetails(id: string): Promise<DeviceDetails<string> | null> {
        const type = this.getDeviceType(id);
        if (!type) {
            return null;
        }
        const objects = await this.adapter.getForeignObjectsAsync(`${id}.*`, 'state');
        const items: Record<string, Record<string, unknown>> = {};
        for (const group of type === 'node' ? NODE_DETAILS : VM_DETAILS) {
            let newLine = true;
            for (const [name, label] of group) {
                if (!objects[`${id}.${name}`] || (type === 'qemu' && QEMU_UNRELIABLE.has(name))) {
                    continue;
                }
                // Der Name darf keinen Punkt enthalten: JsonConfig würde ihn als Pfad in den Daten lesen
                items[`_${name.replace(/\W/g, '_')}`] = {
                    type: 'state',
                    oid: `${id}.${name}`,
                    foreign: true,
                    label,
                    noTranslation: true,
                    addColon: true,
                    readOnly: true,
                    controlled: false,
                    newLine,
                    xs: 12,
                    sm: 6,
                    md: 6,
                    lg: 6,
                    xl: 6,
                };
                newLine = false;
            }
        }
        return { id, schema: { type: 'panel', items } as DeviceDetails<string>['schema'], data: {} };
    }

    /**
     * @param id - volle ID eines Channels
     * @param type - Typ des Channels
     * @returns die Anzeigen der Karte. Sie folgen ihren States, ohne dass die Karte neu geladen wird.
     */
    private getIndicators(id: string, type: DeviceType): Indicators {
        const isNode = type === 'node';
        const indicators: Indicators = [
            {
                id: 'status',
                value: { stateId: `${id}.status` },
                showValue: true,
                levels: isNode ? NODE_STATUS_LEVELS : VM_STATUS_LEVELS,
            },
            {
                id: 'uptime',
                value: { stateId: `${id}.uptime_text` },
                showValue: true,
                icon: ICONS.uptime,
                color: 'info',
                tooltip: UPTIME,
                configurable: true,
            },
            this.getUsage('cpu', `${id}.cpu`, ICONS.cpu, 'CPU'),
            this.getUsage('memory', `${id}.${isNode ? 'memory.used_lev' : 'mem_lev'}`, ICONS.memory, 'RAM'),
        ];
        // Siehe QEMU_UNRELIABLE
        if (type === 'lxc') {
            indicators.push(this.getUsage('disk', `${id}.disk_lev`, ICONS.disk, 'Disk'));
        }
        if (type !== 'qemu') {
            indicators.push(
                this.getUsage('swap', `${id}.${isNode ? 'swap.used_lev' : 'swap_lev'}`, ICONS.swap, 'Swap'),
            );
        }
        return indicators;
    }

    private getUsage(id: string, stateId: string, icon: string, tooltip: string): Indicators[number] {
        return {
            id,
            value: { stateId },
            showValue: true,
            unit: '%',
            icon,
            tooltip,
            levels: USAGE_LEVELS,
            configurable: true,
        };
    }

    /**
     * Die Größe einer Maschine ändert sich selten, deshalb reicht der Wert beim Laden der Karte.
     *
     * @param id - volle ID eines Channels
     * @param type - Typ des Channels
     * @param typeName - Name des Typs
     * @returns Typ, CPUs und RAM, zum Beispiel `LXC · 2 vCPU · 4 GiB`
     */
    private async getModel(id: string, type: DeviceType, typeName: string): Promise<string> {
        const isNode = type === 'node';
        const [cores, memory] = await Promise.all([
            this.adapter.getForeignStateAsync(`${id}.${isNode ? 'cpu_max' : 'cpus'}`),
            this.adapter.getForeignStateAsync(`${id}.${isNode ? 'memory.total' : 'maxmem'}`),
        ]);
        const parts = [typeName];
        if (typeof cores?.val === 'number' && cores.val > 0) {
            parts.push(`${cores.val} ${isNode ? 'CPU' : 'vCPU'}`);
        }
        if (typeof memory?.val === 'number' && memory.val > 0) {
            parts.push(formatSize(memory.val));
        }
        return parts.join(' · ');
    }

    /**
     * @param id - volle ID eines Channels
     * @returns Typ, wenn der Channel ein Node, eine VM oder ein Container ist
     */
    private getDeviceType(id: string): DeviceType | undefined {
        const type = this.adapter.objects[id]?.native?.type as string | undefined;
        return type === 'node' || type === 'qemu' || type === 'lxc' ? type : undefined;
    }

    private getAction(
        item: { command: string; icon: string; color?: string; confirmation?: ioBroker.Translated },
        description: ioBroker.Translated,
    ): DeviceAction<string> {
        return {
            id: item.command,
            icon: item.icon,
            color: item.color,
            description,
            confirmation: item.confirmation,
            handler: (deviceId, context) => this.executeCommand(deviceId, item.command, context),
        };
    }

    private async executeCommand(id: string, command: string, context: ActionContext): Promise<{ refresh: 'none' }> {
        try {
            const button = await this.adapter.getForeignObjectAsync(`${id}.${command}`);
            const action = button?.native ? this.adapter.getButtonAction(button.native, command) : undefined;
            if (!action) {
                throw new Error(`Unknown command for "${id}"`);
            }
            const data = await action();
            this.adapter.log.info(`${command} ${id}: ${JSON.stringify(data)}`);
            this.adapter.sendRequest(POLL_AFTER_COMMAND_MS);
        } catch (err) {
            this.adapter.log.warn(`Unable to execute "${command}" on "${id}": ${(err as Error).message}`);
            await context.showMessage(`${command}: ${(err as Error).message}`);
        }
        // Der Status folgt über den State, sobald die nächste Abfrage ihn liefert
        return { refresh: 'none' };
    }
}
