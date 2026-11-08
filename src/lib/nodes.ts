import { formatUptime, getHostSuffix, withTimeout } from './methods';
import { nodeButtonLabels, stateNames } from './translations';
import type { ProxmoxAdapterContext, ProxmoxNode } from './types';

/**
 * Setzt Disk-States für einen Node (create oder set).
 *
 * @param ctx - Adapter-Instanz
 * @param sid - State-Basis-ID des Nodes
 * @param nodeName - Node-Name für API-Calls
 * @param createObjects - ob Objekte angelegt werden sollen
 */
async function processDiskStates(
    ctx: ProxmoxAdapterContext,
    sid: string,
    nodeName: string,
    createObjects: boolean,
): Promise<void> {
    const nodeDisks = await withTimeout(ctx, () => ctx.proxmox!.getNodeDisks(nodeName, false));

    for (const disk of nodeDisks) {
        if (!disk.devpath) {
            ctx.log.warn(
                `${createObjects ? 'createNodes' : 'setNodes'}: Disk ohne devpath auf Node ${nodeName} übersprungen`,
            );
            continue;
        }
        const devpath = disk.devpath;
        const diskPath = `disk_${String(devpath).replace('/dev/', '')}`;

        if (createObjects) {
            await ctx.setObjectNotExistsAsync(`${sid}.${diskPath}`, {
                type: 'folder',
                common: { name: devpath },
                native: {},
            });
        }

        if (disk.type !== undefined && disk.type.toLowerCase() !== 'unknown') {
            if (createObjects) {
                await ctx.createCustomState(sid, `${diskPath}.type`, 'text', disk.type);
            } else {
                await ctx.setStateChangedAsync(`${sid}.${diskPath}.type`, { val: disk.type, ack: true });
            }
        }
        if (disk.size !== undefined) {
            if (createObjects) {
                await ctx.createCustomState(sid, `${diskPath}.size`, 'size', ctx.bytetoMb(disk.size));
            } else {
                await ctx.setStateChangedAsync(`${sid}.${diskPath}.size`, { val: ctx.bytetoMb(disk.size), ack: true });
            }
        }
        if (disk.health !== undefined && disk.health.toLowerCase() !== 'unknown') {
            if (createObjects) {
                await ctx.createCustomState(sid, `${diskPath}.health`, 'text', disk.health);
            } else {
                await ctx.setStateChangedAsync(`${sid}.${diskPath}.health`, { val: disk.health, ack: true });
            }
            try {
                const smart = await withTimeout(ctx, () => ctx.proxmox!.getNodeDisksSmart(nodeName, devpath));
                if (smart?.data?.text) {
                    if (createObjects) {
                        await ctx.createCustomState(sid, `${diskPath}.smart`, 'text', smart.data.text);
                    } else {
                        await ctx.setStateChangedAsync(`${sid}.${diskPath}.smart`, { val: smart.data.text, ack: true });
                    }
                }
            } catch (smartErr) {
                ctx.log.debug(
                    `${createObjects ? 'createNodes' : 'setNodes'}: SMART für ${devpath} nicht verfügbar: ${(smartErr as Error).message}`,
                );
            }
        }
        // Absicht: isNaN() mit Coercion. Proxmox liefert bei HDDs 'N/A', das so übersprungen wird.
        if (disk.wearout !== undefined && !isNaN(disk.wearout as number)) {
            if (createObjects) {
                await ctx.createCustomState(sid, `${diskPath}.wearout`, 'level', disk.wearout);
            } else {
                await ctx.setStateChangedAsync(`${sid}.${diskPath}.wearout`, { val: disk.wearout, ack: true });
            }
        }
        if (disk.model !== undefined) {
            if (createObjects) {
                await ctx.createCustomState(sid, `${diskPath}.model`, 'text', disk.model);
            } else {
                await ctx.setStateChangedAsync(`${sid}.${diskPath}.model`, { val: disk.model, ack: true });
            }
        }
    }
}

