/**
 * Zentrale Übersetzungstabelle für den ioBroker Proxmox Adapter.
 * Schlüssel entsprechen ioBroker-Sprachcodes: en, de, ru, fr, nl, pl, it, es, pt, uk, zh-cn
 */

/** Text je Sprachcode */
export type Translations = Record<string, string>;

// ─── Wiederverwendete Basis-Übersetzungen ──────────────────────────────────

export const STATUS = {
    en: 'Status',
    de: 'Status',
    ru: 'Статус',
    pt: 'Estado',
    nl: 'Status',
    fr: 'État',
    it: 'Stato',
    es: 'Situación',
    pl: 'Status',
    uk: 'Статус на сервери',
    'zh-cn': '现状',
};

export const SHUTDOWN = {
    en: 'Shutdown',
    de: 'Herunterfahren',
    ru: 'Выключить',
    pt: 'Desligar',
    nl: 'Afsluiten',
    fr: 'Éteindre',
    it: 'Arresta',
    es: 'Apagar',
    pl: 'Wyłącz',
    uk: 'Вимкнути',
    'zh-cn': '关机',
};

export const REBOOT = {
    en: 'Reboot',
    de: 'Neustart',
    ru: 'Перезагрузить',
    pt: 'Reiniciar',
    nl: 'Opnieuw opstarten',
    fr: 'Redémarrer',
    it: 'Riavvia',
    es: 'Reiniciar',
    pl: 'Uruchom ponownie',
    uk: 'Перезавантажити',
    'zh-cn': '重启',
};

export const START = {
    en: 'Start',
    de: 'Start',
    ru: 'Запустить',
    pt: 'Iniciar',
    nl: 'Starten',
    fr: 'Démarrer',
    it: 'Avvia',
    es: 'Iniciar',
    pl: 'Uruchom',
    uk: 'Запустити',
    'zh-cn': '启动',
};

export const STOP = {
    en: 'Stop',
    de: 'Stopp',
    ru: 'Остановить',
    pt: 'Parar',
    nl: 'Stoppen',
    fr: 'Arrêter',
    it: 'Ferma',
    es: 'Detener',
    pl: 'Zatrzymaj',
    uk: 'Зупинити',
    'zh-cn': '停止',
};

export const RESET = {
    en: 'Reset',
    de: 'Zurücksetzen',
    ru: 'Сброс',
    pt: 'Reinicializar',
    nl: 'Reset',
    fr: 'Réinitialiser',
    it: 'Reset',
    es: 'Reiniciar',
    pl: 'Reset',
    uk: 'Скидання',
    'zh-cn': '重置',
};

export const SUSPEND = {
    en: 'Suspend',
    de: 'Anhalten',
    ru: 'Приостановить',
    pt: 'Suspender',
    nl: 'Pauzeren',
    fr: 'Suspendre',
    it: 'Sospendi',
    es: 'Suspender',
    pl: 'Wstrzymaj',
    uk: 'Призупинити',
    'zh-cn': '暂停',
};

export const RESUME = {
    en: 'Resume',
    de: 'Fortsetzen',
    ru: 'Возобновить',
    pt: 'Retomar',
    nl: 'Hervatten',
    fr: 'Reprendre',
    it: 'Riprendi',
    es: 'Reanudar',
    pl: 'Wznów',
    uk: 'Відновити',
    'zh-cn': '恢复',
};

export const AVAILABLE = {
    en: 'Available',
    de: 'Verfügbar',
    ru: 'Доступно',
    pt: 'Disponível',
    nl: 'Beschikbaar',
    fr: 'Disponible',
    it: 'Disponibile',
    es: 'Disponible',
    pl: 'Dostępny',
    uk: 'Доступно',
    'zh-cn': '可用',
};

// ─── Zusammengesetzte Übersetzungs-Objekte ─────────────────────────────────

/**
 * Button-Labels für VM/LXC-Aktionen.
 * Verwendung: vmButtonLabels.start, vmButtonLabels.stop, …
 *
 */
export const vmButtonLabels = {
    start: START,
    stop: STOP,
    shutdown: SHUTDOWN,
    reboot: REBOOT,
    reset: RESET,
    suspend: SUSPEND,
    resume: RESUME,
};

/**
 * Button-Labels für Node-Aktionen.
 *
 */
export const nodeButtonLabels = { shutdown: SHUTDOWN, reboot: REBOOT };

/**
 * Allgemeine State-Namen (Status, Available).
 */
