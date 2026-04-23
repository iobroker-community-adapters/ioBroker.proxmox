'use strict';

const { nodeButtonLabels, stateNames } = require('./translations');

/**
 * createNodes – legt Node-Channel + States beim Adapter-Start an.
 *
 * @param {any[]} nodes
 */
async function createNodes(nodes) {
    const nodesAll = Object.keys(this.objects)
        .map(this.removeNamespace.bind(this))
        .filter((id) => id.startsWith('node_'));

    const nodesKeep = [];

    for (const node of nodes) {
        const nodeName = this.prepareNameForId(node.node);

        this.log.debug(`Node: ${JSON.stringify(node)}`);
        nodesKeep.push(`node_${nodeName}`);

        const sid = `${this.namespace}.${node.type}_${nodeName}`;

        if (!this.objects[sid]) {
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
                type: 'boolean', role: 'button', read: true, write: true,
            },
            native: { node: node.node, type: node.type },
        });
        this.subscribeForeignStates(`${sid}.shutdown`);

        await this.extendObjectAsync(`${sid}.reboot`, {
            type: 'state',
            common: {
                name: nodeButtonLabels.reboot,
                type: 'boolean', role: 'button', read: true, write: true,
            },
            native: { node: node.node, type: node.type },
        });
        this.subscribeForeignStates(`${sid}.reboot`);

        await this.extendObjectAsync(`${sid}.status`, {
            type: 'state',
            common: {
                name: stateNames.status,
                type: 'string', role: 'indicator.status', write: false, read: true,
            },
            native: {},
        });
        await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

        if (node.status === 'online') {
            if (node.cpu) {
                await this.createCustomState(sid, 'cpu', 'level', Math.round(node.cpu * 10000) / 100);
            }
            if (node.maxcpu) {
                await this.createCustomState(sid, 'cpu_max', 'default_num', node.maxcpu);
            }

            this.log.debug(`Requesting states for node ${node.node}`);
            try {
                const nodeStatus = await this.proxmox.getNodeStatus(node.node);
                if (nodeStatus) {
                    if (nodeStatus.uptime !== undefined) {
await this.createCustomState(sid, 'uptime', 'time', nodeStatus.uptime);
}
                    if (nodeStatus.wait !== undefined) {
await this.createCustomState(sid, 'iowait', 'level', Math.round(nodeStatus.wait * 10000) / 100);
}

                    if (nodeStatus.memory?.used !== undefined) {
await this.createCustomState(sid, 'memory.used', 'size', this.bytetoMb(nodeStatus.memory.used));
}
                    if (nodeStatus.memory?.used !== undefined && nodeStatus.memory?.total !== undefined) {
await this.createCustomState(sid, 'memory.used_lev', 'level', this.used_level(nodeStatus.memory.used, nodeStatus.memory.total));
}
                    if (nodeStatus.memory?.total !== undefined) {
await this.createCustomState(sid, 'memory.total', 'size', this.bytetoMb(nodeStatus.memory.total));
}
                    if (nodeStatus.memory?.free !== undefined) {
await this.createCustomState(sid, 'memory.free', 'size', this.bytetoMb(nodeStatus.memory.free));
}

                    if (nodeStatus.loadavg?.[0] !== undefined) {
await this.createCustomState(sid, 'loadavg.0', 'default_num', parseFloat(nodeStatus.loadavg[0]));
}
                    if (nodeStatus.loadavg?.[1] !== undefined) {
await this.createCustomState(sid, 'loadavg.1', 'default_num', parseFloat(nodeStatus.loadavg[1]));
}
                    if (nodeStatus.loadavg?.[2] !== undefined) {
await this.createCustomState(sid, 'loadavg.2', 'default_num', parseFloat(nodeStatus.loadavg[2]));
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
                    if (nodeStatus.swap?.free !== undefined && nodeStatus.swap?.total !== undefined) {
await this.createCustomState(sid, 'swap.used_lev', 'level', this.used_level(nodeStatus.swap.used, nodeStatus.swap.total));
}
                }
            } catch (err) {
                this.log.warn(`Unable to get status of node ${node.node}: ${err}`);
            }

            if (this.config.requestDiskInformation) {
                try {
                    const nodeDisks = await this.proxmox.getNodeDisks(node.node, false);
                    for (const disk of nodeDisks) {
                        if (!disk.devpath) {
                            this.log.warn(`createNodes: Disk ohne devpath auf Node ${node.node} übersprungen`);
                            continue;
                        }
                        const diskPath = `disk_${String(disk.devpath).replace('/dev/', '')}`;
                        await this.setObjectNotExistsAsync(`${sid}.${diskPath}`, {
                            type: 'folder',
                            common: { name: disk.devpath },
                            native: {},
                        });
                        if (disk.type !== undefined && disk.type.toLowerCase() !== 'unknown') {
await this.createCustomState(sid, `${diskPath}.type`, 'text', disk.type);
}
                        if (disk.size !== undefined) {
await this.createCustomState(sid, `${diskPath}.size`, 'size', this.bytetoMb(disk.size));
}
                        if (disk.health !== undefined && disk.health.toLowerCase() !== 'unknown') {
                            await this.createCustomState(sid, `${diskPath}.health`, 'text', disk.health);
                            try {
                                const smart = await this.proxmox.getNodeDisksSmart(node.node, disk.devpath);
                                if (smart?.data?.text) {
await this.createCustomState(sid, `${diskPath}.smart`, 'text', smart.data.text);
}
                            } catch (smartErr) {
                                this.log.debug(`createNodes: SMART für ${disk.devpath} nicht verfügbar: ${smartErr.message}`);
                            }
                        }
                        if (disk.wearout !== undefined && !isNaN(disk.wearout)) {
await this.createCustomState(sid, `${diskPath}.wearout`, 'level', disk.wearout);
}
                        if (disk.model !== undefined) {
await this.createCustomState(sid, `${diskPath}.model`, 'text', disk.model);
}
                    }
                } catch (err) {
                    this.log.warn(`createNodes: Disk-Informationen für Node ${node.node} nicht abrufbar: ${err.message}`);
                }
            }
        }
    }

    if (this.config.requestCephInformation) {
await this.createCeph();
}
    if (this.config.requestHAInformation)   {
await this.createHA();
}
    await this.createVM();

    // Nicht mehr vorhandene Nodes löschen
    for (const node of nodesAll) {
        if (!nodesKeep.includes(node)) {
            await this.delObjectAsync(node, { recursive: true });
            delete this.objects[`${this.namespace}.${node}`];
            this.log.info(`Deleted old node "${node}"`);
        }
    }
}

