/**
 * The machines and nodes of this instance for the drop-down lists of the devices widgets (`selectSendTo` with the
 * commands `getMachines` and `getNodes`, see `src-devices`).
 */

/** One entry of a `selectSendTo` list, as JSON-Config shows it */
export interface ChannelOption {
    /** The full ID of the channel, e.g. `proxmox.0.lxc_web` - what the widget stores */
    value: string;
    label: string;
    /** Second line: type and ID. Translated text, so JSON-Config does not look it up as a word */
    description: ioBroker.StringOrTranslated;
    /** The label is a name, not a word to translate */
    noTranslation: true;
}

/** `native.type` of the channels of VMs and containers */
export const MACHINE_CHANNEL_TYPES = ['qemu', 'lxc'];
/** `native.type` of the channels of nodes */
export const NODE_CHANNEL_TYPES = ['node'];

/** Name of a type in the list */
const TYPE_NAMES: Record<string, string> = { qemu: 'QEMU', lxc: 'LXC', node: 'Node' };

/**
 * @param name `common.name` of a channel
 * @returns the name as text
 */
function getName(name: ioBroker.StringOrTranslated | undefined): string {
    if (name && typeof name === 'object') {
        return name.en || Object.values(name).find(Boolean) || '';
    }
    return name || '';
}

/**
 * The channels of this instance with one of the types, sorted by name
 *
 * @param adapter the adapter
 * @param types the `native.type` of the channels to list
 */
export async function getChannelOptions(
    adapter: Pick<ioBroker.Adapter, 'namespace' | 'getForeignObjectsAsync'>,
    types: string[],
): Promise<ChannelOption[]> {
    const channels = (await adapter.getForeignObjectsAsync(`${adapter.namespace}.*`, 'channel')) || {};
    const options: ChannelOption[] = [];
    for (const [id, obj] of Object.entries(channels)) {
        const type = obj?.native?.type;
        if (obj?.type !== 'channel' || typeof type !== 'string' || !types.includes(type)) {
            continue;
        }
        const relativeId = id.slice(adapter.namespace.length + 1);
        options.push({
            value: id,
            label: getName(obj.common?.name) || relativeId,
            // the ID tells apart machines of the same name, and nodes of several hosts
            description: { en: `${TYPE_NAMES[type] || type} · ${relativeId}` },
            noTranslation: true,
        });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}
