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
            logger_1.logger.warn(`Socket connection without token: ${socket.id}`);
            socket.userId = undefined;
            socket.user = undefined;
            return next();
        }
        let decoded;
        try {
            decoded = (0, jwt_1.verifyToken)(token);
        }
        catch (error) {
            logger_1.logger.warn(`Socket token invalid: ${error.message} for ${socket.id}`);
            socket.userId = undefined;
            socket.user = undefined;
            return next();
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
            logger_1.logger.warn(`Socket user not found or inactive for ${socket.id}`);
            socket.userId = undefined;
            socket.user = undefined;
            return next();
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
        try {
            logger_1.logger.error('Socket authentication error - DIAGNOSTIC', {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                socketId: socket.id,
                handshakeAuthKeys: Object.keys(socket.handshake?.auth || {}),
                handshakeQueryKeys: Object.keys(socket.handshake?.query || {}),
                requestHeaders: socket.handshake?.headers ? {
                    origin: socket.handshake.headers.origin,
                    host: socket.handshake.headers.host,
                    'user-agent': socket.handshake.headers['user-agent'],
                    'x-forwarded-for': socket.handshake.headers['x-forwarded-for'],
                } : undefined,
            });
        }
        catch {
        }
        const err = new Error('Authentication failed');
        err.data = { code: 'AUTH_FAILED' };
        next(err);
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
//# sourceMappingURL=socketAuth.js.map