/**
 * setNodes – aktualisiert Node-States im laufenden Betrieb.
 *
 * @param {any[]} nodes
 */
async function setNodes(nodes) {
    const knownObjIds = Object.keys(this.objects);

    for (const node of nodes) {
        this.log.debug(`Node: ${JSON.stringify(node)}`);

        const sid = `${this.namespace}.${node.type}_${node.node}`;

        if (!knownObjIds.includes(sid) && node.status === 'online') {
            this.log.info(`Detected new node "${node.node}" - restarting instance`);
            return void this.restart();
        }

        await this.setStateChangedAsync(`${sid}.status`, { val: node.status, ack: true });

        if (node.status !== 'offline') {
            await this.setStateChangedAsync(`${sid}.cpu`, { val: Math.round(node.cpu * 10000) / 100, ack: true });
            if (node.maxcpu) {
await this.setStateChangedAsync(`${sid}.cpu_max`, { val: node.maxcpu, ack: true });
}

            this.log.debug(`Requesting states for node ${node.node}`);
            try {
                const nodeStatus = await this.proxmox.getNodeStatus(node.node, true);
                if (nodeStatus) {
                    if (nodeStatus.uptime !== undefined) {
await this.setStateChangedAsync(`${sid}.uptime`, { val: nodeStatus.uptime, ack: true });
}
                    if (nodeStatus.wait !== undefined) {
await this.setStateChangedAsync(`${sid}.iowait`, { val: Math.round(nodeStatus.wait * 10000) / 100, ack: true });
}

                    if (nodeStatus.memory?.used !== undefined) {
await this.setStateChangedAsync(`${sid}.memory.used`, { val: this.bytetoMb(nodeStatus.memory.used), ack: true });
}
                    if (nodeStatus.memory?.used !== undefined && nodeStatus.memory?.total !== undefined) {
await this.setStateChangedAsync(`${sid}.memory.used_lev`, { val: this.used_level(nodeStatus.memory.used, nodeStatus.memory.total), ack: true });
}
                    if (nodeStatus.memory?.total !== undefined) {
await this.setStateChangedAsync(`${sid}.memory.total`, { val: this.bytetoMb(nodeStatus.memory.total), ack: true });
}
                    if (nodeStatus.memory?.free !== undefined) {
await this.setStateChangedAsync(`${sid}.memory.free`, { val: this.bytetoMb(nodeStatus.memory.free), ack: true });
}

                    if (nodeStatus.loadavg?.[0] !== undefined) {
await this.setStateChangedAsync(`${sid}.loadavg.0`, { val: parseFloat(nodeStatus.loadavg[0]), ack: true });
}
                    if (nodeStatus.loadavg?.[1] !== undefined) {
await this.setStateChangedAsync(`${sid}.loadavg.1`, { val: parseFloat(nodeStatus.loadavg[1]), ack: true });
}
                    if (nodeStatus.loadavg?.[2] !== undefined) {
await this.setStateChangedAsync(`${sid}.loadavg.2`, { val: parseFloat(nodeStatus.loadavg[2]), ack: true });
}

                    if (nodeStatus.swap?.used !== undefined) {
await this.setStateChangedAsync(`${sid}.swap.used`, { val: this.bytetoMb(nodeStatus.swap.used), ack: true });
}
                    if (nodeStatus.swap?.free !== undefined) {
await this.setStateChangedAsync(`${sid}.swap.free`, { val: this.bytetoMb(nodeStatus.swap.free), ack: true });
}
                    if (nodeStatus.swap?.total !== undefined) {
await this.setStateChangedAsync(`${sid}.swap.total`, { val: this.bytetoMb(nodeStatus.swap.total), ack: true });
}
                    if (nodeStatus.swap?.used !== undefined && nodeStatus.swap?.total !== undefined) {
await this.setStateChangedAsync(`${sid}.swap.used_lev`, { val: this.used_level(nodeStatus.swap.used, nodeStatus.swap.total), ack: true });
}
                }
            } catch (err) {
                this.log.warn(`Unable to get status of node ${node.node}: ${err}`);
            }
        }

        if (this.config.requestDiskInformation) {
            try {
                if (node.status !== 'offline') {
                    const nodeDisks = await this.proxmox.getNodeDisks(node.node, false);
                    for (const disk of nodeDisks) {
                        if (!disk.devpath) {
                            this.log.warn(`setNodes: Disk ohne devpath auf Node ${node.node} übersprungen`);
                            continue;
                        }
                        const diskPath = `disk_${String(disk.devpath).replace('/dev/', '')}`;
                        if (disk.type !== undefined && disk.type.toLowerCase() !== 'unknown') {
await this.setStateChangedAsync(`${sid}.${diskPath}.type`, { val: disk.type, ack: true });
}
                        if (disk.size !== undefined) {
await this.setStateChangedAsync(`${sid}.${diskPath}.size`, { val: this.bytetoMb(disk.size), ack: true });
}
                        if (disk.health !== undefined && disk.health.toLowerCase() !== 'unknown') {
                            await this.setStateChangedAsync(`${sid}.${diskPath}.health`, { val: disk.health, ack: true });
                            try {
                                const smart = await this.proxmox.getNodeDisksSmart(node.node, disk.devpath);
                                if (smart?.data?.text) {
await this.setStateChangedAsync(`${sid}.${diskPath}.smart`, { val: smart.data.text, ack: true });
}
                            } catch (smartErr) {
                                this.log.debug(`setNodes: SMART für ${disk.devpath} nicht verfügbar: ${smartErr.message}`);
                            }
                        }
                        if (disk.wearout !== undefined && !isNaN(disk.wearout)) {
await this.setStateChangedAsync(`${sid}.${diskPath}.wearout`, { val: disk.wearout, ack: true });
}
                        if (disk.model !== undefined) {
await this.setStateChangedAsync(`${sid}.${diskPath}.model`, { val: disk.model, ack: true });
}
                    }
                }
            } catch (err) {
                this.log.warn(`setNodes: Disk-Informationen für Node ${node.node} nicht abrufbar: ${err.message}`);
            }
        }
    }
}

module.exports = { createNodes, setNodes };
