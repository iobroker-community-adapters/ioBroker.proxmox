/**
 * The web components of the Proxmox adapter. Each one is built on its own (`vite build --mode <name>`, see
 * `vite.config.ts`), so that each is ONE module file: a host imports exactly one URL per component.
 */
import type { StopCommand, UpdatesMode } from '../../src-shared/proxmox.ts';

/** Name of a component: the mode of its build and the base name of its files */
export type ComponentName = 'proxmox-machine' | 'proxmox-node';

export const COMPONENT_NAMES: ComponentName[] = ['proxmox-machine', 'proxmox-node'];

/** Tag of `<iob-proxmox-machine>`: one VM or container */
export const MACHINE_TAG = 'iob-proxmox-machine';

/** Tag of `<iob-proxmox-node>`: one node with its available updates */
export const NODE_TAG = 'iob-proxmox-node';

/** The devices widget that shows the same, see `common.deviceWidgets` in io-package.json */
export const DEVICE_WIDGETS: Record<ComponentName, string> = {
    'proxmox-machine': 'ProxmoxMachineComponent',
    'proxmox-node': 'ProxmoxNodeComponent',
};

/** The built module, next to its manifest */
export function getModuleFile(name: ComponentName): string {
    return `${name}.js`;
}

/** The manifest the build writes next to the module; `common.webComponents` names this one */
export function getManifestFile(name: ComponentName): string {
    return `${name}.json`;
}

/** Where `tasks.ts` puts the module in the admin folder; the React import is relative to it */
export function getModulePath(name: ComponentName): string {
    return `webcomponents/${getModuleFile(name)}`;
}

/**
 * The settings both components have; a setting without a value is missing. Types, not interfaces: the settings
 * of `IobWebComponent` are a record, and only a type has the index signature for it.
 */
export type CommonSettings = {
    /** Shown instead of the name of the channel */
    name?: string;
    showUptime?: boolean;
    /** The bars of CPU and RAM, where the box has room for them */
    showDetails?: boolean;
};

/** The values of the settings of `<iob-proxmox-machine>` */
export type MachineSettings = CommonSettings & {
    /** The channel of the machine, e.g. `proxmox.0.lxc_web` */
    machine?: string;
    showControls?: boolean;
    stopCommand?: StopCommand;
    askConfirmation?: boolean;
};

/** The values of the settings of `<iob-proxmox-node>` */
export type NodeSettings = CommonSettings & {
    /** The channel of the node, e.g. `proxmox.0.node_pve` */
    node?: string;
    updates?: UpdatesMode;
};
