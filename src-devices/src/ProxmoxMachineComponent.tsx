/**
 * One VM or container of the Proxmox adapter as a widget of devices: its state, uptime, CPU and RAM, and buttons
 * to start and stop it - the widget "VM or container" of vis-2 (`src-widgets/src/MachineCard.tsx`) for devices.
 *
 * The setting `machine` is the channel of the machine, e.g. `proxmox.0.lxc_web`. A command writes `true` to the
 * button state `<channel>.start`, `.shutdown` or `.stop`; the status comes with the next poll of the adapter.
 */
import type React from 'react';
import type { ConfigItemPanel, ConfigItemTabs } from '@iobroker/dm-utils';
import type { ConfigItemPanel as JsonConfigItemPanel } from '@iobroker/json-config';
import type { WidgetGenericProps } from '@iobroker/dm-widgets';

import {
    canStart,
    canStop,
    formatMemory,
    formatUptime,
    getTypeName,
    KNOWN_MACHINE_STATUS,
    MACHINE_STATES,
    MACHINE_TYPES,
    PENDING_TIMEOUT_MS,
    TARGET_STATUS,
    type Command,
    type StopCommand,
} from '../../src-shared/proxmox';
import { ActionButton, Avatar, Box, Hint, I18n, Meta, Name, Pill, Typography, UsageBar } from './parts';
import { ProxmoxWidget, type ChannelSettings, type ChannelState, type TileSize } from './ProxmoxWidget';

interface MachineSettings extends ChannelSettings {
    /** The channel of the machine, e.g. `proxmox.0.lxc_web` */
    machine?: string;
    showControls?: boolean;
    stopCommand?: StopCommand;
    askConfirmation?: boolean;
}

interface MachineState extends ChannelState {
    /** The command sent last, until the status it leads to arrives */
    pending: Command | null;
    /** The command could not be written */
    failed: boolean;
}

