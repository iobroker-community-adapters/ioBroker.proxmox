'use strict';

/**
 * Zentrale Übersetzungstabelle für den ioBroker Proxmox Adapter.
 * Schlüssel entsprechen ioBroker-Sprachcodes: en, de, ru, fr, nl, pl, it, es, pt, uk, zh-cn
 */

// ─── Wiederverwendete Basis-Übersetzungen ──────────────────────────────────


const STATUS = {
    en: 'Status', de: 'Status', ru: 'Статус',
    pt: 'Estado', nl: 'Status', fr: 'État',
    it: 'Stato', es: 'Situación', pl: 'Status',
    uk: 'Статус на сервери', 'zh-cn': '现状',
};


const SHUTDOWN = {
    en: 'Shutdown', de: 'Herunterfahren', ru: 'Закрыть',
    pt: 'Desligamento', nl: 'Vertaling', fr: 'Tais-toi',
    it: 'Chiusura', es: 'Apago', pl: 'Shutdown',
    uk: 'Відправити', 'zh-cn': '舒适',
};


const REBOOT = {
    en: 'Reboot', de: 'Neustart', ru: 'Перезагрузка',
    pt: 'Reiniciar', nl: 'Reboot', fr: 'Reboot',
    it: 'Reboot', es: 'Reboot', pl: 'Reboot',
    uk: 'Перезавантаження', 'zh-cn': 'Reboot',
};


const START = {
    en: 'Start', de: 'Start', ru: 'Начало',
    pt: 'Começar', nl: 'Begin', fr: 'Commencez',
    it: 'Inizio', es: 'Comienzo', pl: 'Start',
    uk: 'Почати', 'zh-cn': '导 言',
};


const STOP = {
    en: 'Stop', de: 'Stopp', ru: 'Стоп',
    pt: 'Pára', nl: 'Stop', fr: 'Arrête',
    it: 'Fermati', es: 'Para', pl: 'Stop',
    uk: 'Зареєструватися', 'zh-cn': '禁止',
};


const RESET = {
    en: 'Reset', de: 'Zurücksetzen', ru: 'Сброс',
    pt: 'Reinicializar', nl: 'Reset', fr: 'Réinitialiser',
    it: 'Reset', es: 'Reiniciar', pl: 'Reset',
    uk: 'Скидання', 'zh-cn': '重置',
};


const SUSPEND = {
    en: 'Suspend', de: 'Anhalten', ru: 'Приостановить',
    pt: 'Suspender', nl: 'Pauzeren', fr: 'Suspendre',
    it: 'Sospendi', es: 'Suspender', pl: 'Wstrzymaj',
    uk: 'Призупинити', 'zh-cn': '暂停',
};


const RESUME = {
    en: 'Resume', de: 'Fortsetzen', ru: 'Возобновить',
    pt: 'Retomar', nl: 'Hervatten', fr: 'Reprendre',
    it: 'Riprendi', es: 'Reanudar', pl: 'Wznów',
    uk: 'Відновити', 'zh-cn': '恢复',
};


const AVAILABLE = {
    en: 'Available', de: 'Verfügbar', ru: 'Доступно',
    pt: 'Disponível', nl: 'Beschikbaar', fr: 'Disponible',
    it: 'Disponibile', es: 'Disponible', pl: 'Dostępny',
    uk: 'Доступно', 'zh-cn': '可用',
};

// ─── Zusammengesetzte Übersetzungs-Objekte ─────────────────────────────────

/**
 * Button-Labels für VM/LXC-Aktionen.
 * Verwendung: vmButtonLabels.start, vmButtonLabels.stop, …
 *
 */
const vmButtonLabels = { start: START, stop: STOP, shutdown: SHUTDOWN, reboot: REBOOT, reset: RESET, suspend: SUSPEND, resume: RESUME };

/**
 * Button-Labels für Node-Aktionen.
 *
 */
const nodeButtonLabels = { shutdown: SHUTDOWN, reboot: REBOOT };

/**
 * Allgemeine State-Namen (Status, Available).
 */
const stateNames = { status: STATUS, available: AVAILABLE };

// ─── Auth-Typ Labels ───────────────────────────────────────────────────────

const AUTH_TYPE = {
    en: 'Authentication Type', de: 'Authentifizierungstyp', ru: 'Тип аутентификации',
    pt: 'Tipo de autenticação', nl: 'Authenticatietype', fr: 'Type d\'authentification',
    it: 'Tipo di autenticazione', es: 'Tipo de autenticación', pl: 'Typ uwierzytelniania',
    uk: 'Тип автентифікації', 'zh-cn': '认证类型',
};

const TOKEN_ID = {
    en: 'Token ID', de: 'Token-ID', ru: 'Идентификатор токена',
    pt: 'ID do token', nl: 'Token-ID', fr: 'ID du token',
    it: 'ID token', es: 'ID de token', pl: 'ID tokenu',
    uk: 'Ідентифікатор токена', 'zh-cn': 'Token ID',
};

