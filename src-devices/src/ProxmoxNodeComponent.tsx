/**
 * One node of the Proxmox adapter as a widget of devices: its state, uptime, CPU and RAM, and the available
 * package updates with a button to refresh them - the widget "Proxmox node" of vis-2
 * (`src-widgets/src/NodeCard.tsx`) for devices.
 *
 * The setting `node` is the channel of the node, e.g. `proxmox.0.node_pve`. The updates exist only with the option
 * "Request available updates" of the adapter. The button writes `true` to `<channel>.updates.refresh`; the adapter
 * runs `apt-get update` on the node, reads the updates again and confirms the button with `ack`.
 */
import type React from 'react';
import type { ConfigItemPanel, ConfigItemTabs } from '@iobroker/dm-utils';
import type { ConfigItemPanel as JsonConfigItemPanel } from '@iobroker/json-config';
import type { WidgetGenericProps } from '@iobroker/dm-widgets';

import {
    formatMemory,
    formatUpdate,
    formatUptime,
    getTypeName,
    KNOWN_NODE_STATUS,
    MAX_LISTED,
    NODE_STATES,
    NODE_TYPES,
    parseUpdateList,
    REFRESH_STATE,
    REFRESH_TIMEOUT_MS,
    type UpdatesMode,
} from '../../src-shared/proxmox';
import { ActionButton, Avatar, Box, Hint, I18n, Meta, Name, Pill, Typography, UsageBar } from './parts';
import { ProxmoxWidget, type ChannelSettings, type ChannelState, type TileSize } from './ProxmoxWidget';

interface NodeSettings extends ChannelSettings {
    /** The channel of the node, e.g. `proxmox.0.node_pve` */
    node?: string;
    updates?: UpdatesMode;
}

interface NodeState extends ChannelState {
    /** While refreshing: `ts` of the button state at the click. A newer state with `ack` ends it */
    refreshing: { before: number | null } | null;
    /** The button could not be written */
    failed: boolean;
}

