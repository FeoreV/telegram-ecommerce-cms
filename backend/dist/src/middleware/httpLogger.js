"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdLogger = exports.httpLogger = void 0;
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
const httpLogger = (req, res, next) => {
    req.startTime = Date.now();
    const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
    const isStaticAsset = req.path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/);
    if (skipPaths.includes(req.path) || isStaticAsset) {
        return next();
    }
    if (process.env.NODE_ENV === 'production') {
        loggerEnhanced_1.logger.http('Incoming request', {
            category: loggerEnhanced_1.LogCategory.API,
            method: req.method,
            url: req.originalUrl || req.url,
            path: req.path,
            ip: getClientIP(req),
            userAgent: req.get('User-Agent') || 'Unknown',
            requestId: req.requestId,
            contentLength: req.get('Content-Length'),
            referer: req.get('Referer'),
            acceptEncoding: req.get('Accept-Encoding'),
            acceptLanguage: req.get('Accept-Language'),
            host: req.get('Host'),
        });
    }
    const originalSend = res.send;
    res.send = function (data) {
        return originalSend.call(this, data);
    };
    res.on('finish', () => {
        const duration = req.startTime ? Date.now() - req.startTime : 0;
        const statusCode = res.statusCode;
        let logLevel = 'http';
        if (statusCode >= 500)
            logLevel = 'error';
        else if (statusCode >= 400)
            logLevel = 'warn';
        else if (statusCode >= 300)
            logLevel = 'info';
        const logData = {
            category: loggerEnhanced_1.LogCategory.API,
            method: req.method,
            url: req.originalUrl || req.url,
            path: req.path,
            statusCode,
            duration,
            ip: getClientIP(req),
            userAgent: req.get('User-Agent') || 'Unknown',
            requestId: req.requestId,
            responseSize: res.get('Content-Length'),
            contentType: res.get('Content-Type'),
        };
        if (statusCode >= 400) {
            logData['errorContext'] = {
                query: req.query,
                params: req.params,
                bodyStructure: req.body ? Object.keys(req.body) : undefined,
            };
        }
        if (logLevel === 'error') {
            loggerEnhanced_1.logger.error('Request failed', logData);
        }
        else if (logLevel === 'warn') {
            loggerEnhanced_1.logger.warn('Request warning', logData);
        }
        else if (process.env.NODE_ENV === 'production') {
            loggerEnhanced_1.logger.http('Request completed', logData);
        }
        if (duration > 1000) {
            loggerEnhanced_1.logger.performance('Slow request detected', {
                ...logData,
                category: loggerEnhanced_1.LogCategory.PERFORMANCE,
                threshold: 1000,
            });
        }
    });
    res.on('error', (error) => {
        loggerEnhanced_1.logger.logError(error, 'Response error', {
            category: loggerEnhanced_1.LogCategory.API,
            method: req.method,
            url: req.originalUrl || req.url,
            requestId: req.requestId,
        });
    });
    next();
};
exports.httpLogger = httpLogger;
function getClientIP(req) {
    return (req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        'unknown');
}
const requestIdLogger = (req, res, next) => {
    req.requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.requestId);
    next();
};
exports.requestIdLogger = requestIdLogger;
exports.default = {
    httpLogger: exports.httpLogger,
    requestIdLogger: exports.requestIdLogger,
};
//# sourceMappingURL=httpLogger.js.map