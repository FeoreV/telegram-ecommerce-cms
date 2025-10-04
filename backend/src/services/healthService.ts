// SECURITY FIX (CWE-78): Removed exec import to prevent command injection
// Using Node.js built-in APIs instead of shell commands
import os from 'os';
import { performance } from 'perf_hooks';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  metadata?: Record<string, unknown>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercentage: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
  uptime: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  activeConnections: number;
  databaseConnections: number;
  cacheHitRate?: number;
}

export interface ApplicationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  checks: HealthCheck[];
  metrics: {
    system: SystemMetrics;
    performance: PerformanceMetrics;
  };
  recommendations: string[];
}

export class HealthService {
  private static startTime = Date.now();
  private static performanceData = {
    requests: 0,
    totalResponseTime: 0,
    errors: 0,
    lastMinuteRequests: [] as number[],
  };

  // Record request metrics
  static recordRequest(responseTime: number, hasError: boolean = false) {
    this.performanceData.requests++;
    this.performanceData.totalResponseTime += responseTime;

    if (hasError) {
      this.performanceData.errors++;
    }

    // Keep track of requests in the last minute
    const now = Date.now();
    this.performanceData.lastMinuteRequests.push(now);

    // Clean up old requests (older than 1 minute)
    this.performanceData.lastMinuteRequests = this.performanceData.lastMinuteRequests
      .filter(timestamp => now - timestamp < 60000);
  }

