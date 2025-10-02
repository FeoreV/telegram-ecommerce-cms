"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceTracker = void 0;
exports.getPerformanceAnalytics = getPerformanceAnalytics;
exports.clearPerformanceHistory = clearPerformanceHistory;
const healthService_1 = require("../services/healthService");
const logger_1 = require("../utils/logger");
const performanceTracker = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const endTime = process.hrtime.bigint();
        const responseTimeMs = Number(endTime - startTime) / 1000000;
        const isError = res.statusCode >= 400;
        healthService_1.HealthService.recordRequest(responseTimeMs, isError);
        const performanceData = {
            method: req.method,
            path: req.route?.path || req.path,
            statusCode: res.statusCode,
            responseTime: responseTimeMs,
            timestamp: new Date(),
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.connection.remoteAddress,
            userId: req.user?.id,
            error: isError,
        };
        if (responseTimeMs > 1000) {
            logger_1.logger.warn('Slow request detected', (0, logger_1.toLogMetadata)(performanceData));
        }
        if (isError && res.statusCode >= 500) {
            logger_1.logger.error('Server error response', (0, logger_1.toLogMetadata)(performanceData));
        }
        setImmediate(() => {
            storePerformanceData(performanceData);
        });
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.performanceTracker = performanceTracker;
function storePerformanceData(data) {
    const maxEntries = 1000;
    if (!global.performanceHistory) {
        global.performanceHistory = [];
    }
    global.performanceHistory.push(data);
    if (global.performanceHistory.length > maxEntries) {
        global.performanceHistory = global.performanceHistory.slice(-maxEntries);
    }
}
function getPerformanceAnalytics(timeWindow = 60 * 60 * 1000) {
    const history = global.performanceHistory || [];
    const cutoff = new Date(Date.now() - timeWindow);
    const recentRequests = history.filter(req => req.timestamp >= cutoff);
    if (recentRequests.length === 0) {
        return {
            averageResponseTime: 0,
            requestsPerSecond: 0,
            errorRate: 0,
            slowestRequests: [],
            topEndpoints: [],
            statusCodeDistribution: {},
        };
    }
    const totalResponseTime = recentRequests.reduce((sum, req) => sum + req.responseTime, 0);
    const averageResponseTime = totalResponseTime / recentRequests.length;
    const timeWindowSeconds = timeWindow / 1000;
    const requestsPerSecond = recentRequests.length / timeWindowSeconds;
    const errorCount = recentRequests.filter(req => req.error).length;
    const errorRate = (errorCount / recentRequests.length) * 100;
    const slowestRequests = recentRequests
        .sort((a, b) => b.responseTime - a.responseTime)
        .slice(0, 10);
    const endpointStats = recentRequests.reduce((acc, req) => {
        const key = `${req.method} ${req.path}`;
        if (!acc[key]) {
            acc[key] = { count: 0, totalTime: 0 };
        }
        acc[key].count++;
        acc[key].totalTime += req.responseTime;
        return acc;
    }, {});
    const topEndpoints = Object.entries(endpointStats)
        .map(([path, stats]) => ({
        path,
        count: stats.count,
        avgResponseTime: stats.totalTime / stats.count,
    }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const statusCodeDistribution = recentRequests.reduce((acc, req) => {
        const code = Math.floor(req.statusCode / 100) * 100;
        const key = `${code}xx`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    return {
        averageResponseTime,
        requestsPerSecond,
        errorRate,
        slowestRequests,
        topEndpoints,
        statusCodeDistribution,
    };
}
function clearPerformanceHistory() {
    global.performanceHistory = [];
}
exports.default = exports.performanceTracker;
//# sourceMappingURL=performanceTracker.js.map