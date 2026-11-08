// Augments the globally declared ioBroker types with everything this adapter adds.
// Keep in sync with `native` in io-package.json and with admin/jsonConfig.json.
import type { ProxmoxDeviceConfig } from './types';

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Abfrageintervall in Sekunden (Minimum 5) */
            requestInterval: number;
            requestDiskInformation: boolean;
            newTreeStructure: boolean;
            requestHAInformation: boolean;
            requestCephInformation: boolean;
            requestStorageInformation: boolean;
            requestStorageInformationBackup: boolean;
            tableDevices: ProxmoxDeviceConfig[];

            /**
             * Bewusst weder in `native` noch in jsonConfig.json: Das sind versteckte Stellschrauben, die
             * ProxmoxUtils auswertet, falls sie von Hand in das Instanzobjekt eingetragen wurden.
             */
            retryCount5xx?: number;
            retryDelay5xx?: number;
        }
    }
}

export {}; // nötig, damit die Datei als Modul gilt