export const stateNames = { status: STATUS, available: AVAILABLE };

// ─── Device Manager ─────────────────────────────────────────────────────────

export const CONFIRM_SHUTDOWN = {
    en: 'Really shut down?',
    de: 'Wirklich herunterfahren?',
    ru: 'Действительно выключить?',
    pt: 'Desligar mesmo?',
    nl: 'Echt afsluiten?',
    fr: 'Vraiment éteindre ?',
    it: 'Arrestare davvero?',
    es: '¿Apagar realmente?',
    pl: 'Na pewno wyłączyć?',
    uk: 'Дійсно вимкнути?',
    'zh-cn': '确定要关机吗？',
};

export const CONFIRM_REBOOT = {
    en: 'Really reboot?',
    de: 'Wirklich neu starten?',
    ru: 'Действительно перезагрузить?',
    pt: 'Reiniciar mesmo?',
    nl: 'Echt opnieuw opstarten?',
    fr: 'Vraiment redémarrer ?',
    it: 'Riavviare davvero?',
    es: '¿Reiniciar realmente?',
    pl: 'Na pewno uruchomić ponownie?',
    uk: 'Дійсно перезавантажити?',
    'zh-cn': '确定要重启吗？',
};

export const CONFIRM_STOP = {
    en: 'Really power off immediately, without a clean shutdown? Unsaved data can be lost.',
    de: 'Wirklich sofort ausschalten, ohne sauberes Herunterfahren? Nicht gespeicherte Daten können verloren gehen.',
    ru: 'Действительно немедленно отключить без корректного завершения работы? Несохранённые данные могут быть потеряны.',
    pt: 'Desligar mesmo de imediato, sem um encerramento correto? Os dados não guardados podem ser perdidos.',
    nl: 'Echt direct uitschakelen, zonder correct af te sluiten? Niet-opgeslagen gegevens kunnen verloren gaan.',
    fr: 'Vraiment couper immédiatement, sans arrêt propre ? Les données non enregistrées peuvent être perdues.',
    it: 'Spegnere davvero subito, senza un arresto regolare? I dati non salvati possono andare persi.',
    es: '¿Apagar realmente de inmediato, sin un apagado correcto? Los datos no guardados pueden perderse.',
    pl: 'Na pewno wyłączyć natychmiast, bez prawidłowego zamknięcia? Niezapisane dane mogą zostać utracone.',
    uk: 'Дійсно негайно вимкнути без коректного завершення роботи? Незбережені дані можуть бути втрачені.',
    'zh-cn': '确定要立即断电，而不正常关机吗？未保存的数据可能会丢失。',
};

export const UPTIME = {
    en: 'Uptime',
    de: 'Laufzeit',
    ru: 'Время работы',
    pt: 'Tempo de atividade',
    nl: 'Uptime',
    fr: 'Temps de fonctionnement',
    it: 'Tempo di attività',
    es: 'Tiempo de actividad',
    pl: 'Czas pracy',
    uk: 'Час роботи',
    'zh-cn': '运行时间',
};

/** Status im Device Manager, Schlüssel ist der Wert aus der Proxmox-API */
export const DEVICE_STATUS = {
    running: {
        en: 'Running',
        de: 'Läuft',
        ru: 'Работает',
        pt: 'Em execução',
        nl: 'Actief',
        fr: 'En marche',
        it: 'In esecuzione',
        es: 'En ejecución',
        pl: 'Działa',
        uk: 'Працює',
        'zh-cn': '运行中',
    },
    stopped: {
        en: 'Stopped',
        de: 'Gestoppt',
        ru: 'Остановлена',
        pt: 'Parada',
        nl: 'Gestopt',
        fr: 'Arrêtée',
        it: 'Ferma',
        es: 'Detenida',
        pl: 'Zatrzymana',
        uk: 'Зупинена',
        'zh-cn': '已停止',
    },
    paused: {
        en: 'Paused',
        de: 'Pausiert',
        ru: 'На паузе',
        pt: 'Em pausa',
        nl: 'Gepauzeerd',
        fr: 'En pause',
        it: 'In pausa',
        es: 'En pausa',
        pl: 'Wstrzymana',
        uk: 'На паузі',
        'zh-cn': '已暂停',
    },
    suspended: {
        en: 'Suspended',
        de: 'Angehalten',
        ru: 'Приостановлена',
        pt: 'Suspensa',
        nl: 'Onderbroken',
        fr: 'Suspendue',
        it: 'Sospesa',
        es: 'Suspendida',
        pl: 'Uśpiona',
        uk: 'Призупинена',
        'zh-cn': '已挂起',
    },
    online: {
        en: 'Online',
        de: 'Online',
        ru: 'В сети',
        pt: 'Online',
        nl: 'Online',
        fr: 'En ligne',
        it: 'Online',
        es: 'En línea',
        pl: 'Online',
        uk: 'У мережі',
        'zh-cn': '在线',
    },
    offline: {
        en: 'Offline',
        de: 'Offline',
        ru: 'Не в сети',
        pt: 'Offline',
        nl: 'Offline',
        fr: 'Hors ligne',
        it: 'Offline',
        es: 'Sin conexión',
        pl: 'Offline',
        uk: 'Не в мережі',
        'zh-cn': '离线',
    },
    unknown: {
        en: 'Unknown',
        de: 'Unbekannt',
        ru: 'Неизвестно',
        pt: 'Desconhecido',
        nl: 'Onbekend',
        fr: 'Inconnu',
        it: 'Sconosciuto',
        es: 'Desconocido',
        pl: 'Nieznany',
        uk: 'Невідомо',
        'zh-cn': '未知',
    },
};

