/**
 * The base of both widgets: one channel of the adapter (`proxmox.0.lxc_web`, `proxmox.0.node_pve`), chosen in
 * the settings. It reads the channel object for the name and the type and subscribes to the states below it.
 *
 * Commands are button states of the adapter, written with ack=false, so the widgets need no `sendTo` handler.
 */
import type React from 'react';
import WidgetGeneric, {
    getTileStyles,
    isNeumorphicTheme,
    type CustomWidgetPlugin,
    type WidgetGenericProps,
    type WidgetGenericState,
} from '@iobroker/dm-widgets';

import { getChannelType, getStatusKind, type StatusKind } from '../../src-shared/proxmox';
import { Box } from './parts';

/** `name` of the base settings is shown instead of the name of the channel */
export interface ChannelSettings extends CustomWidgetPlugin {
    /** Only for the list of the channel in the settings, e.g. `proxmox.0`. The channel ID already holds it */
    instance?: string;
    showUptime?: boolean;
}

export interface ChannelState extends WidgetGenericState {
    /** The states below the channel by their name (`status`, `memory.used`), whole: a button needs its `ack` */
    channelStates: Record<string, ioBroker.State | null>;
    /** Name of the channel object, empty until it is read */
    channelName: string;
    /** `native.type` of the channel, empty if it is no channel of a machine or node, null while it is read */
    channelType: string | null;
}

/** The layout of a size: 1x1, 2x0.5 and 2x1 */
export type TileSize = 'compact' | 'wide' | 'wideTall';

type StateListener = (id: string, state: ioBroker.State | null | undefined) => void;

export abstract class ProxmoxWidget<
    TState extends ChannelState,
    TSettings extends ChannelSettings,
