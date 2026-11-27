# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`iobroker.proxmox` is an ioBroker adapter that polls the **Proxmox VE REST API** and mirrors nodes, VMs (qemu), containers (lxc), storages, disks, Ceph and HA status into ioBroker states. Button states start, stop and reboot VMs and nodes.

TypeScript (CommonJS output). Sources live in `src/`, the published/runnable code is the compiled `build/` (`package.json` `main` is `build/main.js`). `build/` is gitignored, so always build before starting the adapter or running the unit tests.

## Commands

```bash
npm run build                             # tsc -p tsconfig.build.json -> build/
npm run watch                             # tsc in watch mode
npm run check                             # type check only
npm run lint                              # eslint (@iobroker/eslint-config, flat config)
npx eslint -c eslint.config.mjs --fix src # autofix + prettier formatting

npm run test:package                      # validates package.json / io-package.json / admin JSON (no build needed)
npm run test:unit                         # node --test test/*.test.js against build/ (needs npm run build first)
node --test test/vms.test.js              # single test file
npm run test:integration                  # starts a real js-controller + adapter instance
npm run build:widgets                     # builds src-widgets into widgets/proxmox, commit the result
npm run build:devices                     # builds src-devices into admin/dm-widgets, commit the result
npm run build:wc                          # builds src-webcomponents into admin/webcomponents, commit the result
npm run check:widgets                     # type check of the vis-2 widgets (needs npm i in src-widgets)
npm run check:devices                     # type check of the devices widgets (needs npm i in src-devices)
npm run check:wc                          # type check of the web components (needs npm i in src-webcomponents)
npm run translate                         # fills the other languages from admin/i18n/en.json
npm run release-patch                     # @alcalzone/release-script, moves the README changelog into io-package news
```

There is deliberately **no `prepare` script**: `npm ci` does not build. Because `build/` is neither committed nor built on install, `common.nogit` is `true`, so the adapter can only be installed from npm. The backend build is plain `tsc`. `tasks.ts` only builds the widgets (vis-2, `--devices`, `--wc`), and their output in `widgets/`, `admin/dm-widgets/` and `admin/webcomponents/` is committed, so a change in `src-widgets`, `src-devices`, `src-webcomponents` or `src-shared` needs the matching build before the commit (a change in `src-shared` all three). CI does not build or check the widgets. The three widget folders are excluded from ESLint, only type checked.

The integration test aborts with "JS-Controller is already running!" if a js-controller runs on the machine.

## Architecture

| Path | Content |
| --- | --- |
| `src/main.ts` | `Proxmox extends utils.Adapter`: lifecycle, polling loop, button handling, messages `cleanup`, `getMachines` and `getNodes` |
| `src/lib/proxmox.ts` | `ProxmoxUtils`, the HTTP client: login, 5xx retries, failover |
| `src/lib/nodes.ts` | `createNodes` / `setNodes`, node and disk states |
| `src/lib/vms.ts` | `createVM` / `setMachines`, VM, LXC and storage states |
| `src/lib/updates.ts` | available package updates of the nodes (`node_<name>.updates.*`): objects, reading, the `updates.refresh` button. `setNodes` reads them only when `isUpdateCheckDue()` in `main.ts` says so, at most every `updateCheckInterval` minutes per instance |
| `src-widgets/src/MachineCard.tsx` | vis-2 widget of a VM or container, uses only its states. `ProxmoxMachineWidget.tsx` declares the settings, `MachineField.tsx` is the machine (or node) list in the editor, `MachineIcon.tsx` the symbol, `translations.ts` holds the words |
| `src-widgets/src/NodeCard.tsx` | vis-2 widget of a node with its available updates, settings in `ProxmoxNodeWidget.tsx`. The refresh button waits until the adapter confirms `updates.refresh` with `ack` |
| `src-shared/` | shared by all three widget builds: `translations.ts` (the words of all widgets, 11 languages; `src-widgets/src/translations.ts` re-exports it) and `proxmox.ts` (state names, commands, formats, status colors, SVG paths). No React, no MUI |
| `src-devices/src/` | widgets of ioBroker.devices (`common.deviceWidgets`): Module Federation remote `DevicesWidgetProxmoxSet`, entry `customDevices.js`. `ProxmoxWidget.tsx` is the base (channel object, subscriptions, tile frame for 1x1, 2x0.5, 2x1), `ProxmoxMachineComponent.tsx` and `ProxmoxNodeComponent.tsx` the widgets. React and MUI come from the host through `@iobroker/dm-widgets`, only `Box` and `Typography` are used. The machine and the node are picked with `selectSendTo` from the instance chosen in the setting `instance`: the messages `getMachines` / `getNodes` answer with the channels of `src/lib/widgets.ts`. The stored value is the full channel ID. `vite.config.ts` shares only `@iobroker/dm-widgets` and `react`: every shared module gets a fallback bundle of several MB |
| `src-webcomponents/src/` | web components `<iob-proxmox-machine>` and `<iob-proxmox-node>` (`@iobroker/web-components`, `common.webComponents`), one `vite build --mode <name>` each, plain React + CSS in a shadow root, React from the host (`lib/esm/react-19.js`). The build writes the manifests (`manifest.ts`); their `name` is the `label` of the devices widget in io-package.json, so devices shows its own widget instead. Layout by container queries in `styles.ts` |
| `src/lib/widgets.ts` | `getChannelOptions`: the channels of a type as `selectSendTo` list (value = channel ID, label = name, description = type and ID) |
| `src/lib/DeviceManagement.ts` | Device manager (`@iobroker/dm-utils`), reads the channels in `objects` and the button objects, runs commands through `getButtonAction`. Icons come from `icons.ts` as base64 SVG: the admin only knows a few `fa-*` names and draws a question mark for the others |
| `src/lib/ceph.ts`, `src/lib/ha.ts` | Ceph and HA trees, generated from whatever the API returns |
| `src/lib/methods.ts` | helpers: unit conversion, `findState`, `withTimeout`, `withRetry` |
| `src/lib/translations.ts` | object names and log messages in all languages |
| `src/lib/types.ts` | API responses and `ProxmoxAdapterContext` |
| `src/lib/adapter-config.d.ts` | augments `ioBroker.AdapterConfig` |

