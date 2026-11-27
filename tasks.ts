/**
 * Builds the widgets. The backend does not need this file, its build is plain `tsc`.
 *
 *   src-widgets/       -> widgets/proxmox/       the vis-2 widget set (`common.visWidgets`)          npm run build:widgets
 *   src-devices/       -> admin/dm-widgets/      the widgets of ioBroker.devices (`common.deviceWidgets`)  npm run build:devices
 *   src-webcomponents/ -> admin/webcomponents/   the web components (`common.webComponents`)         npm run build:wc
 *
 * All three share `src-shared/` (words, formats, symbols). The results are committed, so `npm ci` and the unit
 * tests do not have to install the widget toolchains. Build again whenever the sources or `src-shared/` change.
 */

import { exec } from 'node:child_process';
import { deleteFoldersRecursive, buildReact, copyFiles, npmInstall } from '@iobroker/build-tools';

// tsx appends its loader to process.execArgv, and a forked Vite would inherit it: it would then load
// vite.config.ts as CommonJS and fail on `import.meta`
process.execArgv = [];

interface Target {
    /** The source folder */
    src: string;
    clean: () => void;
    build: () => Promise<void>;
    copy: () => void;
}

/**
 * @param folder source folder
 * @returns the Vite build of a Module Federation bundle (vis-2, devices)
 */
function viteBuild(folder: string): () => Promise<void> {
    return () => buildReact(`${__dirname}/${folder}/`, { rootDir: `${__dirname}/${folder}/`, vite: true });
}

const TARGETS: Record<'widgets' | 'devices' | 'wc', Target> = {
    widgets: {
        src: 'src-widgets',
        clean: (): void => {
            deleteFoldersRecursive(`${__dirname}/widgets/proxmox`);
            deleteFoldersRecursive(`${__dirname}/src-widgets/build`);
        },
        build: viteBuild('src-widgets'),
        // `index.html` is only the entry for Vite. `mf-manifest.json` is shipped: vis-2 reads it next to the
        // remote entry to see which shared modules the bundle was built against.
        copy: (): void => copyFiles(['src-widgets/build/**/*', '!src-widgets/build/index.html'], 'widgets/proxmox/'),
    },
    devices: {
        src: 'src-devices',
        clean: (): void => {
            deleteFoldersRecursive(`${__dirname}/admin/dm-widgets`);
            deleteFoldersRecursive(`${__dirname}/src-devices/build`);
        },
        build: viteBuild('src-devices'),
        // the symbols of `common.deviceWidgets.components[].icon` lie next to the remote entry
        copy: (): void => {
            copyFiles(['src-devices/build/**/*', '!src-devices/build/index.html'], 'admin/dm-widgets/');
            copyFiles(['src-devices/img/*'], 'admin/dm-widgets/');
        },
    },
    wc: {
        src: 'src-webcomponents',
        clean: (): void => {
            deleteFoldersRecursive(`${__dirname}/admin/webcomponents`);
            deleteFoldersRecursive(`${__dirname}/src-webcomponents/build`);
        },
        // one `vite build` per component, so each is one module file: `npm run build` there runs all of them
        build: () =>
            new Promise<void>((resolve, reject) => {
                const child = exec('npm run build', { cwd: `${__dirname}/src-webcomponents/` }, error =>
                    error ? reject(new Error(`Cannot build the web components: ${error.message}`)) : resolve(),
                );
                child.stdout?.pipe(process.stdout);
                child.stderr?.pipe(process.stderr);
            }),
        // one ES module and its manifest per component, the manifest is written and checked by the build
        copy: (): void =>
            copyFiles(['src-webcomponents/build/*.js', 'src-webcomponents/build/*.json'], 'admin/webcomponents/'),
    },
};

const target = process.argv.includes('--wc')
    ? TARGETS.wc
    : process.argv.includes('--devices')
      ? TARGETS.devices
      : TARGETS.widgets;

target.clean();
npmInstall(`${__dirname}/${target.src}/`)
    .then(() => target.build())
    .then(() => target.copy())
    .catch((e: unknown) => {
        console.error(e);
        process.exit(1);
    });
