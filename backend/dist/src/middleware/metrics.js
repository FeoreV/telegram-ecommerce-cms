"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMetrics = exports.getMetrics = exports.metricsMiddleware = void 0;
const logger_1 = require("../utils/logger");
const prometheusService_1 = __importDefault(require("../services/prometheusService"));
const metrics = {
    totalRequests: 0,
    requestsByMethod: {},
    requestsByPath: {},
    responseTimeSum: 0,
    errorCount: 0,
    statusCodes: {},
};
const metricsMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.route?.path || req.path;
    const prometheusService = prometheusService_1.default.getInstance();
    prometheusService.httpRequestsInProgress.inc({ method, route: path });
    metrics.totalRequests++;
    metrics.requestsByMethod[method] = (metrics.requestsByMethod[method] || 0) + 1;
    metrics.requestsByPath[path] = (metrics.requestsByPath[path] || 0) + 1;
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode.toString();
        metrics.responseTimeSum += responseTime;
        metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
        if (res.statusCode >= 400) {
            metrics.errorCount++;
        }
        prometheusService.recordHttpRequest(method, path, res.statusCode, responseTime);
        prometheusService.httpRequestsInProgress.dec({ method, route: path });
        logger_1.logger.info('Request completed', {
            method,
            path,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            requestId: req.requestId,
        });
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = undefined;
        }
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.metricsMiddleware = metricsMiddleware;
const getMetrics = () => {
    const avgResponseTime = metrics.totalRequests > 0
        ? metrics.responseTimeSum / metrics.totalRequests
        : 0;
    const errorRate = metrics.totalRequests > 0
        ? (metrics.errorCount / metrics.totalRequests) * 100
        : 0;
    return {
        ...metrics,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
    };
};
exports.getMetrics = getMetrics;
const resetMetrics = () => {
    metrics.totalRequests = 0;
    metrics.requestsByMethod = {};
    metrics.requestsByPath = {};
    metrics.responseTimeSum = 0;
    metrics.errorCount = 0;
    metrics.statusCodes = {};
};
exports.resetMetrics = resetMetrics;
//# sourceMappingURL=metrics.js.map