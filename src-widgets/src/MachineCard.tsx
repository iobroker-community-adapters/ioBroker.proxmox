/**
 * Shows the state of one VM or container and optionally starts and stops it.
 *
 * It only works on the states of the machine: the commands are the button states of the adapter, so
 * they behave like every other way to press them.
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, Typography } from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';

export type StopCommand = 'shutdown' | 'stop';

type Command = 'start' | StopCommand;

interface MachineCardProps {
    socket: Connection;
    /** Full ID of the channel, for example `proxmox.0.qemu_web` */
    machineId: string;
    title?: string;
    showControls: boolean;
    showDetails: boolean;
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

const KNOWN_STATUS = ['running', 'stopped', 'paused', 'suspended', 'offline'];

/**
 * @param socket connection of vis-2
 * @param machineId full ID of the channel
 * @returns the current values of the states of the machine, by state name
 */
function useMachineStates(socket: Connection, machineId: string): Record<string, ioBroker.StateValue> {
    const [values, setValues] = useState<Record<string, ioBroker.StateValue>>({});

    const ids = useMemo(() => ['status', 'cpu', 'mem_lev'].map(name => `${machineId}.${name}`), [machineId]);

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
 * @returns the name of the machine, or the last part of its ID until it is known
 */
function useMachineName(socket: Connection, machineId: string): string {
    const [name, setName] = useState('');

    useEffect(() => {
        let alive = true;
        setName('');
        socket
            .getObject(machineId)
            .then(obj => {
                const common = obj?.common?.name;
                if (alive) {
                    setName(typeof common === 'object' ? common[I18n.getLanguage()] || common.en : common || '');
                }
            })
            .catch(() => {
                // The ID of the machine stays as its name
            });
        return () => {
            alive = false;
        };
    }, [socket, machineId]);

    return name || machineId.split('.').pop() || machineId;
}

export function MachineCard(props: MachineCardProps): React.JSX.Element {
    const { socket, machineId, title, showControls, showDetails, stopCommand, askConfirmation, readOnly } = props;

    const values = useMachineStates(socket, machineId);
    const machineName = useMachineName(socket, machineId);
    const name = title || machineName;
    const status = typeof values.status === 'string' ? values.status : '';

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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', height: '100%', minHeight: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                    variant="subtitle1"
                    noWrap
                    title={name}
                    sx={{ fontWeight: 500 }}
                >
                    {name}
                </Typography>
                <Chip
                    size="small"
                    label={pending ? I18n.t('proxmox_in_progress') : statusLabel}
                    color={pending ? 'info' : STATUS_COLORS[status] || 'default'}
                />
            </Box>

            {showDetails ? (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        CPU {typeof values.cpu === 'number' ? `${values.cpu} %` : '–'}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        RAM {typeof values.mem_lev === 'number' ? `${values.mem_lev} %` : '–'}
                    </Typography>
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