const TOKEN_SECRET = {
    en: 'Token Secret', de: 'Token-Secret', ru: 'Секрет токена',
    pt: 'Segredo do token', nl: 'Token-geheim', fr: 'Secret du token',
    it: 'Segreto del token', es: 'Secreto del token', pl: 'Sekret tokenu',
    uk: 'Секрет токена', 'zh-cn': 'Token 密钥',
};

const AUTH_TOKEN_FAILED = {
    en: 'API token authentication failed (401). Please verify Token ID and Token Secret.',
    de: 'API-Token-Authentifizierung fehlgeschlagen (401). Bitte Token-ID und Token-Secret prüfen.',
    ru: 'Ошибка аутентификации API-токена (401). Проверьте Token ID и Token Secret.',
    pt: 'Falha na autenticação por token de API (401). Verifique o ID e o segredo do token.',
    nl: 'API-tokenauthenticatie mislukt (401). Controleer Token-ID en Token-geheim.',
    fr: 'Échec de l\'authentification par jeton API (401). Vérifiez l\'ID et le secret du jeton.',
    it: 'Autenticazione tramite token API non riuscita (401). Verificare l\'ID token e il segreto.',
    es: 'Error de autenticación con token de API (401). Verifique el ID y el secreto del token.',
    pl: 'Błąd uwierzytelniania tokenu API (401). Sprawdź ID tokenu i jego sekret.',
    uk: 'Помилка автентифікації за токеном API (401). Перевірте Token ID і Token Secret.',
    'zh-cn': 'API Token 认证失败 (401)，请检查 Token ID 和 Token Secret。',
};

// ─── Log-Nachrichten (parametrisiert) ─────────────────────────────────────

/**
 * @param {number} count
 * @returns {Record<string, string>}
 */
function warnIndividualNodes(count) {
    return {
        en: `⚠️  ${count} nodes are configured as individual nodes (clusterNode=false). ` +
            `If these nodes belong to a Proxmox cluster, all VMs/LXCs will be processed ${count}× per ` +
            `query cycle, because the Proxmox API returns cluster-wide data via each node. ` +
            `Please enable "Cluster Node" to get proper failover and avoid duplicate processing.`,
        de: `⚠️  ${count} Nodes sind als Einzel-Nodes (clusterNode=false) konfiguriert. ` +
            `Falls diese Nodes einem Proxmox-Cluster angehören, werden alle VMs/LXCs ${count}× pro ` +
            `Abfrage-Zyklus verarbeitet, da die Proxmox-API cluster-weite Daten über jeden Node zurückgibt. ` +
            `Bitte "Cluster Node" aktivieren, um korrekten Failover zu erhalten und Doppelverarbeitung zu vermeiden.`,
        ru: `⚠️  ${count} узлов настроены как отдельные (clusterNode=false). ` +
            `Если эти узлы входят в кластер Proxmox, все ВМ/LXC будут обрабатываться ${count}× за ` +
            `цикл запроса, так как API Proxmox возвращает данные всего кластера через каждый узел. ` +
            `Пожалуйста, включите "Cluster Node" для корректного переключения при отказе и чтобы избежать дублирования.`,
        fr: `⚠️  ${count} nœuds sont configurés comme nœuds individuels (clusterNode=false). ` +
            `Si ces nœuds appartiennent à un cluster Proxmox, toutes les VMs/LXC seront traitées ${count}× par ` +
            `cycle d'interrogation, car l'API Proxmox renvoie des données à l'échelle du cluster via chaque nœud. ` +
            `Veuillez activer "Cluster Node" pour un basculement correct et éviter le double traitement.`,
        nl: `⚠️  ${count} nodes zijn geconfigureerd als afzonderlijke nodes (clusterNode=false). ` +
            `Als deze nodes tot een Proxmox-cluster behoren, worden alle VMs/LXC's ${count}× per ` +
            `querycyclus verwerkt, omdat de Proxmox-API clusterwijde gegevens via elke node retourneert. ` +
            `Schakel "Cluster Node" in voor correcte failover en om dubbele verwerking te voorkomen.`,
        pl: `⚠️  ${count} węzłów skonfigurowanych jest jako węzły indywidualne (clusterNode=false). ` +
            `Jeśli te węzły należą do klastra Proxmox, wszystkie VMs/LXC będą przetwarzane ${count}× na ` +
            `cykl zapytań, ponieważ API Proxmox zwraca dane całego klastra przez każdy węzeł. ` +
            `Włącz "Cluster Node", aby uzyskać prawidłowe przełączanie awaryjne i uniknąć podwójnego przetwarzania.`,
        it: `⚠️  ${count} nodi sono configurati come nodi individuali (clusterNode=false). ` +
            `Se questi nodi appartengono a un cluster Proxmox, tutte le VM/LXC verranno elaborate ${count}× per ` +
            `ciclo di query, poiché l'API Proxmox restituisce dati a livello di cluster tramite ogni nodo. ` +
            `Abilita "Cluster Node" per un corretto failover ed evitare la doppia elaborazione.`,
        es: `⚠️  ${count} nodos están configurados como nodos individuales (clusterNode=false). ` +
            `Si estos nodos pertenecen a un clúster Proxmox, todas las VMs/LXC se procesarán ${count}× por ` +
            `ciclo de consulta, ya que la API de Proxmox devuelve datos de todo el clúster a través de cada nodo. ` +
            `Habilite "Cluster Node" para una conmutación por error correcta y evitar el procesamiento doble.`,
        pt: `⚠️  ${count} nós estão configurados como nós individuais (clusterNode=false). ` +
            `Se esses nós pertencem a um cluster Proxmox, todas as VMs/LXCs serão processadas ${count}× por ` +
            `ciclo de consulta, pois a API do Proxmox retorna dados de todo o cluster por cada nó. ` +
            `Ative "Cluster Node" para failover correto e evitar processamento duplicado.`,
        uk: `⚠️  ${count} вузлів налаштовані як окремі (clusterNode=false). ` +
            `Якщо ці вузли належать до кластера Proxmox, всі ВМ/LXC будуть оброблятися ${count}× за ` +
            `цикл запиту, оскільки API Proxmox повертає дані всього кластера через кожен вузол. ` +
            `Будь ласка, увімкніть "Cluster Node" для коректного переключення при відмові та уникнення дублювання.`,
        'zh-cn': `⚠️  ${count} 个节点配置为独立节点（clusterNode=false）。` +
            `如果这些节点属于 Proxmox 集群，则每个查询周期所有 VM/LXC 将被处理 ${count} 次，` +
            `因为 Proxmox API 通过每个节点返回集群范围的数据。` +
            `请启用"Cluster Node"以实现正确的故障转移并避免重复处理。`,
    };
}

