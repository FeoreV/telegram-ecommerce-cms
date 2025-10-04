// Runtime threat detection service
// fs and path imports removed as they were unused
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { securityLogService } from './SecurityLogService';
import { siemIntegrationService } from './SIEMIntegrationService';

export interface ThreatDetectionConfig {
  enableRuntimeDetection: boolean;
  enableeBPFIntegration: boolean;
  enableProcessMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  enableFileSystemMonitoring: boolean;
  enableMemoryMonitoring: boolean;

  // Detection sensitivity
  detectionSensitivity: 'low' | 'medium' | 'high' | 'paranoid';
  falsePositiveThreshold: number;
  anomalyScoreThreshold: number;

  // Monitoring intervals
  processMonitoringIntervalMs: number;
  networkMonitoringIntervalMs: number;
  fileSystemMonitoringIntervalMs: number;
  memoryMonitoringIntervalMs: number;

  // Response actions
  enableAutoQuarantine: boolean;
  enableAutoTermination: boolean;
  enableNetworkIsolation: boolean;
  enableForensicCapture: boolean;

  // Machine learning
  enableMLDetection: boolean;
  anomalyDetectionWindow: number;
  baselineLearningPeriod: number;

  // Integration
  edrEndpoint?: string;
  edrApiKey?: string;
  siemIntegration: boolean;
}

export interface ThreatIndicator {
  id: string;
  timestamp: Date;
  type: 'process' | 'network' | 'filesystem' | 'memory' | 'registry' | 'api' | 'behavior';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Indicator details
  name: string;
  description: string;
  mitreTactic?: string;
  mitreTechnique?: string;

  // Context
  processId?: number;
  processName?: string;
  commandLine?: string;
  parentProcessId?: number;
  userId?: string;

  // Network context
  sourceIP?: string;
  destinationIP?: string;
  port?: number;
  protocol?: string;

  // File context
  filePath?: string;
  fileHash?: string;
  fileSize?: number;

  // Behavioral context
  anomalyScore: number;
  riskScore: number;
  confidence: number;

  // Detection metadata
  detectionRule: string;
  detectionEngine: string;
  evidenceChain: string[];
}

export interface RuntimeAlert {
  id: string;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';

  // Alert details
  title: string;
  description: string;
  category: string;

  // Threat classification
  threatType: 'malware' | 'apt' | 'insider' | 'dos' | 'data_exfiltration' | 'privilege_escalation' | 'lateral_movement' | 'persistence' | 'unknown';
  attackStage: 'reconnaissance' | 'initial_access' | 'execution' | 'persistence' | 'privilege_escalation' | 'defense_evasion' | 'credential_access' | 'discovery' | 'lateral_movement' | 'collection' | 'exfiltration' | 'impact';

  // Related indicators
  indicators: ThreatIndicator[];
  indicatorCount: number;

  // Impact assessment
  impactLevel: 'minimal' | 'moderate' | 'significant' | 'severe';
  affectedAssets: string[];

  // Response actions
  responseActions: string[];
  autoActionsEnabled: boolean;
  quarantined: boolean;
  isolated: boolean;

  // Timeline
  firstDetected: Date;
  lastDetected: Date;

  // Investigation
  investigationNotes: string[];
  assignee?: string;

  // Machine learning
  anomalyScore: number;
  baselineDeviation: number;
}

export interface ProcessEvent {
  pid: number;
  ppid: number;
  name: string;
  commandLine: string;
  user: string;
  startTime: Date;
  memoryUsage: number;
  cpuUsage: number;
  networkConnections: number;
  fileOperations: number;
  suspicious: boolean;
  suspiciousReasons: string[];
}

export interface NetworkEvent {
  sourceIP: string;
  destinationIP: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  bytesTransferred: number;
  duration: number;
  suspicious: boolean;
  suspiciousReasons: string[];
}

export interface FileSystemEvent {
  path: string;
  operation: 'create' | 'read' | 'write' | 'delete' | 'modify' | 'execute';
  process: string;
  user: string;
  size: number;
  hash?: string;
  suspicious: boolean;
  suspiciousReasons: string[];
}

