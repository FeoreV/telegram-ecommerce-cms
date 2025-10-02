import * as os from 'os';
import * as process from 'process';
import { logger } from '../utils/logger';
import { securityLogService } from './SecurityLogService';
import { Request, Response, NextFunction } from 'express';

export interface ResourceLimits {
  // Memory limits
  maxMemoryMB: number;
  memoryWarningThreshold: number; // percentage
  memoryCriticalThreshold: number; // percentage
  
  // CPU limits
  maxCpuPercent: number;
  cpuWarningThreshold: number; // percentage
  cpuCriticalThreshold: number; // percentage
  
  // File descriptor limits
  maxFileDescriptors: number;
  fdWarningThreshold: number; // percentage
  fdCriticalThreshold: number; // percentage
  
  // Network limits
  maxConnections: number;
  maxRequestsPerSecond: number;
  maxBandwidthMBps: number;
  
  // Disk I/O limits
  maxDiskReadMBps: number;
  maxDiskWriteMBps: number;
  maxTempStorageMB: number;
  
  // Application-specific limits
  maxConcurrentRequests: number;
  maxUploadSizeMB: number;
  maxDatabaseConnections: number;
  maxCacheSize: number;
  
  // Process limits
  maxChildProcesses: number;
  maxThreads: number;
  
  // Time limits
  maxRequestTimeoutMs: number;
  maxIdleTimeMs: number;
  
  // Rate limiting
  enableRateLimiting: boolean;
  enableAdaptiveRateLimiting: boolean;
  
  // Emergency actions
  enableEmergencyThrottling: boolean;
  enableProcessTermination: boolean;
  enableConnectionDraining: boolean;
}

export interface ResourceUsage {
  timestamp: Date;
  
  // Memory usage
  memoryUsedMB: number;
  memoryUsagePercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
  
  // CPU usage
  cpuUsagePercent: number;
  loadAverage: number[];
  
  // File descriptors
  openFileDescriptors: number;
  fdUsagePercent: number;
  
  // Network
  activeConnections: number;
  requestsPerSecond: number;
  networkBandwidthMBps: number;
  
  // Disk I/O
  diskReadMBps: number;
  diskWriteMBps: number;
  tempStorageUsedMB: number;
  
  // Application metrics
  concurrentRequests: number;
  databaseConnections: number;
  cacheUsageMB: number;
  
  // Process metrics
  childProcesses: number;
  threadCount: number;
  
  // Event loop metrics
  eventLoopLag: number;
  eventLoopUtilization: number;
}

export interface ResourceAlert {
  id: string;
  timestamp: Date;
  type: 'warning' | 'critical' | 'emergency';
  resource: string;
  currentValue: number;
  threshold: number;
  limit: number;
  message: string;
  action: 'monitor' | 'throttle' | 'terminate' | 'drain';
}

export class ResourceLimitService {
  private static instance: ResourceLimitService;
  private limits: ResourceLimits;
  private usage: ResourceUsage;
  private alerts: Map<string, ResourceAlert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private connectionCount: number = 0;
  private requestCount: number = 0;
  private concurrentRequests: number = 0;
  private lastRequestReset: number = Date.now();
  private cpuUsageHistory: number[] = [];
  private memoryUsageHistory: number[] = [];
  private emergencyMode: boolean = false;

