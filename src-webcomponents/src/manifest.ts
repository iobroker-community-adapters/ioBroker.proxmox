/**
 * The manifests of `<iob-proxmox-machine>` and `<iob-proxmox-node>`. Read by the build only (`vite.config.ts`),
 * which writes each as `<name>.json` next to its module - a host reads that file for its palette and its settings
 * without loading the module.
 *
 * The `name` of a manifest is the label of the devices widget that shows the same (`common.deviceWidgets` in
 * io-package.json): devices then offers its own widget and leaves the web component out, other hosts show the
 * web component. The build takes the labels and descriptions from io-package.json, so they cannot differ.
 *
 * Settings may only use the types every host can show: `text`, `checkbox`, `select`, `objectId`, ...
 */
import type { WebComponentManifest, WebComponentSettingsPanel } from '@iobroker/web-components';

// with the extension: `vite.config.ts` imports this file, and Vite may load its config natively
import { getModuleFile, MACHINE_TAG, NODE_TAG, type ComponentName } from './constants.ts';
import { getTranslated } from './i18n.ts';

const SCHEMA = 'https://raw.githubusercontent.com/ioBroker/web-components/main/schemas/manifest.json';

/** Label and description of a devices widget, from `common.deviceWidgets.components` */
export interface DeviceWidgetInfo {
    label: ioBroker.StringOrTranslated;
    description?: ioBroker.StringOrTranslated;
}

/** The settings of both: the name, the uptime and the bars */
const COMMON_ITEMS: WebComponentSettingsPanel['items'] = {
    showUptime: {
        type: 'checkbox',
        default: true,
        label: getTranslated('proxmox_show_uptime'),
    },
    showDetails: {
        type: 'checkbox',
        default: true,
        label: getTranslated('proxmox_show_details'),
    },
};

const MACHINE_SETTINGS: WebComponentSettingsPanel = {
    type: 'panel',
    items: {
        machine: {
            type: 'objectId',
            types: 'channel',
            // every instance of the adapter; the element takes the channel of the VM or container
            root: 'proxmox',
            label: getTranslated('proxmox_machine'),
            help: getTranslated('proxmox_machine_id_help'),
        },
        name: {
            type: 'text',
            label: getTranslated('proxmox_title'),
            help: getTranslated('proxmox_title_help'),
        },
        ...COMMON_ITEMS,
        showControls: {
            type: 'checkbox',
            default: true,
            label: getTranslated('proxmox_show_controls'),
            help: getTranslated('proxmox_show_controls_help'),
        },
        stopCommand: {
            type: 'select',
            default: 'shutdown',
            hidden: 'data.showControls === false',
            label: getTranslated('proxmox_stop_command'),
            options: [
                { value: 'shutdown', label: getTranslated('proxmox_stop_shutdown') },
                { value: 'stop', label: getTranslated('proxmox_stop_hard') },
            ],
        },
        askConfirmation: {
            type: 'checkbox',
            default: true,
            hidden: 'data.showControls === false',
            label: getTranslated('proxmox_ask_confirmation'),
        },
    },
};

const NODE_SETTINGS: WebComponentSettingsPanel = {
    type: 'panel',
    items: {
        node: {
            type: 'objectId',
            types: 'channel',
            root: 'proxmox',
            label: getTranslated('proxmox_node'),
            help: getTranslated('proxmox_node_id_help'),
        },
        name: {
            type: 'text',
            label: getTranslated('proxmox_title'),
            help: getTranslated('proxmox_node_title_help'),
        },
        ...COMMON_ITEMS,
        updates: {
            type: 'select',
            default: 'control',
            label: getTranslated('proxmox_updates'),
            help: getTranslated('proxmox_updates_help'),
            options: [
                { value: 'control', label: getTranslated('proxmox_updates_control') },
                { value: 'show', label: getTranslated('proxmox_updates_show') },
                { value: 'hidden', label: getTranslated('proxmox_updates_hidden') },
            ],
        },
    },
};

/**
 * @param name the component
 * @param widget label and description of its devices widget
 * @returns its manifest
 */
export function getManifest(name: ComponentName, widget: DeviceWidgetInfo): WebComponentManifest {
    const machine = name === 'proxmox-machine';
    return {
        $schema: SCHEMA,
        manifestVersion: 1,
        tag: machine ? MACHINE_TAG : NODE_TAG,
        name: widget.label,
        description: widget.description,
        // relative to this file: the symbol of the devices widget in /adapter/proxmox/dm-widgets/
        icon: machine ? '../dm-widgets/machine.svg' : '../dm-widgets/node.svg',
        module: getModuleFile(name),
        // a card with the bars and the buttons; small boxes show less, see styles.ts
        size: { width: 320, height: 160 },
        settings: machine ? MACHINE_SETTINGS : NODE_SETTINGS,
    };
}