export class ProxmoxMachineComponent extends ProxmoxWidget<MachineState, MachineSettings> {
    private pendingTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: WidgetGenericProps<MachineSettings>) {
        super(props);
        this.state = { ...this.state, pending: null, failed: false };
    }

    static override getConfigSchema(): { name: string; schema: ConfigItemPanel | ConfigItemTabs } {
        const schema: JsonConfigItemPanel = {
            type: 'panel',
            items: {
                instance: {
                    type: 'instance',
                    adapter: 'proxmox',
                    label: 'proxmox_instance',
                    default: 'proxmox.0',
                    sm: 12,
                },
                machine: {
                    // the list comes from the selected instance, see `getMachines` in src/main.ts. The value is the
                    // full channel ID, so the widget does not need the instance itself
                    type: 'selectSendTo',
                    command: 'getMachines',
                    instance: '${data.instance}',
                    alsoDependsOn: ['instance'],
                    label: 'proxmox_machine',
                    help: 'proxmox_machine_help',
                    sm: 12,
                },
                name: {
                    type: 'text',
                    label: 'proxmox_title',
                    help: 'proxmox_title_help',
                    sm: 12,
                },
                showUptime: {
                    type: 'checkbox',
                    label: 'proxmox_show_uptime',
                    default: true,
                    sm: 6,
                },
                showControls: {
                    type: 'checkbox',
                    label: 'proxmox_show_controls',
                    help: 'proxmox_show_controls_help',
                    default: true,
                    sm: 6,
                },
                stopCommand: {
                    type: 'select',
                    label: 'proxmox_stop_command',
                    options: [
                        { value: 'shutdown', label: 'proxmox_stop_shutdown' },
                        { value: 'stop', label: 'proxmox_stop_hard' },
                    ],
                    default: 'shutdown',
                    hidden: 'data.showControls === false',
                    sm: 6,
                },
                askConfirmation: {
                    type: 'checkbox',
                    label: 'proxmox_ask_confirmation',
                    default: true,
                    hidden: 'data.showControls === false',
                    sm: 6,
                },
                icon: {
                    type: 'component',
                    subType: 'iconSelect',
                    label: 'proxmox_icon',
                    help: 'proxmox_icon_help',
                    sm: 12,
                },
            },
        };

        return { name: 'Proxmox', schema: schema as unknown as ConfigItemPanel };
    }

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.clearPending();
    }

    protected getChannelId(): string {
        return this.props.settings.machine?.trim() || '';
    }

    protected getStateNames(): string[] {
        return MACHINE_STATES;
    }

    protected onChannelChange(): void {
        this.clearPending();
        this.setState({ pending: null, failed: false });
    }

    protected onChannelState(name: string, state: ioBroker.State | null): void {
        const pending = this.state.pending;
        if (name === 'status' && pending && state?.val === TARGET_STATUS[pending]) {
            this.clearPending();
            this.setState({ pending: null });
        }
    }

    private clearPending(): void {
        if (this.pendingTimer) {
            clearTimeout(this.pendingTimer);
            this.pendingTimer = null;
        }
    }

    private getStopCommand(): StopCommand {
        return this.props.settings.stopCommand === 'stop' ? 'stop' : 'shutdown';
    }

    private send(command: Command): void {
        const channelId = this.getChannelId();
        if (!channelId || this.isWriteBlocked()) {
            return;
        }
        this.clearPending();
        this.setState({ pending: command, failed: false });
        // if the status does not change, the buttons are released again
        this.pendingTimer = setTimeout(() => {
            this.pendingTimer = null;
            this.setState({ pending: null });
        }, PENDING_TIMEOUT_MS);
        this.props.stateContext
            .getSocket()
            .setState(`${channelId}.${command}`, true, false)
            .catch(() => {
                this.clearPending();
                this.setState({ pending: null, failed: true });
            });
    }

    private onStop(): void {
        if (this.props.settings.askConfirmation === false) {
            this.send(this.getStopCommand());
            return;
        }
        const word = this.getStopCommand() === 'stop' ? 'proxmox_confirm_hard' : 'proxmox_confirm_shutdown';
        this.showConfirmDialog('dialog', undefined, I18n.t(word, this.getDisplayName()));
    }

    protected onConfirmDialogSuccess(): void {
        this.send(this.getStopCommand());
    }

    private getStatusLabel(): string {
        if (this.state.pending) {
            return I18n.t('proxmox_in_progress');
        }
        const status = this.getStatus();
        return KNOWN_MACHINE_STATUS.includes(status)
            ? I18n.t(`proxmox_status_${status}`)
            : status || I18n.t('proxmox_unknown');
    }

    /**
     * @param both start and stop side by side, else only the one that fits the status
     * @param withLabels the words next to the symbols
     */
    private renderButtons(both: boolean, withLabels: boolean): React.JSX.Element | null {
        if (this.props.settings.showControls === false) {
            return null;
        }
        const status = this.getStatus();
        const blocked = !!this.state.pending || this.isWriteBlocked();
        const stopCommand = this.getStopCommand();
        const start = (
            <ActionButton
                key="start"
                icon="start"
                label={withLabels ? I18n.t('proxmox_start') : undefined}
                title={I18n.t('proxmox_start')}
                color="success"
                disabled={blocked || !canStart(status)}
                onClick={() => this.send('start')}
            />
        );
        const stop = (
            <ActionButton
                key="stop"
                icon="stop"
                label={withLabels ? I18n.t('proxmox_stop') : undefined}
                title={I18n.t(stopCommand === 'stop' ? 'proxmox_stop_hard' : 'proxmox_stop_shutdown')}
                color={stopCommand === 'stop' ? 'error' : 'primary'}
                disabled={blocked || !canStop(status)}
                onClick={() => this.onStop()}
            />
        );
        if (both) {
            return <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{[start, stop]}</Box>;
        }
        return canStop(status) ? stop : start;
    }

    protected renderContent(size: TileSize): React.JSX.Element {
        const channelType = this.state.channelType;
        if (!this.getChannelId() || (channelType !== null && !MACHINE_TYPES.includes(channelType))) {
            return (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                    <Hint text={I18n.t(this.getChannelId() ? 'proxmox_not_machine' : 'proxmox_no_machine')} />
                </Box>
            );
        }

        const settings = this.props.settings;
        const kind = this.state.pending ? 'unknown' : this.getStatusKind();
        const name = this.getDisplayName();
        const uptime = settings.showUptime === false ? '' : formatUptime(this.value('uptime'));
        const typeName = getTypeName(channelType || '');
        const pill = (
            <Pill
                kind={kind}
                label={this.getStatusLabel()}
            />
        );
        const failed = this.state.failed ? (
            <Typography
                variant="caption"
                sx={{ color: 'error.main' }}
                noWrap
            >
                {I18n.t('proxmox_command_failed')}
            </Typography>
        ) : null;

        if (size === 'compact') {
            return (
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.75,
                        textAlign: 'center',
                    }}
                >
                    <Avatar
                        type={channelType || ''}
                        kind={kind}
                        icon={settings.icon}
                        size="28%"
                    />
                    <Name name={name} />
                    {pill}
                    {failed || this.renderButtons(false, true)}
                </Box>
            );
        }

        if (size === 'wide') {
            return (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                        type={channelType || ''}
                        kind={kind}
                        icon={settings.icon}
                        size={44}
                    />
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Name name={name} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            {pill}
                            {failed || (
                                <Meta
                                    typeName=""
                                    uptime={uptime}
                                />
                            )}
                        </Box>
                    </Box>
                    {this.renderButtons(false, false)}
                </Box>
            );
        }

        const cpu = this.value('cpu');
        const cpus = this.value('cpus');
        const memLevel = this.value('mem_lev');
        return (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Avatar
                        type={channelType || ''}
                        kind={kind}
                        icon={settings.icon}
                        size={44}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Name
                            name={name}
                            big
                        />
                        <Meta
                            typeName={typeName}
                            uptime={uptime}
                        />
                    </Box>
                    {pill}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <UsageBar
                        label={typeof cpus === 'number' && cpus > 0 ? `${cpus} vCPU` : 'CPU'}
                        percent={typeof cpu === 'number' ? cpu : undefined}
                        text={typeof cpu === 'number' ? `${cpu} %` : '–'}
                    />
                    <UsageBar
                        label="RAM"
                        percent={typeof memLevel === 'number' ? memLevel : undefined}
                        text={formatMemory(this.value('mem'), this.value('maxmem'), memLevel)}
                    />
                </Box>
                {failed}
                <Box sx={{ marginTop: 'auto' }}>{this.renderButtons(true, true)}</Box>
            </Box>
        );
    }
}

export default ProxmoxMachineComponent;
