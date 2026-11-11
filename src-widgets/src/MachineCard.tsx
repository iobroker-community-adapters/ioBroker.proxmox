/**
 * Shows the state of one VM or container and optionally starts and stops it.
 *
 * It only works on the states of the machine: the commands are the button states of the adapter, so
 * they behave like every other way to press them.
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    LinearProgress,
    Tooltip,
    Typography,
} from '@mui/material';
import { PlayArrow, Schedule, Stop } from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';

import { MachineIcon } from './MachineIcon';

export type StopCommand = 'shutdown' | 'stop';

type Command = 'start' | StopCommand;

interface MachineCardProps {
    socket: Connection;
    /** Full ID of the channel, for example `proxmox.0.qemu_web` */
    machineId: string;
    title?: string;
    showControls: boolean;
    showDetails: boolean;
    showUptime: boolean;
    showIcon: boolean;
    /** Result of the icon selector of vis-2 */
    icon?: string;
    /** URL of an image, it takes precedence over the icon */
    image?: string;
    stopCommand: StopCommand;
    askConfirmation: boolean;
    /** In the editor of vis-2 a click selects the widget, it must not stop a machine */
    readOnly: boolean;
}

/** The status a command leads to */
const TARGET_STATUS: Record<Command, string> = { start: 'running', shutdown: 'stopped', stop: 'stopped' };

/**
 * If the status does not change, the controls are released again after this time. A failed command is
 * only logged by the adapter, and a clean shutdown can take a while.
 */
const PENDING_TIMEOUT_MS = 60000;

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    running: 'success',
    paused: 'warning',
    suspended: 'warning',
    offline: 'error',
};

/** The same colors as the chip, as the background of the symbol */
const AVATAR_COLORS: Record<string, string> = {
    running: '#2e7d32',
    stopped: '#757575',
    paused: '#ed6c02',
    suspended: '#ed6c02',
    offline: '#d32f2f',
};

const AVATAR_UNKNOWN = '#9e9e9e';

const KNOWN_STATUS = ['running', 'stopped', 'paused', 'suspended', 'offline'];

const STATE_NAMES = ['status', 'cpu', 'cpus', 'mem', 'maxmem', 'mem_lev', 'uptime'];

const MIB_PER_GIB = 1024;

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

/**
 * @param mib size in MiB
 * @returns for example `4 GiB`
 */
export function formatSize(mib: number): string {
    return mib < MIB_PER_GIB ? `${mib} MiB` : `${Math.round((mib / MIB_PER_GIB) * 10) / 10} GiB`;
}

/**
 * @param socket connection of vis-2
 * @param machineId full ID of the channel
 * @returns the current values of the states of the machine, by state name
 */
function useMachineStates(socket: Connection, machineId: string): Record<string, ioBroker.StateValue> {
    const [values, setValues] = useState<Record<string, ioBroker.StateValue>>({});

    const ids = useMemo(() => STATE_NAMES.map(name => `${machineId}.${name}`), [machineId]);

    useEffect(() => {
        let alive = true;
        const onChange = (id: string, state: ioBroker.State | null | undefined): void => {
            if (alive) {
                const name = id.substring(machineId.length + 1);
                const value = state ? state.val : null;
                setValues(old => (old[name] === value ? old : { ...old, [name]: value }));
            }
        };

        // Another machine must not be shown with the values of the old one
        setValues({});
        void socket.subscribeState(ids, onChange);

        return () => {
            alive = false;
            socket.unsubscribeState(ids, onChange);
        };
    }, [socket, machineId, ids]);

    return values;
}

/**
 * @param socket connection of vis-2
 * @param machineId full ID of the channel
 * @returns the name and the type of the machine. Until it is known, the name is the last part of the ID.
 */
export function useMachine(socket: Connection, machineId: string): { name: string; type: string } {
    const [machine, setMachine] = useState({ name: '', type: '' });

    useEffect(() => {
        let alive = true;
        setMachine({ name: '', type: '' });
        socket
            .getObject(machineId)
            .then(obj => {
                const common = obj?.common?.name;
                if (alive) {
                    setMachine({
                        name: typeof common === 'object' ? common[I18n.getLanguage()] || common.en : common || '',
                        type: typeof obj?.native?.type === 'string' ? obj.native.type : '',
                    });
                }
            })
            .catch(() => {
                // The ID of the machine stays as its name
            });
        return () => {
            alive = false;
        };
    }, [socket, machineId]);

    return { name: machine.name || machineId.split('.').pop() || machineId, type: machine.type };
}

/**
 * A usage as a bar, in the color of how full it is.
 *
 * @param props properties
 * @param props.label name of the value
 * @param props.percent usage in percent, if known
 * @param props.text the value as text
 */
