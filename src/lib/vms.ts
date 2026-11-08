import { stateNames, vmButtonLabels } from './translations';
import type {
    OfflineResourceStatus,
    ProxmoxAdapterContext,
    ProxmoxBackupEntry,
    ProxmoxClusterResource,
    StatusRecord,
} from './types';

const VM_COMMANDS = ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume'] as const;

/**
 * Ermittelt je VM/LXC den Namensteil der Objekt-ID.
 *
 * Proxmox erlaubt gleiche Namen, eindeutig ist nur die VMID. Die ID bleibt beim Namen, damit Skripte
 * und Historien bestehender Installationen weiter passen. Nur wenn Typ und Name mehrerer Maschinen
 * übereinstimmen, bekommen alle betroffenen `<name>_<vmid>`, unabhängig von ihrer Reihenfolge.
 *
 * Eine vergebene ID mit VMID bleibt, solange ihr Channel existiert. Sonst würde sie sich ändern (und
 * die Historie verloren gehen), sobald Proxmox den Namen der anderen Maschine nicht liefert,
 * etwa weil deren Node offline ist, oder diese Maschine entfernt wird.
 *
 * @param ctx - Adapter-Instanz
 * @param resources - Ressourcen EINER Proxmox-Instanz
 * @returns Namensteil je Maschine. Maschinen ohne Namen sind nicht enthalten.
 */
export function getMachineIdNames(
    ctx: ProxmoxAdapterContext,
    resources: ProxmoxClusterResource[],
): Map<ProxmoxClusterResource, string> {
    const separator = ctx.config.newTreeStructure ? '.' : '_';
    const machines = resources.filter(res => (res.type === 'qemu' || res.type === 'lxc') && res.name !== undefined);
    const relativeId = (res: ProxmoxClusterResource, name: string): string => `${res.type}${separator}${name}`;
    const plainIds = new Set(machines.map(res => relativeId(res, ctx.prepareNameForId(res.name))));

    const idNames = new Map<ProxmoxClusterResource, string>();
    for (const res of machines) {
        const plainName = ctx.prepareNameForId(res.name);
        const vmidName = `${plainName}_${res.vmid}`;
        const id = relativeId(res, vmidName);
        // Heißt eine andere Maschine tatsächlich so, gehört der Channel ihr
        idNames.set(res, ctx.objects[`${ctx.namespace}.${id}`] && !plainIds.has(id) ? vmidName : plainName);
    }

    // In einer Schleife, weil auch `web_100` mit `web` + VMID 100 zusammenfallen kann. Jede Maschine
    // kann nur einmal umbenannt werden, die Schleife endet also.
    let renamed = true;
    while (renamed) {
        renamed = false;
        const count = new Map<string, number>();
        for (const [res, name] of idNames) {
            const id = relativeId(res, name);
            count.set(id, (count.get(id) ?? 0) + 1);
        }
        for (const [res, name] of idNames) {
            if (count.get(relativeId(res, name))! > 1 && name === ctx.prepareNameForId(res.name)) {
                idNames.set(res, `${name}_${res.vmid}`);
                renamed = true;
            }
        }
    }

    return idNames;
}

/**
 * createVM – legt VM/LXC/Storage-Channels + States beim Adapter-Start an.
 */
