"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundMiddleware = exports.secureNotFoundHandler = exports.apiNotFoundHandler = void 0;
const logger_1 = require("../utils/logger");
const apiNotFoundHandler = (req, res, _next) => {
    const requestInfo = {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        userRole: req.user?.role,
        timestamp: new Date().toISOString(),
        headers: {
            accept: req.get('Accept'),
            contentType: req.get('Content-Type'),
            origin: req.get('Origin'),
            referer: req.get('Referer'),
        }
    };
    logger_1.logger.warn('API endpoint not found', requestInfo);
    const acceptsJson = req.accepts(['json', 'html']) === 'json';
    if (acceptsJson || req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({
            error: 'Endpoint not found',
            message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            availableEndpoints: getAvailableEndpoints(req.user?.role),
        });
    }
    return res.status(404).json({
        error: 'Route not found',
        message: 'This route is not handled by the API. Please check if this should be a frontend route.',
        statusCode: 404,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
    });
};
exports.apiNotFoundHandler = apiNotFoundHandler;
const getAvailableEndpoints = (userRole) => {
    const publicEndpoints = [
        'GET /health',
        'GET /api',
        'POST /api/auth/telegram',
    ];
    const authenticatedEndpoints = [
        'GET /api/stores',
        'GET /api/products',
        'GET /api/orders',
        'GET /api/notifications',
    ];
    const adminEndpoints = [
        'GET /api/admin/dashboard',
        'GET /api/admin/stats',
        'GET /api/admin/users',
        'POST /api/admin/stores',
    ];
    const ownerEndpoints = [
        'GET /api/users',
        'POST /api/users',
        'DELETE /api/users/:id',
        'GET /api/security/status',
        'GET /api/backup',
    ];
    const endpoints = {
        public: publicEndpoints,
    };
    if (userRole) {
        endpoints.authenticated = authenticatedEndpoints;
        if (userRole === 'ADMIN' || userRole === 'OWNER') {
            endpoints.admin = adminEndpoints;
        }
        if (userRole === 'OWNER') {
            endpoints.owner = ownerEndpoints;
        }
    }
    return endpoints;
};
const secureNotFoundHandler = (req, res, next) => {
    const requestInfo = {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        userRole: req.user?.role,
        timestamp: new Date().toISOString(),
    };
    const suspiciousPatterns = [
        /\.env$/i,
        /\.git/i,
        /admin/i,
        /wp-admin/i,
        /phpmyadmin/i,
        /\.php$/i,
        /\.asp$/i,
        /\.jsp$/i,
        /backup/i,
        /config/i,
        /database/i,
        /\.sql$/i,
    ];
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(req.originalUrl) || pattern.test(req.url));
    if (isSuspicious) {
        logger_1.logger.warn('Suspicious 404 request detected', {
            ...requestInfo,
            suspicious: true,
            pattern: 'security_scan'
        });
        return res.status(404).json({
            error: 'Not found',
            statusCode: 404,
        });
    }
    if (req.originalUrl.includes('/admin') && (!req.user || !['ADMIN', 'OWNER'].includes(req.user.role))) {
        logger_1.logger.warn('Unauthorized admin access attempt', {
            ...requestInfo,
            threat: 'unauthorized_admin_access'
        });
        return res.status(404).json({
            error: 'Not found',
            statusCode: 404,
        });
    }
    return (0, exports.apiNotFoundHandler)(req, res, next);
};
exports.secureNotFoundHandler = secureNotFoundHandler;
const notFoundMiddleware = (req, res, next) => {
    if (res.headersSent) {
        return next();
    }
    return (0, exports.secureNotFoundHandler)(req, res, next);
};
exports.notFoundMiddleware = notFoundMiddleware;
//# sourceMappingURL=notFoundHandler.js.map