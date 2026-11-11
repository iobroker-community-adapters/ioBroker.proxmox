/**
 * The vis-2 widget set of ioBroker.proxmox.
 *
 * vis-2 shares React and MUI through Module Federation as singletons in its share scope, so plain
 * imports are right here.
 */

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import pack from './package.json';

/**
 * Resolves a path relative to this file.
 *
 * @param relative path relative to `src-widgets`
 */
const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

const config = {
    plugins: [
        federation({
            manifest: true,
            name: 'vis2ProxmoxWidgets',
            filename: 'customWidgets.js',
            exposes: {
                './ProxmoxMachine': './src/ProxmoxMachineWidget.tsx',
                './ProxmoxNode': './src/ProxmoxNodeWidget.tsx',
                './translations': './src/translations',
            },
            remotes: {},
            shared: moduleFederationShared(pack),
            dts: false,
        }),
        react(),
    ],
    resolve: {
        alias: [
            // The package itself only, not its sub-paths: `./src/guiComponents.ts` reaches `I18n` by one.
            { find: /^@iobroker\/gui-components$/, replacement: dir('./src/guiComponents.ts') },
            // The icon package reaches for this deep path, which the share scope does not cover,
            // see `./src/muiSvgIcon.tsx`.
            { find: /^@mui\/material\/SvgIcon$/, replacement: dir('./src/muiSvgIcon.tsx') },
        ],
    },
    base: './',
    build: {
        // Top-level await, emitted by the federation plugin, needs chrome89+.
        target: 'chrome89',
        outDir: './build',
        rollupOptions: {
            onwarn(warning: { code: string }, warn: (warning: { code: string }) => void): void {
                // "Module level directives cause errors when bundled" - harmless for "use client".
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
                    return;
                }
                warn(warning);
            },
        },
    },
};

export default config;