/** Gruppen im Device Manager, Schlüssel ist `native.type` des Channels */
export const DEVICE_GROUPS = {
    node: {
        en: 'Nodes',
        de: 'Nodes',
        ru: 'Узлы',
        pt: 'Nós',
        nl: 'Nodes',
        fr: 'Nœuds',
        it: 'Nodi',
        es: 'Nodos',
        pl: 'Węzły',
        uk: 'Вузли',
        'zh-cn': '节点',
    },
    qemu: {
        en: 'Virtual machines',
        de: 'Virtuelle Maschinen',
        ru: 'Виртуальные машины',
        pt: 'Máquinas virtuais',
        nl: 'Virtuele machines',
        fr: 'Machines virtuelles',
        it: 'Macchine virtuali',
        es: 'Máquinas virtuales',
        pl: 'Maszyny wirtualne',
        uk: 'Віртуальні машини',
        'zh-cn': '虚拟机',
    },
    lxc: {
        en: 'Containers',
        de: 'Container',
        ru: 'Контейнеры',
        pt: 'Contentores',
        nl: 'Containers',
        fr: 'Conteneurs',
        it: 'Container',
        es: 'Contenedores',
        pl: 'Kontenery',
        uk: 'Контейнери',
        'zh-cn': '容器',
    },
};

// ─── Auth-Typ Labels ───────────────────────────────────────────────────────

export const AUTH_TYPE = {
    en: 'Authentication Type',
    de: 'Authentifizierungstyp',
    ru: 'Тип аутентификации',
    pt: 'Tipo de autenticação',
    nl: 'Authenticatietype',
    fr: "Type d'authentification",
    it: 'Tipo di autenticazione',
    es: 'Tipo de autenticación',
    pl: 'Typ uwierzytelniania',
    uk: 'Тип автентифікації',
    'zh-cn': '认证类型',
};

export const TOKEN_ID = {
    en: 'Token ID',
    de: 'Token-ID',
    ru: 'Идентификатор токена',
    pt: 'ID do token',
    nl: 'Token-ID',
    fr: 'ID du token',
    it: 'ID token',
    es: 'ID de token',
    pl: 'ID tokenu',
    uk: 'Ідентифікатор токена',
    'zh-cn': 'Token ID',
};

export const TOKEN_SECRET = {
    en: 'Token Secret',
    de: 'Token-Secret',
    ru: 'Секрет токена',
    pt: 'Segredo do token',
    nl: 'Token-geheim',
    fr: 'Secret du token',
    it: 'Segreto del token',
    es: 'Secreto del token',
    pl: 'Sekret tokenu',
    uk: 'Секрет токена',
    'zh-cn': 'Token 密钥',
};