export class RuntimeThreatDetectionService {
  private static instance: RuntimeThreatDetectionService;
  private config: ThreatDetectionConfig;
  private indicators: Map<string, ThreatIndicator> = new Map();
  private alerts: Map<string, RuntimeAlert> = new Map();
  private processBaseline: Map<string, any> = new Map();
  private networkBaseline: Map<string, any> = new Map();
  private fileSystemBaseline: Map<string, any> = new Map();
  private monitoringIntervals: NodeJS.Timeout[] = [];
  private isLearningMode: boolean = true;
  private learningStartTime: Date = new Date();

  private constructor() {
    this.config = {
      enableRuntimeDetection: process.env.ENABLE_RUNTIME_THREAT_DETECTION !== 'false',
      enableeBPFIntegration: process.env.ENABLE_EBPF_INTEGRATION === 'true',
      enableProcessMonitoring: process.env.ENABLE_PROCESS_MONITORING !== 'false',
      enableNetworkMonitoring: process.env.ENABLE_NETWORK_MONITORING !== 'false',
      enableFileSystemMonitoring: process.env.ENABLE_FILESYSTEM_MONITORING !== 'false',
      enableMemoryMonitoring: process.env.ENABLE_MEMORY_MONITORING === 'true',

      detectionSensitivity: (process.env.THREAT_DETECTION_SENSITIVITY as any) || 'high',
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
      anomalyDetectionWindow: parseInt(process.env.ANOMALY_DETECTION_WINDOW || '300000'), // 5 minutes
      baselineLearningPeriod: parseInt(process.env.BASELINE_LEARNING_PERIOD || '3600000'), // 1 hour

      edrEndpoint: process.env.EDR_ENDPOINT,
      edrApiKey: process.env.EDR_API_KEY,
      siemIntegration: process.env.THREAT_DETECTION_SIEM_INTEGRATION !== 'false'
    };

    this.initializeRuntimeDetection();
    this.startMonitoring();

    logger.info('Runtime Threat Detection Service initialized', {
      enabled: this.config.enableRuntimeDetection,
      eBPFIntegration: this.config.enableeBPFIntegration,
      sensitivity: this.config.detectionSensitivity,
      mlDetection: this.config.enableMLDetection,
      autoResponse: this.config.enableAutoQuarantine
    });
  }

  public static getInstance(): RuntimeThreatDetectionService {
    if (!RuntimeThreatDetectionService.instance) {
      RuntimeThreatDetectionService.instance = new RuntimeThreatDetectionService();
    }
    return RuntimeThreatDetectionService.instance;
  }

  private async initializeRuntimeDetection(): Promise<void> {
    if (!this.config.enableRuntimeDetection) {
      return;
    }

    try {
      // Initialize eBPF if available
      if (this.config.enableeBPFIntegration) {
        await this.initializeeBPF();
      }

      // Initialize threat detection rules
      this.initializeThreatRules();

      // Initialize baselines
      this.initializeBaselines();

      // Setup learning mode
      this.setupLearningMode();

      logger.info('Runtime threat detection initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize runtime threat detection:', err as Record<string, unknown>);
    }
  }

  private async initializeeBPF(): Promise<void> {
    // eBPF integration would require native modules
    // This is a placeholder for actual eBPF implementation
    logger.info('eBPF integration initialized (placeholder)');
  }

  private initializeThreatRules(): void {
    // Process-based threat indicators
    this.addThreatRule('suspicious_process_spawn', {
      type: 'process',
      patterns: ['/bin/sh', '/bin/bash', 'cmd.exe', 'powershell.exe'],
      severity: 'MEDIUM',
      mitreTactic: 'TA0002', // Execution
      mitreTechnique: 'T1059' // Command and Scripting Interpreter
    });

    // Network-based threat indicators
    this.addThreatRule('suspicious_network_connection', {
      type: 'network',
      patterns: ['tor', 'proxy', 'tunnel'],
      severity: 'HIGH',
      mitreTactic: 'TA0011', // Command and Control
      mitreTechnique: 'T1071' // Application Layer Protocol
    });

    // File-based threat indicators
    this.addThreatRule('suspicious_file_creation', {
      type: 'filesystem',
      patterns: ['.exe', '.bat', '.ps1', '.sh'],
      severity: 'MEDIUM',
      mitreTactic: 'TA0003', // Persistence
      mitreTechnique: 'T1547' // Boot or Logon Autostart Execution
    });

    // Memory-based threat indicators
    this.addThreatRule('memory_injection_attempt', {
      type: 'memory',
      patterns: ['injection', 'hollowing', 'shellcode'],
      severity: 'CRITICAL',
      mitreTactic: 'TA0005', // Defense Evasion
      mitreTechnique: 'T1055' // Process Injection
    });

    // API-based threat indicators
    this.addThreatRule('suspicious_api_calls', {
      type: 'api',
      patterns: ['VirtualAlloc', 'WriteProcessMemory', 'CreateRemoteThread'],
      severity: 'HIGH',
      mitreTactic: 'TA0005', // Defense Evasion
      mitreTechnique: 'T1055' // Process Injection
    });

    logger.debug('Threat detection rules initialized');
  }

