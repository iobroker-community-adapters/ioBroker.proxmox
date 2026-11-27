/**
 * One node of the Proxmox adapter as a web component: `<iob-proxmox-node>` - the web component of the devices
 * widget "Proxmox node" (`src-devices/src/ProxmoxNodeComponent.tsx`).
 *
 * The setting `node` is the channel of the node, e.g. `proxmox.0.node_pve`. The updates exist only with the option
 * "Request available updates" of the adapter. The button writes `true` to `<channel>.updates.refresh`; the adapter
 * runs `apt-get update` on the node, reads the updates again and confirms the button with `ack`.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import type { JSX } from 'react';
import { defineWebComponent } from '@iobroker/web-components/element';

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
} from '../../src-shared/proxmox.ts';
import { NODE_TAG, type NodeSettings } from './constants.ts';
import type { WordKey } from './i18n.ts';
import { Button, Head, Hint, Pill, UsageBar } from './parts.tsx';
import { ProxmoxElement } from './ProxmoxElement.tsx';

class ProxmoxNodeElement extends ProxmoxElement<NodeSettings> {
    /** While refreshing: `ts` of the button state at the click. A newer state with `ack` ends it */
    #refreshing: { before: number | null; channelId: string } | null = null;

    #refreshTimer: ReturnType<typeof setTimeout> | null = null;

    /** The button could not be written; the channel it happened on */
    #failedFor = '';

    protected getChannelOf(settings: NodeSettings): string {
        return settings.node?.trim() || '';
    }

    protected getStateNames(): string[] {
        return NODE_STATES;
    }

    protected getChannelTypes(): string[] {
        return NODE_TYPES;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.#clearRefresh();
    }

    #clearRefresh(): void {
        if (this.#refreshTimer) {
            clearTimeout(this.#refreshTimer);
            this.#refreshTimer = null;
        }
        this.#refreshing = null;
    }

    #getUpdatesMode(): UpdatesMode {
        const mode = this.settings.updates;
        return mode === 'show' || mode === 'hidden' ? mode : 'control';
    }

    #refresh(): void {
        const channelId = this.getChannelId();
        if (this.editMode || !channelId) {
            return;
        }
        this.#clearRefresh();
        this.#refreshing = { before: this.getChannelState(REFRESH_STATE)?.ts ?? null, channelId };
        this.#failedFor = '';
        // if the adapter does not confirm the button, it is released again
        this.#refreshTimer = setTimeout(() => {
            this.#refreshTimer = null;
            this.#refreshing = null;
            this.render();
        }, REFRESH_TIMEOUT_MS);
        this.render();
        this.setState(`${channelId}.${REFRESH_STATE}`, true).catch(() => {
            this.#clearRefresh();
            this.#failedFor = channelId;
            this.render();
        });
    }

    /** The number of updates, with the packages in the tooltip. Nothing while the adapter does not read them */
    #renderUpdates(count: number): JSX.Element {
        if (count <= 0) {
            return (
                <Pill
                    kind="success"
                    icon="upToDate"
                    label={this.word('proxmox_up_to_date')}
                />
            );
        }
        const list = parseUpdateList(this.stateValue('updates.list'));
        const lines = list.slice(0, MAX_LISTED).map(formatUpdate);
        if (list.length > MAX_LISTED) {
            lines.push(this.word('proxmox_more_updates', String(list.length - MAX_LISTED)));
        }
        return (
            <Pill
                kind="warning"
                icon="update"
                label={
                    count === 1
                        ? this.word('proxmox_update_available')
                        : this.word('proxmox_updates_available', String(count))
                }
                title={lines.join('\n')}
            />
        );
    }

    protected override render(): void {
        const check = this.checkChannel();
        if (check === 'missing' || check === 'wrong') {
            this.root.render(
                <Hint
                    text={this.word(check === 'missing' ? 'proxmox_no_node' : 'proxmox_not_node')}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        const settings = this.settings;
        const channelId = this.getChannelId();
        const refreshState = this.getChannelState(REFRESH_STATE);
        const refreshing = this.#refreshing;
        if (
            refreshing &&
            (refreshing.channelId !== channelId || (refreshState?.ack && refreshState.ts !== refreshing.before))
        ) {
            this.#clearRefresh();
        }

        const status = this.getStatus();
        const mode = this.#getUpdatesMode();
        const count = this.stateValue('updates.count');
        const showUpdates = mode !== 'hidden' && typeof count === 'number';
        const statusLabel = KNOWN_NODE_STATUS.includes(status)
            ? this.word(`proxmox_status_${status}` as WordKey)
            : status || this.word('proxmox_unknown');
        const cpu = this.stateValue('cpu');
        const cpuMax = this.stateValue('cpu_max');
        const usedLevel = this.stateValue('memory.used_lev');
        const busy = !!this.#refreshing;

        this.root.render(
            <div className={this.editMode ? 'card edit' : 'card'}>
                <Head
                    type="node"
                    kind={this.getStatusKind()}
                    name={this.getDisplayName()}
                    typeName={getTypeName('node')}
                    uptime={settings.showUptime === false ? '' : formatUptime(this.stateValue('uptime'))}
                    uptimeLabel={this.word('proxmox_uptime')}
                    status={
                        <Pill
                            kind={this.getStatusKind()}
                            label={statusLabel}
                        />
                    }
                />
                {settings.showDetails !== false ? (
                    <div className="bars">
                        <UsageBar
                            label={typeof cpuMax === 'number' && cpuMax > 0 ? `${cpuMax} CPU` : 'CPU'}
                            percent={typeof cpu === 'number' ? cpu : undefined}
                            text={typeof cpu === 'number' ? `${cpu} %` : '–'}
                        />
                        <UsageBar
                            label="RAM"
                            percent={typeof usedLevel === 'number' ? usedLevel : undefined}
                            text={formatMemory(this.stateValue('memory.used'), this.stateValue('memory.total'), usedLevel)}
                        />
                    </div>
                ) : null}
                {this.#failedFor === channelId && channelId ? (
                    <div className="failed">{this.word('proxmox_command_failed')}</div>
                ) : null}
                {showUpdates ? (
                    <div className="actions">
                        {this.#renderUpdates(count)}
                        {mode === 'control' ? (
                            <span className="push">
                                <Button
                                    className="outlined"
                                    icon="refresh"
                                    label={this.word(busy ? 'proxmox_refreshing' : 'proxmox_refresh')}
                                    title={this.word(busy ? 'proxmox_refreshing' : 'proxmox_refresh_help')}
                                    disabled={busy || this.editMode || status !== 'online'}
                                    onClick={() => this.#refresh()}
                                />
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>,
        );
    }
}

defineWebComponent(NODE_TAG, ProxmoxNodeElement);
