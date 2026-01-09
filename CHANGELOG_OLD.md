# Older changes
## 2.4.4 (2025-12-22)
* (arteck) fix reconnect if node is offline

## 2.4.3 (2025-12-22)
* (arteck) fix check backupStatus

## 2.4.2 (2025-12-07)
* (arteck) Adapter requires node.js >= 20, js-controller >= 6.0.11 and admin >= 7.6.17 now
* (Scrounger) some improvements
* (arteck) Dependencies have been updated
* (arteck) migrate to eslint 9

## 2.4.0 (2025-01-27)
* (mcm1957) BREAKING: you must enter your configuration data again at the config page.

## 2.3.1 (2025-01-26)
* (arteck) new settings structure
* (arteck) fix storage request
* (arteck) add new eslint file
* (arteck) fix node message
* (arteck) refactor

## 2.3.0 (2024-04-26)
* (mcm1957) Adapter requires node.js >= 18 and js-controller >= 5 now
* (jens-maus) fix ha and ceph object type
* (mcm1957) Dependencies have been updated

## 2.2.3 (2024-02-01)
* (arteck) add icon status available for lxc and vm
* (arteck) settings adjustment

## 2.2.2 (2023-11-06)
* (arteck) storage message corr

## 2.2.1 (2023-10-28)
* (arteck) machines delete after restart corr
* (arteck) vmid type corr
* (arteck) corstorage error message

## 2.2.0 (2023-10-21)
* (arteck) new Object tree structure (selectable)
* (arteck) added HA Information
* (arteck) Storage info is selectable
* (arteck) Backup info are under Storage info as Object backupJson
* (arteck) corr info for offline container
* (arteck) axios timout is now 5 sec.

## 2.1.0 (2023-09-25)
* (klein0r) Improved error handling
* (arteck) Added cluster adaptation

## 2.0.2 (2023-09-08)
* (klein0r) Added option for disk information
* (klein0r) Check a type of disk wear out
* (klein0r) Catch exception when requesting disk information

## 2.0.1 (2023-09-07)
* (klein0r) Added node disks (heals, wearout)

## 2.0.0 (2023-09-07)

* (klein0r) Updated admin instance configuration
* (klein0r) Refactoring of adapter
* (klein0r) Allow dots in resource names

__Requires js-controller >= 3.3.22__
__Requires admin >= 6.0.0__

## 1.3.5 (2022-08-11)
* (foxriver76) fixed warning if `max_cpu` is not in response

## 1.3.4 (2021-05-07)
* (foxriver76) add dataSource and connectionType
* (foxriver76) add compact mode (closes #12, closes #49)

## 1.3.3 (2021-05-02)
* (foxriver76) we fixed some incorrect types

## 1.3.2 (2021-03-26)
* (foxriver76) status of vms is now a string instead of incorrectly a button

## 1.3.0 (2021-03-26)
* (foxriver76) Detect newly added VMs/storages/nodes during runtime and restart instance to initialize everything correctly
* (foxriver76) clean up deleted VM/storage/node objects
__Requires js-controller >= 2.2.8__

## 1.2.0 (2020-01-24)
* (foxriver76) Created info connection state + channel
* (foxriver76) status is a string and not a boolean, so set an obj type correctly
* (foxriver76) fix bug which resulted in not all nodes objects being created during a single execution of the adapter
* (foxriver76) password can now only be read by own instance if a controller version is new enough

__js-controller v2  or above required__
__node v10 or above required__

## 1.1.0 (10.08.2020)
* (Apollon77) Bug Update on features and stability and performance
* (ThetaGamma) Fix for failing Node shutdown/reboot commands

## 1.0.1 (05.03.2020)
* (MeisterTR) bump version to stable

## 0.5.2 (27.11.2019)
* (DutchmanNL) Fix issue with special character in password, now you can use $/&/* etc

## 0.5.1 (17.09.2019)
* (MeisterTR) add act. disk size form vm and lxc and disc size_level
* (MeisterTR) add start/stop and shutdown for vm an lxc (nodes must be testet my dev is on the node so i cant test stop node)

## 0.3.1 (03.10.2018)
* (MeisterTR) fixed mem_lev, error at install, catch error no node and vm

## 0.3.0 (28.09.2018)
* (MeisterTR) add storage
* (MeisterTR) add password encryption

## 0.2.0 (27.09.2018)
* (MeisterTR) add container

## 0.0.5 (25.09.2018)
* (MeisterTR) cleaning up

## 0.0.5 (02.05.2018)
* (MeisterTR) fixed wrong ram

## 0.0.5 (29.04.2018)
* (MeisterTR) Testing fixes, now ready for node4

## 0.0.3 (26.04.2018)
* (MeisterTR) first running version

## 0.0.2
* (MeisterTR) first running version

## 0.0.1
* (MeisterTR) initial release