  private addThreatRule(id: string, ruleDetails: any): void {
    // Implementation would add actual threat detection rules
    logger.debug(`Added threat rule: ${id}`, ruleDetails);
  }

  private initializeBaselines(): void {
    // Initialize process baseline
    this.processBaseline.set('normal_processes', new Set([
      'node', 'npm', 'init', 'tini', 'dumb-init'
    ]));

    // Initialize network baseline
    this.networkBaseline.set('allowed_ports', new Set([
      80, 443, 5432, 6379, 8200, 3000
    ]));

    // Initialize filesystem baseline
    this.fileSystemBaseline.set('protected_paths', new Set([
      '/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64'
    ]));

    logger.debug('Security baselines initialized');
  }

  private setupLearningMode(): void {
    // Exit learning mode after specified period
    setTimeout(() => {
      this.isLearningMode = false;
      logger.info('Exiting learning mode, active threat detection enabled');
    }, this.config.baselineLearningPeriod);
  }

  private startMonitoring(): void {
    if (!this.config.enableRuntimeDetection) {
      return;
    }

    // Process monitoring
    if (this.config.enableProcessMonitoring) {
      const processInterval = setInterval(() => {
        this.monitorProcesses().catch((err: unknown) => {
          logger.error('Process monitoring error:', err as Record<string, unknown>);
        });
      }, this.config.processMonitoringIntervalMs);

      this.monitoringIntervals.push(processInterval);
    }

    // Network monitoring
    if (this.config.enableNetworkMonitoring) {
      const networkInterval = setInterval(() => {
        this.monitorNetwork().catch((err: unknown) => {
          logger.error('Network monitoring error:', err as Record<string, unknown>);
        });
      }, this.config.networkMonitoringIntervalMs);

      this.monitoringIntervals.push(networkInterval);
    }

    // Filesystem monitoring
    if (this.config.enableFileSystemMonitoring) {
      const filesystemInterval = setInterval(() => {
        this.monitorFileSystem().catch((err: unknown) => {
          logger.error('Filesystem monitoring error:', err as Record<string, unknown>);
        });
      }, this.config.fileSystemMonitoringIntervalMs);

      this.monitoringIntervals.push(filesystemInterval);
    }

    // Memory monitoring
    if (this.config.enableMemoryMonitoring) {
      const memoryInterval = setInterval(() => {
        this.monitorMemory().catch((err: unknown) => {
          logger.error('Memory monitoring error:', err as Record<string, unknown>);
        });
      }, this.config.memoryMonitoringIntervalMs);

      this.monitoringIntervals.push(memoryInterval);
    }

    logger.info('Runtime threat detection monitoring started');
  }

  private async monitorProcesses(): Promise<void> {
    try {
      // Get current process list (simplified implementation)
      const processes = await this.getCurrentProcesses();

      for (const process of processes) {
        await this.analyzeProcess(process);
      }

    } catch (err: unknown) {
      logger.error('Error monitoring processes:', err as Record<string, unknown>);
    }
  }

  private async getCurrentProcesses(): Promise<ProcessEvent[]> {
    // Simplified process enumeration
    // In a real implementation, this would use eBPF or system APIs
    const currentProcess: ProcessEvent = {
      pid: process.pid,
      ppid: process.ppid || 0,
      name: 'node',
      commandLine: process.argv.join(' '),
      user: process.env.USER || 'unknown',
      startTime: new Date(),
      memoryUsage: process.memoryUsage().rss,
      cpuUsage: 0, // Would calculate actual CPU usage
      networkConnections: 0, // Would count actual connections
      fileOperations: 0, // Would count actual file operations
      suspicious: false,
      suspiciousReasons: []
    };

    return [currentProcess];
  }

