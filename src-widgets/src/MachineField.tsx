/**
 * The machine or node setting of a widget in the vis-2 editor: a list of the VMs and containers, or of the
 * nodes, instead of searching the channel in the object tree.
 *
 * It reads the channels like the widget reads its states, so it also works while the adapter is stopped.
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { ListItemIcon, ListItemText, MenuItem, Select } from '@mui/material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';

import { MachineTypeIcon } from './MachineIcon';

interface MachineOption {
    id: string;
    name: string;
    type: string;
    instance: string;
}

/**
 * @param name name of an object
 * @returns the name in the language of the user
 */
function getText(name: ioBroker.StringOrTranslated | undefined): string {
    if (typeof name === 'object') {
        return name[I18n.getLanguage()] || name.en;
    }
    return name || '';
}

/**
 * @param socket connection of vis-2
 * @param types the `native.type` of the channels to list
 * @returns the channels of all Proxmox instances, sorted by instance and name
 */
async function readMachines(socket: Connection, types: string[]): Promise<MachineOption[]> {
    const channels = (await socket.getObjectViewSystem('channel', 'proxmox.', 'proxmox.香')) || {};
    const machines: MachineOption[] = [];
    for (const [id, obj] of Object.entries(channels)) {
        const type = obj.native?.type as string | undefined;
        if (type && types.includes(type)) {
            machines.push({
                id,
                name: getText(obj.common?.name) || id,
                type,
                instance: id.split('.').slice(0, 2).join('.'),
            });
        }
    }
    return machines.sort(
        (a, b) =>
            a.instance.localeCompare(b.instance) || a.name.localeCompare(b.name) || a.type.localeCompare(b.type),
    );
}

/** VMs and containers, the default of the machine widget */
const MACHINE_TYPES = ['qemu', 'lxc'];

/** Name of a type in the list */
const TYPE_NAMES: Record<string, string> = { lxc: 'LXC', qemu: 'QEMU', node: 'Proxmox VE' };

export default function MachineField({
    socket,
    value,
    onChange,
    types = MACHINE_TYPES,
    emptyLabel = 'proxmox_no_machine',
}: {
    socket: Connection;
    value: string;
    onChange: (value: string) => void;
    /** The `native.type` of the channels to list */
    types?: string[];
    /** Word for "nothing selected" */
    emptyLabel?: string;
}): React.JSX.Element {
    const [options, setOptions] = useState<MachineOption[]>([]);

    useEffect(() => {
        let cancelled = false;
        readMachines(socket, types)
            .then(machines => !cancelled && setOptions(machines))
            .catch(() => !cancelled && setOptions([]));
        return () => {
            cancelled = true;
        };
    }, [socket, types]);

    const selected = value === 'nothing_selected' ? '' : value;
    // A machine that is gone stays selectable, so the setting is not silently lost
    const known = !selected || options.some(option => option.id === selected);
    const severalInstances = new Set(options.map(option => option.instance)).size > 1;

    const getSecondary = (option: MachineOption): string => {
        const parts = [TYPE_NAMES[option.type] || option.type];
        // Machines of the same name differ by the ID only, see `getMachineIdNames` in the adapter
        if (options.some(o => o !== option && o.name === option.name && o.type === option.type)) {
            parts.push(option.id.split('.').pop() || option.id);
        }
        if (severalInstances) {
            parts.push(option.instance);
        }
        return parts.join(', ');
    };

    return (
        <Select
            variant="standard"
            fullWidth
            value={selected}
            displayEmpty
            onChange={event => onChange(event.target.value)}
            renderValue={current => {
                const option = options.find(o => o.id === current);
                return option ? option.name : current || <em>{I18n.t(emptyLabel)}</em>;
            }}
        >
            <MenuItem value="">
                <em>{I18n.t(emptyLabel)}</em>
            </MenuItem>
            {options.map(option => (
                <MenuItem
                    key={option.id}
                    value={option.id}
                    dense
                >
                    <ListItemIcon>
                        <MachineTypeIcon type={option.type} />
                    </ListItemIcon>
                    <ListItemText
                        primary={option.name}
                        secondary={getSecondary(option)}
                    />
                </MenuItem>
            ))}
            {known ? null : <MenuItem value={selected}>{selected}</MenuItem>}
        </Select>
    );
}
