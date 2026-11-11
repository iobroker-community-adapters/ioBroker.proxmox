import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/dm-widgets/modulefederation.devices.config';

/**
 * The widgets of ioBroker.devices: a Module Federation remote `DevicesWidgetProxmoxSet` with the entry
 * `customDevices.js`, copied to `admin/dm-widgets/` by `tasks.ts --devices`. devices loads it from there because
 * `common.deviceWidgets` in io-package.json names the components.
 *
 * Shared are only the modules the widgets load at run time. Every shared module gets a fallback bundle next to
 * the remote entry, and MUI, emotion and gui-components would add several MB that devices never loads: the
 * widgets take React and MUI from the host through `@iobroker/dm-widgets` and import the others only as types.
 */
const SHARED = ['@iobroker/dm-widgets', 'react'];

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'DevicesWidgetProxmoxSet',
            filename: 'customDevices.js',
            exposes: {
                './Components': './src/Components.tsx',
                './translations': './src/translations.ts',
            },
            remotes: {},
            shared: moduleFederationShared(SHARED),
            dts: false,
        }),
        react(),
        commonjs(),
    ],
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
        rollupOptions: {
            onwarn(warning: { code: string }, warn: (warning: { code: string }) => void): void {
                // "Module level directives cause errors when bundled" of the MUI sources
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
                    return;
                }
                warn(warning);
            },
        },
    },
};