> extends WidgetGeneric<TState, TSettings> {
    private subscribed: { id: string; handler: StateListener }[] = [];

    /**
     * Counts the subscriptions (mount, every change of the channel) and is advanced on unmount, too. Only the
     * latest one takes values, so a late answer for the channel before is dropped.
     */
    private round = 0;

    /** The channel the latest round subscribed for, `undefined` before the first one */
    private subscribedFor: string | undefined;

    protected constructor(props: WidgetGenericProps<TSettings>) {
        super(props);
        this.state = {
            ...this.state,
            channelStates: {},
            channelName: '',
            channelType: null,
        };
    }

    /** @returns the ID of the chosen channel, empty if none is chosen */
    protected abstract getChannelId(): string;

    /** @returns the names of the states below the channel */
    protected abstract getStateNames(): string[];

    /** Called when another channel is chosen: nothing of the one before is in progress anymore */
    protected abstract onChannelChange(): void;

    /**
     * Called for every state that arrives for the current channel, before it is stored.
     *
     * @param _name name of the state below the channel
     * @param _state the state
     */
    protected onChannelState(_name: string, _state: ioBroker.State | null): void {
        // for the subclasses
    }

    componentDidMount(): void {
        super.componentDidMount?.();
        this.resubscribe();
    }

    componentDidUpdate(prevProps: Readonly<WidgetGenericProps<TSettings>>, prevState: Readonly<TState>): void {
        super.componentDidUpdate?.(prevProps, prevState);
        // compared with what was subscribed, not with prevProps: that also catches settings changed in place
        if (this.getChannelId() !== this.subscribedFor) {
            this.resubscribe();
        }
    }

    componentWillUnmount(): void {
        super.componentWillUnmount?.();
        this.round++;
        this.unsubscribe();
    }

    /** Sets a part of the state; the generic `TState` keeps `setState` from taking it directly */
    protected patch(update: Partial<ChannelState> | ((old: TState) => Partial<ChannelState>)): void {
        this.setState(update as unknown as TState);
    }

    private resubscribe(): void {
        this.unsubscribe();
        const round = ++this.round;
        const channelId = this.getChannelId();
        this.subscribedFor = channelId;
        // another channel must not be shown with the values of the one before
        this.patch({ channelStates: {}, channelName: '', channelType: channelId ? null : '' });
        this.onChannelChange();
        if (!channelId) {
            return;
        }

        const ctx = this.props.stateContext;
        ctx.getObject<ioBroker.Object>(channelId)
            .then(obj => {
                if (round === this.round) {
                    this.patch({
                        channelName: obj?.common?.name ? this.getText(obj.common.name) : '',
                        channelType: getChannelType(obj),
                    });
                }
            })
            .catch(() => {
                if (round === this.round) {
                    this.patch({ channelType: '' });
                }
            });

        for (const name of this.getStateNames()) {
            const id = `${channelId}.${name}`;
            const handler: StateListener = (_id, state) => {
                if (round === this.round) {
                    this.onChannelState(name, state ?? null);
                    this.patch(old => ({ channelStates: { ...old.channelStates, [name]: state ?? null } }));
                }
            };
            ctx.getState(id, handler as (id: string, state: ioBroker.State) => void);
            this.subscribed.push({ id, handler });
        }
    }

    private unsubscribe(): void {
        const ctx = this.props.stateContext;
        for (const { id, handler } of this.subscribed) {
            ctx.removeState(id, handler as (id: string, state: ioBroker.State) => void);
        }
        this.subscribed = [];
    }

    /**
     * @param name name of the state below the channel
     * @returns its value, `undefined` while it has none
     */
    protected value(name: string): ioBroker.StateValue | undefined {
        return this.state.channelStates[name]?.val;
    }

    /** @returns the value of `status`, empty while it is not known */
    protected getStatus(): string {
        const status = this.value('status');
        return typeof status === 'string' ? status : '';
    }

    /** @returns the color group of the status */
    protected getStatusKind(): StatusKind {
        return getStatusKind(this.getStatus());
    }

    /** @returns the name of the settings, else the name of the channel, else the last part of its ID */
    protected getDisplayName(): string {
        return (
            this.props.settings.name?.trim() ||
            this.state.channelName ||
            this.getChannelId().split('.').pop() ||
            ''
        );
    }

    /**
     * The access rules of devices may allow only to read a widget. The host knows it, its class has
     * `isReadOnly`, the compile-time mirror of `@iobroker/dm-widgets` does not.
     *
     * @returns whether the widget must not write anything
     */
    protected isWriteBlocked(): boolean {
        return (this as unknown as { isReadOnly?: boolean }).isReadOnly === true;
    }

    /**
     * The frame of a size, like the widgets of devices draw it: the tile in the colors of the theme, the
     * indicators and the settings button of the host on top.
     *
     * @param size the layout
     * @param content what is in the tile
     */
    protected renderFrame(size: TileSize, content: React.JSX.Element): React.JSX.Element {
        const isActive = this.isTileActive();
        const accent = this.getAccentColor();
        const indicators = this.renderIndicators(this.renderSettingsButton());

        const tile = (
            <Box
                sx={theme => ({
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    overflow: 'hidden',
                    ...(size === 'compact'
                        ? { aspectRatio: '1', position: 'relative' }
                        : size === 'wide'
                          ? { height: 80, position: 'relative' }
                          : { position: 'absolute', inset: 0 }),
                    ...(getTileStyles(theme, isActive, accent) as object),
                    padding: isNeumorphicTheme(theme) ? '8px' : '10px',
                })}
            >
                {/* clicks on the indicators and the settings button do not reach the tile */}
                <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'contents' }}
                >
                    {indicators}
                </div>
                {content}
            </Box>
        );

        return (
            <Box
                id={String(this.props.widget.id)}
                className={this.getWidgetClass()}
                sx={theme =>
                    size === 'compact'
                        ? WidgetGeneric.getStyleCompact(theme)
                        : size === 'wide'
                          ? WidgetGeneric.getStyleWide(theme)
                          : WidgetGeneric.getStyleWideTall(theme)
                }
            >
                {size === 'wideTall' ? (
                    // as high as a tile of 1x1: one column wide and square, the tile lies above it
                    <Box sx={{ width: 'calc(50% - 6px)', aspectRatio: '1' }} />
                ) : null}
                {tile}
            </Box>
        );
    }

    /** Active is a running machine or a node online: the host draws the tile as switched on */
    protected isTileActive(): boolean {
        return this.getStatusKind() === 'success';
    }

    renderCompact(): React.JSX.Element {
        return this.renderFrame('compact', this.renderContent('compact'));
    }

    renderWide(): React.JSX.Element {
        return this.renderFrame('wide', this.renderContent('wide'));
    }

    renderWideTall(): React.JSX.Element {
        return this.renderFrame('wideTall', this.renderContent('wideTall'));
    }

    /**
     * @param size the layout
     * @returns the content of the tile
     */
    protected abstract renderContent(size: TileSize): React.JSX.Element;
}
