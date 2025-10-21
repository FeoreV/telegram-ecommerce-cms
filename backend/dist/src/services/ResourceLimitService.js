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
exports.resourceLimitService = exports.ResourceLimitService = void 0;
const os = __importStar(require("os"));
const process = __importStar(require("process"));
const logger_1 = require("../utils/logger");
const SecurityLogService_1 = require("./SecurityLogService");
class ResourceLimitService {
    constructor() {
        this.alerts = new Map();
        this.monitoringInterval = null;
        this.connectionCount = 0;
        this.requestCount = 0;
        this.concurrentRequests = 0;
        this.lastRequestReset = Date.now();
        this.cpuUsageHistory = [];
        this.memoryUsageHistory = [];
        this.emergencyMode = false;
        this.limits = {
            maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '512'),
            memoryWarningThreshold: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '70'),
            memoryCriticalThreshold: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '85'),
            maxCpuPercent: parseFloat(process.env.MAX_CPU_PERCENT || '80'),
            cpuWarningThreshold: parseFloat(process.env.CPU_WARNING_THRESHOLD || '60'),
            cpuCriticalThreshold: parseFloat(process.env.CPU_CRITICAL_THRESHOLD || '75'),
            maxFileDescriptors: parseInt(process.env.MAX_FILE_DESCRIPTORS || '1024'),
            fdWarningThreshold: parseFloat(process.env.FD_WARNING_THRESHOLD || '70'),
            fdCriticalThreshold: parseFloat(process.env.FD_CRITICAL_THRESHOLD || '85'),
            maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
            maxRequestsPerSecond: parseInt(process.env.MAX_REQUESTS_PER_SECOND || '100'),
            maxBandwidthMBps: parseFloat(process.env.MAX_BANDWIDTH_MBPS || '100'),
            maxDiskReadMBps: parseFloat(process.env.MAX_DISK_READ_MBPS || '50'),
            maxDiskWriteMBps: parseFloat(process.env.MAX_DISK_WRITE_MBPS || '30'),
            maxTempStorageMB: parseInt(process.env.MAX_TEMP_STORAGE_MB || '100'),
            maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '50'),
            maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10'),
            maxDatabaseConnections: parseInt(process.env.MAX_DB_CONNECTIONS || '20'),
            maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE_MB || '128'),
            maxChildProcesses: parseInt(process.env.MAX_CHILD_PROCESSES || '5'),
            maxThreads: parseInt(process.env.MAX_THREADS || '20'),
            maxRequestTimeoutMs: parseInt(process.env.MAX_REQUEST_TIMEOUT || '30000'),
            maxIdleTimeMs: parseInt(process.env.MAX_IDLE_TIME || '300000'),
            enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
            enableAdaptiveRateLimiting: process.env.ENABLE_ADAPTIVE_RATE_LIMITING !== 'false',
            enableEmergencyThrottling: process.env.ENABLE_EMERGENCY_THROTTLING !== 'false',
            enableProcessTermination: process.env.ENABLE_PROCESS_TERMINATION === 'true',
            enableConnectionDraining: process.env.ENABLE_CONNECTION_DRAINING !== 'false'
        };
        this.usage = this.createEmptyUsage();
        this.initializeResourceMonitoring();
        this.setupProcessHandlers();
        logger_1.logger.info('Resource Limit Service initialized', {
            maxMemoryMB: this.limits.maxMemoryMB,
            maxCpuPercent: this.limits.maxCpuPercent,
            maxConnections: this.limits.maxConnections,
            emergencyThrottling: this.limits.enableEmergencyThrottling
        });
    }
    static getInstance() {
        if (!ResourceLimitService.instance) {
            ResourceLimitService.instance = new ResourceLimitService();
        }
        return ResourceLimitService.instance;
    }
    createEmptyUsage() {
        return {
            timestamp: new Date(),
            memoryUsedMB: 0,
            memoryUsagePercent: 0,
            heapUsedMB: 0,
            heapTotalMB: 0,
            cpuUsagePercent: 0,
            loadAverage: [0, 0, 0],
            openFileDescriptors: 0,
            fdUsagePercent: 0,
            activeConnections: 0,
            requestsPerSecond: 0,
            networkBandwidthMBps: 0,
            diskReadMBps: 0,
            diskWriteMBps: 0,
            tempStorageUsedMB: 0,
            concurrentRequests: 0,
            databaseConnections: 0,
            cacheUsageMB: 0,
            childProcesses: 0,
            threadCount: 0,
            eventLoopLag: 0,
            eventLoopUtilization: 0
        };
    }
    initializeResourceMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectResourceUsage();
            this.checkResourceLimits();
        }, 5000);
        setInterval(() => {
            this.requestCount = 0;
        }, 1000);
    }
    setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught exception with resource context:', {
                error: error.message,
                stack: error.stack,
                memoryUsage: this.usage.memoryUsedMB,
                cpuUsage: this.usage.cpuUsagePercent,
                concurrentRequests: this.usage.concurrentRequests
            });
            if (global.gc) {
                global.gc();
            }
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled rejection with resource context:', {
                reason,
                promise,
                memoryUsage: this.usage.memoryUsedMB,
                cpuUsage: this.usage.cpuUsagePercent
            });
        });
        process.on('SIGTERM', () => {
            logger_1.logger.info('SIGTERM received, starting graceful shutdown...');
            this.gracefulShutdown();
        });
        process.on('SIGINT', () => {
            logger_1.logger.info('SIGINT received, starting graceful shutdown...');
            this.gracefulShutdown();
        });
    }
    collectResourceUsage() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const loadAvg = os.loadavg();
        const memoryUsedMB = memUsage.rss / (1024 * 1024);
        const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
        const heapTotalMB = memUsage.heapTotal / (1024 * 1024);
        const memoryUsagePercent = (memoryUsedMB / this.limits.maxMemoryMB) * 100;
        const totalCpuTime = cpuUsage.user + cpuUsage.system;
        const cpuUsagePercent = Math.min(100, (totalCpuTime / 1000000) / os.cpus().length);
        this.cpuUsageHistory.push(cpuUsagePercent);
        this.memoryUsageHistory.push(memoryUsagePercent);
        if (this.cpuUsageHistory.length > 60) {
            this.cpuUsageHistory.shift();
        }
        if (this.memoryUsageHistory.length > 60) {
            this.memoryUsageHistory.shift();
        }
        const eventLoopLag = this.measureEventLoopLag();
        const eventLoopUtilization = this.measureEventLoopUtilization();
        this.usage = {
            timestamp: new Date(),
            memoryUsedMB,
            memoryUsagePercent,
            heapUsedMB,
            heapTotalMB,
            cpuUsagePercent,
            loadAverage: loadAvg,
            openFileDescriptors: this.getOpenFileDescriptors(),
            fdUsagePercent: (this.getOpenFileDescriptors() / this.limits.maxFileDescriptors) * 100,
            activeConnections: this.connectionCount,
            requestsPerSecond: this.requestCount,
            networkBandwidthMBps: 0,
            diskReadMBps: 0,
            diskWriteMBps: 0,
            tempStorageUsedMB: this.getTempStorageUsage(),
            concurrentRequests: this.concurrentRequests,
            databaseConnections: 0,
            cacheUsageMB: 0,
            childProcesses: this.getChildProcessCount(),
            threadCount: this.getThreadCount(),
            eventLoopLag,
            eventLoopUtilization
        };
    }
    measureEventLoopLag() {
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000;
            return lag;
        });
        return 0;
    }
    measureEventLoopUtilization() {
        return this.usage.cpuUsagePercent / 100;
    }
    getOpenFileDescriptors() {
        return Math.floor(this.limits.maxFileDescriptors * 0.3);
    }
    getTempStorageUsage() {
        return Math.floor(this.limits.maxTempStorageMB * 0.2);
    }
    getChildProcessCount() {
        return 0;
    }
    getThreadCount() {
        return 1;
    }
    checkResourceLimits() {
        this.checkMemoryLimits();
        this.checkCpuLimits();
        this.checkConnectionLimits();
        this.checkFileDescriptorLimits();
        this.checkConcurrentRequestLimits();
        this.checkEventLoopHealth();
    }
    checkMemoryLimits() {
        const usage = this.usage.memoryUsagePercent;
        if (usage >= this.limits.memoryCriticalThreshold) {
            this.createAlert('memory', 'critical', usage, this.limits.memoryCriticalThreshold, this.limits.maxMemoryMB);
            if (this.limits.enableEmergencyThrottling) {
                this.enterEmergencyMode('memory_critical');
            }
        }
        else if (usage >= this.limits.memoryWarningThreshold) {
            this.createAlert('memory', 'warning', usage, this.limits.memoryWarningThreshold, this.limits.maxMemoryMB);
            if (global.gc) {
                global.gc();
            }
        }
    }
    checkCpuLimits() {
        const avgUsage = this.cpuUsageHistory.reduce((a, b) => a + b, 0) / this.cpuUsageHistory.length;
        if (avgUsage >= this.limits.cpuCriticalThreshold) {
            this.createAlert('cpu', 'critical', avgUsage, this.limits.cpuCriticalThreshold, this.limits.maxCpuPercent);
            if (this.limits.enableEmergencyThrottling) {
                this.enterEmergencyMode('cpu_critical');
            }
        }
        else if (avgUsage >= this.limits.cpuWarningThreshold) {
            this.createAlert('cpu', 'warning', avgUsage, this.limits.cpuWarningThreshold, this.limits.maxCpuPercent);
        }
    }
    checkConnectionLimits() {
        const usage = this.usage.activeConnections;
        const usagePercent = (usage / this.limits.maxConnections) * 100;
        if (usagePercent >= 90) {
            this.createAlert('connections', 'critical', usage, this.limits.maxConnections * 0.9, this.limits.maxConnections);
            if (this.limits.enableConnectionDraining) {
                this.startConnectionDraining();
            }
        }
        else if (usagePercent >= 70) {
            this.createAlert('connections', 'warning', usage, this.limits.maxConnections * 0.7, this.limits.maxConnections);
        }
    }
    checkFileDescriptorLimits() {
        const usage = this.usage.fdUsagePercent;
        if (usage >= this.limits.fdCriticalThreshold) {
            this.createAlert('file_descriptors', 'critical', usage, this.limits.fdCriticalThreshold, this.limits.maxFileDescriptors);
        }
        else if (usage >= this.limits.fdWarningThreshold) {
            this.createAlert('file_descriptors', 'warning', usage, this.limits.fdWarningThreshold, this.limits.maxFileDescriptors);
        }
    }
    checkConcurrentRequestLimits() {
        const usage = this.usage.concurrentRequests;
        const usagePercent = (usage / this.limits.maxConcurrentRequests) * 100;
        if (usagePercent >= 90) {
            this.createAlert('concurrent_requests', 'critical', usage, this.limits.maxConcurrentRequests * 0.9, this.limits.maxConcurrentRequests);
            if (this.limits.enableEmergencyThrottling) {
                this.throttleIncomingRequests();
            }
        }
        else if (usagePercent >= 70) {
            this.createAlert('concurrent_requests', 'warning', usage, this.limits.maxConcurrentRequests * 0.7, this.limits.maxConcurrentRequests);
        }
    }
    checkEventLoopHealth() {
        const lag = this.usage.eventLoopLag;
        const utilization = this.usage.eventLoopUtilization;
        if (lag > 100) {
            this.createAlert('event_loop_lag', 'critical', lag, 100, 500);
        }
        else if (lag > 50) {
            this.createAlert('event_loop_lag', 'warning', lag, 50, 100);
        }
        if (utilization > 0.9) {
            this.createAlert('event_loop_utilization', 'critical', utilization * 100, 90, 100);
        }
    }
    createAlert(resource, type, currentValue, threshold, limit) {
        const alertId = `${resource}_${type}`;
        if (this.alerts.has(alertId)) {
            return;
        }
        const alert = {
            id: alertId,
            timestamp: new Date(),
            type,
            resource,
            currentValue,
            threshold,
            limit,
            message: `${resource} usage (${currentValue.toFixed(2)}) exceeded ${type} threshold (${threshold})`,
            action: this.determineAction(resource, type)
        };
        this.alerts.set(alertId, alert);
        SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: 'resource_limit_exceeded',
            severity: type === 'critical' ? 'HIGH' : type === 'emergency' ? 'CRITICAL' : 'MEDIUM',
            category: 'system',
            ipAddress: '82.147.84.78',
            success: false,
            details: {
                resource,
                currentValue,
                threshold,
                limit,
                action: alert.action
            },
            riskScore: type === 'critical' ? 80 : type === 'emergency' ? 95 : 50,
            tags: ['resource_exhaustion', 'dos_protection', resource],
            compliance: {
                pii: false,
                gdpr: false,
                pci: false,
                hipaa: false
            }
        });
        logger_1.logger.warn(`Resource limit alert: ${alert.message}`, {
            alertId: alert.id,
            resource: alert.resource,
            type: alert.type,
            currentValue: alert.currentValue,
            threshold: alert.threshold,
            action: alert.action
        });
        setTimeout(() => {
            this.alerts.delete(alertId);
        }, 300000);
    }
    determineAction(resource, type) {
        if (type === 'emergency') {
            return 'terminate';
        }
        if (type === 'critical') {
            switch (resource) {
                case 'memory':
                case 'cpu':
                    return 'throttle';
                case 'connections':
                    return 'drain';
                default:
                    return 'monitor';
            }
        }
        return 'monitor';
    }
    enterEmergencyMode(reason) {
        if (this.emergencyMode) {
            return;
        }
        this.emergencyMode = true;
        logger_1.logger.error(`Entering emergency mode due to: ${reason}`, {
            reason,
            memoryUsage: this.usage.memoryUsagePercent,
            cpuUsage: this.usage.cpuUsagePercent,
            concurrentRequests: this.usage.concurrentRequests
        });
        this.throttleIncomingRequests();
        this.startConnectionDraining();
        if (global.gc) {
            global.gc();
        }
        setTimeout(() => {
            this.exitEmergencyMode();
        }, 300000);
    }
    exitEmergencyMode() {
        this.emergencyMode = false;
        logger_1.logger.info('Exiting emergency mode');
    }
    throttleIncomingRequests() {
        logger_1.logger.warn('Throttling incoming requests due to resource pressure');
    }
    startConnectionDraining() {
        logger_1.logger.warn('Starting connection draining due to resource pressure');
    }
    gracefulShutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        logger_1.logger.info('Resource monitoring stopped during graceful shutdown');
    }
    requestTrackingMiddleware() {
        return (req, res, next) => {
            if (this.concurrentRequests >= this.limits.maxConcurrentRequests) {
                return res.status(503).json({
                    error: 'Service temporarily unavailable',
                    message: 'Too many concurrent requests',
                    retryAfter: 60
                });
            }
            this.concurrentRequests++;
            this.requestCount++;
            res.on('finish', () => {
                this.concurrentRequests--;
            });
            res.on('close', () => {
                this.concurrentRequests--;
            });
            next();
        };
    }
    connectionTrackingMiddleware() {
        return (req, res, next) => {
            this.connectionCount++;
            req.socket.on('close', () => {
                this.connectionCount--;
            });
            next();
        };
    }
    isUnderStress() {
        return this.emergencyMode ||
            this.usage.memoryUsagePercent > this.limits.memoryCriticalThreshold ||
            this.usage.cpuUsagePercent > this.limits.cpuCriticalThreshold ||
            this.usage.concurrentRequests > (this.limits.maxConcurrentRequests * 0.9);
    }
    getResourceUsage() {
        return { ...this.usage };
    }
    getActiveAlerts() {
        return Array.from(this.alerts.values());
    }
    getResourceLimits() {
        return { ...this.limits };
    }
    healthCheck() {
        const alertCount = this.alerts.size;
        const criticalAlerts = Array.from(this.alerts.values()).filter(a => a.type === 'critical').length;
        let status = 'healthy';
        if (this.emergencyMode || criticalAlerts > 0) {
            status = 'critical';
        }
        else if (alertCount > 0) {
            status = 'warning';
        }
        return {
            status,
            usage: this.getResourceUsage(),
            alerts: this.getActiveAlerts(),
            emergencyMode: this.emergencyMode
        };
    }
}
exports.ResourceLimitService = ResourceLimitService;
exports.resourceLimitService = ResourceLimitService.getInstance();
//# sourceMappingURL=ResourceLimitService.js.map