  private constructor() {
    this.limits = {
      // Memory limits (conservative for containers)
      maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '512'),
      memoryWarningThreshold: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '70'),
      memoryCriticalThreshold: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '85'),
      
      // CPU limits
      maxCpuPercent: parseFloat(process.env.MAX_CPU_PERCENT || '80'),
      cpuWarningThreshold: parseFloat(process.env.CPU_WARNING_THRESHOLD || '60'),
      cpuCriticalThreshold: parseFloat(process.env.CPU_CRITICAL_THRESHOLD || '75'),
      
      // File descriptor limits
      maxFileDescriptors: parseInt(process.env.MAX_FILE_DESCRIPTORS || '1024'),
      fdWarningThreshold: parseFloat(process.env.FD_WARNING_THRESHOLD || '70'),
      fdCriticalThreshold: parseFloat(process.env.FD_CRITICAL_THRESHOLD || '85'),
      
      // Network limits
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
      maxRequestsPerSecond: parseInt(process.env.MAX_REQUESTS_PER_SECOND || '100'),
      maxBandwidthMBps: parseFloat(process.env.MAX_BANDWIDTH_MBPS || '100'),
      
      // Disk I/O limits
      maxDiskReadMBps: parseFloat(process.env.MAX_DISK_READ_MBPS || '50'),
      maxDiskWriteMBps: parseFloat(process.env.MAX_DISK_WRITE_MBPS || '30'),
      maxTempStorageMB: parseInt(process.env.MAX_TEMP_STORAGE_MB || '100'),
      
      // Application limits
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '50'),
      maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10'),
      maxDatabaseConnections: parseInt(process.env.MAX_DB_CONNECTIONS || '20'),
      maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE_MB || '128'),
      
      // Process limits
      maxChildProcesses: parseInt(process.env.MAX_CHILD_PROCESSES || '5'),
      maxThreads: parseInt(process.env.MAX_THREADS || '20'),
      
      // Time limits
      maxRequestTimeoutMs: parseInt(process.env.MAX_REQUEST_TIMEOUT || '30000'),
      maxIdleTimeMs: parseInt(process.env.MAX_IDLE_TIME || '300000'),
      
      // Rate limiting
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      enableAdaptiveRateLimiting: process.env.ENABLE_ADAPTIVE_RATE_LIMITING !== 'false',
      
      // Emergency actions
      enableEmergencyThrottling: process.env.ENABLE_EMERGENCY_THROTTLING !== 'false',
      enableProcessTermination: process.env.ENABLE_PROCESS_TERMINATION === 'true',
      enableConnectionDraining: process.env.ENABLE_CONNECTION_DRAINING !== 'false'
    };

    this.usage = this.createEmptyUsage();
    this.initializeResourceMonitoring();
    this.setupProcessHandlers();

    logger.info('Resource Limit Service initialized', {
      maxMemoryMB: this.limits.maxMemoryMB,
      maxCpuPercent: this.limits.maxCpuPercent,
      maxConnections: this.limits.maxConnections,
      emergencyThrottling: this.limits.enableEmergencyThrottling
    });
  }

  public static getInstance(): ResourceLimitService {
    if (!ResourceLimitService.instance) {
      ResourceLimitService.instance = new ResourceLimitService();
    }
    return ResourceLimitService.instance;
  }

  private createEmptyUsage(): ResourceUsage {
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

  private initializeResourceMonitoring(): void {
    // Start monitoring every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectResourceUsage();
      this.checkResourceLimits();
    }, 5000);

    // Request rate reset every second
    setInterval(() => {
      this.requestCount = 0;
    }, 1000);
  }

  private setupProcessHandlers(): void {
    // Handle uncaught exceptions with resource context
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception with resource context:', {
        error: error.message,
        stack: error.stack,
        memoryUsage: this.usage.memoryUsedMB,
        cpuUsage: this.usage.cpuUsagePercent,
        concurrentRequests: this.usage.concurrentRequests
      });
      
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection with resource context:', {
        reason,
        promise,
        memoryUsage: this.usage.memoryUsedMB,
        cpuUsage: this.usage.cpuUsagePercent
      });
    });

    // Handle SIGTERM gracefully
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown...');
      this.gracefulShutdown();
    });

    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown...');
      this.gracefulShutdown();
    });
  }

  private collectResourceUsage(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    // Memory metrics
    const memoryUsedMB = memUsage.rss / (1024 * 1024);
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
    const heapTotalMB = memUsage.heapTotal / (1024 * 1024);
    const memoryUsagePercent = (memoryUsedMB / this.limits.maxMemoryMB) * 100;

    // CPU metrics (simplified approximation)
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const cpuUsagePercent = Math.min(100, (totalCpuTime / 1000000) / os.cpus().length);

    // Store historical data
    this.cpuUsageHistory.push(cpuUsagePercent);
    this.memoryUsageHistory.push(memoryUsagePercent);
    
    // Keep only last 60 measurements (5 minutes at 5-second intervals)
    if (this.cpuUsageHistory.length > 60) {
      this.cpuUsageHistory.shift();
    }
    if (this.memoryUsageHistory.length > 60) {
      this.memoryUsageHistory.shift();
    }

    // Event loop metrics
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
      networkBandwidthMBps: 0, // Would need network monitoring
      diskReadMBps: 0, // Would need disk I/O monitoring
      diskWriteMBps: 0, // Would need disk I/O monitoring
      tempStorageUsedMB: this.getTempStorageUsage(),
      concurrentRequests: this.concurrentRequests,
      databaseConnections: 0, // Would need DB connection pool monitoring
      cacheUsageMB: 0, // Would need cache size monitoring
      childProcesses: this.getChildProcessCount(),
      threadCount: this.getThreadCount(),
      eventLoopLag,
      eventLoopUtilization
    };
  }

  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return lag;
    });
    return 0; // Simplified for this implementation
  }

  private measureEventLoopUtilization(): number {
    // Simplified - would use process.resourceUsage() in real implementation
    return this.usage.cpuUsagePercent / 100;
  }

  private getOpenFileDescriptors(): number {
    // Simplified - would use actual file descriptor counting
    return Math.floor(this.limits.maxFileDescriptors * 0.3); // Simulate 30% usage
  }

  private getTempStorageUsage(): number {
    // Simplified - would check actual temp directory usage
    return Math.floor(this.limits.maxTempStorageMB * 0.2); // Simulate 20% usage
  }

  private getChildProcessCount(): number {
    // Simplified - would count actual child processes
    return 0;
  }

  private getThreadCount(): number {
    // Simplified - would count actual threads
    return 1; // Main thread
  }

  private checkResourceLimits(): void {
    this.checkMemoryLimits();
    this.checkCpuLimits();
    this.checkConnectionLimits();
    this.checkFileDescriptorLimits();
    this.checkConcurrentRequestLimits();
    this.checkEventLoopHealth();
  }

  private checkMemoryLimits(): void {
    const usage = this.usage.memoryUsagePercent;
    
    if (usage >= this.limits.memoryCriticalThreshold) {
      this.createAlert('memory', 'critical', usage, this.limits.memoryCriticalThreshold, this.limits.maxMemoryMB);
      
      if (this.limits.enableEmergencyThrottling) {
        this.enterEmergencyMode('memory_critical');
      }
    } else if (usage >= this.limits.memoryWarningThreshold) {
      this.createAlert('memory', 'warning', usage, this.limits.memoryWarningThreshold, this.limits.maxMemoryMB);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }

  private checkCpuLimits(): void {
    // const _usage = this.usage.cpuUsagePercent;
 // Unused variable removed
    const avgUsage = this.cpuUsageHistory.reduce((a, b) => a + b, 0) / this.cpuUsageHistory.length;
    
    if (avgUsage >= this.limits.cpuCriticalThreshold) {
      this.createAlert('cpu', 'critical', avgUsage, this.limits.cpuCriticalThreshold, this.limits.maxCpuPercent);
      
      if (this.limits.enableEmergencyThrottling) {
        this.enterEmergencyMode('cpu_critical');
      }
    } else if (avgUsage >= this.limits.cpuWarningThreshold) {
      this.createAlert('cpu', 'warning', avgUsage, this.limits.cpuWarningThreshold, this.limits.maxCpuPercent);
    }
  }

  private checkConnectionLimits(): void {
    const usage = this.usage.activeConnections;
    const usagePercent = (usage / this.limits.maxConnections) * 100;
    
    if (usagePercent >= 90) {
      this.createAlert('connections', 'critical', usage, this.limits.maxConnections * 0.9, this.limits.maxConnections);
      
      if (this.limits.enableConnectionDraining) {
        this.startConnectionDraining();
      }
    } else if (usagePercent >= 70) {
      this.createAlert('connections', 'warning', usage, this.limits.maxConnections * 0.7, this.limits.maxConnections);
    }
  }

  private checkFileDescriptorLimits(): void {
    const usage = this.usage.fdUsagePercent;
    
    if (usage >= this.limits.fdCriticalThreshold) {
      this.createAlert('file_descriptors', 'critical', usage, this.limits.fdCriticalThreshold, this.limits.maxFileDescriptors);
    } else if (usage >= this.limits.fdWarningThreshold) {
      this.createAlert('file_descriptors', 'warning', usage, this.limits.fdWarningThreshold, this.limits.maxFileDescriptors);
    }
  }

  private checkConcurrentRequestLimits(): void {
    const usage = this.usage.concurrentRequests;
    const usagePercent = (usage / this.limits.maxConcurrentRequests) * 100;
    
    if (usagePercent >= 90) {
      this.createAlert('concurrent_requests', 'critical', usage, this.limits.maxConcurrentRequests * 0.9, this.limits.maxConcurrentRequests);
      
      if (this.limits.enableEmergencyThrottling) {
        this.throttleIncomingRequests();
      }
    } else if (usagePercent >= 70) {
      this.createAlert('concurrent_requests', 'warning', usage, this.limits.maxConcurrentRequests * 0.7, this.limits.maxConcurrentRequests);
    }
  }

  private checkEventLoopHealth(): void {
    const lag = this.usage.eventLoopLag;
    const utilization = this.usage.eventLoopUtilization;
    
    if (lag > 100) { // 100ms lag is critical
      this.createAlert('event_loop_lag', 'critical', lag, 100, 500);
    } else if (lag > 50) { // 50ms lag is warning
      this.createAlert('event_loop_lag', 'warning', lag, 50, 100);
    }
    
    if (utilization > 0.9) { // 90% utilization is critical
      this.createAlert('event_loop_utilization', 'critical', utilization * 100, 90, 100);
    }
  }

  private createAlert(resource: string, type: 'warning' | 'critical' | 'emergency', currentValue: number, threshold: number, limit: number): void {
    const alertId = `${resource}_${type}`;
    
    // Don't create duplicate alerts
    if (this.alerts.has(alertId)) {
      return;
    }

    const alert: ResourceAlert = {
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

    // Log security event
    securityLogService.logSecurityEvent({
      eventType: 'resource_limit_exceeded',
      severity: type === 'critical' ? 'HIGH' : type === 'emergency' ? 'CRITICAL' : 'MEDIUM',
      category: 'system',
      ipAddress: 'localhost',
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

    logger.warn(`Resource limit alert: ${alert.message}`, {
      alertId: alert.id,
      resource: alert.resource,
      type: alert.type,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      action: alert.action
    });

    // Auto-clear alert after 5 minutes
    setTimeout(() => {
      this.alerts.delete(alertId);
    }, 300000);
  }

  private determineAction(resource: string, type: string): ResourceAlert['action'] {
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

  private enterEmergencyMode(reason: string): void {
    if (this.emergencyMode) {
      return; // Already in emergency mode
    }

    this.emergencyMode = true;
    
    logger.error(`Entering emergency mode due to: ${reason}`, {
      reason,
      memoryUsage: this.usage.memoryUsagePercent,
      cpuUsage: this.usage.cpuUsagePercent,
      concurrentRequests: this.usage.concurrentRequests
    });

    // Implement emergency actions
    this.throttleIncomingRequests();
    this.startConnectionDraining();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    // Auto-exit emergency mode after 5 minutes
    setTimeout(() => {
      this.exitEmergencyMode();
    }, 300000);
  }

  private exitEmergencyMode(): void {
    this.emergencyMode = false;
    logger.info('Exiting emergency mode');
  }

  private throttleIncomingRequests(): void {
    // This would integrate with your request handling middleware
    logger.warn('Throttling incoming requests due to resource pressure');
  }

  private startConnectionDraining(): void {
    // This would gracefully close existing connections
    logger.warn('Starting connection draining due to resource pressure');
  }

  private gracefulShutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info('Resource monitoring stopped during graceful shutdown');
  }

  /**
   * Middleware for tracking concurrent requests
   */
  public requestTrackingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if we're at the limit
      if (this.concurrentRequests >= this.limits.maxConcurrentRequests) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Too many concurrent requests',
          retryAfter: 60
        });
      }

      // Track request
      this.concurrentRequests++;
      this.requestCount++;

      // Track response completion
      res.on('finish', () => {
        this.concurrentRequests--;
      });

      res.on('close', () => {
        this.concurrentRequests--;
      });

      next();
    };
  }

  /**
   * Middleware for connection tracking
   */
  public connectionTrackingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.connectionCount++;

      req.socket.on('close', () => {
        this.connectionCount--;
      });

      next();
    };
  }

  /**
   * Check if system is under stress
   */
  public isUnderStress(): boolean {
    return this.emergencyMode ||
           this.usage.memoryUsagePercent > this.limits.memoryCriticalThreshold ||
           this.usage.cpuUsagePercent > this.limits.cpuCriticalThreshold ||
           this.usage.concurrentRequests > (this.limits.maxConcurrentRequests * 0.9);
  }

  /**
   * Get current resource usage
   */
  public getResourceUsage(): ResourceUsage {
    return { ...this.usage };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): ResourceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get resource limits
   */
  public getResourceLimits(): ResourceLimits {
    return { ...this.limits };
  }

  /**
   * Health check
   */
  public healthCheck(): {
    status: string;
    usage: ResourceUsage;
    alerts: ResourceAlert[];
    emergencyMode: boolean;
  } {
    const alertCount = this.alerts.size;
    const criticalAlerts = Array.from(this.alerts.values()).filter(a => a.type === 'critical').length;
    
    let status = 'healthy';
    if (this.emergencyMode || criticalAlerts > 0) {
      status = 'critical';
    } else if (alertCount > 0) {
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

// Export singleton instance
export const resourceLimitService = ResourceLimitService.getInstance();
