/**
 * One VM or container of the Proxmox adapter as a web component: `<iob-proxmox-machine>` - the web component of
 * the devices widget "Proxmox VM or container" (`src-devices/src/ProxmoxMachineComponent.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). The host sets `socket` and
 * `settings`, and if it has them `theme`, `editMode` and `dialogs`. The setting `machine` is the channel of the
 * machine, e.g. `proxmox.0.lxc_web`. A command writes `true` to `<channel>.start`, `.shutdown` or `.stop`; the
 * status comes with the next poll of the adapter.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { defineWebComponent } from '@iobroker/web-components/element';

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
} from '../../src-shared/proxmox.ts';
import { MACHINE_TAG, type MachineSettings } from './constants.ts';
import type { WordKey } from './i18n.ts';
import { Button, Head, Hint, Pill, UsageBar } from './parts.tsx';
import { ProxmoxElement } from './ProxmoxElement.tsx';

class ProxmoxMachineElement extends ProxmoxElement<MachineSettings> {
    /** The command sent last, until the status it leads to arrives */
    #pending: Command | null = null;

    #pendingTimer: ReturnType<typeof setTimeout> | null = null;

    /** The channel `#pending` belongs to: another machine has nothing in progress */
    #pendingFor = '';

    /** The command could not be written */
    #failed = false;

    protected getChannelOf(settings: MachineSettings): string {
        return settings.machine?.trim() || '';
    }

    protected getStateNames(): string[] {
        return MACHINE_STATES;
    }

    protected getChannelTypes(): string[] {
        return MACHINE_TYPES;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.#clearPending();
    }

    #clearPending(): void {
        if (this.#pendingTimer) {
            clearTimeout(this.#pendingTimer);
            this.#pendingTimer = null;
        }
        this.#pending = null;
    }

    #getStopCommand(): StopCommand {
        return this.settings.stopCommand === 'stop' ? 'stop' : 'shutdown';
    }

    #send(command: Command): void {
        const channelId = this.getChannelId();
        if (this.editMode || !channelId) {
            return;
        }
        this.#clearPending();
        this.#pending = command;
        this.#pendingFor = channelId;
        this.#failed = false;
        // if the status does not change, the buttons are released again
        this.#pendingTimer = setTimeout(() => {
            this.#pendingTimer = null;
            this.#pending = null;
            this.render();
        }, PENDING_TIMEOUT_MS);
        this.render();
        this.setState(`${channelId}.${command}`, true).catch(() => {
            this.#clearPending();
            this.#failed = true;
            this.render();
        });
    }

    async #stop(): Promise<void> {
        const command = this.#getStopCommand();
        if (this.settings.askConfirmation !== false) {
            const word: WordKey = command === 'stop' ? 'proxmox_confirm_hard' : 'proxmox_confirm_shutdown';
            if (!(await this.confirm(this.word(word, this.getDisplayName())))) {
                return;
            }
        }
        this.#send(command);
    }

    protected override render(): void {
        const check = this.checkChannel();
        if (check === 'missing' || check === 'wrong') {
            this.root.render(
                <Hint
                    text={this.word(check === 'missing' ? 'proxmox_no_machine' : 'proxmox_not_machine')}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        const settings = this.settings;
        const channelId = this.getChannelId();
        const status = this.getStatus();
        if (this.#pending && (this.#pendingFor !== channelId || status === TARGET_STATUS[this.#pending])) {
            this.#clearPending();
        }
        if (this.#pendingFor !== channelId) {
            this.#failed = false;
            this.#pendingFor = channelId;
        }

        const pending = this.#pending;
        const type = this.getChannelType();
        const stopCommand = this.#getStopCommand();
        const showControls = settings.showControls !== false;
        const blocked = !!pending || this.editMode;
        const statusLabel = pending
            ? this.word('proxmox_in_progress')
            : KNOWN_MACHINE_STATUS.includes(status)
              ? this.word(`proxmox_status_${status}` as WordKey)
              : status || this.word('proxmox_unknown');
        const cpu = this.stateValue('cpu');
        const cpus = this.stateValue('cpus');
        const memLevel = this.stateValue('mem_lev');

        this.root.render(
            <div className={this.editMode ? 'card edit' : 'card'}>
                <Head
                    type={type}
                    kind={pending ? 'unknown' : this.getStatusKind()}
                    name={this.getDisplayName()}
                    typeName={getTypeName(type)}
                    uptime={settings.showUptime === false ? '' : formatUptime(this.stateValue('uptime'))}
                    uptimeLabel={this.word('proxmox_uptime')}
                    status={
                        <Pill
                            kind={pending ? 'unknown' : this.getStatusKind()}
                            label={statusLabel}
                        />
                    }
                />
                {settings.showDetails !== false ? (
                    <div className="bars">
                        <UsageBar
                            label={typeof cpus === 'number' && cpus > 0 ? `${cpus} vCPU` : 'CPU'}
                            percent={typeof cpu === 'number' ? cpu : undefined}
                            text={typeof cpu === 'number' ? `${cpu} %` : '–'}
                        />
                        <UsageBar
                            label="RAM"
                            percent={typeof memLevel === 'number' ? memLevel : undefined}
                            text={formatMemory(this.stateValue('mem'), this.stateValue('maxmem'), memLevel)}
                        />
                    </div>
                ) : null}
                {this.#failed ? <div className="failed">{this.word('proxmox_command_failed')}</div> : null}
                {showControls ? (
                    <div className="actions">
                        <Button
                            className="start"
                            icon="start"
                            label={this.word('proxmox_start')}
                            disabled={blocked || !canStart(status)}
                            onClick={() => this.#send('start')}
                        />
                        <Button
                            className={stopCommand === 'stop' ? 'hard' : undefined}
                            icon="stop"
                            label={this.word('proxmox_stop')}
                            title={this.word(stopCommand === 'stop' ? 'proxmox_stop_hard' : 'proxmox_stop_shutdown')}
                            disabled={blocked || !canStop(status)}
                            onClick={() => void this.#stop()}
                        />
                    </div>
                ) : null}
            </div>,
        );
    }
}

defineWebComponent(MACHINE_TAG, ProxmoxMachineElement);
