import {
    DeviceManagement,
    type ActionContext,
    type DeviceAction,
    type DeviceInfo,
    type DeviceLoadContext,
    type InstanceDetails,
} from '@iobroker/dm-utils';
import {
    CONFIRM_REBOOT,
    CONFIRM_SHUTDOWN,
    CONFIRM_STOP,
    DEVICE_GROUPS,
    nodeButtonLabels,
    vmButtonLabels,
} from './translations';
import type { ProxmoxAdapterContext } from './types';

type DeviceType = keyof typeof DEVICE_GROUPS;

/** dm-utils verlangt seinen eigenen Adapter-Typ, die lib-Funktionen hier das Interface aus types.ts */
type DeviceManagementAdapter = ConstructorParameters<typeof DeviceManagement>[0] & ProxmoxAdapterContext;

/** Nach einem Befehl fragt der Adapter so schnell neu ab wie bei einem Button in onStateChange */
const POLL_AFTER_COMMAND_MS = 10000;

/** Abbildung der Proxmox-Status auf die Verbindungsanzeige im Device Manager */
const VM_CONNECTION = {
    running: 'connected',
    stopped: 'disconnected',
    paused: 'disconnected',
    suspended: 'disconnected',
    offline: 'disconnected',
} as const;

const NODE_CONNECTION = { online: 'connected', offline: 'disconnected', unknown: 'disconnected' } as const;

const NODE_COMMANDS: { command: 'shutdown' | 'reboot'; icon: string; confirmation: ioBroker.Translated }[] = [
    { command: 'shutdown', icon: 'stop', confirmation: CONFIRM_SHUTDOWN },
    { command: 'reboot', icon: 'refresh', confirmation: CONFIRM_REBOOT },
];

const VM_COMMANDS: {
    command: 'start' | 'stop' | 'shutdown' | 'reboot';
    icon: string;
    confirmation?: ioBroker.Translated;
}[] = [
    { command: 'start', icon: 'play' },
    { command: 'shutdown', icon: 'stop', confirmation: CONFIRM_SHUTDOWN },
    { command: 'reboot', icon: 'refresh', confirmation: CONFIRM_REBOOT },
    { command: 'stop', icon: 'fa-power-off', confirmation: CONFIRM_STOP },
];

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

        return {
            id,
            name: this.adapter.objects[id].common.name,
            identifier: isNode
                ? typeof native.host === 'string'
                    ? native.host
                    : ''
                : `VMID ${String(native.vmid)}, ${String(native.node)}`,
            model: type === 'lxc' ? 'LXC' : type === 'qemu' ? 'QEMU' : 'Proxmox VE',
            group: { key: type, name: DEVICE_GROUPS[type] },
            status: {
                connection: {
                    stateId: `${id}.status`,
                    mapping: isNode ? NODE_CONNECTION : VM_CONNECTION,
                },
            },
            indicators: [
                { id: 'status', value: { stateId: `${id}.status` }, showValue: true, icon: 'fa-circle-info' },
                {
                    id: 'cpu',
                    value: { stateId: `${id}.cpu` },
                    showValue: true,
                    unit: '%',
                    icon: 'fa-microchip',
                    tooltip: 'CPU',
                },
                {
                    id: 'memory',
                    value: { stateId: `${id}.${isNode ? 'memory.used_lev' : 'mem_lev'}` },
                    showValue: true,
                    unit: '%',
                    icon: 'fa-memory',
                    tooltip: 'RAM',
                },
            ],
            actions: isNode
                ? NODE_COMMANDS.map(item => this.getAction(item, nodeButtonLabels[item.command]))
                : VM_COMMANDS.map(item => this.getAction(item, vmButtonLabels[item.command])),
        };
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
        item: { command: string; icon: string; confirmation?: ioBroker.Translated },
        description: ioBroker.Translated,
    ): DeviceAction<string> {
        return {
            id: item.command,
            icon: item.icon,
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
