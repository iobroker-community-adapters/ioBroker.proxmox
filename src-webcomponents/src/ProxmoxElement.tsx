/**
 * The base of both web components: one channel of the adapter (`proxmox.0.lxc_web`, `proxmox.0.node_pve`), named
 * by a setting. `IobWebComponent` subscribes to the states below it and keeps the channel object up to date, for
 * its name and its type; React renders into the shadow root.
 *
 * Commands are button states of the adapter (ack=false), so the components need no `sendTo` handler.
 */
import { createRoot, type Root } from 'react-dom/client';
import { IobWebComponent } from '@iobroker/web-components/element';

import { getChannelType, getStatusKind, type StatusKind } from '../../src-shared/proxmox.ts';
import type { CommonSettings } from './constants.ts';
import { getWord, type WordKey } from './i18n.ts';
import { STYLES } from './styles.ts';

/** Whether the setting names a channel of the expected kind */
export type ChannelCheck = 'missing' | 'reading' | 'wrong' | 'ok';

export abstract class ProxmoxElement<TSettings extends CommonSettings> extends IobWebComponent<TSettings> {
    protected readonly root: Root;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.root = createRoot(mount);
    }

    /**
     * @param settings the values of the settings
     * @returns the ID of the channel, empty if none is chosen
     */
    protected abstract getChannelOf(settings: TSettings): string;

    /** @returns the names of the states below the channel */
    protected abstract getStateNames(): string[];

    /** @returns the `native.type` values of the channels this component shows */
    protected abstract getChannelTypes(): string[];

    /** The channel object, for its name and its type */
    protected override getObjectIds(settings: TSettings): string[] {
        const channelId = this.getChannelOf(settings);
        return channelId ? [channelId] : [];
    }

    protected override getStateIds(settings: TSettings): string[] {
        const channelId = this.getChannelOf(settings);
        return channelId ? this.getStateNames().map(name => `${channelId}.${name}`) : [];
    }

    /** @returns the ID of the channel of the current settings */
    protected getChannelId(): string {
        return this.getChannelOf(this.settings);
    }

    /**
     * @param key the word
     * @param args put in for `%s`
     * @returns the word in the language of the system
     */
    protected word(key: WordKey, ...args: string[]): string {
        return getWord(this.systemLang, key, ...args);
    }

    /**
     * @param name name of the state below the channel
     * @returns the state, null while it has none
     */
    protected getChannelState(name: string): ioBroker.State | null {
        return this.states[`${this.getChannelId()}.${name}`] ?? null;
    }

    /**
     * @param name name of the state below the channel
     * @returns its value, `undefined` while it has none
     */
    protected stateValue(name: string): ioBroker.StateValue | undefined {
        return this.getChannelState(name)?.val;
    }

    /** @returns the value of `status`, empty while it is not known */
    protected getStatus(): string {
        const status = this.stateValue('status');
        return typeof status === 'string' ? status : '';
    }

    /** @returns the color group of the status */
    protected getStatusKind(): StatusKind {
        return getStatusKind(this.getStatus());
    }

    /** @returns `native.type` of the channel, empty while it is read or if it is no channel of the adapter */
    protected getChannelType(): string {
        return getChannelType(this.objects[this.getChannelId()]);
    }

    /** @returns whether the setting names a channel of this component */
    protected checkChannel(): ChannelCheck {
        const channelId = this.getChannelId();
        if (!channelId) {
            return 'missing';
        }
        const obj = this.objects[channelId];
        if (obj === undefined) {
            return 'reading';
        }
        return this.getChannelTypes().includes(getChannelType(obj)) ? 'ok' : 'wrong';
    }

    /** @returns the name of the settings, else the name of the channel, else the last part of its ID */
    protected getDisplayName(): string {
        const channelId = this.getChannelId();
        return (
            this.settings.name?.trim() ||
            this.text(this.objects[channelId]?.common?.name) ||
            channelId.split('.').pop() ||
            ''
        );
    }

    /**
     * Asks before a command.
     *
     * @param text the question
     * @returns whether the user confirmed it
     */
    protected async confirm(text: string): Promise<boolean> {
        const result = await this.openDialog({
            title: this.getDisplayName(),
            form: { type: 'panel', items: { question: { type: 'staticText', text } } },
        });
        return result !== null;
    }
}