export class ProxmoxNodeComponent extends ProxmoxWidget<NodeState, NodeSettings> {
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: WidgetGenericProps<NodeSettings>) {
        super(props);
        this.state = { ...this.state, refreshing: null, failed: false };
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
                node: {
                    // the list comes from the selected instance, see `getNodes` in src/main.ts
                    type: 'selectSendTo',
                    command: 'getNodes',
                    instance: '${data.instance}',
                    alsoDependsOn: ['instance'],
                    label: 'proxmox_node',
                    help: 'proxmox_node_help',
                    sm: 12,
                },
                name: {
                    type: 'text',
                    label: 'proxmox_title',
                    help: 'proxmox_node_title_help',
                    sm: 12,
                },
                updates: {
                    type: 'select',
                    label: 'proxmox_updates',
                    help: 'proxmox_updates_help',
                    options: [
                        { value: 'control', label: 'proxmox_updates_control' },
                        { value: 'show', label: 'proxmox_updates_show' },
                        { value: 'hidden', label: 'proxmox_updates_hidden' },
                    ],
                    default: 'control',
                    sm: 6,
                },
                showUptime: {
                    type: 'checkbox',
                    label: 'proxmox_show_uptime',
                    default: true,
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
        this.clearRefresh();
    }

    protected getChannelId(): string {
        return this.props.settings.node?.trim() || '';
    }

    protected getStateNames(): string[] {
        return NODE_STATES;
    }

    protected onChannelChange(): void {
        this.clearRefresh();
        this.setState({ refreshing: null, failed: false });
    }

    protected onChannelState(name: string, state: ioBroker.State | null): void {
        const refreshing = this.state.refreshing;
        if (name === REFRESH_STATE && refreshing && state?.ack && state.ts !== refreshing.before) {
            this.clearRefresh();
            this.setState({ refreshing: null });
        }
    }

    private clearRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private getUpdatesMode(): UpdatesMode {
        const mode = this.props.settings.updates;
        return mode === 'show' || mode === 'hidden' ? mode : 'control';
    }

    private refresh(): void {
        const channelId = this.getChannelId();
        if (!channelId || this.isWriteBlocked()) {
            return;
        }
        this.clearRefresh();
        this.setState({ refreshing: { before: this.state.channelStates[REFRESH_STATE]?.ts ?? null }, failed: false });
        // if the adapter does not confirm the button, it is released again
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            this.setState({ refreshing: null });
        }, REFRESH_TIMEOUT_MS);
        this.props.stateContext
            .getSocket()
            .setState(`${channelId}.${REFRESH_STATE}`, true, false)
            .catch(() => {
                this.clearRefresh();
                this.setState({ refreshing: null, failed: true });
            });
    }

    private getStatusLabel(): string {
        const status = this.getStatus();
        return KNOWN_NODE_STATUS.includes(status)
            ? I18n.t(`proxmox_status_${status}`)
            : status || I18n.t('proxmox_unknown');
    }

    /** The number of updates, with the packages in the tooltip. Nothing while the adapter does not read them */
    private renderUpdates(): React.JSX.Element | null {
        const count = this.value('updates.count');
        if (this.getUpdatesMode() === 'hidden' || typeof count !== 'number') {
            return null;
        }
        if (count <= 0) {
            return (
                <Pill
                    kind="success"
                    icon="upToDate"
                    label={I18n.t('proxmox_up_to_date')}
                />
            );
        }
        const list = parseUpdateList(this.value('updates.list'));
        const lines = list.slice(0, MAX_LISTED).map(formatUpdate);
        if (list.length > MAX_LISTED) {
            lines.push(I18n.t('proxmox_more_updates', String(list.length - MAX_LISTED)));
        }
        return (
            <Pill
                kind="warning"
                icon="update"
                label={
                    count === 1
                        ? I18n.t('proxmox_update_available')
                        : I18n.t('proxmox_updates_available', String(count))
                }
                title={lines.join('\n')}
            />
        );
    }

    /** @param withLabel the word next to the symbol */
    private renderRefresh(withLabel: boolean): React.JSX.Element | null {
        if (this.getUpdatesMode() !== 'control' || typeof this.value('updates.count') !== 'number') {
            return null;
        }
        const refreshing = !!this.state.refreshing;
        return (
            <ActionButton
                icon="refresh"
                label={withLabel ? I18n.t(refreshing ? 'proxmox_refreshing' : 'proxmox_refresh') : undefined}
                title={I18n.t(refreshing ? 'proxmox_refreshing' : 'proxmox_refresh_help')}
                color="primary"
                outlined
                disabled={refreshing || this.isWriteBlocked() || this.getStatus() !== 'online'}
                onClick={() => this.refresh()}
            />
        );
    }

    protected renderContent(size: TileSize): React.JSX.Element {
        const channelType = this.state.channelType;
        if (!this.getChannelId() || (channelType !== null && !NODE_TYPES.includes(channelType))) {
            return (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                    <Hint text={I18n.t(this.getChannelId() ? 'proxmox_not_node' : 'proxmox_no_node')} />
                </Box>
            );
        }

        const settings = this.props.settings;
        const kind = this.getStatusKind();
        const name = this.getDisplayName();
        const uptime = settings.showUptime === false ? '' : formatUptime(this.value('uptime'));
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
        const updates = this.renderUpdates();

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
                        type="node"
                        kind={kind}
                        icon={settings.icon}
                        size="28%"
                    />
                    <Name name={name} />
                    {updates || pill}
                    {failed || this.renderRefresh(false)}
                </Box>
            );
        }

        if (size === 'wide') {
            return (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                        type="node"
                        kind={kind}
                        icon={settings.icon}
                        size={44}
                    />
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Name name={name} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                            {pill}
                            {failed || updates}
                        </Box>
                    </Box>
                    {this.renderRefresh(false)}
                </Box>
            );
        }

        const cpu = this.value('cpu');
        const cpuMax = this.value('cpu_max');
        const usedLevel = this.value('memory.used_lev');
        return (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Avatar
                        type="node"
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
                            typeName={getTypeName('node')}
                            uptime={uptime}
                        />
                    </Box>
                    {pill}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <UsageBar
                        label={typeof cpuMax === 'number' && cpuMax > 0 ? `${cpuMax} CPU` : 'CPU'}
                        percent={typeof cpu === 'number' ? cpu : undefined}
                        text={typeof cpu === 'number' ? `${cpu} %` : '–'}
                    />
                    <UsageBar
                        label="RAM"
                        percent={typeof usedLevel === 'number' ? usedLevel : undefined}
                        text={formatMemory(this.value('memory.used'), this.value('memory.total'), usedLevel)}
                    />
                </Box>
                {failed}
                {updates ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 'auto', minWidth: 0 }}>
                        {updates}
                        <Box sx={{ marginLeft: 'auto' }}>{this.renderRefresh(true)}</Box>
                    </Box>
                ) : null}
            </Box>
        );
    }
}

export default ProxmoxNodeComponent;