export function UsageBar({
    label,
    percent,
    text,
}: {
    label: string;
    percent: number | undefined;
    text: string;
}): React.JSX.Element {
    const value = percent ?? 0;
    return (
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
                <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                >
                    {label}
                </Typography>
                <Typography
                    variant="caption"
                    noWrap
                    title={text}
                    sx={{ color: 'text.secondary' }}
                >
                    {text}
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={Math.min(value, 100)}
                // Without load, for example on a stopped machine, the bar stays grey
                color={value <= 0 ? 'inherit' : value > 90 ? 'error' : value > 75 ? 'warning' : 'success'}
                sx={{ height: 5, borderRadius: 1, color: value <= 0 ? 'text.disabled' : undefined }}
            />
        </Box>
    );
}

export function MachineCard(props: MachineCardProps): React.JSX.Element {
    const { socket, machineId, title, showControls, showDetails, showUptime, showIcon, icon, image } = props;
    const { stopCommand, askConfirmation, readOnly } = props;

    const values = useMachineStates(socket, machineId);
    const machine = useMachine(socket, machineId);
    const name = title || machine.name;
    const status = typeof values.status === 'string' ? values.status : '';
    const uptime = formatUptime(values.uptime);

    const [pending, setPending] = useState<Command | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState(false);

    // Another machine has nothing in progress
    useEffect(() => {
        setPending(null);
        setConfirming(false);
        setError(false);
    }, [machineId]);

    useEffect(() => {
        if (!pending) {
            return;
        }
        if (status === TARGET_STATUS[pending]) {
            setPending(null);
            return;
        }
        const timer = setTimeout(() => setPending(null), PENDING_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [pending, status]);

    const send = (command: Command): void => {
        setConfirming(false);
        setError(false);
        setPending(command);
        socket.setState(`${machineId}.${command}`, true, false).catch(() => {
            setPending(null);
            setError(true);
        });
    };

    const canStart = !readOnly && !pending && status === 'stopped';
    const canStop = !readOnly && !pending && (status === 'running' || status === 'paused' || status === 'suspended');

    const statusLabel = KNOWN_STATUS.includes(status)
        ? I18n.t(`proxmox_status_${status}`)
        : status || I18n.t('proxmox_unknown');

    const typeName = machine.type === 'lxc' ? 'LXC' : machine.type === 'qemu' ? 'QEMU' : '';
    const cpuText = typeof values.cpu === 'number' ? `${values.cpu} %` : '–';
    const memoryText =
        typeof values.mem === 'number' && typeof values.maxmem === 'number' && values.maxmem > 0
            ? `${formatSize(values.mem)} / ${formatSize(values.maxmem)}`
            : typeof values.mem_lev === 'number'
              ? `${values.mem_lev} %`
              : '–';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', height: '100%', minHeight: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {showIcon ? (
                    <MachineIcon
                        type={machine.type}
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
                            {typeName}
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
                    label={pending ? I18n.t('proxmox_in_progress') : statusLabel}
                    color={pending ? 'info' : STATUS_COLORS[status] || 'default'}
                />
            </Box>

            {showDetails ? (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <UsageBar
                        label={typeof values.cpus === 'number' && values.cpus > 0 ? `${values.cpus} vCPU` : 'CPU'}
                        percent={typeof values.cpu === 'number' ? values.cpu : undefined}
                        text={cpuText}
                    />
                    <UsageBar
                        label="RAM"
                        percent={typeof values.mem_lev === 'number' ? values.mem_lev : undefined}
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

            {showControls ? (
                <Box sx={{ display: 'flex', gap: 1, marginTop: 'auto' }}>
                    <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={<PlayArrow />}
                        disabled={!canStart}
                        onClick={() => send('start')}
                    >
                        {I18n.t('proxmox_start')}
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        color={stopCommand === 'stop' ? 'error' : 'primary'}
                        startIcon={<Stop />}
                        disabled={!canStop}
                        onClick={() => (askConfirmation ? setConfirming(true) : send(stopCommand))}
                    >
                        {I18n.t('proxmox_stop')}
                    </Button>
                </Box>
            ) : null}

            {confirming ? (
                <Dialog
                    open
                    onClose={() => setConfirming(false)}
                >
                    <DialogContent>
                        <DialogContentText>
                            {I18n.t(stopCommand === 'stop' ? 'proxmox_confirm_hard' : 'proxmox_confirm_shutdown', name)}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color="inherit"
                            onClick={() => setConfirming(false)}
                        >
                            {I18n.t('proxmox_cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            color={stopCommand === 'stop' ? 'error' : 'primary'}
                            onClick={() => send(stopCommand)}
                        >
                            {I18n.t('proxmox_stop')}
                        </Button>
                    </DialogActions>
                </Dialog>
            ) : null}
        </Box>
    );
}
