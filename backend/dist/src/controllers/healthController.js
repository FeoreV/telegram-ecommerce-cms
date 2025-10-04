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
exports.getPublicDiagnostics = exports.getDiagnostics = exports.getResourceHistory = exports.getSystemInfo = exports.getPerformanceMetrics = exports.getLivenessProbe = exports.getReadinessProbe = exports.getDetailedHealth = exports.getBasicHealth = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const healthService_1 = require("../services/healthService");
const logger_1 = require("../utils/logger");
const os = __importStar(require("os"));
exports.getBasicHealth = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
    });
});
exports.getDetailedHealth = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    try {
        const healthReport = await healthService_1.HealthService.getHealthReport();
        let statusCode = 200;
        if (healthReport.status === 'degraded') {
            statusCode = 207;
        }
        else if (healthReport.status === 'unhealthy') {
            statusCode = 503;
        }
        res.status(statusCode).json(healthReport);
    }
    catch (error) {
        logger_1.logger.error('Failed to get health report:', (0, logger_1.serializeError)(error));
        throw new errorHandler_1.AppError('Failed to get health report', 500);
    }
});
exports.getReadinessProbe = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    try {
        const checks = await Promise.allSettled([
            import('../lib/prisma.js').then(({ prisma }) => prisma.$queryRaw `SELECT 1`),
        ]);
        const allHealthy = checks.every(check => check.status === 'fulfilled');
        if (allHealthy) {
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString(),
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                failures: checks
                    .map((check, index) => check.status === 'rejected' ? index : null)
                    .filter(index => index !== null),
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Readiness probe failed:', (0, logger_1.serializeError)(error));
        res.status(503).json({
            status: 'not ready',
            error: 'Internal error',
            timestamp: new Date().toISOString(),
        });
    }
});
exports.getLivenessProbe = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
    });
});
exports.getPerformanceMetrics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    try {
        const healthReport = await healthService_1.HealthService.getHealthReport();
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get performance metrics:', (0, logger_1.serializeError)(error));
        throw new errorHandler_1.AppError('Failed to get performance metrics', 500);
    }
});
exports.getSystemInfo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can view system information', 403);
    }
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
exports.getResourceHistory = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new errorHandler_1.AppError('Insufficient permissions', 403);
    }
    const currentMetrics = await healthService_1.HealthService.getHealthReport();
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
exports.getDiagnostics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        throw new errorHandler_1.AppError('Only owners can view diagnostics', 403);
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
            errors: [],
            warnings: [],
        },
    };
    res.json(diagnostics);
});
exports.getPublicDiagnostics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthReport = await healthService_1.HealthService.getHealthReport();
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
exports.default = {
    getBasicHealth: exports.getBasicHealth,
    getDetailedHealth: exports.getDetailedHealth,
    getReadinessProbe: exports.getReadinessProbe,
    getLivenessProbe: exports.getLivenessProbe,
    getPerformanceMetrics: exports.getPerformanceMetrics,
    getSystemInfo: exports.getSystemInfo,
    getResourceHistory: exports.getResourceHistory,
    getDiagnostics: exports.getDiagnostics,
    getPublicDiagnostics: exports.getPublicDiagnostics,
};
//# sourceMappingURL=healthController.js.map