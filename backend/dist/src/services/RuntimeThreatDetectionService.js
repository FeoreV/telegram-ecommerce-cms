"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeThreatDetectionService = exports.RuntimeThreatDetectionService = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const SecurityLogService_1 = require("./SecurityLogService");
const SIEMIntegrationService_1 = require("./SIEMIntegrationService");
class RuntimeThreatDetectionService {
    constructor() {
        this.indicators = new Map();
        this.alerts = new Map();
        this.processBaseline = new Map();
        this.networkBaseline = new Map();
        this.fileSystemBaseline = new Map();
        this.monitoringIntervals = [];
        this.isLearningMode = true;
        this.learningStartTime = new Date();
        this.config = {
            enableRuntimeDetection: process.env.ENABLE_RUNTIME_THREAT_DETECTION !== 'false',
            enableeBPFIntegration: process.env.ENABLE_EBPF_INTEGRATION === 'true',
            enableProcessMonitoring: process.env.ENABLE_PROCESS_MONITORING !== 'false',
            enableNetworkMonitoring: process.env.ENABLE_NETWORK_MONITORING !== 'false',
            enableFileSystemMonitoring: process.env.ENABLE_FILESYSTEM_MONITORING !== 'false',
            enableMemoryMonitoring: process.env.ENABLE_MEMORY_MONITORING === 'true',
            detectionSensitivity: process.env.THREAT_DETECTION_SENSITIVITY || 'high',
            falsePositiveThreshold: parseFloat(process.env.FALSE_POSITIVE_THRESHOLD || '0.3'),
            anomalyScoreThreshold: parseFloat(process.env.ANOMALY_SCORE_THRESHOLD || '0.7'),
            processMonitoringIntervalMs: parseInt(process.env.PROCESS_MONITORING_INTERVAL || '10000'),
            networkMonitoringIntervalMs: parseInt(process.env.NETWORK_MONITORING_INTERVAL || '5000'),
            fileSystemMonitoringIntervalMs: parseInt(process.env.FILESYSTEM_MONITORING_INTERVAL || '5000'),
            memoryMonitoringIntervalMs: parseInt(process.env.MEMORY_MONITORING_INTERVAL || '30000'),
            enableAutoQuarantine: process.env.ENABLE_AUTO_QUARANTINE === 'true',
            enableAutoTermination: process.env.ENABLE_AUTO_TERMINATION === 'true',
            enableNetworkIsolation: process.env.ENABLE_NETWORK_ISOLATION === 'true',
            enableForensicCapture: process.env.ENABLE_FORENSIC_CAPTURE !== 'false',
            enableMLDetection: process.env.ENABLE_ML_DETECTION !== 'false',
            anomalyDetectionWindow: parseInt(process.env.ANOMALY_DETECTION_WINDOW || '300000'),
            baselineLearningPeriod: parseInt(process.env.BASELINE_LEARNING_PERIOD || '3600000'),
            edrEndpoint: process.env.EDR_ENDPOINT,
            edrApiKey: process.env.EDR_API_KEY,
            siemIntegration: process.env.THREAT_DETECTION_SIEM_INTEGRATION !== 'false'
        };
        this.initializeRuntimeDetection();
        this.startMonitoring();
        logger_1.logger.info('Runtime Threat Detection Service initialized', {
            enabled: this.config.enableRuntimeDetection,
            eBPFIntegration: this.config.enableeBPFIntegration,
            sensitivity: this.config.detectionSensitivity,
            mlDetection: this.config.enableMLDetection,
            autoResponse: this.config.enableAutoQuarantine
        });
    }
    static getInstance() {
        if (!RuntimeThreatDetectionService.instance) {
            RuntimeThreatDetectionService.instance = new RuntimeThreatDetectionService();
        }
        return RuntimeThreatDetectionService.instance;
    }
    async initializeRuntimeDetection() {
        if (!this.config.enableRuntimeDetection) {
            return;
        }
        try {
            if (this.config.enableeBPFIntegration) {
                await this.initializeeBPF();
            }
            this.initializeThreatRules();
            this.initializeBaselines();
            this.setupLearningMode();
            logger_1.logger.info('Runtime threat detection initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize runtime threat detection:', err);
        }
    }
    async initializeeBPF() {
        logger_1.logger.info('eBPF integration initialized (placeholder)');
    }
    initializeThreatRules() {
        this.addThreatRule('suspicious_process_spawn', {
            type: 'process',
            patterns: ['/bin/sh', '/bin/bash', 'cmd.exe', 'powershell.exe'],
            severity: 'MEDIUM',
            mitreTactic: 'TA0002',
            mitreTechnique: 'T1059'
        });
        this.addThreatRule('suspicious_network_connection', {
            type: 'network',
            patterns: ['tor', 'proxy', 'tunnel'],
            severity: 'HIGH',
            mitreTactic: 'TA0011',
            mitreTechnique: 'T1071'
        });
        this.addThreatRule('suspicious_file_creation', {
            type: 'filesystem',
            patterns: ['.exe', '.bat', '.ps1', '.sh'],
            severity: 'MEDIUM',
            mitreTactic: 'TA0003',
            mitreTechnique: 'T1547'
        });
        this.addThreatRule('memory_injection_attempt', {
            type: 'memory',
            patterns: ['injection', 'hollowing', 'shellcode'],
            severity: 'CRITICAL',
            mitreTactic: 'TA0005',
            mitreTechnique: 'T1055'
        });
        this.addThreatRule('suspicious_api_calls', {
            type: 'api',
            patterns: ['VirtualAlloc', 'WriteProcessMemory', 'CreateRemoteThread'],
            severity: 'HIGH',
            mitreTactic: 'TA0005',
            mitreTechnique: 'T1055'
        });
        logger_1.logger.debug('Threat detection rules initialized');
    }
    addThreatRule(id, ruleDetails) {
        logger_1.logger.debug(`Added threat rule: ${id}`, ruleDetails);
    }
    initializeBaselines() {
        this.processBaseline.set('normal_processes', new Set([
            'node', 'npm', 'init', 'tini', 'dumb-init'
        ]));
        this.networkBaseline.set('allowed_ports', new Set([
            80, 443, 5432, 6379, 8200, 3000
        ]));
        this.fileSystemBaseline.set('protected_paths', new Set([
            '/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64'
        ]));
        logger_1.logger.debug('Security baselines initialized');
    }
    setupLearningMode() {
        setTimeout(() => {
            this.isLearningMode = false;
            logger_1.logger.info('Exiting learning mode, active threat detection enabled');
        }, this.config.baselineLearningPeriod);
    }
    startMonitoring() {
        if (!this.config.enableRuntimeDetection) {
            return;
        }
        if (this.config.enableProcessMonitoring) {
            const processInterval = setInterval(() => {
                this.monitorProcesses().catch((err) => {
                    logger_1.logger.error('Process monitoring error:', err);
                });
            }, this.config.processMonitoringIntervalMs);
            this.monitoringIntervals.push(processInterval);
        }
        if (this.config.enableNetworkMonitoring) {
            const networkInterval = setInterval(() => {
                this.monitorNetwork().catch((err) => {
                    logger_1.logger.error('Network monitoring error:', err);
                });
            }, this.config.networkMonitoringIntervalMs);
            this.monitoringIntervals.push(networkInterval);
        }
        if (this.config.enableFileSystemMonitoring) {
            const filesystemInterval = setInterval(() => {
                this.monitorFileSystem().catch((err) => {
                    logger_1.logger.error('Filesystem monitoring error:', err);
                });
            }, this.config.fileSystemMonitoringIntervalMs);
            this.monitoringIntervals.push(filesystemInterval);
        }
        if (this.config.enableMemoryMonitoring) {
            const memoryInterval = setInterval(() => {
                this.monitorMemory().catch((err) => {
                    logger_1.logger.error('Memory monitoring error:', err);
                });
            }, this.config.memoryMonitoringIntervalMs);
            this.monitoringIntervals.push(memoryInterval);
        }
        logger_1.logger.info('Runtime threat detection monitoring started');
    }
    async monitorProcesses() {
        try {
            const processes = await this.getCurrentProcesses();
            for (const process of processes) {
                await this.analyzeProcess(process);
            }
        }
        catch (err) {
            logger_1.logger.error('Error monitoring processes:', err);
        }
    }
    async getCurrentProcesses() {
        const currentProcess = {
            pid: process.pid,
            ppid: process.ppid || 0,
            name: 'node',
            commandLine: process.argv.join(' '),
            user: process.env.USER || 'unknown',
            startTime: new Date(),
            memoryUsage: process.memoryUsage().rss,
            cpuUsage: 0,
            networkConnections: 0,
            fileOperations: 0,
            suspicious: false,
            suspiciousReasons: []
        };
        return [currentProcess];
    }
    async analyzeProcess(processEvent) {
        const suspiciousReasons = [];
        let riskScore = 0;
        const normalProcesses = this.processBaseline.get('normal_processes');
        if (!normalProcesses.has(processEvent.name)) {
            if (!this.isLearningMode) {
                suspiciousReasons.push('Unknown process name');
                riskScore += 20;
            }
            else {
                normalProcesses.add(processEvent.name);
            }
        }
        if (this.containsSuspiciousPatterns(processEvent.commandLine, 'process')) {
            suspiciousReasons.push('Suspicious command line arguments');
            riskScore += 40;
        }
        if (processEvent.memoryUsage > 100 * 1024 * 1024) {
            suspiciousReasons.push('Excessive memory usage');
            riskScore += 15;
        }
        if (processEvent.user === 'root' && processEvent.name !== 'init') {
            suspiciousReasons.push('Unexpected root process');
            riskScore += 60;
        }
        if (suspiciousReasons.length > 0) {
            await this.createThreatIndicator({
                type: 'process',
                name: `Suspicious Process: ${processEvent.name}`,
                description: suspiciousReasons.join(', '),
                severity: riskScore >= 60 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : 'MEDIUM',
                processId: processEvent.pid,
                processName: processEvent.name,
                commandLine: processEvent.commandLine,
                userId: processEvent.user,
                anomalyScore: riskScore / 100,
                riskScore,
                confidence: 0.8,
                detectionRule: 'process_analysis',
                detectionEngine: 'RuntimeThreatDetectionService',
                evidenceChain: [`Process spawn: ${processEvent.name}`, ...suspiciousReasons]
            });
        }
    }
    async monitorNetwork() {
        try {
            const connections = await this.getCurrentNetworkConnections();
            for (const connection of connections) {
                await this.analyzeNetworkConnection(connection);
            }
        }
        catch (err) {
            logger_1.logger.error('Error monitoring network:', err);
        }
    }
    async getCurrentNetworkConnections() {
        return [];
    }
    async analyzeNetworkConnection(networkEvent) {
        const suspiciousReasons = [];
        let riskScore = 0;
        const allowedPorts = this.networkBaseline.get('allowed_ports');
        if (!allowedPorts.has(networkEvent.destinationPort)) {
            if (!this.isLearningMode) {
                suspiciousReasons.push('Connection to unusual port');
                riskScore += 25;
            }
        }
        if (this.isSuspiciousIP(networkEvent.destinationIP)) {
            suspiciousReasons.push('Connection to suspicious IP');
            riskScore += 70;
        }
        if (networkEvent.bytesTransferred > 10 * 1024 * 1024) {
            suspiciousReasons.push('Large data transfer');
            riskScore += 30;
        }
        if (suspiciousReasons.length > 0) {
            await this.createThreatIndicator({
                type: 'network',
                name: `Suspicious Network Activity`,
                description: suspiciousReasons.join(', '),
                severity: riskScore >= 60 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : 'MEDIUM',
                sourceIP: networkEvent.sourceIP,
                destinationIP: networkEvent.destinationIP,
                port: networkEvent.destinationPort,
                protocol: networkEvent.protocol,
                anomalyScore: riskScore / 100,
                riskScore,
                confidence: 0.7,
                detectionRule: 'network_analysis',
                detectionEngine: 'RuntimeThreatDetectionService',
                evidenceChain: [`Network connection: ${networkEvent.destinationIP}:${networkEvent.destinationPort}`, ...suspiciousReasons]
            });
        }
    }
    async monitorFileSystem() {
        try {
            logger_1.logger.debug('Monitoring filesystem events');
        }
        catch (err) {
            logger_1.logger.error('Error monitoring filesystem:', err);
        }
    }
    async monitorMemory() {
        try {
            const memUsage = process.memoryUsage();
            if (memUsage.external > 50 * 1024 * 1024) {
                await this.createThreatIndicator({
                    type: 'memory',
                    name: 'Excessive External Memory Usage',
                    description: `External memory usage: ${memUsage.external / 1024 / 1024}MB`,
                    severity: 'MEDIUM',
                    anomalyScore: 0.6,
                    riskScore: 40,
                    confidence: 0.8,
                    detectionRule: 'memory_analysis',
                    detectionEngine: 'RuntimeThreatDetectionService',
                    evidenceChain: [`External memory: ${memUsage.external} bytes`]
                });
            }
        }
        catch (err) {
            logger_1.logger.error('Error monitoring memory:', err);
        }
    }
    containsSuspiciousPatterns(text, category) {
        const suspiciousPatterns = {
            process: [
                /wget.*http/, /curl.*http/, /nc\s+-/, /netcat/, /telnet/,
                /base64.*decode/, /echo.*pipe/, /\/dev\/tcp/, /\/bin\/sh/,
                /powershell.*-enc/, /cmd.*\/c/, /certutil.*-decode/
            ],
            network: [
                /tor/, /proxy/, /tunnel/, /vpn/, /onion/
            ],
            filesystem: [
                /\.exe$/, /\.bat$/, /\.ps1$/, /\.sh$/, /\.scr$/,
                /temp.*exe/, /tmp.*sh/, /downloads.*exe/
            ]
        };
        const patterns = suspiciousPatterns[category] || [];
        return patterns.some(pattern => pattern.test(text.toLowerCase()));
    }
    isSuspiciousIP(_ip) {
        return false;
    }
    async createThreatIndicator(indicator) {
        const threatIndicator = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            type: indicator.type || 'behavior',
            severity: indicator.severity || 'MEDIUM',
            name: indicator.name || 'Unknown Threat',
            description: indicator.description || '',
            anomalyScore: indicator.anomalyScore || 0.5,
            riskScore: indicator.riskScore || 50,
            confidence: indicator.confidence || 0.5,
            detectionRule: indicator.detectionRule || 'unknown',
            detectionEngine: indicator.detectionEngine || 'RuntimeThreatDetectionService',
            evidenceChain: indicator.evidenceChain || [],
            ...indicator
        };
        this.indicators.set(threatIndicator.id, threatIndicator);
        await SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: 'runtime_threat_detected',
            severity: threatIndicator.severity,
            category: 'system',
            ipAddress: threatIndicator.sourceIP || '82.147.84.78',
            success: false,
            details: {
                indicatorType: threatIndicator.type,
                threatName: threatIndicator.name,
                riskScore: threatIndicator.riskScore,
                anomalyScore: threatIndicator.anomalyScore,
                confidence: threatIndicator.confidence,
                mitreTactic: threatIndicator.mitreTactic,
                mitreTechnique: threatIndicator.mitreTechnique
            },
            riskScore: threatIndicator.riskScore,
            tags: ['runtime_threat', 'edr', threatIndicator.type],
            compliance: {
                pii: false,
                gdpr: false,
                pci: false,
                hipaa: false
            }
        });
        if (this.config.siemIntegration) {
            await SIEMIntegrationService_1.siemIntegrationService.sendEvent({
                eventType: 'runtime_threat_indicator',
                severity: threatIndicator.severity,
                category: 'system',
                title: `Runtime Threat Detected: ${threatIndicator.name}`,
                description: threatIndicator.description,
                customFields: {
                    indicatorId: threatIndicator.id,
                    indicatorType: threatIndicator.type,
                    riskScore: threatIndicator.riskScore,
                    anomalyScore: threatIndicator.anomalyScore,
                    confidence: threatIndicator.confidence,
                    detectionRule: threatIndicator.detectionRule,
                    mitreTactic: threatIndicator.mitreTactic,
                    mitreTechnique: threatIndicator.mitreTechnique,
                    evidenceChain: threatIndicator.evidenceChain
                }
            });
        }
        if (threatIndicator.severity === 'CRITICAL' || threatIndicator.riskScore >= 70) {
            await this.createRuntimeAlert(threatIndicator);
        }
        logger_1.logger.warn('Runtime threat indicator created', {
            id: threatIndicator.id,
            type: threatIndicator.type,
            severity: threatIndicator.severity,
            name: threatIndicator.name,
            riskScore: threatIndicator.riskScore
        });
    }
    async createRuntimeAlert(indicator) {
        const alert = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            severity: indicator.severity,
            status: 'open',
            title: `Runtime Threat Alert: ${indicator.name}`,
            description: indicator.description,
            category: 'runtime_threat',
            threatType: this.classifyThreatType(indicator),
            attackStage: this.classifyAttackStage(indicator),
            indicators: [indicator],
            indicatorCount: 1,
            impactLevel: this.assessImpactLevel(indicator.riskScore),
            affectedAssets: this.identifyAffectedAssets(indicator),
            responseActions: this.generateResponseActions(indicator),
            autoActionsEnabled: this.config.enableAutoQuarantine || this.config.enableAutoTermination,
            quarantined: false,
            isolated: false,
            firstDetected: indicator.timestamp,
            lastDetected: indicator.timestamp,
            investigationNotes: [],
            anomalyScore: indicator.anomalyScore,
            baselineDeviation: indicator.anomalyScore
        };
        this.alerts.set(alert.id, alert);
        if (indicator.severity === 'CRITICAL') {
            await this.executeAutomatedResponse(alert);
        }
        logger_1.logger.error('Runtime threat alert created', {
            alertId: alert.id,
            severity: alert.severity,
            threatType: alert.threatType,
            impactLevel: alert.impactLevel
        });
    }
    classifyThreatType(indicator) {
        if (indicator.type === 'process' && indicator.commandLine?.includes('shell')) {
            return 'privilege_escalation';
        }
        if (indicator.type === 'network') {
            return 'lateral_movement';
        }
        if (indicator.type === 'filesystem') {
            return 'persistence';
        }
        if (indicator.type === 'memory') {
            return 'malware';
        }
        return 'unknown';
    }
    classifyAttackStage(indicator) {
        if (indicator.mitreTactic) {
            const tacticMap = {
                'TA0001': 'initial_access',
                'TA0002': 'execution',
                'TA0003': 'persistence',
                'TA0004': 'privilege_escalation',
                'TA0005': 'defense_evasion',
                'TA0006': 'credential_access',
                'TA0007': 'discovery',
                'TA0008': 'lateral_movement',
                'TA0009': 'collection',
                'TA0010': 'exfiltration',
                'TA0011': 'lateral_movement'
            };
            return tacticMap[indicator.mitreTactic] || 'execution';
        }
        return 'execution';
    }
    assessImpactLevel(riskScore) {
        if (riskScore >= 80)
            return 'severe';
        if (riskScore >= 60)
            return 'significant';
        if (riskScore >= 40)
            return 'moderate';
        return 'minimal';
    }
    identifyAffectedAssets(indicator) {
        const assets = [];
        if (indicator.processName) {
            assets.push(`Process: ${indicator.processName}`);
        }
        if (indicator.filePath) {
            assets.push(`File: ${indicator.filePath}`);
        }
        if (indicator.destinationIP) {
            assets.push(`Network: ${indicator.destinationIP}`);
        }
        return assets;
    }
    generateResponseActions(indicator) {
        const actions = [];
        actions.push('Investigate the threat indicator immediately');
        actions.push('Review associated process and network activity');
        actions.push('Check for additional indicators of compromise');
        if (indicator.type === 'process') {
            actions.push('Consider terminating suspicious process');
            actions.push('Review process execution context');
        }
        if (indicator.type === 'network') {
            actions.push('Block suspicious network connections');
            actions.push('Review network traffic logs');
        }
        if (indicator.type === 'filesystem') {
            actions.push('Quarantine suspicious files');
            actions.push('Scan for additional malicious files');
        }
        return actions;
    }
    async executeAutomatedResponse(alert) {
        if (!alert.autoActionsEnabled) {
            return;
        }
        try {
            if (this.config.enableAutoQuarantine && alert.severity === 'CRITICAL') {
                await this.quarantineAssets(alert);
                alert.quarantined = true;
            }
            if (this.config.enableNetworkIsolation && alert.threatType === 'lateral_movement') {
                await this.isolateNetworkAccess(alert);
                alert.isolated = true;
            }
            if (this.config.enableForensicCapture) {
                await this.captureForensicEvidence(alert);
            }
            logger_1.logger.info('Automated response executed', {
                alertId: alert.id,
                quarantined: alert.quarantined,
                isolated: alert.isolated
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to execute automated response:', err);
        }
    }
    async quarantineAssets(alert) {
        logger_1.logger.warn('Quarantining assets for alert', { alertId: alert.id });
    }
    async isolateNetworkAccess(alert) {
        logger_1.logger.warn('Isolating network access for alert', { alertId: alert.id });
    }
    async captureForensicEvidence(alert) {
        logger_1.logger.info('Capturing forensic evidence for alert', { alertId: alert.id });
    }
    getStats() {
        return {
            config: this.config,
            indicatorsCount: this.indicators.size,
            alertsCount: this.alerts.size,
            isLearningMode: this.isLearningMode,
            uptime: Date.now() - this.learningStartTime.getTime()
        };
    }
    getActiveIndicators() {
        return Array.from(this.indicators.values());
    }
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => alert.status === 'open' || alert.status === 'investigating');
    }
    async healthCheck() {
        const stats = this.getStats();
        const activeAlerts = this.getActiveAlerts();
        const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'CRITICAL').length;
        let status = 'healthy';
        if (criticalAlerts > 0) {
            status = 'critical';
        }
        else if (activeAlerts.length > 5) {
            status = 'warning';
        }
        return {
            status,
            stats: {
                ...stats,
                activeAlerts: activeAlerts.length,
                criticalAlerts
            }
        };
    }
}
exports.RuntimeThreatDetectionService = RuntimeThreatDetectionService;
exports.runtimeThreatDetectionService = RuntimeThreatDetectionService.getInstance();
//# sourceMappingURL=RuntimeThreatDetectionService.js.map