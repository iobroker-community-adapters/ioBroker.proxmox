![Logo](admin/proxmox.png)

# ioBroker.proxmox

[![NPM version](https://img.shields.io/npm/v/iobroker.proxmox?style=flat-square)](https://www.npmjs.com/package/iobroker.proxmox)
[![Downloads](https://img.shields.io/npm/dm/iobroker.proxmox?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.proxmox)
![node-lts](https://img.shields.io/node/v-lts/iobroker.proxmox?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.proxmox?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/iobroker-community-adapters/iobroker.proxmox?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/iobroker.proxmox?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/iobroker.proxmox?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/iobroker.proxmox?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/iobroker.proxmox?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/iobroker-community-adapters/iobroker.proxmox/test-and-release.yml?branch=master&logo=github&style=flat-square)

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.proxmox.svg?color=red&label=beta)
![Stable](http://iobroker.live/badges/proxmox-stable.svg)
![Installed](http://iobroker.live/badges/proxmox-installed.svg)

Control and use data from your Proxmox VE

## Documentation

[🇺🇸 Documentation](./docs/en/README.md)

[🇩🇪 Dokumentation](./docs/de/README.md)

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### next Version
* (arteck) new Object tree structure (selectable)
* (arteck) added HA Information
* (arteck) Storage info is selectable
* (arteck) Backup info are under Storage info as Object backupJson
* (arteck) corr info for offline container
* (arteck) axios timout is now 5 sec.


### 2.1.0 (2023-09-25)
* (klein0r) Improved error handling
* (arteck) Added cluster adaptation

### 2.0.2 (2023-09-08)
* (klein0r) Added option for disk information
* (klein0r) Check a type of disk wear out
* (klein0r) Catch exception when requesting disk information

### 2.0.1 (2023-09-07)
* (klein0r) Added node disks (heals, wearout)

### 2.0.0 (2023-09-07)

* (klein0r) Updated admin instance configuration
* (klein0r) Refactoring of adapter
* (klein0r) Allow dots in resource names

__Requires js-controller >= 3.3.22__
__Requires admin >= 6.0.0__

### 1.3.5 (2022-08-11)
* (foxriver76) fixed warning if `max_cpu` is not in response

## License

The MIT License (MIT)

Copyright (c) 2023 MeisterTR <meistertr.smarthome@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
