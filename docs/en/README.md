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

### Widget "Proxmox node"

The second widget of the set shows a Proxmox node: state, uptime, CPU and RAM, and the available updates. Select the node from the list.

- **Available updates:** "Show and refresh" shows the number of updates and a button that refreshes the package index of the node (like `apt update`). "Show only" shows only the number, "Do not show" hides both. The packages are listed in the tooltip of the indicator.
- The indicator needs the option **Request available updates** in the adapter, the button also needs the permission `Sys.Modify` of the Proxmox user.
- While the package index is refreshed, the button shows "Refreshing". This can take up to two minutes.
- The updates are still installed in the Proxmox web interface, the API cannot do that.
- Uptime, symbol, icon, image and "Without card" work like in the widget for VMs and containers.

## Widgets for devices and web components

The two widgets also exist for the devices adapter and as web components:

- **devices:** "Proxmox VM or container" and "Proxmox node" in the set "Proxmox". Size 1x1 is a tile with the state and one button, 2x0.5 a row, 2x1 a card with CPU and RAM.
- **Web components:** `<iob-proxmox-machine>` and `<iob-proxmox-node>` for Aura and every other UI that shows web components. They adapt to the size of their box: a small box shows a tile, a wide one a card with CPU and RAM. devices offers its own widgets instead of them.

In devices, first select the instance, then the VM, container or node from the list. The list comes from the instance, so it has to be running. In the web components, select the channel in the object tree, for example `proxmox.0.lxc_web` or `proxmox.0.node_pve`. The other settings are the same as in the vis-2 widgets. In devices, a widget that the access rights only allow to read cannot send commands. The confirmation before stopping is no access protection.

After an update of the adapter, run `iobroker upload proxmox` if the new widgets do not appear.
