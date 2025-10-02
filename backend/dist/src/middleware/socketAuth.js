"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            logger_1.logger.warn(`Socket authentication failed: No token provided for ${socket.id}`);
            return next(new Error('Authentication failed: No token provided'));
        }
        let decoded;
        try {
            decoded = (0, jwt_1.verifyToken)(token);
        }
        catch (error) {
            logger_1.logger.warn(`Socket authentication failed: ${error.message} for ${socket.id}`);
            if (error.message === 'Token expired') {
                return next(new Error('Authentication failed: Token expired'));
            }
            return next(new Error('Authentication failed: Invalid token'));
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                telegramId: true,
                role: true,
                username: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            logger_1.logger.warn(`Socket authentication failed: User not found or inactive for ${socket.id}`);
            return next(new Error('Authentication failed: User not found or inactive'));
        }
        socket.userId = user.id;
        socket.user = {
            id: user.id,
            telegramId: user.telegramId,
            role: user.role,
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
        };
        logger_1.logger.info(`Socket authenticated: ${socket.id} for user ${user.id} (${user.role})`);
        next();
    }
    catch (error) {
        logger_1.logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed: Server error'));
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
//# sourceMappingURL=socketAuth.js.map