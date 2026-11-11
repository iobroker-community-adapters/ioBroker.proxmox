import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { checkManifest, getReactImportPath, REACT_SPECIFIERS } from '@iobroker/web-components';
import type { Plugin, UserConfig } from 'vite';

// with the extension: Vite may load its config natively, without a bundler that would add it
import {
    COMPONENT_NAMES,
    DEVICE_WIDGETS,
    getManifestFile,
    getModuleFile,
    getModulePath,
    type ComponentName,
} from './src/constants.ts';
import { getManifest, type DeviceWidgetInfo } from './src/manifest.ts';

/**
 * The web components `<iob-proxmox-machine>` and `<iob-proxmox-node>`: one ES module each,
 * `admin/webcomponents/proxmox-machine.js` and `proxmox-node.js`, and its manifest `<name>.json` next to it
 * (`common.webComponents`). Every host - vis-2, devices, Aura, admin - reads them from `/adapter/proxmox/webcomponents/`.
 * No module federation: the host shares nothing but the socket.
 *
 * One build per component (`npm run build`): a host imports exactly one URL per component, so each module is one
 * file, with the shared code compiled into both. One build with two entries would move it into a chunk of its own.
 *
 * React is not bundled: the four React imports point at `lib/esm/react-19.js`, which web and admin serve beside
 * `adapter/`. The path is relative to the module, so a path prefix of a reverse proxy stays.
 */

/** The module of each component */
const ENTRIES: Record<ComponentName, string> = {
    'proxmox-machine': './src/ProxmoxMachine.tsx',
    'proxmox-node': './src/ProxmoxNode.tsx',
};

/**
 * @param name the component
 * @returns label and description of the devices widget that shows the same
 */
function getDeviceWidget(name: ComponentName): DeviceWidgetInfo {
    const ioPackage = JSON.parse(readFileSync(fileURLToPath(new URL('../io-package.json', import.meta.url)), 'utf8'));
    const components: ({ name: string } & DeviceWidgetInfo)[] = ioPackage.common?.deviceWidgets?.components || [];
    const widget = components.find(component => component.name === DEVICE_WIDGETS[name]);
    if (!widget) {
        throw new Error(`io-package.json: common.deviceWidgets has no component "${DEVICE_WIDGETS[name]}"`);
    }
    return { label: widget.label, description: widget.description };
}

/** Writes `<name>.json` next to the module, checked like a host checks it */
function manifestFile(name: ComponentName): Plugin {
    return {
        name: 'proxmox-web-component-manifest',
        generateBundle() {
            const manifest = getManifest(name, getDeviceWidget(name));
            const problem = checkManifest(manifest);
            if (problem) {
                this.error(`${getManifestFile(name)}: ${problem}`);
            }
            this.emitFile({
                type: 'asset',
                fileName: getManifestFile(name),
                source: `${JSON.stringify(manifest, null, 4)}\n`,
            });
        },
    };
}

export default ({ mode }: { mode: string }): UserConfig => {
    const name = COMPONENT_NAMES.find(component => component === mode);
    if (!name) {
        throw new Error(`Build one component at a time: vite build --mode <${COMPONENT_NAMES.join('|')}>`);
    }
    const reactImport = getReactImportPath(getModulePath(name));

    return {
        plugins: [react(), manifestFile(name)],
        define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
            target: 'es2022',
            outDir: './build',
            // the builds of all components write into the same folder: only the first one empties it
            emptyOutDir: name === COMPONENT_NAMES[0],
            lib: {
                entry: ENTRIES[name],
                formats: ['es'],
                fileName: (): string => getModuleFile(name),
            },
            rollupOptions: {
                external: [...REACT_SPECIFIERS],
                output: {
                    paths: Object.fromEntries(REACT_SPECIFIERS.map(specifier => [specifier, reactImport])),
                    // one file: a host imports exactly one URL
                    codeSplitting: false,
                    // library mode keeps whitespace for the bundler of a consumer; this module is loaded as it is
                    minify: true,
                },
            },
        },
    };
};