/** @returns {Record<string, string>} */
function warnSingleClusterNode() {
    return {
        en: `⚠️  Only 1 node is marked as a cluster node. ` +
            `Cluster failover requires at least 2 nodes with "Cluster Node = true". ` +
            `If this is a single server, the configuration is correct.`,
        de: `⚠️  Nur 1 Node ist als Cluster-Node markiert. ` +
            `Cluster-Failover benötigt mindestens 2 Nodes mit "Cluster Node = true". ` +
            `Falls dies ein Einzel-Server ist, ist die Konfiguration korrekt.`,
        ru: `⚠️  Только 1 узел помечен как кластерный. ` +
            `Для кластерного переключения при отказе требуется минимум 2 узла с "Cluster Node = true". ` +
            `Если это одиночный сервер, конфигурация верна.`,
        fr: `⚠️  Un seul nœud est marqué comme nœud de cluster. ` +
            `Le basculement de cluster nécessite au moins 2 nœuds avec "Cluster Node = true". ` +
            `S'il s'agit d'un serveur unique, la конфигурация est correcte.`,
        nl: `⚠️  Slechts 1 node is gemarkeerd als clusternode. ` +
            `Cluster-failover vereist minimaal 2 nodes met "Cluster Node = true". ` +
            `Als dit een enkele server is, is de configuratie correct.`,
        pl: `⚠️  Tylko 1 węzeł jest oznaczony jako węzeł klastra. ` +
            `Przełączanie awaryjne klastra wymaga co najmniej 2 węzłów z "Cluster Node = true". ` +
            `Jeśli to jest pojedynczy serwer, konfiguracja jest prawidłowa.`,
        it: `⚠️  Solo 1 nodo è contrassegnato come nodo cluster. ` +
            `Il failover del cluster richiede almeno 2 nodi con "Cluster Node = true". ` +
            `Se si tratta di un singolo server, la configurazione è corretta.`,
        es: `⚠️  Solo 1 nodo está marcado como nodo de clúster. ` +
            `El failover del clúster requiere al menos 2 nodos con "Cluster Node = true". ` +
            `Si se trata de un servidor único, la configuración es correcta.`,
        pt: `⚠️  Apenas 1 nó está marcado como nó de cluster. ` +
            `O failover de cluster requer pelo menos 2 nós com "Cluster Node = true". ` +
            `Se este é um servidor único, a configuração está correta.`,
        uk: `⚠️  Лише 1 вузол позначено як кластерний. ` +
            `Для переключення при відмові кластера потрібно мінімум 2 вузли з "Cluster Node = true". ` +
            `Якщо це одиночний сервер, конфігурація правильна.`,
        'zh-cn': `⚠️  只有 1 个节点被标记为集群节点。` +
            `集群故障转移需要至少 2 个"Cluster Node = true"的节点。` +
            `如果这是单台服务器，则配置正确。`,
    };
}

module.exports = {
    // Basis-Labels (direkt als Objekte verwendbar)
    STATUS,
    SHUTDOWN,
    REBOOT,
    START,
    STOP,
    RESET,
    SUSPEND,
    RESUME,
    AVAILABLE,
    AUTH_TYPE,
    TOKEN_ID,
    TOKEN_SECRET,
    AUTH_TOKEN_FAILED,

    // Zusammengesetzte Label-Maps
    vmButtonLabels,
    nodeButtonLabels,
    stateNames,

    // Log-Nachrichten
    warnIndividualNodes,
    warnSingleClusterNode,
};
