/**
 * Shows the state of one Proxmox node and its available updates.
 *
 * Like the machine card it only works on the states of the adapter: the refresh button is the button
 * state `updates.refresh`, which runs `apt-get update` on the node and reads the updates again. The
 * adapter confirms it with `ack` when it is done.
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import { CheckCircle, Refresh, Schedule, SystemUpdateAlt } from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';

import { formatSize, formatUptime, useMachine, UsageBar } from './MachineCard';
import { MachineIcon } from './MachineIcon';

/** How the updates appear: with the refresh button, only the indicator, or not at all */
export type UpdatesMode = 'control' | 'show' | 'hidden';

interface NodeCardProps {
    socket: Connection;
    /** Full ID of the channel, for example `proxmox.0.node_pve` */
    nodeId: string;
    title?: string;
    updates: UpdatesMode;
    showDetails: boolean;
    showUptime: boolean;
    showIcon: boolean;
    /** Result of the icon selector of vis-2 */
    icon?: string;
    /** URL of an image, it takes precedence over the icon */
    image?: string;
    /** In the editor of vis-2 a click selects the widget, it must not start anything */
    readOnly: boolean;
}

/**
 * If the adapter does not confirm the button, it is released again after this time. The adapter waits up
 * to 2 minutes for `apt-get update`.
 */
const REFRESH_TIMEOUT_MS = 150000;

/** At most this many packages are listed in the tooltip */
const MAX_LISTED = 15;

const STATUS_COLORS: Record<string, 'success' | 'error'> = { online: 'success', offline: 'error' };

const AVATAR_COLORS: Record<string, string> = { online: '#2e7d32', offline: '#d32f2f' };

const AVATAR_UNKNOWN = '#9e9e9e';