export async function createVM(this: ProxmoxAdapterContext): Promise<void> {
    // BUG FIX: Mit newTreeStructure werden Objekte mit Punkt gespeichert (lxc.name),
    // daher müssen beide Präfix-Formate berücksichtigt werden.
    const resourcesAll = Object.keys(this.objects)
        .map(id => this.removeNamespace(id))
        .filter(
            id =>
                id.startsWith('lxc_') ||
                id.startsWith('qemu_') ||
                id.startsWith('storage_') ||
                id.startsWith('lxc.') ||
                id.startsWith('qemu.') ||
                id.startsWith('storage.'),
        );

    const resourcesKeep: string[] = [];

    try {
        const resources = await this.proxmox!.getClusterResources();
        const idNames = getMachineIdNames(this, resources);

        for (const res of resources) {
            let sid = '';
            const type = res.type;
            const resName = this.prepareNameForId(res.name);
            const idName = idNames.get(res) ?? resName;

            if (this.config.newTreeStructure) {
                sid = `${this.namespace}.${type}.${idName}`;
            } else {
                sid = `${this.namespace}.${type}_${idName}`;
            }

            if (res.status === 'unknown') {
                res.status = 'offline';
            }

            // ── qemu / lxc ─────────────────────────────────────────────────
            if (res.type === 'qemu' || res.type === 'lxc') {
                // BUG FIX: Separator muss zum Format in resourcesAll passen
                resourcesKeep.push(this.config.newTreeStructure ? `${type}.${idName}` : `${type}_${idName}`);

                if (!this.objects[sid]) {
                    if (idName !== resName) {
                        this.log.info(`The name "${res.name}" is used more than once, using "${sid}" for ${res.id}`);
                    }
                    this.objects[sid] = {
                        type: 'channel',
                        // statusStates wertet der Admin aus, fehlt aber im Typ ChannelCommon
                        common: {
                            name: res.name as string,
                            statusStates: { onlineId: `${sid}.available` },
                        } as ioBroker.ChannelCommon,
                        native: { type },
                    };
                    await this.setObjectNotExistsAsync(sid, this.objects[sid]);
                }

                const vmNative = { node: res.node, type: res.type, vmid: res.vmid };

                for (const cmd of VM_COMMANDS) {
                    await this.extendObjectAsync(`${sid}.${cmd}`, {
                        type: 'state',
                        common: {
                            name: vmButtonLabels[cmd],
                            type: 'boolean',
                            role: 'button',
                            read: true,
                            write: true,
                        },
                        native: vmNative,
                    });
                }

                await this.extendObjectAsync(`${sid}.status`, {
                    type: 'state',
                    common: {
                        name: stateNames.status,
                        type: 'string',
                        role: 'indicator.status',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await this.setStateChangedAsync(`${sid}.status`, { val: res.status, ack: true });

                await this.extendObjectAsync(`${sid}.available`, {
                    type: 'state',
                    common: { name: stateNames.available, type: 'boolean', role: 'state', read: true, write: false },
                    native: {},
                });

                let available = false;
                let resourceStatus: StatusRecord | OfflineResourceStatus | null;

                if (res.status === 'running') {
                    resourceStatus = await this.proxmox!.getResourceStatus(res.node, type, res.vmid);
                    available = true;
                    this.log.debug(`new ${type}: ${String(resourceStatus?.name)} - ${JSON.stringify(resourceStatus)}`);
                } else {
                    this.offlineResourceStatus.status = res.status;
                    this.offlineResourceStatus.type = res.type;
                    this.offlineResourceStatus.name = resName;
                    this.offlineResourceStatus.vmid = res.vmid;
                    resourceStatus = this.offlineResourceStatus;
                }

                await this.setStateChangedAsync(`${sid}.available`, { val: available, ack: true });

                // Absicht: Ohne Status wirft findState(), das fängt der catch am Ende dieser Funktion ab
                const states = this.findState(sid, resourceStatus!);
                for (const element of states) {
                    await this.createCustomState(element[0], element[1], element[2], element[3]);
                }
            }

            // ── storage ────────────────────────────────────────────────────
            if (res.type === 'storage' && this.config.requestStorageInformation) {
                const storageName = !res.shared
                    ? `${res.node}_${this.prepareNameForId(res.storage)}`
                    : this.prepareNameForId(res.storage);

                if (
                    !resourcesKeep.includes(`${type}_${storageName}`) &&
                    !resourcesKeep.includes(`${type}.${storageName}`)
                ) {
                    // BUG FIX: Format-konsistenter Key für resourcesKeep
                    resourcesKeep.push(
                        this.config.newTreeStructure ? `${type}.${storageName}` : `${type}_${storageName}`,
                    );

                    sid = this.config.newTreeStructure
                        ? `${this.namespace}.${type}.${storageName}`
                        : `${this.namespace}.${type}_${storageName}`;

                    if (!this.objects[sid]) {
                        this.objects[sid] = {
                            type: 'channel',
                            common: { name: res.storage },
                            native: { type },
                        };
                        await this.setObjectNotExistsAsync(sid, this.objects[sid]);
                    }

                    if (res.status !== 'unknown') {
                        let storageStatus: StatusRecord | undefined;
                        try {
                            storageStatus = await this.proxmox!.getStorageStatus(res.node, res.storage, !!res.shared);
                            this.log.debug(`new storage: ${res.storage} - ${JSON.stringify(storageStatus)}`);

                            const storageStates = this.findState(sid, storageStatus);
                            for (const element of storageStates) {
                                await this.createCustomState(element[0], element[1], element[2], element[3]);
                            }

                            if (this.config.requestStorageInformationBackup) {
                                await this.extendObjectAsync(`${sid}.backupJson`, {
                                    type: 'state',
                                    common: {
                                        name: {
                                            en: 'Backup JSON',
                                            de: 'Backup JSON',
                                            ru: 'Backup JSON',
                                            pt: 'Backup JSON',
                                            nl: 'Backup JSON',
                                            fr: 'Backup JSON',
                                            it: 'Backup JSON',
                                            es: 'Backup JSON',
                                            pl: 'Backup JSON',
                                            uk: 'Backup JSON',
                                            'zh-cn': 'Backup JSON',
                                        },
                                        type: 'string',
                                        role: 'json',
                                        read: true,
                                        write: false,
                                    },
                                    native: {},
                                });
                                await this.setStateChangedAsync(`${sid}.backupJson`, { val: '{}', ack: true });
                            }
                        } catch (err) {
                            if ((err as Error).message === 'STOPPED') {
                                return; // Adapter wird beendet – kein Logging nötig
                            }
                            this.log.error(
                                `Storageerror createVM: ${res.storage} on ${res.node} (status: ${res.status}): ${(err as Error).message}`,
                            );
                            this.log.debug(`Storageerror Detail: ${JSON.stringify(storageStatus)}`);
                        }
                    }
                }
            }
        }

        // Nicht mehr vorhandene Ressourcen löschen
        for (const res of resourcesAll) {
            if (!resourcesKeep.includes(res)) {
                await this.delObjectAsync(res, { recursive: true });
                delete this.objects[`${this.namespace}.${res}`];
                this.log.info(`Deleted old resource "${res}"`);
            }
        }
    } catch (err) {
        if ((err as Error).message === 'STOPPED') {
            return; // Adapter wird beendet – kein Logging nötig
        }
        this.log.debug(`Unable to get cluster resources: ${err as string}`);
    }
}

/**
 * setMachines – aktualisiert VM/LXC/Storage-States im laufenden Betrieb.
 */
export async function setMachines(this: ProxmoxAdapterContext): Promise<void> {
    try {
        const resources = await this.proxmox!.getClusterResources();
        const idNames = getMachineIdNames(this, resources);
        const knownObjIds = Object.keys(this.objects);
        const offlineMachines: Record<string, string> = {};
        const storageKeep: string[] = [];

        // offlineMachines wird erst NACH der Iteration gesetzt (BUG FIX: nicht vorab leer setzen)

        for (const res of resources) {
            let sid = '';

            // ── qemu / lxc ─────────────────────────────────────────────────
            if (res.type === 'qemu' || res.type === 'lxc') {
                const resName = this.prepareNameForId(res.name);
                const idName = idNames.get(res) ?? resName;

                sid = this.config.newTreeStructure
                    ? `${this.namespace}.${res.type}.${idName}`
                    : `${this.namespace}.${res.type}_${idName}`;

                if (res.status === 'unknown') {
                    res.status = 'offline';
                }

                if (resName === 'undefined') {
                    offlineMachines[res.id] = 'offline';
                    continue;
                }

                await this.setStateChangedAsync(`${sid}.status`, { val: res.status, ack: true });

                if (!knownObjIds.includes(sid)) {
                    this.log.info(`Detected new VM/storage "${res.name}" (${idName}) - restarting instance`);
                    this.restart();
                    return;
                }

                let available = false;
                let resourceStatus: StatusRecord | OfflineResourceStatus | null;

                if (res.status === 'running') {
                    resourceStatus = await this.proxmox!.getResourceStatus(res.node, res.type, res.vmid, false);
                    available = true;
                } else {
                    this.offlineResourceStatus.status = res.status;
                    this.offlineResourceStatus.type = res.type;
                    this.offlineResourceStatus.name = resName;
                    this.offlineResourceStatus.vmid = res.vmid;
                    resourceStatus = this.offlineResourceStatus;
                }

                await this.setStateChangedAsync(`${sid}.available`, { val: available, ack: true });

                // Absicht: Ohne Status wirft findState(), das fängt der catch am Ende dieser Funktion ab
                const states = this.findState(sid, resourceStatus!);
                for (const element of states) {
                    await this.setStateChangedAsync(`${element[0]}.${element[1]}`, element[3], true);
                }
            }

            // ── storage ────────────────────────────────────────────────────
            if (res.type === 'storage' && this.config.requestStorageInformation) {
                const storageName = !res.shared
                    ? `${res.node}_${this.prepareNameForId(res.storage)}`
                    : this.prepareNameForId(res.storage);

                if (!storageKeep.includes(storageName)) {
                    storageKeep.push(storageName);

                    const type = res.type;
                    sid = this.config.newTreeStructure
                        ? `${this.namespace}.${type}.${storageName}`
                        : `${this.namespace}.${type}_${storageName}`;

                    if (res.status !== 'unknown') {
                        try {
                            const storageStatus = await this.proxmox!.getStorageStatus(
                                res.node,
                                res.storage,
                                !!res.shared,
                            );
                            const storageStates = this.findState(sid, storageStatus);
                            for (const element of storageStates) {
                                await this.setStateChangedAsync(`${element[0]}.${element[1]}`, element[3], true);
                            }
                        } catch (err) {
                            if ((err as Error).message === 'STOPPED') {
                                return; // Adapter wird beendet – kein Logging nötig
                            }
                            this.log.warn(
                                `setMachines storageStatus: ${res.storage} on ${res.id} nicht verfügbar: ${(err as Error).message}`,
                            );
                        }

                        if (this.config.requestStorageInformationBackup) {
                            try {
                                const allBackupStatus = await this.proxmox!.getBackupStatus(res.node, res.storage);
                                const backupJson: Record<string, ProxmoxBackupEntry> = {};
                                for (const backupStatus of allBackupStatus) {
                                    backupJson[backupStatus.volid] = backupStatus;
                                }
                                await this.setStateChangedAsync(`${sid}.backupJson`, {
                                    val: JSON.stringify(backupJson),
                                    ack: true,
                                });
                            } catch (err) {
                                if ((err as Error).message === 'STOPPED') {
                                    return; // Adapter wird beendet
                                }
                                this.log.warn(
                                    `setMachines backupStatus: ${res.storage} auf ${res.id} nicht verfügbar: ${(err as Error).message}`,
                                );
                            }
                        }
                    }
                }
            }
        }

        // BUG FIX: State erst nach vollständiger Iteration setzen
        await this.setStateAsync('info.offlineMachines', JSON.stringify(offlineMachines), true);
    } catch (err) {
        if ((err as Error).message === 'STOPPED') {
            return; // Adapter wird beendet – kein Logging nötig
        }
        this.log.debug(`Unable to get cluster resources: ${(err as Error).message}`);
    }
}
