import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { HealthService } from '../services/healthService';
import { logger, serializeError } from '../utils/logger';
import * as os from 'os';

// Basic health check endpoint (public)
export const getBasicHealth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed health report (admin only)
export const getDetailedHealth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  try {
    const healthReport = await HealthService.getHealthReport();
    
    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (healthReport.status === 'degraded') {
      statusCode = 207; // Multi-Status
    } else if (healthReport.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json(healthReport);
  } catch (error) {
    logger.error('Failed to get health report:', serializeError(error));
    throw new AppError('Failed to get health report', 500);
  }
});

// Live readiness probe (for load balancers)
export const getReadinessProbe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Quick checks for readiness
    const checks = await Promise.allSettled([
      // Database connectivity
      import('../lib/prisma.js').then(({ prisma }) => prisma.$queryRaw`SELECT 1`),
    ]);

    const allHealthy = checks.every(check => check.status === 'fulfilled');
    
    if (allHealthy) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        failures: checks
          .map((check, index) => check.status === 'rejected' ? index : null)
          .filter(index => index !== null),
      });
    }
  } catch (error) {
    logger.error('Readiness probe failed:', serializeError(error));
    res.status(503).json({
      status: 'not ready',
      error: 'Internal error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe (for container orchestrators)
export const getLivenessProbe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Simple liveness check - just ensure the process is running
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  });
});

// Performance metrics endpoint
export const getPerformanceMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  try {
    const healthReport = await HealthService.getHealthReport();
    
    // Return only performance-related data
    res.json({
      timestamp: healthReport.timestamp,
      uptime: healthReport.uptime,
      performance: healthReport.metrics.performance,
      system: {
        cpu: healthReport.metrics.system.cpu,
        memory: {
          usagePercentage: healthReport.metrics.system.memory.usagePercentage,
          used: healthReport.metrics.system.memory.used,
          total: healthReport.metrics.system.memory.total,
        },
        disk: {
          usagePercentage: healthReport.metrics.system.disk.usagePercentage,
          free: healthReport.metrics.system.disk.free,
          total: healthReport.metrics.system.disk.total,
        },
      },
      status: healthReport.status,
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', serializeError(error));
    throw new AppError('Failed to get performance metrics', 500);
  }
});

// System information endpoint
export const getSystemInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can view system information', 403);
  }

  // Using imported os module
  
  const systemInfo = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV,
    uptime: {
      process: process.uptime(),
      system: os.uptime(),
    },
    pid: process.pid,
    execPath: process.execPath,
    workingDirectory: process.cwd(),
    features: {
      adminjs: !!process.env.ENABLE_ADMINJS,
      smtp: !!process.env.SMTP_HOST,
      telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
      redis: !!process.env.REDIS_URL,
    },
  };

  res.json(systemInfo);
});

// Resource usage history
export const getResourceHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  // In a real implementation, you'd store historical data
  // For now, we'll return current metrics with placeholder historical data
  const currentMetrics = await HealthService.getHealthReport();
  
  // Generate sample historical data (in production, you'd pull from a time-series DB)
  const history = {
    cpu: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000).toISOString(),
      value: Math.max(0, currentMetrics.metrics.system.cpu.usage + (Math.random() - 0.5) * 20),
    })),
    memory: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000).toISOString(),
      value: Math.max(0, currentMetrics.metrics.system.memory.usagePercentage + (Math.random() - 0.5) * 10),
    })),
    responseTime: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000).toISOString(),
      value: Math.max(50, currentMetrics.metrics.performance.averageResponseTime + (Math.random() - 0.5) * 200),
    })),
    requestsPerSecond: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000).toISOString(),
      value: Math.max(0, currentMetrics.metrics.performance.requestsPerSecond + (Math.random() - 0.5) * 5),
    })),
  };

  res.json({
    current: {
      cpu: currentMetrics.metrics.system.cpu.usage,
      memory: currentMetrics.metrics.system.memory.usagePercentage,
      responseTime: currentMetrics.metrics.performance.averageResponseTime,
      requestsPerSecond: currentMetrics.metrics.performance.requestsPerSecond,
    },
    history,
    period: '1 hour',
    interval: '1 minute',
  });
});

// Application diagnostics (owner only)
export const getDiagnostics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'OWNER') {
    throw new AppError('Only owners can view diagnostics', 403);
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodejs: {
      version: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      databaseUrl: process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT SET]',
      jwtSecret: process.env.JWT_SECRET ? '[CONFIGURED]' : '[NOT SET]',
      adminJs: process.env.ENABLE_ADMINJS,
    },
    features: {
      emailNotifications: !!process.env.SMTP_HOST,
      telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
      redis: !!process.env.REDIS_URL,
      backups: true,
      monitoring: true,
    },
    recent: {
      errors: [], // Would pull from error logs
      warnings: [], // Would pull from warning logs
    },
  };

  res.json(diagnostics);
});

// Public diagnostics endpoint (sanitized)
export const getPublicDiagnostics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const healthReport = await HealthService.getHealthReport();

  const sanitizedChecks = healthReport.checks.map((check) => ({
    name: check.name,
    status: check.status,
    message: check.message,
    responseTime: check.responseTime,
  }));

  const sanitizedPerformance = {
    averageResponseTime: healthReport.metrics.performance.averageResponseTime,
    requestsPerSecond: healthReport.metrics.performance.requestsPerSecond,
    errorRate: healthReport.metrics.performance.errorRate,
  };

  const sanitizedSystem = {
    cpu: {
      usage: healthReport.metrics.system.cpu.usage,
      loadAverage: healthReport.metrics.system.cpu.loadAverage,
    },
    memory: {
      usagePercentage: healthReport.metrics.system.memory.usagePercentage,
      used: healthReport.metrics.system.memory.used,
      total: healthReport.metrics.system.memory.total,
    },
    disk: {
      usagePercentage: healthReport.metrics.system.disk.usagePercentage,
      free: healthReport.metrics.system.disk.free,
      total: healthReport.metrics.system.disk.total,
    },
    uptime: healthReport.metrics.system.uptime,
  };

  res.json({
    status: healthReport.status,
    version: healthReport.version,
    uptime: healthReport.uptime,
    timestamp: healthReport.timestamp,
    checks: sanitizedChecks,
    metrics: {
      performance: sanitizedPerformance,
      system: sanitizedSystem,
    },
    recommendations: healthReport.recommendations,
  });
});

export default {
  getBasicHealth,
  getDetailedHealth,
  getReadinessProbe,
  getLivenessProbe,
  getPerformanceMetrics,
  getSystemInfo,
  getResourceHistory,
  getDiagnostics,
  getPublicDiagnostics,
};
