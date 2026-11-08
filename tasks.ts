/**
 * Builds the vis-2 widget set: src-widgets -> widgets/proxmox.
 *
 * The backend does not need this file, its build is plain `tsc`. The result in widgets/ is committed,
 * so `npm ci` and the unit tests do not have to install the widget toolchain.
 */

import { deleteFoldersRecursive, buildReact, copyFiles, npmInstall } from '@iobroker/build-tools';

function cleanWidgets(): void {
    deleteFoldersRecursive(`${__dirname}/widgets/proxmox`);
    deleteFoldersRecursive(`${__dirname}/src-widgets/build`);
}

function buildWidgets(): Promise<void> {
    return buildReact(`${__dirname}/src-widgets/`, { rootDir: `${__dirname}/src-widgets/`, vite: true });
}

/**
 * `index.html` is only the entry for Vite. `mf-manifest.json` is shipped: vis-2 reads it next to the
 * remote entry to see which shared modules the bundle was built against.
 */
function copyWidgetFiles(): void {
    copyFiles(['src-widgets/build/**/*', '!src-widgets/build/index.html'], 'widgets/proxmox/');
}

cleanWidgets();
npmInstall(`${__dirname}/src-widgets/`)
    .then(() => buildWidgets())
    .then(() => copyWidgetFiles())
    .catch((e: unknown) => {
        console.error(e);
        process.exit(1);
    });