**`create*` vs. `set*`:** `create*` run once at start (`onReady` -> `getNodes`) and create objects. `set*` run every poll cycle and only write states. If a poll finds an unknown node or VM it calls `restart()`, and the next start creates the objects.

**Removing old objects:** `createNodes` and `createVM` only return the IDs their Proxmox instance still knows. `getNodes` deletes the rest after all instances are done, and only if every instance answered: a single instance does not know the objects of the others.

**`lib/` functions use `this`:** they are bound to the adapter in `main.ts` and declare `this: ProxmoxAdapterContext`. The unit tests bind them to plain mocks, so they do not need a real adapter.

**`this.proxmox` is the instance being processed.** There is one `ProxmoxUtils` for all nodes marked "Cluster Node" (failover between them) plus one per individual node. `sendRequest` and `getNodes` set `this.proxmox` before calling into `lib/`. Buttons store their instance in `native.host` (`ProxmoxUtils.hostId`), because a node name is not unique across individual hosts. `nodeInstanceMap` is the fallback for buttons created by older versions.

**Polling** is a self-rescheduling `setTimeout` in `sendRequest`, not an interval. Pressing a button reschedules the next poll to 10 s.

**Failover** (`_getData`): 5xx is retried with backoff, then the next node is tried. Node-specific URLs (`/nodes/<name>/...`) never fail over, because every cluster node proxies to the same target and would answer the same.

**`STOPPED`:** after `stop()`, `_getData` throws `Error('STOPPED')`. Callers pass it on and stay silent; do not wrap it or log it.

### Where states are written

| Object IDs | Written by |
| --- | --- |
| `info.*` | `main.ts`, `vms.ts` (`info.offlineMachines`) |
| `node_<name>.*` | `nodes.ts`, `updates.ts` (`updates.*`) |
| `qemu_<name>.*`, `lxc_<name>.*`, `storage_<name>.*` | `vms.ts` (with `newTreeStructure`: `qemu.<name>.*` etc.) |
| `ceph.*`, `ha.*` | `ceph.ts`, `ha.ts` |

Machines of the same type and name get `<name>_<vmid>` instead of `<name>`, see `getMachineIdNames` in `vms.ts`. Everything that builds a machine ID has to use it, otherwise `cleanup` or `setMachines` no longer match the objects. If several Proxmox instances report the same ID (individual hosts are often all called `pve`), all of them get `_<hostId>` on top, see `getHostSuffix` in `methods.ts`. Both are kept while the channel exists. `ceph.*` and `ha.*` are not separated per instance.

## Conventions

- **Config in three places:** `src/lib/adapter-config.d.ts`, `native` in `io-package.json` and `admin/jsonConfig.json` must match. A field missing from jsonConfig is deleted from `native` on the next save.
- **Timers:** only `this.setTimeout` / `adapter.setTimeout`, never the global ones. While the adapter stops, `setTimeout` returns `undefined` and no callback fires; `withTimeout` and `_delay` handle that.
- **Compatibility:** object IDs, roles, `native` keys and the `cleanup` command are used by existing installations and user scripts, the messages `getMachines` and `getNodes` by the settings of the devices widgets.
- **Passwords:** `realmPassword` and `realmTokenSecret` are stored unencrypted in `native.tableDevices`. Encrypting them would invalidate the stored credentials of existing instances, so it needs a migration.
- **Translations:** `admin/i18n/<lang>.json` are flat, keys are the labels from `jsonConfig.json`, `en.json` is the reference. Mind the file encoding: a wrong one destroyed the texts in v2.5.0.
- **Log messages** are partly German. The unit tests assert on some of them.
- **Tests** use `node:test` and `node:assert`, there is no assertion library.

## Release

Add changelog lines under `### **WORK IN PROGRESS**` in `README.md`. `common.news` is maintained by the release script. Release with `npm run release-patch` (or `-minor` / `-major`) after a green build. Raising a minimum version (Node.js, js-controller, admin) is a breaking change and needs a major release.
