"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStoreAccess = exports.requireRole = exports.authMiddleware = void 0;
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.substring(7);
        let decoded;
        try {
            decoded = (0, jwt_1.verifyToken)(token);
        }
        catch (error) {
            logger_1.logger.warn('Token verification failed', {
                error: error instanceof Error ? error.message : error,
                errorName: error instanceof Error ? error.name : undefined,
                userAgent: req.headers['user-agent'],
                ip: req.ip,
                tokenPreview: `${token.substring(0, 6)}...${token.substring(token.length - 6)}`,
            });
            if (error instanceof Error && error.message === 'Token expired') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            else if (error instanceof Error && error.message === 'Invalid token') {
                return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
            }
            else {
                return res.status(401).json({ error: 'Authentication failed', code: 'AUTH_FAILED' });
            }
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                telegramId: true,
                email: true,
                role: true,
                username: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        req.user = {
            id: user.id,
            telegramId: user.telegramId || undefined,
            email: user.email || undefined,
            role: user.role,
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            isActive: user.isActive,
            permissions: []
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('Auth middleware error', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            request: {
                method: req.method,
                url: req.url,
                headers: (0, logger_1.maskSensitiveData)(req.headers),
            },
        });
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authMiddleware = authMiddleware;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            logger_1.logger.warn('requireRole insufficient permissions', {
                userId: req.user.id,
                role: req.user.role,
                requiredRoles: roles,
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireStoreAccess = async (req, res, next) => {
    try {
        const storeId = req.params.id || req.params.storeId || req.body.storeId;
        const userId = req.user?.id;
        if (!storeId || !userId) {
            return res.status(400).json({ error: 'Store ID and user required' });
        }
        if (req.user?.role === 'OWNER') {
            return next();
        }
        const store = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                OR: [
                    { ownerId: userId },
                    { admins: { some: { userId } } }
                ]
            }
        });
        if (!store) {
            return res.status(403).json({ error: 'No access to this store' });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Store access middleware error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};
exports.requireStoreAccess = requireStoreAccess;
//# sourceMappingURL=auth.js.map