export const AUTH_TOKEN_FAILED = {
    en: 'API token authentication failed (401). Please verify Token ID and Token Secret.',
    de: 'API-Token-Authentifizierung fehlgeschlagen (401). Bitte Token-ID und Token-Secret prüfen.',
    ru: 'Ошибка аутентификации API-токена (401). Проверьте Token ID и Token Secret.',
    pt: 'Falha na autenticação por token de API (401). Verifique o ID e o segredo do token.',
    nl: 'API-tokenauthenticatie mislukt (401). Controleer Token-ID en Token-geheim.',
    fr: "Échec de l'authentification par jeton API (401). Vérifiez l'ID et le secret du jeton.",
    it: "Autenticazione tramite token API non riuscita (401). Verificare l'ID token e il segreto.",
    es: 'Error de autenticación con token de API (401). Verifique el ID y el secreto del token.',
    pl: 'Błąd uwierzytelniania tokenu API (401). Sprawdź ID tokenu i jego sekret.',
    uk: 'Помилка автентифікації за токеном API (401). Перевірте Token ID і Token Secret.',
    'zh-cn': 'API Token 认证失败 (401)，请检查 Token ID 和 Token Secret。',
};

// ─── Log-Nachrichten (parametrisiert) ─────────────────────────────────────

/**
 * @param count - Anzahl der Einzel-Nodes
 */
export function warnIndividualNodes(count: number): Translations {
    return {
        en:
            `⚠️  ${count} nodes are configured as individual nodes (clusterNode=false). ` +
            `If these nodes belong to a Proxmox cluster, all VMs/LXCs will be processed ${count}× per ` +
            `query cycle, because the Proxmox API returns cluster-wide data via each node. ` +
            `Please enable "Cluster Node" to get proper failover and avoid duplicate processing.`,
        de:
            `⚠️  ${count} Nodes sind als Einzel-Nodes (clusterNode=false) konfiguriert. ` +
            `Falls diese Nodes einem Proxmox-Cluster angehören, werden alle VMs/LXCs ${count}× pro ` +
            `Abfrage-Zyklus verarbeitet, da die Proxmox-API cluster-weite Daten über jeden Node zurückgibt. ` +
            `Bitte "Cluster Node" aktivieren, um korrekten Failover zu erhalten und Doppelverarbeitung zu vermeiden.`,
        ru:
            `⚠️  ${count} узлов настроены как отдельные (clusterNode=false). ` +
            `Если эти узлы входят в кластер Proxmox, все ВМ/LXC будут обрабатываться ${count}× за ` +
            `цикл запроса, так как API Proxmox возвращает данные всего кластера через каждый узел. ` +
            `Пожалуйста, включите "Cluster Node" для корректного переключения при отказе и чтобы избежать дублирования.`,
        fr:
            `⚠️  ${count} nœuds sont configurés comme nœuds individuels (clusterNode=false). ` +
            `Si ces nœuds appartiennent à un cluster Proxmox, toutes les VMs/LXC seront traitées ${count}× par ` +
            `cycle d'interrogation, car l'API Proxmox renvoie des données à l'échelle du cluster via chaque nœud. ` +
            `Veuillez activer "Cluster Node" pour un basculement correct et éviter le double traitement.`,
        nl:
            `⚠️  ${count} nodes zijn geconfigureerd als afzonderlijke nodes (clusterNode=false). ` +
            `Als deze nodes tot een Proxmox-cluster behoren, worden alle VMs/LXC's ${count}× per ` +
            `querycyclus verwerkt, omdat de Proxmox-API clusterwijde gegevens via elke node retourneert. ` +
            `Schakel "Cluster Node" in voor correcte failover en om dubbele verwerking te voorkomen.`,
        pl:
            `⚠️  ${count} węzłów skonfigurowanych jest jako węzły indywidualne (clusterNode=false). ` +
            `Jeśli te węzły należą do klastra Proxmox, wszystkie VMs/LXC będą przetwarzane ${count}× na ` +
            `cykl zapytań, ponieważ API Proxmox zwraca dane całego klastra przez każdy węzeł. ` +
            `Włącz "Cluster Node", aby uzyskać prawidłowe przełączanie awaryjne i uniknąć podwójnego przetwarzania.`,
        it:
            `⚠️  ${count} nodi sono configurati come nodi individuali (clusterNode=false). ` +
            `Se questi nodi appartengono a un cluster Proxmox, tutte le VM/LXC verranno elaborate ${count}× per ` +
            `ciclo di query, poiché l'API Proxmox restituisce dati a livello di cluster tramite ogni nodo. ` +
            `Abilita "Cluster Node" per un corretto failover ed evitare la doppia elaborazione.`,
        es:
            `⚠️  ${count} nodos están configurados como nodos individuales (clusterNode=false). ` +
            `Si estos nodos pertenecen a un clúster Proxmox, todas las VMs/LXC se procesarán ${count}× por ` +
            `ciclo de consulta, ya que la API de Proxmox devuelve datos de todo el clúster a través de cada nodo. ` +
            `Habilite "Cluster Node" para una conmutación por error correcta y evitar el procesamiento doble.`,
        pt:
            `⚠️  ${count} nós estão configurados como nós individuais (clusterNode=false). ` +
            `Se esses nós pertencem a um cluster Proxmox, todas as VMs/LXCs serão processadas ${count}× por ` +
            `ciclo de consulta, pois a API do Proxmox retorna dados de todo o cluster por cada nó. ` +
            `Ative "Cluster Node" para failover correto e evitar processamento duplicado.`,
        uk:
            `⚠️  ${count} вузлів налаштовані як окремі (clusterNode=false). ` +
            `Якщо ці вузли належать до кластера Proxmox, всі ВМ/LXC будуть оброблятися ${count}× за ` +
            `цикл запиту, оскільки API Proxmox повертає дані всього кластера через кожен вузол. ` +
            `Будь ласка, увімкніть "Cluster Node" для коректного переключення при відмові та уникнення дублювання.`,
        'zh-cn':
            `⚠️  ${count} 个节点配置为独立节点（clusterNode=false）。` +
            `如果这些节点属于 Proxmox 集群，则每个查询周期所有 VM/LXC 将被处理 ${count} 次，` +
            `因为 Proxmox API 通过每个节点返回集群范围的数据。` +
            `请启用"Cluster Node"以实现正确的故障转移并避免重复处理。`,
    };
}