const STATE_NAMES = [
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

/** An entry of `updates.list` */
interface UpdateEntry {
    package?: string;
    oldVersion?: string;
    version?: string;
}

/**
 * @param value value of `updates.list`
 * @returns the updates, empty if the value is not a list
 */
function parseList(value: ioBroker.StateValue | undefined): UpdateEntry[] {
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
 * @param socket connection of vis-2
 * @param nodeId full ID of the channel
 * @returns the current states of the node, by state name. The whole state, the button needs its `ack`.
 */
function useNodeStates(socket: Connection, nodeId: string): Record<string, ioBroker.State | null> {
    const [states, setStates] = useState<Record<string, ioBroker.State | null>>({});

    const ids = useMemo(() => STATE_NAMES.map(name => `${nodeId}.${name}`), [nodeId]);

    useEffect(() => {
        let alive = true;
        const onChange = (id: string, state: ioBroker.State | null | undefined): void => {
            if (alive) {
                const name = id.substring(nodeId.length + 1);
                setStates(old => ({ ...old, [name]: state ?? null }));
            }
        };

        // Another node must not be shown with the values of the old one
        setStates({});
        void socket.subscribeState(ids, onChange);

        return () => {
            alive = false;
            socket.unsubscribeState(ids, onChange);
        };
    }, [socket, nodeId, ids]);

    return states;
}

/**
 * The packages in the tooltip of the indicator.
 *
 * @param props properties
 * @param props.list the updates
 */
function UpdateList({ list }: { list: UpdateEntry[] }): React.JSX.Element {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {list.slice(0, MAX_LISTED).map((entry, i) => (
                <Typography
                    key={entry.package || i}
                    variant="caption"
                    noWrap
                >
                    {entry.package}
                    {entry.version ? ` ${entry.oldVersion ? `${entry.oldVersion} → ` : ''}${entry.version}` : ''}
                </Typography>
            ))}
            {list.length > MAX_LISTED ? (
                <Typography variant="caption">
                    {I18n.t('proxmox_more_updates', String(list.length - MAX_LISTED))}
                </Typography>
            ) : null}
        </Box>
    );
}

export function NodeCard(props: NodeCardProps): React.JSX.Element {
    const { socket, nodeId, title, updates, showDetails, showUptime, showIcon, icon, image, readOnly } = props;

    const states = useNodeStates(socket, nodeId);
    const node = useMachine(socket, nodeId);
    const name = title || node.name;
    const val = (stateName: string): ioBroker.StateValue | undefined => states[stateName]?.val;

    const status = typeof val('status') === 'string' ? (val('status') as string) : '';
    const uptime = formatUptime(val('uptime'));
    const count = val('updates.count');
    const listValue = val('updates.list');
    const list = useMemo(() => parseList(listValue), [listValue]);
    const refreshState = states['updates.refresh'];

    /** While refreshing: the state of the button at the click, a newer one with `ack` ends it */
    const [pending, setPending] = useState<{ before: ioBroker.State | null | undefined } | null>(null);
    const [error, setError] = useState(false);

    // Another node has nothing in progress
    useEffect(() => {
        setPending(null);
        setError(false);
    }, [nodeId]);

    useEffect(() => {
        if (pending && refreshState !== pending.before && refreshState?.ack) {
            setPending(null);
        }
    }, [pending, refreshState]);

    useEffect(() => {
        if (!pending) {
            return;
        }
        const timer = setTimeout(() => setPending(null), REFRESH_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [pending]);

    const refresh = (): void => {
        setError(false);
        setPending({ before: refreshState });
        socket.setState(`${nodeId}.updates.refresh`, true, false).catch(() => {
            setPending(null);
            setError(true);
        });
    };

    const statusLabel =
        status === 'online' || status === 'offline'
            ? I18n.t(`proxmox_status_${status}`)
            : status || I18n.t('proxmox_unknown');

    const cpuMax = val('cpu_max');
    const cpu = val('cpu');
    const usedLevel = val('memory.used_lev');
    const used = val('memory.used');
    const total = val('memory.total');
    const memoryText =
        typeof used === 'number' && typeof total === 'number' && total > 0
            ? `${formatSize(used)} / ${formatSize(total)}`
            : typeof usedLevel === 'number'
              ? `${usedLevel} %`
              : '–';

    const hasUpdates = typeof count === 'number' && count > 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', height: '100%', minHeight: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {showIcon ? (
                    <MachineIcon
                        type="node"
                        color={AVATAR_COLORS[status] || AVATAR_UNKNOWN}
                        icon={icon}
                        image={image}
                    />
                ) : null}
                <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        noWrap
                        title={name}
                        sx={{ fontWeight: 500, lineHeight: 1.3 }}
                    >
                        {name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', minHeight: 18 }}>
                        <Typography
                            variant="caption"
                            noWrap
                        >
                            Proxmox VE
                        </Typography>
                        {showUptime && uptime ? (
                            <Tooltip title={I18n.t('proxmox_uptime')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, marginLeft: 0.5 }}>
                                    <Schedule sx={{ fontSize: 14 }} />
                                    <Typography
                                        variant="caption"
                                        noWrap
                                    >
                                        {uptime}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        ) : null}
                    </Box>
                </Box>
                <Chip
                    size="small"
                    label={statusLabel}
                    color={STATUS_COLORS[status] || 'default'}
                />
            </Box>

            {showDetails ? (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <UsageBar
                        label={typeof cpuMax === 'number' && cpuMax > 0 ? `${cpuMax} CPU` : 'CPU'}
                        percent={typeof cpu === 'number' ? cpu : undefined}
                        text={typeof cpu === 'number' ? `${cpu} %` : '–'}
                    />
                    <UsageBar
                        label="RAM"
                        percent={typeof usedLevel === 'number' ? usedLevel : undefined}
                        text={memoryText}
                    />
                </Box>
            ) : null}

            {error ? (
                <Typography
                    variant="caption"
                    sx={{ color: 'error.main' }}
                >
                    {I18n.t('proxmox_command_failed')}
                </Typography>
            ) : null}

            {updates !== 'hidden' && typeof count === 'number' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 'auto' }}>
                    <Tooltip title={hasUpdates && list.length ? <UpdateList list={list} /> : ''}>
                        <Chip
                            size="small"
                            variant="outlined"
                            icon={hasUpdates ? <SystemUpdateAlt /> : <CheckCircle />}
                            color={hasUpdates ? 'warning' : 'success'}
                            label={
                                !hasUpdates
                                    ? I18n.t('proxmox_up_to_date')
                                    : count === 1
                                      ? I18n.t('proxmox_update_available')
                                      : I18n.t('proxmox_updates_available', String(count))
                            }
                        />
                    </Tooltip>
                    {updates === 'control' ? (
                        <Tooltip title={I18n.t('proxmox_refresh_help')}>
                            <span style={{ marginLeft: 'auto' }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Refresh />}
                                    disabled={readOnly || !!pending || status !== 'online'}
                                    onClick={refresh}
                                >
                                    {I18n.t(pending ? 'proxmox_refreshing' : 'proxmox_refresh')}
                                </Button>
                            </span>
                        </Tooltip>
                    ) : null}
                </Box>
            ) : null}

            {updates !== 'hidden' && typeof count !== 'number' && readOnly ? (
                // Only in the editor: the option is off in the adapter, so there is nothing to show
                <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', marginTop: 'auto' }}
                >
                    {I18n.t('proxmox_updates_off')}
                </Typography>
            ) : null}
        </Box>
    );
}
