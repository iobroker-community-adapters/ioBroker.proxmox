import { stateNames, vmButtonLabels } from './translations';
import type { OfflineResourceStatus, ProxmoxAdapterContext, ProxmoxBackupEntry, StatusRecord } from './types';

const VM_COMMANDS = ['start', 'stop', 'shutdown', 'reboot', 'reset', 'suspend', 'resume'] as const;

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

        for (const res of resources) {
            let sid = '';
            const type = res.type;
            const resName = this.prepareNameForId(res.name);

            if (this.config.newTreeStructure) {
                sid = `${this.namespace}.${type}.${resName}`;
            } else {
                sid = `${this.namespace}.${type}_${resName}`;
            }

            if (res.status === 'unknown') {
                res.status = 'offline';
            }

            // ── qemu / lxc ─────────────────────────────────────────────────
            if (res.type === 'qemu' || res.type === 'lxc') {
                // BUG FIX: Separator muss zum Format in resourcesAll passen
                resourcesKeep.push(this.config.newTreeStructure ? `${type}.${resName}` : `${type}_${resName}`);

                if (!this.objects[sid]) {
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
                    this.subscribeForeignStates(`${sid}.${cmd}`);
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
        const knownObjIds = Object.keys(this.objects);
        const offlineMachines: Record<string, string> = {};
        const storageKeep: string[] = [];

        // offlineMachines wird erst NACH der Iteration gesetzt (BUG FIX: nicht vorab leer setzen)

        for (const res of resources) {
            let sid = '';

            // ── qemu / lxc ─────────────────────────────────────────────────
            if (res.type === 'qemu' || res.type === 'lxc') {
                const resName = this.prepareNameForId(res.name);

                sid = this.config.newTreeStructure
                    ? `${this.namespace}.${res.type}.${resName}`
                    : `${this.namespace}.${res.type}_${resName}`;

                if (res.status === 'unknown') {
                    res.status = 'offline';
                }

                if (resName === 'undefined') {
                    offlineMachines[res.id] = 'offline';
                    continue;
                }

                await this.setStateChangedAsync(`${sid}.status`, { val: res.status, ack: true });

                if (!knownObjIds.includes(sid)) {
                    this.log.info(`Detected new VM/storage "${res.name}" (${resName}) - restarting instance`);
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
