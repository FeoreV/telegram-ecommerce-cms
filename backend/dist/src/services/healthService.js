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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const os_1 = __importDefault(require("os"));
const perf_hooks_1 = require("perf_hooks");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class HealthService {
    static recordRequest(responseTime, hasError = false) {
        this.performanceData.requests++;
        this.performanceData.totalResponseTime += responseTime;
        if (hasError) {
            this.performanceData.errors++;
        }
        const now = Date.now();
        this.performanceData.lastMinuteRequests.push(now);
        this.performanceData.lastMinuteRequests = this.performanceData.lastMinuteRequests
            .filter(timestamp => now - timestamp < 60000);
    }
    static async getHealthReport() {
        const startTime = perf_hooks_1.performance.now();
        try {
            const checks = await this.runHealthChecks();
            const systemMetrics = await this.getSystemMetrics();
            const performanceMetrics = this.getPerformanceMetrics();
            const overallStatus = this.determineOverallStatus(checks);
            const recommendations = this.generateRecommendations(checks, systemMetrics, performanceMetrics);
            const endTime = perf_hooks_1.performance.now();
            logger_1.logger.info(`Health check completed in ${(endTime - startTime).toFixed(2)}ms`, {
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
        }
        catch (error) {
            logger_1.logger.error('Health check failed:', error);
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
    static async runHealthChecks() {
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
            }
            else {
                const checkNames = ['database', 'redis', 'filesystem', 'external_services', 'memory', 'cpu'];
                return {
                    name: checkNames[index] || 'unknown',
                    status: 'unhealthy',
                    message: `Check failed: ${result.reason}`,
                };
            }
        });
    }
    static async checkDatabase() {
        const startTime = perf_hooks_1.performance.now();
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1 as test`;
            const connectionCount = await this.getDatabaseConnectionCount();
            const responseTime = perf_hooks_1.performance.now() - startTime;
            return {
                name: 'database',
                status: responseTime > 1000 ? 'degraded' : 'healthy',
                message: responseTime > 1000 ? 'Database response time is slow' : 'Database is responsive',
                responseTime,
                metadata: {
                    connectionCount,
                    type: 'sqlite',
                },
            };
        }
        catch (error) {
            return {
                name: 'database',
                status: 'unhealthy',
                message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                responseTime: perf_hooks_1.performance.now() - startTime,
            };
        }
    }
    static async checkRedis() {
        return {
            name: 'redis',
            status: 'healthy',
            message: 'Redis not configured - using in-memory cache',
            metadata: {
                configured: false,
            },
        };
    }
    static async checkFileSystem() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const directories = ['uploads', 'backups', 'logs'];
            const results = [];
            for (const dir of directories) {
                const dirPath = path.join(process.cwd(), dir);
                try {
                    await fs.access(dirPath);
                    results.push({ [dir]: 'accessible' });
                }
                catch (error) {
                    results.push({ [dir]: 'not_accessible' });
                }
            }
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
        }
        catch (error) {
            return {
                name: 'filesystem',
                status: 'unhealthy',
                message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
    static async checkExternalServices() {
        const services = [];
        if (process.env.SMTP_HOST) {
            try {
                services.push({ smtp: 'configured' });
            }
            catch (error) {
                services.push({ smtp: 'error' });
            }
        }
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
    static async checkMemoryUsage() {
        const usage = process.memoryUsage();
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsagePercent = (usedMem / totalMem) * 100;
        const status = memoryUsagePercent > 90 ? 'unhealthy' : memoryUsagePercent > 80 ? 'degraded' : 'healthy';
        return {
            name: 'memory',
            status,
            message: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`,
            metadata: {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                rss: Math.round(usage.rss / 1024 / 1024),
                external: Math.round(usage.external / 1024 / 1024),
                systemUsagePercent: memoryUsagePercent,
            },
        };
    }
    static async checkCPUUsage() {
        const loadAvg = os_1.default.loadavg();
        const cpuCount = os_1.default.cpus().length;
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
    static async getSystemMetrics() {
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const usedMem = totalMem - freeMem;
        const diskSpace = await this.getDiskSpace();
        return {
            cpu: {
                usage: await this.getCPUUsage(),
                loadAverage: os_1.default.loadavg(),
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
                bytesReceived: 0,
                bytesSent: 0,
            },
            uptime: os_1.default.uptime(),
        };
    }
    static getPerformanceMetrics() {
        const { requests, totalResponseTime, errors, lastMinuteRequests } = this.performanceData;
        return {
            averageResponseTime: requests > 0 ? totalResponseTime / requests : 0,
            requestsPerSecond: lastMinuteRequests.length / 60,
            errorRate: requests > 0 ? (errors / requests) * 100 : 0,
            activeConnections: 0,
            databaseConnections: 1,
        };
    }
    static async getDatabaseConnectionCount() {
        return 1;
    }
    static async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3;
                const cpuTime = endUsage.user + endUsage.system;
                const cpuPercent = (cpuTime / totalTime) * 100;
                resolve(Math.min(cpuPercent, 100));
            }, 100);
        });
    }
    static async getDiskSpace() {
        try {
            if (os_1.default.platform() === 'win32') {
                const { stdout } = await execAsync('fsutil volume diskfree .');
                const lines = stdout.trim().split('\n');
                const freeBytes = parseInt(lines[0].split(':')[1].trim());
                const totalBytes = parseInt(lines[1].split(':')[1].trim());
                return {
                    total: totalBytes,
                    free: freeBytes,
                    used: totalBytes - freeBytes,
                };
            }
            else {
                const { stdout } = await execAsync('df -B1 .');
                const lines = stdout.trim().split('\n');
                const data = lines[1].split(/\s+/);
                const total = parseInt(data[1]);
                const used = parseInt(data[2]);
                const free = parseInt(data[3]);
                return { total, free, used };
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not get disk space information:', error);
            return {
                total: 1024 * 1024 * 1024 * 100,
                free: 1024 * 1024 * 1024 * 50,
                used: 1024 * 1024 * 1024 * 50,
            };
        }
    }
    static getDefaultSystemMetrics() {
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
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
            uptime: os_1.default.uptime(),
        };
    }
    static determineOverallStatus(checks) {
        const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
        const degradedCount = checks.filter(c => c.status === 'degraded').length;
        if (unhealthyCount > 0) {
            return 'unhealthy';
        }
        else if (degradedCount > 0) {
            return 'degraded';
        }
        else {
            return 'healthy';
        }
    }
    static generateRecommendations(checks, systemMetrics, performanceMetrics) {
        const recommendations = [];
        if (systemMetrics.memory.usagePercentage > 80) {
            recommendations.push('High memory usage detected - consider optimizing or adding more RAM');
        }
        if (systemMetrics.cpu.usage > 70) {
            recommendations.push('High CPU usage detected - check for resource-intensive processes');
        }
        if (systemMetrics.disk.usagePercentage > 80) {
            recommendations.push('Low disk space - clean up old files or increase storage');
        }
        if (performanceMetrics.averageResponseTime > 1000) {
            recommendations.push('Slow response times - optimize database queries and API endpoints');
        }
        if (performanceMetrics.errorRate > 5) {
            recommendations.push('High error rate detected - check application logs for issues');
        }
        checks.forEach(check => {
            if (check.status === 'unhealthy') {
                recommendations.push(`${check.name} is unhealthy: ${check.message}`);
            }
            else if (check.status === 'degraded') {
                recommendations.push(`${check.name} performance is degraded: ${check.message}`);
            }
        });
        return recommendations.length > 0 ? recommendations : ['System is operating normally'];
    }
    static resetPerformanceCounters() {
        this.performanceData = {
            requests: 0,
            totalResponseTime: 0,
            errors: 0,
            lastMinuteRequests: [],
        };
    }
}
exports.HealthService = HealthService;
HealthService.startTime = Date.now();
HealthService.performanceData = {
    requests: 0,
    totalResponseTime: 0,
    errors: 0,
    lastMinuteRequests: [],
};
exports.default = HealthService;
//# sourceMappingURL=healthService.js.map