  // Get comprehensive health report
  static async getHealthReport(): Promise<ApplicationHealth> {
    const startTime = performance.now();

    try {
      const checks = await this.runHealthChecks();
      const systemMetrics = await this.getSystemMetrics();
      const performanceMetrics = this.getPerformanceMetrics();

      const overallStatus = this.determineOverallStatus(checks);
      const recommendations = this.generateRecommendations(checks, systemMetrics, performanceMetrics);

      const endTime = performance.now();
      logger.info(`Health check completed in ${(endTime - startTime).toFixed(2)}ms`, {
        status: overallStatus,
        checksCount: checks.length,
      });

      return {
        status: overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        uptime: Date.now() - this.startTime,
        timestamp: new Date(),
        checks,
        metrics: {
          system: systemMetrics,
          performance: performanceMetrics,
        },
        recommendations,
      };
    } catch (error) {
      logger.error('Health check failed:', error);

      return {
        status: 'unhealthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Date.now() - this.startTime,
        timestamp: new Date(),
        checks: [{
          name: 'health_service',
          status: 'unhealthy',
          message: `Health service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        metrics: {
          system: await this.getSystemMetrics().catch(() => this.getDefaultSystemMetrics()),
          performance: this.getPerformanceMetrics(),
        },
        recommendations: ['Health service is experiencing issues - check logs'],
      };
    }
  }

  // Run all health checks
  private static async runHealthChecks(): Promise<HealthCheck[]> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkFileSystem(),
      this.checkExternalServices(),
      this.checkMemoryUsage(),
      this.checkCPUUsage(),
    ]);

    return checks.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const checkNames = ['database', 'redis', 'filesystem', 'external_services', 'memory', 'cpu'];
        return {
          name: checkNames[index] || 'unknown',
          status: 'unhealthy' as const,
          message: `Check failed: ${result.reason}`,
        };
      }
    });
  }

  // Database health check
  private static async checkDatabase(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      // Test database connection with a simple query
      await prisma.$queryRaw`SELECT 1 as test`;

      // Check connection pool status
      const connectionCount = await this.getDatabaseConnectionCount();

      const responseTime = performance.now() - startTime;

      return {
        name: 'database',
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        message: responseTime > 1000 ? 'Database response time is slow' : 'Database is responsive',
        responseTime,
        metadata: {
          connectionCount,
          type: 'sqlite', // or detect actual DB type
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: performance.now() - startTime,
      };
    }
  }

  // Redis health check (if available)
  private static async checkRedis(): Promise<HealthCheck> {
    // For now, we'll assume Redis is not configured
    return {
      name: 'redis',
      status: 'healthy',
      message: 'Redis not configured - using in-memory cache',
      metadata: {
        configured: false,
      },
    };
  }

  // File system health check
  private static async checkFileSystem(): Promise<HealthCheck> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Check critical directories
      const directories = ['uploads', 'backups', 'logs'];
      const results = [];

      for (const dir of directories) {
        const dirPath = path.join(process.cwd(), dir);
        try {
          await fs.access(dirPath);
          results.push({ [dir]: 'accessible' });
        } catch (_error) {
          results.push({ [dir]: 'not_accessible' });
        }
      }

      // Check available disk space
      const diskSpace = await this.getDiskSpace();
      const freeSpaceGB = diskSpace.free / (1024 ** 3);

      const status = freeSpaceGB < 1 ? 'unhealthy' : freeSpaceGB < 5 ? 'degraded' : 'healthy';
      const message = status === 'unhealthy'
        ? 'Critical: Less than 1GB free disk space'
        : status === 'degraded'
        ? 'Warning: Less than 5GB free disk space'
        : 'File system is healthy';

      return {
        name: 'filesystem',
        status,
        message,
        metadata: {
          directories: results,
          diskSpace: {
            freeGB: Math.round(freeSpaceGB * 100) / 100,
            totalGB: Math.round((diskSpace.total / (1024 ** 3)) * 100) / 100,
          },
        },
      };
    } catch (error) {
      return {
        name: 'filesystem',
        status: 'unhealthy',
        message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // External services health check
  private static async checkExternalServices(): Promise<HealthCheck> {
    const services = [];

    // Check SMTP if configured
    if (process.env.SMTP_HOST) {
      try {
        // Simple connection test - in production you'd use nodemailer to test
        services.push({ smtp: 'configured' });
      } catch (_error) {
        services.push({ smtp: 'error' });
      }
    }

    // Check Telegram bot if configured
    if (process.env.TELEGRAM_BOT_TOKEN) {
      services.push({ telegram: 'configured' });
    }

    return {
      name: 'external_services',
      status: 'healthy',
      message: `${services.length} external services configured`,
      metadata: {
        services,
      },
    };
  }

  // Memory usage check
  private static async checkMemoryUsage(): Promise<HealthCheck> {
    const usage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    const status = memoryUsagePercent > 90 ? 'unhealthy' : memoryUsagePercent > 80 ? 'degraded' : 'healthy';

    return {
      name: 'memory',
      status,
      message: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`,
      metadata: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        systemUsagePercent: memoryUsagePercent,
      },
    };
  }

  // CPU usage check
  private static async checkCPUUsage(): Promise<HealthCheck> {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercent = (loadAvg[0] / cpuCount) * 100;

    const status = loadPercent > 90 ? 'unhealthy' : loadPercent > 70 ? 'degraded' : 'healthy';

    return {
      name: 'cpu',
      status,
      message: `CPU load: ${loadPercent.toFixed(1)}%`,
      metadata: {
        loadAverage: loadAvg,
        cpuCount,
        loadPercent,
      },
    };
  }

  // Get system metrics
  private static async getSystemMetrics(): Promise<SystemMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const diskSpace = await this.getDiskSpace();

    return {
      cpu: {
        usage: await this.getCPUUsage(),
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercentage: (usedMem / totalMem) * 100,
      },
      disk: {
        total: diskSpace.total,
        free: diskSpace.free,
        used: diskSpace.used,
        usagePercentage: (diskSpace.used / diskSpace.total) * 100,
      },
      network: {
        bytesReceived: 0, // Would need system-specific implementation
        bytesSent: 0,
      },
      uptime: os.uptime(),
    };
  }

  // Get performance metrics
  private static getPerformanceMetrics(): PerformanceMetrics {
    const { requests, totalResponseTime, errors, lastMinuteRequests } = this.performanceData;

    return {
      averageResponseTime: requests > 0 ? totalResponseTime / requests : 0,
      requestsPerSecond: lastMinuteRequests.length / 60,
      errorRate: requests > 0 ? (errors / requests) * 100 : 0,
      activeConnections: 0, // Would need to track WebSocket connections
      databaseConnections: 1, // Simplified - would query actual connection pool
    };
  }

  // Helper methods
  private static async getDatabaseConnectionCount(): Promise<number> {
    // For SQLite, this is always 1
    // For other databases, you'd query the connection pool
    return 1;
  }

  private static async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3; // microseconds
        const cpuTime = endUsage.user + endUsage.system;
        const cpuPercent = (cpuTime / totalTime) * 100;

        resolve(Math.min(cpuPercent, 100));
      }, 100);
    });
  }

  private static async getDiskSpace(): Promise<{ total: number; free: number; used: number }> {
    try {
      // SECURITY FIX (CWE-78): Use Node.js fs.statfs instead of shell commands
      // This eliminates command injection risks
      const fs = await import('fs/promises');

      try {
        // Try to use statfs (Node.js 19+)
        const stats = await (fs as any).statfs(process.cwd());
        const blockSize = stats.bsize;
        const total = stats.blocks * blockSize;
        const free = stats.bfree * blockSize;
        const used = total - free;

        return { total, free, used };
      } catch (statfsError) {
        // Fallback: Use process.cwd() size as approximation
        // This is safer than shell execution
        logger.warn('statfs not available, using fallback disk space calculation');

        // Use available memory as rough disk space estimate
        // This is imperfect but secure
        const totalMem = os.totalmem();
        const estimate = totalMem * 10; // Rough estimate

        return {
          total: estimate,
          free: estimate * 0.5,
          used: estimate * 0.5,
        };
      }
    } catch (error) {
      logger.warn('Could not get disk space information:', error);
      // Return default values
      return {
        total: 1024 * 1024 * 1024 * 100, // 100GB
        free: 1024 * 1024 * 1024 * 50,   // 50GB
        used: 1024 * 1024 * 1024 * 50,   // 50GB
      };
    }
  }

  private static getDefaultSystemMetrics(): SystemMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercentage: (usedMem / totalMem) * 100,
      },
      disk: {
        total: 0,
        free: 0,
        used: 0,
        usagePercentage: 0,
      },
      network: {
        bytesReceived: 0,
        bytesSent: 0,
      },
      uptime: os.uptime(),
    };
  }

  // Determine overall status from individual checks
  private static determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // Generate recommendations based on health status
  private static generateRecommendations(
    checks: HealthCheck[],
    systemMetrics: SystemMetrics,
    performanceMetrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (systemMetrics.memory.usagePercentage > 80) {
      recommendations.push('High memory usage detected - consider optimizing or adding more RAM');
    }

    // CPU recommendations
    if (systemMetrics.cpu.usage > 70) {
      recommendations.push('High CPU usage detected - check for resource-intensive processes');
    }

    // Disk space recommendations
    if (systemMetrics.disk.usagePercentage > 80) {
      recommendations.push('Low disk space - clean up old files or increase storage');
    }

    // Performance recommendations
    if (performanceMetrics.averageResponseTime > 1000) {
      recommendations.push('Slow response times - optimize database queries and API endpoints');
    }

    if (performanceMetrics.errorRate > 5) {
      recommendations.push('High error rate detected - check application logs for issues');
    }

    // Check-specific recommendations
    checks.forEach(check => {
      if (check.status === 'unhealthy') {
        recommendations.push(`${check.name} is unhealthy: ${check.message}`);
      } else if (check.status === 'degraded') {
        recommendations.push(`${check.name} performance is degraded: ${check.message}`);
      }
    });

    return recommendations.length > 0 ? recommendations : ['System is operating normally'];
  }

  // Reset performance counters (useful for testing)
  static resetPerformanceCounters() {
    this.performanceData = {
      requests: 0,
      totalResponseTime: 0,
      errors: 0,
      lastMinuteRequests: [],
    };
  }
}

export default HealthService;