/**
 * createNodes – legt Node-Channel + States beim Adapter-Start an.
 *
 * @param nodes - Nodes aus der Proxmox-API
 * @returns IDs der Channels (ohne Namespace), die diese Proxmox-Instanz noch kennt, oder `null`, wenn
 * das nicht vollständig ermittelt werden konnte. Gelöscht wird in getNodes(), wenn alle Instanzen durch sind.
 */
export async function createNodes(this: ProxmoxAdapterContext, nodes: ProxmoxNode[]): Promise<string[] | null> {
    const nodesKeep: string[] = [];

    for (const node of nodes) {
        const plainName = this.prepareNameForId(node.node);
        const nodeName = `${plainName}${getHostSuffix(this, this.proxmox, `node_${plainName}`)}`;

        this.log.debug(`Node: ${JSON.stringify(node)}`);
        nodesKeep.push(`node_${nodeName}`);

        const sid = `${this.namespace}.${node.type}_${nodeName}`;

        if (!this.objects[sid]) {
            if (nodeName !== plainName) {
                this.log.info(`Several Proxmox hosts use the node name "${node.node}", using "${sid}"`);
            }
            this.objects[sid] = {
                type: 'channel',
                common: { name: node.node },
                native: { type: node.type },
            };
            await this.setObjectNotExistsAsync(sid, this.objects[sid]);
        }

        await this.extendObjectAsync(`${sid}.shutdown`, {
            type: 'state',
            common: {
                name: nodeButtonLabels.shutdown,
                type: 'boolean',
                role: 'button',
                read: true,
                write: true,
            },
            native: { node: node.node, type: node.type, host: this.proxmox?.hostId },
        });

        await this.extendObjectAsync(`${sid}.reboot`, {
            type: 'state',
            common: {
                name: nodeButtonLabels.reboot,
                type: 'boolean',
                role: 'button',
                read: true,
                write: true,
            },
            native: { node: node.node, type: node.type, host: this.proxmox?.hostId },
        });

        await this.extendObjectAsync(`${sid}.status`, {
            type: 'state',
            common: {
                name: stateNames.status,
                type: 'string',
                role: 'indicator.status',
                write: false,
                read: true,
            },
            native: {},
        });
        await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

        if (node.status === 'online') {
            // FIX: node.cpu kann 0 sein → !== undefined statt falsy-Check
            if (node.cpu !== undefined) {
                await this.createCustomState(sid, 'cpu', 'level', Math.round(node.cpu * 10000) / 100);
            }
            if (node.maxcpu) {
                await this.createCustomState(sid, 'cpu_max', 'default_num', node.maxcpu);
            }

            this.log.debug(`Requesting states for node ${node.node}`);
            try {
                const nodeStatus = await withTimeout(this, () => this.proxmox!.getNodeStatus(node.node));
                if (nodeStatus) {
                    if (nodeStatus.uptime !== undefined) {
                        await this.createCustomState(sid, 'uptime', 'time', nodeStatus.uptime);
                        await this.createCustomState(sid, 'uptime_text', 'text', formatUptime(nodeStatus.uptime));
                    }
                    if (nodeStatus.wait !== undefined) {
                        await this.createCustomState(sid, 'iowait', 'level', Math.round(nodeStatus.wait * 10000) / 100);
                    }
                    if (nodeStatus.memory?.used !== undefined) {
                        await this.createCustomState(sid, 'memory.used', 'size', this.bytetoMb(nodeStatus.memory.used));
                    }
                    if (nodeStatus.memory?.used !== undefined && nodeStatus.memory?.total !== undefined) {
                        await this.createCustomState(
                            sid,
                            'memory.used_lev',
                            'level',
                            this.used_level(nodeStatus.memory.used, nodeStatus.memory.total),
                        );
                    }
                    if (nodeStatus.memory?.total !== undefined) {
                        await this.createCustomState(
                            sid,
                            'memory.total',
                            'size',
                            this.bytetoMb(nodeStatus.memory.total),
                        );
                    }
                    if (nodeStatus.memory?.free !== undefined) {
                        await this.createCustomState(sid, 'memory.free', 'size', this.bytetoMb(nodeStatus.memory.free));
                    }
                    if (nodeStatus.loadavg?.[0] !== undefined) {
                        await this.createCustomState(
                            sid,
                            'loadavg.0',
                            'default_num',
                            parseFloat(nodeStatus.loadavg[0]),
                        );
                    }
                    if (nodeStatus.loadavg?.[1] !== undefined) {
                        await this.createCustomState(
                            sid,
                            'loadavg.1',
                            'default_num',
                            parseFloat(nodeStatus.loadavg[1]),
                        );
                    }
                    if (nodeStatus.loadavg?.[2] !== undefined) {
                        await this.createCustomState(
                            sid,
                            'loadavg.2',
                            'default_num',
                            parseFloat(nodeStatus.loadavg[2]),
                        );
                    }
                    if (nodeStatus.swap?.used !== undefined) {
                        await this.createCustomState(sid, 'swap.used', 'size', this.bytetoMb(nodeStatus.swap.used));
                    }
                    if (nodeStatus.swap?.free !== undefined) {
                        await this.createCustomState(sid, 'swap.free', 'size', this.bytetoMb(nodeStatus.swap.free));
                    }
                    if (nodeStatus.swap?.total !== undefined) {
                        await this.createCustomState(sid, 'swap.total', 'size', this.bytetoMb(nodeStatus.swap.total));
                    }
                    // FIX: Guard war swap.free statt swap.used → falscher Wert hätte undefined sein können
                    if (nodeStatus.swap?.used !== undefined && nodeStatus.swap?.total !== undefined) {
                        await this.createCustomState(
                            sid,
                            'swap.used_lev',
                            'level',
                            this.used_level(nodeStatus.swap.used, nodeStatus.swap.total),
                        );
                    }
                }
            } catch (err) {
                this.log.error(
                    `createNodes: Fehler beim Abrufen des Node-Status ${node.node}: ${(err as Error).message}`,
                );
            }

            if (this.config.requestDiskInformation) {
                try {
                    await processDiskStates(this, sid, node.node, true);
                } catch (err) {
                    this.log.warn(
                        `createNodes: Disk-Informationen für Node ${node.node} nicht abrufbar: ${(err as Error).message}`,
                    );
                }
            }
        } else {
            // setNodes leert den State, sobald der Node offline ist. Dafür muss es ihn auch dann geben.
            await this.createCustomState(sid, 'uptime_text', 'text', '');
        }
    }

    if (this.config.requestCephInformation) {
        await this.createCeph();
    }
    if (this.config.requestHAInformation) {
        await this.createHA();
    }
    const resourcesKeep = await this.createVM();

    return resourcesKeep ? [...nodesKeep, ...resourcesKeep] : null;
}

