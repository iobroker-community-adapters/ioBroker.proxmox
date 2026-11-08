![Logo](../../admin/proxmox.png)

# ioBroker.proxmox

## Anforderungen
- Node.js 22.19 (or later)
- js-controller 6.0.11 (or later)
- Admin Adapter 7.7.22 (or later)

## vis-2 widget

The widget set "Proxmox" contains a widget for one VM or container. Select the machine from the list. The widget shows the state, uptime, CPU and RAM, and has buttons to start and stop the machine.

- **Show uptime:** the uptime is shown while the machine is running.
- **Show icon:** the color of the icon shows the state. Use **Icon** to choose your own icon, or **Image** to choose your own image file. An image takes precedence over the icon and keeps its own colors.
- **Show controls:** without this option, the widget only displays the state. Use it if a vis project is reachable by people who should not be able to stop machines. The confirmation is no access protection.
- **Stop button:** by default it shuts the machine down cleanly. "Power off immediately" uses the Proxmox command `stop`, which can lose unsaved data.
- After a command, the state updates with the next poll, about 10 seconds later. Until then, the widget shows "In progress".
