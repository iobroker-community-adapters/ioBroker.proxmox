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
npm run check:widgets                     # type check of the widgets (needs npm i in src-widgets)
npm run translate                         # fills the other languages from admin/i18n/en.json
npm run release-patch                     # @alcalzone/release-script, moves the README changelog into io-package news
```

There is deliberately **no `prepare` script**: `npm ci` does not build. Because `build/` is neither committed nor built on install, `common.nogit` is `true`, so the adapter can only be installed from npm. The backend build is plain `tsc`. `tasks.ts` only builds the vis-2 widgets, and `widgets/` is committed, so a change in `src-widgets` needs `npm run build:widgets` before the commit. CI does not build or check the widgets.

The integration test aborts with "JS-Controller is already running!" if a js-controller runs on the machine.

## Architecture

| Path | Content |
| --- | --- |
| `src/main.ts` | `Proxmox extends utils.Adapter`: lifecycle, polling loop, button handling, `cleanup` message |
| `src/lib/proxmox.ts` | `ProxmoxUtils`, the HTTP client: login, 5xx retries, failover |
| `src/lib/nodes.ts` | `createNodes` / `setNodes`, node and disk states |
| `src/lib/vms.ts` | `createVM` / `setMachines`, VM, LXC and storage states |
| `src-widgets/src/MachineCard.tsx` | vis-2 widget of a VM or container, uses only its states. `ProxmoxMachineWidget.tsx` declares the settings, `translations.ts` holds the words |
| `src/lib/DeviceManagement.ts` | Device manager (`@iobroker/dm-utils`), reads the channels in `objects` and the button objects, runs commands through `getButtonAction` |
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
| `node_<name>.*` | `nodes.ts` |
| `qemu_<name>.*`, `lxc_<name>.*`, `storage_<name>.*` | `vms.ts` (with `newTreeStructure`: `qemu.<name>.*` etc.) |
| `ceph.*`, `ha.*` | `ceph.ts`, `ha.ts` |

Machines of the same type and name get `<name>_<vmid>` instead of `<name>`, see `getMachineIdNames` in `vms.ts`. Everything that builds a machine ID has to use it, otherwise `cleanup` or `setMachines` no longer match the objects. If several Proxmox instances report the same ID (individual hosts are often all called `pve`), all of them get `_<hostId>` on top, see `getHostSuffix` in `methods.ts`. Both are kept while the channel exists. `ceph.*` and `ha.*` are not separated per instance.

## Conventions

- **Config in three places:** `src/lib/adapter-config.d.ts`, `native` in `io-package.json` and `admin/jsonConfig.json` must match. A field missing from jsonConfig is deleted from `native` on the next save.
- **Timers:** only `this.setTimeout` / `adapter.setTimeout`, never the global ones. While the adapter stops, `setTimeout` returns `undefined` and no callback fires; `withTimeout` and `_delay` handle that.
- **Compatibility:** object IDs, roles, `native` keys and the `cleanup` command are used by existing installations and user scripts.
- **Passwords:** `realmPassword` and `realmTokenSecret` are stored unencrypted in `native.tableDevices`. Encrypting them would invalidate the stored credentials of existing instances, so it needs a migration.
- **Translations:** `admin/i18n/<lang>.json` are flat, keys are the labels from `jsonConfig.json`, `en.json` is the reference. Mind the file encoding: a wrong one destroyed the texts in v2.5.0.
- **Log messages** are partly German. The unit tests assert on some of them.
- **Tests** use `node:test` and `node:assert`, there is no assertion library.

## Release

Add changelog lines under `### **WORK IN PROGRESS**` in `README.md`. `common.news` is maintained by the release script. Release with `npm run release-patch` (or `-minor` / `-major`) after a green build. Raising a minimum version (Node.js, js-controller, admin) is a breaking change and needs a major release.
