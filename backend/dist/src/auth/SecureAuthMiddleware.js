"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerAuthMiddlewareStack = exports.adminAuthMiddlewareStack = exports.authMiddlewareStack = exports.securityMiddlewareStack = exports.securityLoggingMiddleware = exports.requireStoreAccess = exports.requirePermission = exports.requireRole = exports.optionalAuthMiddleware = exports.secureAuthMiddleware = exports.generalRateLimit = exports.loginSlowDown = exports.authRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const permissions_1 = require("../middleware/permissions");
const logger_1 = require("../utils/logger");
const SecureAuthSystem_1 = require("./SecureAuthSystem");
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many authentication attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.logger.warn('Authentication rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.originalUrl
        });
        res.status(429).json({
            error: 'Too many authentication attempts',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: '15 minutes'
        });
    }
});
exports.loginSlowDown = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000,
    delayAfter: 2,
    delayMs: () => 500,
    maxDelayMs: 5000,
    validate: { delayMs: false }
});
exports.generalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});
const secureAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = SecureAuthSystem_1.SecureAuthSystem.extractTokenFromHeader(authHeader);
        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'MISSING_TOKEN'
            });
        }
        let tokenPayload;
        try {
            tokenPayload = await SecureAuthSystem_1.SecureAuthSystem.verifyAccessToken(token);
        }
        catch (error) {
            logger_1.logger.warn('Token verification failed', {
                error: error instanceof Error ? error.message : String(error),
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.originalUrl
            });
            let code = 'INVALID_TOKEN';
            if (error instanceof Error && error.message.includes('expired'))
                code = 'TOKEN_EXPIRED';
            else if (error instanceof Error && error.message.includes('revoked'))
                code = 'TOKEN_REVOKED';
            return res.status(401).json({
                error: 'Invalid or expired token',
                code,
                message: error instanceof Error ? error.message : String(error)
            });
        }
        const sessionValid = await SecureAuthSystem_1.SecureAuthSystem.validateSession(tokenPayload.sessionId, tokenPayload.userId);
        if (!sessionValid) {
            logger_1.logger.warn('Invalid session', {
                userId: tokenPayload.userId,
                sessionId: tokenPayload.sessionId,
                ip: req.ip
            });
            return res.status(401).json({
                error: 'Session expired or invalid',
                code: 'INVALID_SESSION'
            });
        }
        await SecureAuthSystem_1.SecureAuthSystem.updateSessionActivity(tokenPayload.sessionId, tokenPayload.userId);
        const { prisma } = await import('../lib/prisma.js');
        const user = await prisma.user.findUnique({
            where: { id: tokenPayload.userId },
            select: {
                id: true,
                email: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });
        if (!user || !user.isActive) {
            logger_1.logger.warn('User not found or inactive', {
                userId: tokenPayload.userId,
                ip: req.ip
            });
            return res.status(401).json({
                error: 'User account not found or deactivated',
                code: 'USER_INACTIVE'
            });
        }
        if (user.role !== tokenPayload.role) {
            logger_1.logger.warn('User role changed, invalidating token', {
                userId: user.id,
                oldRole: tokenPayload.role,
                newRole: user.role,
                ip: req.ip
            });
            await SecureAuthSystem_1.SecureAuthSystem.blacklistToken(token, 'role_changed');
            return res.status(401).json({
                error: 'User permissions have changed. Please log in again.',
                code: 'ROLE_CHANGED'
            });
        }
        req.user = {
            id: user.id,
            email: user.email || undefined,
            telegramId: user.telegramId || undefined,
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            role: user.role,
            permissions: await SecureAuthSystem_1.SecureAuthSystem.getUserPermissions(user.id)
        };
        req.sessionId = tokenPayload.sessionId;
        req.token = token;
        if (process.env.NODE_ENV === 'production') {
            logger_1.logger.debug('User authenticated successfully', {
                userId: user.id,
                role: user.role,
                ip: req.ip,
                endpoint: req.originalUrl,
                userAgent: req.get('User-Agent')
            });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            ip: req.ip,
            endpoint: req.originalUrl
        });
        res.status(500).json({
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR'
        });
    }
};
exports.secureAuthMiddleware = secureAuthMiddleware;
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = SecureAuthSystem_1.SecureAuthSystem.extractTokenFromHeader(authHeader);
        if (!token) {
            return next();
        }
        try {
            const tokenPayload = await SecureAuthSystem_1.SecureAuthSystem.verifyAccessToken(token);
            const sessionValid = await SecureAuthSystem_1.SecureAuthSystem.validateSession(tokenPayload.sessionId, tokenPayload.userId);
            if (sessionValid) {
                const { prisma } = await import('../lib/prisma.js');
                const user = await prisma.user.findUnique({
                    where: { id: tokenPayload.userId },
                    select: {
                        id: true,
                        email: true,
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        isActive: true
                    }
                });
                if (user && user.isActive && user.role === tokenPayload.role) {
                    req.user = {
                        id: user.id,
                        email: user.email || undefined,
                        telegramId: user.telegramId || undefined,
                        username: user.username || undefined,
                        firstName: user.firstName || undefined,
                        lastName: user.lastName || undefined,
                        role: user.role,
                        permissions: await SecureAuthSystem_1.SecureAuthSystem.getUserPermissions(user.id)
                    };
                    req.sessionId = tokenPayload.sessionId;
                    req.token = token;
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('Optional authentication failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                ip: req.ip
            });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Optional authentication middleware error', { error });
        next();
    }
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const requireRole = (allowedRoles) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        if (!roles.includes(req.user.role)) {
            logger_1.logger.warn('Access denied - insufficient role', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: roles,
                endpoint: req.originalUrl,
                ip: req.ip
            });
            return res.status(403).json({
                error: 'Access denied - insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: roles,
                current: req.user.role
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        try {
            const permissionChecker = new permissions_1.PermissionChecker(req.user);
            if (!permissionChecker.hasPermission(permission)) {
                logger_1.logger.warn('Access denied - insufficient permission', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    requiredPermission: permission,
                    endpoint: req.originalUrl,
                    ip: req.ip
                });
                return res.status(403).json({
                    error: 'Access denied - insufficient permissions',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: permission,
                    userRole: req.user.role
                });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Permission check error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user.id,
                permission
            });
            res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
};
exports.requirePermission = requirePermission;
const requireStoreAccess = (storeIdParam = 'storeId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        const storeId = req.params[storeIdParam] || req.body.storeId;
        if (!storeId) {
            return res.status(400).json({
                error: 'Store ID required',
                code: 'STORE_ID_REQUIRED'
            });
        }
        try {
            if (req.user.role === SecureAuthSystem_1.UserRole.OWNER) {
                return next();
            }
            const { prisma } = await import('../lib/prisma.js');
            const hasAccess = await prisma.user.findFirst({
                where: {
                    id: req.user.id,
                    OR: [
                        { ownedStores: { some: { id: storeId } } },
                        { managedStores: { some: { storeId } } }
                    ]
                }
            });
            if (!hasAccess) {
                logger_1.logger.warn('Access denied - no store access', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    storeId,
                    endpoint: req.originalUrl,
                    ip: req.ip
                });
                return res.status(403).json({
                    error: 'Access denied - no access to this store',
                    code: 'NO_STORE_ACCESS',
                    storeId
                });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Store access check error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user.id,
                storeId
            });
            res.status(500).json({
                error: 'Store access check failed',
                code: 'STORE_ACCESS_CHECK_ERROR'
            });
        }
    };
};
exports.requireStoreAccess = requireStoreAccess;
const securityLoggingMiddleware = (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();
    const securityEndpoints = ['/auth', '/admin', '/api/users', '/api/stores'];
    const isSecurityEndpoint = securityEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint));
    if (isSecurityEndpoint) {
        logger_1.logger.info('Security endpoint accessed', {
            method: req.method,
            endpoint: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
    }
    res.send = function (body) {
        const responseTime = Date.now() - startTime;
        if (res.statusCode === 401 || res.statusCode === 403) {
            logger_1.logger.warn('Security event - access denied', {
                method: req.method,
                endpoint: req.originalUrl,
                statusCode: res.statusCode,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                responseTime,
                user: req.user?.id
            });
        }
        return originalSend.call(this, body);
    };
    next();
};
exports.securityLoggingMiddleware = securityLoggingMiddleware;
exports.securityMiddlewareStack = [
    exports.securityLoggingMiddleware,
    exports.generalRateLimit,
];
exports.authMiddlewareStack = [
    ...exports.securityMiddlewareStack,
    exports.secureAuthMiddleware
];
exports.adminAuthMiddlewareStack = [
    ...exports.securityMiddlewareStack,
    exports.secureAuthMiddleware,
    (0, exports.requireRole)([SecureAuthSystem_1.UserRole.OWNER, SecureAuthSystem_1.UserRole.ADMIN])
];
exports.ownerAuthMiddlewareStack = [
    ...exports.securityMiddlewareStack,
    exports.secureAuthMiddleware,
    (0, exports.requireRole)(SecureAuthSystem_1.UserRole.OWNER)
];
//# sourceMappingURL=SecureAuthMiddleware.js.map