export function warnSingleClusterNode(): Translations {
    return {
        en:
            `⚠️  Only 1 node is marked as a cluster node. ` +
            `Cluster failover requires at least 2 nodes with "Cluster Node = true". ` +
            `If this is a single server, the configuration is correct.`,
        de:
            `⚠️  Nur 1 Node ist als Cluster-Node markiert. ` +
            `Cluster-Failover benötigt mindestens 2 Nodes mit "Cluster Node = true". ` +
            `Falls dies ein Einzel-Server ist, ist die Konfiguration korrekt.`,
        ru:
            `⚠️  Только 1 узел помечен как кластерный. ` +
            `Для кластерного переключения при отказе требуется минимум 2 узла с "Cluster Node = true". ` +
            `Если это одиночный сервер, конфигурация верна.`,
        fr:
            `⚠️  Un seul nœud est marqué comme nœud de cluster. ` +
            `Le basculement de cluster nécessite au moins 2 nœuds avec "Cluster Node = true". ` +
            `S'il s'agit d'un serveur unique, la конфигурация est correcte.`,
        nl:
            `⚠️  Slechts 1 node is gemarkeerd als clusternode. ` +
            `Cluster-failover vereist minimaal 2 nodes met "Cluster Node = true". ` +
            `Als dit een enkele server is, is de configuratie correct.`,
        pl:
            `⚠️  Tylko 1 węzeł jest oznaczony jako węzeł klastra. ` +
            `Przełączanie awaryjne klastra wymaga co najmniej 2 węzłów z "Cluster Node = true". ` +
            `Jeśli to jest pojedynczy serwer, konfiguracja jest prawidłowa.`,
        it:
            `⚠️  Solo 1 nodo è contrassegnato come nodo cluster. ` +
            `Il failover del cluster richiede almeno 2 nodi con "Cluster Node = true". ` +
            `Se si tratta di un singolo server, la configurazione è corretta.`,
        es:
            `⚠️  Solo 1 nodo está marcado como nodo de clúster. ` +
            `El failover del clúster requiere al menos 2 nodos con "Cluster Node = true". ` +
            `Si se trata de un servidor único, la configuración es correcta.`,
        pt:
            `⚠️  Apenas 1 nó está marcado como nó de cluster. ` +
            `O failover de cluster requer pelo menos 2 nós com "Cluster Node = true". ` +
            `Se este é um servidor único, a configuração está correta.`,
        uk:
            `⚠️  Лише 1 вузол позначено як кластерний. ` +
            `Для переключення при відмові кластера потрібно мінімум 2 вузли з "Cluster Node = true". ` +
            `Якщо це одиночний сервер, конфігурація правильна.`,
        'zh-cn':
            `⚠️  只有 1 个节点被标记为集群节点。` +
            `集群故障转移需要至少 2 个"Cluster Node = true"的节点。` +
            `如果这是单台服务器，则配置正确。`,
    };
}
