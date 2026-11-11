![Logo](../../admin/proxmox.png)

# ioBroker.proxmox

## Anforderungen
- Node.js 22.19 (or later)
- js-controller 6.0.11 (or later)
- Admin Adapter 7.7.22 (or later)

## Available updates of the nodes
With the option **Request available updates** the adapter reads the available package updates (apt) of every node that is online.
It does so in the first poll after the start and then in the configured interval (default 60 minutes, at least 10 minutes).

| State | Description |
| --- | --- |
| `node_<name>.updates.count` | Number of available updates |
| `node_<name>.updates.list` | The updates as JSON, for example `[{"package": "pve-manager", "oldVersion": "9.0.1", "version": "9.0.2", "origin": "Proxmox"}]` |
| `node_<name>.updates.refresh` | Button: refreshes the package index of the node (like `apt-get update`) and reads the updates again |

Proxmox refreshes the package index itself once a day. The button is only needed if new updates should show up at once.
The device manager shows the updates in the details of a node.

Permissions of the Proxmox user on `/nodes/<name>`: `Sys.Audit` for reading, `Sys.Modify` for the button.

Only the updates of the Proxmox host are detected. What is installed inside a container or a VM is not available through the Proxmox API.

## vis-2 widget

The widget set "Proxmox" contains a widget for one VM or container. Select the machine from the list. The widget shows the state, uptime, CPU and RAM, and has buttons to start and stop the machine.

- **Show uptime:** the uptime is shown while the machine is running.
- **Show icon:** the color of the icon shows the state. Use **Icon** to choose your own icon, or **Image** to choose your own image file. An image takes precedence over the icon and keeps its own colors.
- **Show controls:** without this option, the widget only displays the state. Use it if a vis project is reachable by people who should not be able to stop machines. The confirmation is no access protection.
- **Stop button:** by default it shuts the machine down cleanly. "Power off immediately" uses the Proxmox command `stop`, which can lose unsaved data.
- After a command, the state updates with the next poll, about 10 seconds later. Until then, the widget shows "In progress".
