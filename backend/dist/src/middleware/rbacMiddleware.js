"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupContext = exports.rbac = exports.requireSelfAccess = exports.requireOwnerAccess = exports.requirePermission = exports.requireStoreAccess = exports.requireRole = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const MultiTenantSecurityService_1 = require("../services/MultiTenantSecurityService");
const SecretManager_1 = require("../utils/SecretManager");
const logger_1 = require("../utils/logger");
const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            logger_1.logger.warn('Authentication failed: No token provided', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(401).json({
                error: 'Authentication required',
                message: 'Access token is required'
            });
            return;
        }
        try {
            const jwtSecrets = SecretManager_1.secretManager.getJWTSecrets();
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecrets.secret);
            const user = {
                id: decoded.userId || decoded.id,
                telegramId: decoded.telegramId || '',
                role: decoded.role || 'CUSTOMER',
                storeId: decoded.storeId,
                permissions: decoded.permissions || [],
                sessionId: decoded.sessionId || `session-${Date.now()}-${Math.random()}`
            };
            if (!user.id || !user.role) {
                throw new Error('Invalid token payload: missing user ID or role');
            }
            req.user = user;
            req.storeId = user.storeId;
            const tenantContext = {
                userId: user.id,
                role: user.role,
                storeId: user.storeId,
                permissions: user.permissions
            };
            req.tenantContext = tenantContext;
            await MultiTenantSecurityService_1.multiTenantSecurityService.setUserContext(user.sessionId, tenantContext, req.ip);
            logger_1.logger.debug('User authenticated successfully', {
                userId: user.id,
                role: user.role,
                storeId: user.storeId,
                sessionId: user.sessionId,
                path: req.path
            });
            next();
        }
        catch (jwtError) {
            logger_1.logger.warn('JWT verification failed', {
                error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(401).json({
                error: 'Invalid token',
                message: 'Access token is invalid or expired'
            });
            return;
        }
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Authentication service unavailable'
        });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRole = (allowedRoles) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
                return;
            }
            const userRole = req.user.role;
            if (!roles.includes(userRole)) {
                logger_1.logger.warn('Access denied: insufficient role', {
                    userId: req.user.id,
                    userRole,
                    requiredRoles: roles,
                    path: req.path,
                    ip: req.ip
                });
                res.status(403).json({
                    error: 'Access denied',
                    message: `Required role: ${roles.join(' or ')}. Current role: ${userRole}`
                });
                return;
            }
            logger_1.logger.debug('Role check passed', {
                userId: req.user.id,
                userRole,
                requiredRoles: roles,
                path: req.path
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Role middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Authorization service unavailable'
            });
        }
    };
};
exports.requireRole = requireRole;
const requireStoreAccess = (operation = 'read') => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
                return;
            }
            const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
            if (!storeId) {
                res.status(400).json({
                    error: 'Bad request',
                    message: 'Store ID is required'
                });
                return;
            }
            const hasAccess = await MultiTenantSecurityService_1.multiTenantSecurityService.validateStoreAccess(req.user.id, storeId, operation);
            if (!hasAccess) {
                logger_1.logger.warn('Store access denied', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    storeId,
                    operation,
                    path: req.path,
                    ip: req.ip
                });
                res.status(403).json({
                    error: 'Access denied',
                    message: `You don't have ${operation} access to this store`
                });
                return;
            }
            req.storeId = storeId;
            logger_1.logger.debug('Store access granted', {
                userId: req.user.id,
                userRole: req.user.role,
                storeId,
                operation,
                path: req.path
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Store access middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Store access validation failed'
            });
        }
    };
};
exports.requireStoreAccess = requireStoreAccess;
const requirePermission = (requiredPermissions) => {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    return (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
                return;
            }
            const userPermissions = req.user.permissions || [];
            const hasAllPermissions = permissions.every(permission => userPermissions.includes(permission));
            if (req.user.role === 'OWNER' || hasAllPermissions) {
                logger_1.logger.debug('Permission check passed', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    userPermissions,
                    requiredPermissions: permissions,
                    path: req.path
                });
                next();
                return;
            }
            logger_1.logger.warn('Access denied: insufficient permissions', {
                userId: req.user.id,
                userRole: req.user.role,
                userPermissions,
                requiredPermissions: permissions,
                path: req.path,
                ip: req.ip
            });
            res.status(403).json({
                error: 'Access denied',
                message: `Required permissions: ${permissions.join(', ')}`
            });
        }
        catch (error) {
            logger_1.logger.error('Permission middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Permission validation failed'
            });
        }
    };
};
exports.requirePermission = requirePermission;
const requireOwnerAccess = (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'User must be authenticated'
            });
            return;
        }
        if (req.user.role !== 'OWNER') {
            logger_1.logger.warn('Owner access denied', {
                userId: req.user.id,
                userRole: req.user.role,
                path: req.path,
                ip: req.ip
            });
            res.status(403).json({
                error: 'Access denied',
                message: 'Owner access required'
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Owner access middleware error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Owner access validation failed'
        });
    }
};
exports.requireOwnerAccess = requireOwnerAccess;
const requireSelfAccess = (userIdParam = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
                return;
            }
            const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
            if (!targetUserId) {
                res.status(400).json({
                    error: 'Bad request',
                    message: 'User ID is required'
                });
                return;
            }
            if (req.user.id === targetUserId || ['OWNER', 'ADMIN'].includes(req.user.role)) {
                next();
                return;
            }
            logger_1.logger.warn('Self-access denied', {
                userId: req.user.id,
                targetUserId,
                userRole: req.user.role,
                path: req.path,
                ip: req.ip
            });
            res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own data'
            });
        }
        catch (error) {
            logger_1.logger.error('Self-access middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Self-access validation failed'
            });
        }
    };
};
exports.requireSelfAccess = requireSelfAccess;
const rbac = (options) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
                return;
            }
            if (options.roles && !options.roles.includes(req.user.role)) {
                logger_1.logger.warn('RBAC access denied: insufficient role', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    requiredRoles: options.roles,
                    path: req.path,
                    ip: req.ip
                });
                res.status(403).json({
                    error: 'Access denied',
                    message: `Required role: ${options.roles.join(' or ')}`
                });
                return;
            }
            if (options.permissions) {
                const userPermissions = req.user.permissions || [];
                const hasPermissions = req.user.role === 'OWNER' ||
                    options.permissions.every(permission => userPermissions.includes(permission));
                if (!hasPermissions) {
                    logger_1.logger.warn('RBAC access denied: insufficient permissions', {
                        userId: req.user.id,
                        userPermissions,
                        requiredPermissions: options.permissions,
                        path: req.path,
                        ip: req.ip
                    });
                    res.status(403).json({
                        error: 'Access denied',
                        message: `Required permissions: ${options.permissions.join(', ')}`
                    });
                    return;
                }
            }
            if (options.requireStoreAccess) {
                const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
                if (!storeId) {
                    res.status(400).json({
                        error: 'Bad request',
                        message: 'Store ID is required'
                    });
                    return;
                }
                const hasStoreAccess = await MultiTenantSecurityService_1.multiTenantSecurityService.validateStoreAccess(req.user.id, storeId, options.operation || 'read');
                if (!hasStoreAccess) {
                    logger_1.logger.warn('RBAC access denied: insufficient store access', {
                        userId: req.user.id,
                        storeId,
                        operation: options.operation,
                        path: req.path,
                        ip: req.ip
                    });
                    res.status(403).json({
                        error: 'Access denied',
                        message: 'You don\'t have access to this store'
                    });
                    return;
                }
                req.storeId = storeId;
            }
            logger_1.logger.debug('RBAC check passed', {
                userId: req.user.id,
                userRole: req.user.role,
                options,
                path: req.path
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('RBAC middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Access control validation failed'
            });
        }
    };
};
exports.rbac = rbac;
const cleanupContext = async (req, res, next) => {
    res.on('finish', async () => {
        if (req.user?.sessionId) {
            try {
                await MultiTenantSecurityService_1.multiTenantSecurityService.clearUserContext(req.user.sessionId);
            }
            catch (error) {
                logger_1.logger.error('Failed to cleanup user context:', error);
            }
        }
    });
    next();
};
exports.cleanupContext = cleanupContext;
//# sourceMappingURL=rbacMiddleware.js.map