/**
 * setNodes – aktualisiert Node-States im laufenden Betrieb.
 *
 * @param nodes - Nodes aus der Proxmox-API
 */
export async function setNodes(this: ProxmoxAdapterContext, nodes: ProxmoxNode[]): Promise<void> {
    const knownObjIds = Object.keys(this.objects);

    for (const node of nodes) {
        this.log.debug(`Node: ${JSON.stringify(node)}`);

        // FIX: prepareNameForId verwenden – identisch zu createNodes, sonst falsche sid bei Sonderzeichen
        const plainName = this.prepareNameForId(node.node);
        const nodeName = `${plainName}${getHostSuffix(this, this.proxmox, `node_${plainName}`)}`;
        const sid = `${this.namespace}.${node.type}_${nodeName}`;

        if (!knownObjIds.includes(sid) && node.status === 'online') {
            this.log.info(`Detected new node "${node.node}" - restarting instance`);
            this.restart();
            return;
        }

        await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

        if (node.status !== 'offline') {
            // FIX: node.cpu kann 0 sein → !== undefined statt impliziter truthy-Auswertung
            if (node.cpu !== undefined) {
                await this.setStateChangedAsync(`${sid}.cpu`, { val: Math.round(node.cpu * 10000) / 100, ack: true });
            }
            if (node.maxcpu) {
                await this.setStateChangedAsync(`${sid}.cpu_max`, { val: node.maxcpu, ack: true });
            }

            this.log.debug(`Requesting states for node ${node.node}`);
            try {
                const nodeStatus = await withTimeout(this, () => this.proxmox!.getNodeStatus(node.node, true));
                if (nodeStatus) {
                    if (nodeStatus.uptime !== undefined) {
                        await this.setStateChangedAsync(`${sid}.uptime`, { val: nodeStatus.uptime, ack: true });
                        await this.setStateChangedAsync(`${sid}.uptime_text`, {
                            val: formatUptime(nodeStatus.uptime),
                            ack: true,
                        });
                    }
                    if (nodeStatus.wait !== undefined) {
                        await this.setStateChangedAsync(`${sid}.iowait`, {
                            val: Math.round(nodeStatus.wait * 10000) / 100,
                            ack: true,
                        });
                    }
                    if (nodeStatus.memory?.used !== undefined) {
                        await this.setStateChangedAsync(`${sid}.memory.used`, {
                            val: this.bytetoMb(nodeStatus.memory.used),
                            ack: true,
                        });
                    }
                    if (nodeStatus.memory?.used !== undefined && nodeStatus.memory?.total !== undefined) {
                        await this.setStateChangedAsync(`${sid}.memory.used_lev`, {
                            val: this.used_level(nodeStatus.memory.used, nodeStatus.memory.total),
                            ack: true,
                        });
                    }
                    if (nodeStatus.memory?.total !== undefined) {
                        await this.setStateChangedAsync(`${sid}.memory.total`, {
                            val: this.bytetoMb(nodeStatus.memory.total),
                            ack: true,
                        });
                    }
                    if (nodeStatus.memory?.free !== undefined) {
                        await this.setStateChangedAsync(`${sid}.memory.free`, {
                            val: this.bytetoMb(nodeStatus.memory.free),
                            ack: true,
                        });
                    }
                    if (nodeStatus.loadavg?.[0] !== undefined) {
                        await this.setStateChangedAsync(`${sid}.loadavg.0`, {
                            val: parseFloat(nodeStatus.loadavg[0]),
                            ack: true,
                        });
                    }
                    if (nodeStatus.loadavg?.[1] !== undefined) {
                        await this.setStateChangedAsync(`${sid}.loadavg.1`, {
                            val: parseFloat(nodeStatus.loadavg[1]),
                            ack: true,
                        });
                    }
                    if (nodeStatus.loadavg?.[2] !== undefined) {
                        await this.setStateChangedAsync(`${sid}.loadavg.2`, {
                            val: parseFloat(nodeStatus.loadavg[2]),
                            ack: true,
                        });
                    }
                    if (nodeStatus.swap?.used !== undefined) {
                        await this.setStateChangedAsync(`${sid}.swap.used`, {
                            val: this.bytetoMb(nodeStatus.swap.used),
                            ack: true,
                        });
                    }
                    if (nodeStatus.swap?.free !== undefined) {
                        await this.setStateChangedAsync(`${sid}.swap.free`, {
                            val: this.bytetoMb(nodeStatus.swap.free),
                            ack: true,
                        });
                    }
                    if (nodeStatus.swap?.total !== undefined) {
                        await this.setStateChangedAsync(`${sid}.swap.total`, {
                            val: this.bytetoMb(nodeStatus.swap.total),
                            ack: true,
                        });
                    }
                    if (nodeStatus.swap?.used !== undefined && nodeStatus.swap?.total !== undefined) {
                        await this.setStateChangedAsync(`${sid}.swap.used_lev`, {
                            val: this.used_level(nodeStatus.swap.used, nodeStatus.swap.total),
                            ack: true,
                        });
                    }
                }
            } catch (err) {
                this.log.error(`setNodes: Fehler beim Abrufen des Node-Status ${node.node}: ${(err as Error).message}`);
            }
        }

        if (this.config.requestDiskInformation && node.status !== 'offline') {
            try {
                await processDiskStates(this, sid, node.node, false);
            } catch (err) {
                this.log.warn(
                    `setNodes: Disk-Informationen für Node ${node.node} nicht abrufbar: ${(err as Error).message}`,
                );
            }
        }
        if (node.status === 'offline') {
            await this.setStateChangedAsync(`${sid}.uptime_text`, { val: '', ack: true });
        }
    }
}
