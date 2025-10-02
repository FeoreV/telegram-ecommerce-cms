export interface ThreatDetectionConfig {
    enableRuntimeDetection: boolean;
    enableeBPFIntegration: boolean;
    enableProcessMonitoring: boolean;
    enableNetworkMonitoring: boolean;
    enableFileSystemMonitoring: boolean;
    enableMemoryMonitoring: boolean;
    detectionSensitivity: 'low' | 'medium' | 'high' | 'paranoid';
    falsePositiveThreshold: number;
    anomalyScoreThreshold: number;
    processMonitoringIntervalMs: number;
    networkMonitoringIntervalMs: number;
    fileSystemMonitoringIntervalMs: number;
    memoryMonitoringIntervalMs: number;
    enableAutoQuarantine: boolean;
    enableAutoTermination: boolean;
    enableNetworkIsolation: boolean;
    enableForensicCapture: boolean;
    enableMLDetection: boolean;
    anomalyDetectionWindow: number;
    baselineLearningPeriod: number;
    edrEndpoint?: string;
    edrApiKey?: string;
    siemIntegration: boolean;
}
export interface ThreatIndicator {
    id: string;
    timestamp: Date;
    type: 'process' | 'network' | 'filesystem' | 'memory' | 'registry' | 'api' | 'behavior';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    name: string;
    description: string;
    mitreTactic?: string;
    mitreTechnique?: string;
    processId?: number;
    processName?: string;
    commandLine?: string;
    parentProcessId?: number;
    userId?: string;
    sourceIP?: string;
    destinationIP?: string;
    port?: number;
    protocol?: string;
    filePath?: string;
    fileHash?: string;
    fileSize?: number;
    anomalyScore: number;
    riskScore: number;
    confidence: number;
    detectionRule: string;
    detectionEngine: string;
    evidenceChain: string[];
}
export interface RuntimeAlert {
    id: string;
    timestamp: Date;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'open' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';
    title: string;
    description: string;
    category: string;
    threatType: 'malware' | 'apt' | 'insider' | 'dos' | 'data_exfiltration' | 'privilege_escalation' | 'lateral_movement' | 'persistence' | 'unknown';
    attackStage: 'reconnaissance' | 'initial_access' | 'execution' | 'persistence' | 'privilege_escalation' | 'defense_evasion' | 'credential_access' | 'discovery' | 'lateral_movement' | 'collection' | 'exfiltration' | 'impact';
    indicators: ThreatIndicator[];
    indicatorCount: number;
    impactLevel: 'minimal' | 'moderate' | 'significant' | 'severe';
    affectedAssets: string[];
    responseActions: string[];
    autoActionsEnabled: boolean;
    quarantined: boolean;
    isolated: boolean;
    firstDetected: Date;
    lastDetected: Date;
    investigationNotes: string[];
    assignee?: string;
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
export declare class RuntimeThreatDetectionService {
    private static instance;
    private config;
    private indicators;
    private alerts;
    private processBaseline;
    private networkBaseline;
    private fileSystemBaseline;
    private monitoringIntervals;
    private isLearningMode;
    private learningStartTime;
    private constructor();
    static getInstance(): RuntimeThreatDetectionService;
    private initializeRuntimeDetection;
    private initializeeBPF;
    private initializeThreatRules;
    private addThreatRule;
    private initializeBaselines;
    private setupLearningMode;
    private startMonitoring;
    private monitorProcesses;
    private getCurrentProcesses;
    private analyzeProcess;
    private monitorNetwork;
    private getCurrentNetworkConnections;
    private analyzeNetworkConnection;
    private monitorFileSystem;
    private monitorMemory;
    private containsSuspiciousPatterns;
    private isSuspiciousIP;
    private createThreatIndicator;
    private createRuntimeAlert;
    private classifyThreatType;
    private classifyAttackStage;
    private assessImpactLevel;
    private identifyAffectedAssets;
    private generateResponseActions;
    private executeAutomatedResponse;
    private quarantineAssets;
    private isolateNetworkAccess;
    private captureForensicEvidence;
    getStats(): {
        config: ThreatDetectionConfig;
        indicatorsCount: number;
        alertsCount: number;
        isLearningMode: boolean;
        uptime: number;
    };
    getActiveIndicators(): ThreatIndicator[];
    getActiveAlerts(): RuntimeAlert[];
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const runtimeThreatDetectionService: RuntimeThreatDetectionService;
//# sourceMappingURL=RuntimeThreatDetectionService.d.ts.map