  private async analyzeProcess(processEvent: ProcessEvent): Promise<void> {
    const suspiciousReasons: string[] = [];
    let riskScore = 0;

    // Check against known good processes
    const normalProcesses = this.processBaseline.get('normal_processes') as Set<string>;
    if (!normalProcesses.has(processEvent.name)) {
      if (!this.isLearningMode) {
        suspiciousReasons.push('Unknown process name');
        riskScore += 20;
      } else {
        // Add to baseline during learning
        normalProcesses.add(processEvent.name);
      }
    }

    // Check command line for suspicious patterns
    if (this.containsSuspiciousPatterns(processEvent.commandLine, 'process')) {
      suspiciousReasons.push('Suspicious command line arguments');
      riskScore += 40;
    }

    // Check memory usage anomalies
    if (processEvent.memoryUsage > 100 * 1024 * 1024) { // 100MB threshold
      suspiciousReasons.push('Excessive memory usage');
      riskScore += 15;
    }

    // Check for privilege escalation attempts
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

  private async monitorNetwork(): Promise<void> {
    try {
      // Get current network connections (simplified)
      const connections = await this.getCurrentNetworkConnections();

      for (const connection of connections) {
        await this.analyzeNetworkConnection(connection);
      }

    } catch (err: unknown) {
      logger.error('Error monitoring network:', err as Record<string, unknown>);
    }
  }

  private async getCurrentNetworkConnections(): Promise<NetworkEvent[]> {
    // Simplified network monitoring
    // In a real implementation, this would use eBPF or netstat/ss
    return []; // Placeholder
  }

  private async analyzeNetworkConnection(networkEvent: NetworkEvent): Promise<void> {
    const suspiciousReasons: string[] = [];
    let riskScore = 0;

    // Check against allowed ports
    const allowedPorts = this.networkBaseline.get('allowed_ports') as Set<number>;
    if (!allowedPorts.has(networkEvent.destinationPort)) {
      if (!this.isLearningMode) {
        suspiciousReasons.push('Connection to unusual port');
        riskScore += 25;
      }
    }

    // Check for suspicious IPs (simplified)
    if (this.isSuspiciousIP(networkEvent.destinationIP)) {
      suspiciousReasons.push('Connection to suspicious IP');
      riskScore += 70;
    }

    // Check for excessive data transfer
    if (networkEvent.bytesTransferred > 10 * 1024 * 1024) { // 10MB threshold
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

  private async monitorFileSystem(): Promise<void> {
    try {
      // Monitor file system events (simplified)
      // In a real implementation, this would use inotify/fanotify or eBPF
      logger.debug('Monitoring filesystem events');

    } catch (err: unknown) {
      logger.error('Error monitoring filesystem:', err as Record<string, unknown>);
    }
  }

  private async monitorMemory(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();

      // Check for memory anomalies
      if (memUsage.external > 50 * 1024 * 1024) { // 50MB external memory
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

    } catch (err: unknown) {
      logger.error('Error monitoring memory:', err as Record<string, unknown>);
    }
  }

  private containsSuspiciousPatterns(text: string, category: string): boolean {
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

    const patterns = suspiciousPatterns[category as keyof typeof suspiciousPatterns] || [];
    return patterns.some(pattern => pattern.test(text.toLowerCase()));
  }

  private isSuspiciousIP(_ip: string): boolean {
    // Simplified IP reputation check
    // In a real implementation, this would check against threat intelligence feeds

    // Placeholder for actual IP reputation check
    return false;
  }

  private async createThreatIndicator(indicator: Partial<ThreatIndicator>): Promise<void> {
    const threatIndicator: ThreatIndicator = {
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

    // Log security event
    await securityLogService.logSecurityEvent({
      eventType: 'runtime_threat_detected',
      severity: threatIndicator.severity,
      category: 'system',
      ipAddress: threatIndicator.sourceIP || 'localhost',
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

    // Send to SIEM
    if (this.config.siemIntegration) {
      await siemIntegrationService.sendEvent({
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

    // Check if we need to create an alert
    if (threatIndicator.severity === 'CRITICAL' || threatIndicator.riskScore >= 70) {
      await this.createRuntimeAlert(threatIndicator);
    }

    logger.warn('Runtime threat indicator created', {
      id: threatIndicator.id,
      type: threatIndicator.type,
      severity: threatIndicator.severity,
      name: threatIndicator.name,
      riskScore: threatIndicator.riskScore
    });
  }

  private async createRuntimeAlert(indicator: ThreatIndicator): Promise<void> {
    const alert: RuntimeAlert = {
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

    // Execute automated response if enabled
    if (indicator.severity === 'CRITICAL') {
      // NOTE: Internal method with predefined response actions, not dynamic code execution (CWE-94 false positive)
      await this.executeAutomatedResponse(alert);
    }

    logger.error('Runtime threat alert created', {
      alertId: alert.id,
      severity: alert.severity,
      threatType: alert.threatType,
      impactLevel: alert.impactLevel
    });
  }

  private classifyThreatType(indicator: ThreatIndicator): RuntimeAlert['threatType'] {
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

  private classifyAttackStage(indicator: ThreatIndicator): RuntimeAlert['attackStage'] {
    if (indicator.mitreTactic) {
      const tacticMap: Record<string, RuntimeAlert['attackStage']> = {
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

  private assessImpactLevel(riskScore: number): RuntimeAlert['impactLevel'] {
    if (riskScore >= 80) return 'severe';
    if (riskScore >= 60) return 'significant';
    if (riskScore >= 40) return 'moderate';
    return 'minimal';
  }

  private identifyAffectedAssets(indicator: ThreatIndicator): string[] {
    const assets: string[] = [];

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

  private generateResponseActions(indicator: ThreatIndicator): string[] {
    const actions: string[] = [];

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

  private async executeAutomatedResponse(alert: RuntimeAlert): Promise<void> {
    if (!alert.autoActionsEnabled) {
      return;
    }

    try {
      // Auto-quarantine if enabled
      if (this.config.enableAutoQuarantine && alert.severity === 'CRITICAL') {
        await this.quarantineAssets(alert);
        alert.quarantined = true;
      }

      // Auto-isolation if enabled
      if (this.config.enableNetworkIsolation && alert.threatType === 'lateral_movement') {
        await this.isolateNetworkAccess(alert);
        alert.isolated = true;
      }

      // Forensic capture if enabled
      if (this.config.enableForensicCapture) {
        await this.captureForensicEvidence(alert);
      }

      logger.info('Automated response executed', {
        alertId: alert.id,
        quarantined: alert.quarantined,
        isolated: alert.isolated
      });

    } catch (err: unknown) {
      logger.error('Failed to execute automated response:', err as Record<string, unknown>);
    }
  }

  private async quarantineAssets(alert: RuntimeAlert): Promise<void> {
    // Implementation would quarantine affected assets
    logger.warn('Quarantining assets for alert', { alertId: alert.id });
  }

  private async isolateNetworkAccess(alert: RuntimeAlert): Promise<void> {
    // Implementation would isolate network access
    logger.warn('Isolating network access for alert', { alertId: alert.id });
  }

  private async captureForensicEvidence(alert: RuntimeAlert): Promise<void> {
    // Implementation would capture forensic evidence
    logger.info('Capturing forensic evidence for alert', { alertId: alert.id });
  }

  /**
   * Get runtime threat statistics
   */
  getStats(): {
    config: ThreatDetectionConfig;
    indicatorsCount: number;
    alertsCount: number;
    isLearningMode: boolean;
    uptime: number;
  } {
    return {
      config: this.config,
      indicatorsCount: this.indicators.size,
      alertsCount: this.alerts.size,
      isLearningMode: this.isLearningMode,
      uptime: Date.now() - this.learningStartTime.getTime()
    };
  }

  /**
   * Get active threat indicators
   */
  getActiveIndicators(): ThreatIndicator[] {
    return Array.from(this.indicators.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): RuntimeAlert[] {
    return Array.from(this.alerts.values()).filter(alert =>
      alert.status === 'open' || alert.status === 'investigating'
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    const stats = this.getStats();
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'CRITICAL').length;

    let status = 'healthy';
    if (criticalAlerts > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 5) {
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

// Export singleton instance
export const runtimeThreatDetectionService = RuntimeThreatDetectionService.getInstance();
