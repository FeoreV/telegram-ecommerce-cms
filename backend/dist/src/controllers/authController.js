"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoteUser = exports.cleanupExpiredSessions = exports.revokeSession = exports.getActiveSessions = exports.generateDeepLink = exports.updateProfile = exports.getProfile = exports.logout = exports.refreshToken = exports.checkQRAuth = exports.generateQRAuth = exports.telegramAuth = void 0;
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const notificationService_1 = require("../services/notificationService");
const qrSessions = new Map();
exports.telegramAuth = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { telegramId, username, firstName, lastName, authDate, hash, photoUrl, sessionId } = req.body;
    if (!telegramId) {
        throw new errorHandler_1.AppError('Telegram ID is required', 400);
    }
    if (hash && authDate) {
        const isValid = verifyTelegramAuth({ telegramId, username, firstName, lastName, authDate }, hash);
        if (!isValid) {
            throw new errorHandler_1.AppError('Invalid Telegram authentication data', 400);
        }
    }
    let user = await prisma_1.prisma.user.findUnique({
        where: { telegramId: telegramId.toString() },
    });
    if (!user) {
        const isSuperAdmin = process.env.SUPER_ADMIN_TELEGRAM_ID && process.env.SUPER_ADMIN_TELEGRAM_ID === telegramId.toString();
        const initialRole = isSuperAdmin ? jwt_1.UserRole.OWNER : jwt_1.UserRole.CUSTOMER;
        user = await prisma_1.prisma.user.create({
            data: {
                telegramId: telegramId.toString(),
                username,
                firstName,
                lastName,
                role: initialRole,
                lastLoginAt: new Date(),
                profilePhoto: photoUrl,
            },
        });
        logger_1.logger.info(`New user created: ${telegramId} with role: ${initialRole}`);
        await notificationService_1.NotificationService.send({
            title: 'Добро пожаловать!',
            message: 'Ваш аккаунт успешно создан в системе управления e-commerce платформой',
            type: notificationService_1.NotificationType.USER_REGISTERED,
            priority: notificationService_1.NotificationPriority.MEDIUM,
            recipients: [user.id],
            channels: [notificationService_1.NotificationChannel.TELEGRAM],
            data: {
                userId: user.id,
                role: user.role
            }
        });
    }
    else {
        user = await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                username,
                firstName,
                lastName,
                role: user.role,
                lastLoginAt: new Date(),
                profilePhoto: photoUrl,
            },
        });
        logger_1.logger.info(`User updated: id=${user.id}, role=${user.role}`);
    }
    if (!user.isActive) {
        throw new errorHandler_1.AppError('Account is deactivated', 403);
    }
    const accessToken = (0, jwt_1.generateToken)({
        userId: user.id,
        telegramId: user.telegramId,
        role: user.role,
    });
    const refreshToken = (0, jwt_1.generateRefreshToken)(user.id);
    const refreshTokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
    await prisma_1.prisma.userSession.create({
        data: {
            userId: user.id,
            refreshToken: refreshTokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || '',
        }
    });
    if (sessionId && qrSessions.has(sessionId)) {
        const session = qrSessions.get(sessionId);
        if (!session) {
            throw new errorHandler_1.AppError('QR session not found', 404);
        }
        session.completed = true;
        session.telegramId = user.telegramId;
        qrSessions.set(sessionId, session);
    }
    logger_1.logger.info(`User ${user.id} logged in successfully via ${sessionId ? 'QR code' : 'direct'} method`);
    res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            profilePhoto: user.profilePhoto,
            lastLoginAt: user.lastLoginAt,
        },
        sessionId: sessionId || null,
    });
});
exports.generateQRAuth = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sessionId = crypto_1.default.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    qrSessions.set(sessionId, {
        sessionId,
        createdAt: new Date(),
        expiresAt,
        completed: false,
    });
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    const deepLink = `https://t.me/${botUsername}?start=auth_${sessionId}`;
    logger_1.logger.info(`QR auth session created: ${sessionId}`);
    res.json({
        success: true,
        sessionId,
        deepLink,
        qrData: deepLink,
        expiresAt: expiresAt.toISOString(),
        expiresIn: 300,
    });
});
exports.checkQRAuth = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { sessionId } = req.params;
    const session = qrSessions.get(sessionId);
    if (!session) {
        throw new errorHandler_1.AppError('Session not found or expired', 404);
    }
    if (new Date() > session.expiresAt) {
        qrSessions.delete(sessionId);
        throw new errorHandler_1.AppError('Session expired', 410);
    }
    res.json({
        success: true,
        sessionId,
        completed: session.completed || false,
        telegramId: session.telegramId || null,
        expiresAt: session.expiresAt.toISOString(),
    });
});
exports.refreshToken = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw new errorHandler_1.AppError('Refresh token is required', 400);
    }
    try {
        (0, jwt_1.verifyRefreshToken)(refreshToken);
    }
    catch (error) {
        throw new errorHandler_1.AppError('Invalid refresh token', 401);
    }
    const providedHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
    const session = await prisma_1.prisma.userSession.findFirst({
        where: {
            refreshToken: providedHash,
            isRevoked: false,
            expiresAt: { gt: new Date() }
        },
        include: {
            user: true
        }
    });
    if (!session) {
        throw new errorHandler_1.AppError('Invalid refresh token', 401);
    }
    const user = session.user;
    if (!user || !user.isActive) {
        throw new errorHandler_1.AppError('User not found or inactive', 401);
    }
    const newAccessToken = (0, jwt_1.generateToken)({
        userId: user.id,
        telegramId: user.telegramId,
        role: user.role,
    });
    const newRefreshToken = (0, jwt_1.generateRefreshToken)(user.id);
    const newRefreshTokenHash = crypto_1.default.createHash('sha256').update(newRefreshToken).digest('hex');
    await prisma_1.prisma.userSession.update({
        where: { id: session.id },
        data: {
            refreshToken: newRefreshTokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
    });
    logger_1.logger.info(`Token refreshed for user ${user.id}`);
    res.json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        },
    });
});
exports.logout = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    if (refreshToken) {
        const providedHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        await prisma_1.prisma.userSession.deleteMany({
            where: {
                userId: req.user.id,
                refreshToken: providedHash,
            }
        });
    }
    else {
        await prisma_1.prisma.userSession.deleteMany({
            where: {
                userId: req.user.id,
            }
        });
    }
    logger_1.logger.info(`User ${req.user.id} logged out`);
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});
exports.getProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            profilePhoto: true,
            lastLoginAt: true,
            balance: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    orders: true,
                    ownedStores: true,
                }
            }
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    res.json({
        success: true,
        user,
    });
});
exports.updateProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const { username, firstName, lastName, email } = req.body;
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: {
            username,
            firstName,
            lastName,
            email,
        },
        select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            profilePhoto: true,
        }
    });
    logger_1.logger.info(`Profile updated for user ${req.user.id}`);
    res.json({
        success: true,
        user: updatedUser,
    });
});
exports.generateDeepLink = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { action, params } = req.body;
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
        throw new errorHandler_1.AppError('Bot username not configured', 500);
    }
    let deepLinkParam = '';
    switch (action) {
        case 'auth': {
            const sessionId = crypto_1.default.randomUUID();
            qrSessions.set(sessionId, {
                sessionId,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                completed: false,
            });
            deepLinkParam = `auth_${sessionId}`;
            break;
        }
        case 'admin_panel':
            deepLinkParam = 'admin_panel';
            break;
        case 'order_verify':
            if (!params?.orderId) {
                throw new errorHandler_1.AppError('Order ID required for order verification link', 400);
            }
            deepLinkParam = `verify_${params.orderId}`;
            break;
        default:
            throw new errorHandler_1.AppError('Invalid action', 400);
    }
    const deepLink = `https://t.me/${botUsername}?start=${deepLinkParam}`;
    res.json({
        success: true,
        deepLink,
        action,
        params: deepLinkParam,
    });
});
exports.getActiveSessions = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const sessions = await prisma_1.prisma.userSession.findMany({
        where: {
            userId: req.user.id,
            expiresAt: { gt: new Date() },
            isRevoked: false,
        },
        select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    res.json({
        success: true,
        sessions,
    });
});
exports.revokeSession = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const { sessionId } = req.params;
    await prisma_1.prisma.userSession.deleteMany({
        where: {
            id: sessionId,
            userId: req.user.id,
        }
    });
    logger_1.logger.info(`Session ${sessionId} revoked by user ${req.user.id}`);
    res.json({
        success: true,
        message: 'Session revoked successfully'
    });
});
function verifyTelegramAuth(authData, hash) {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        throw new errorHandler_1.AppError('Telegram bot token not configured', 500);
    }
    const secret = crypto_1.default.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const checkString = Object.keys(authData)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${authData[key]}`)
        .join('\n');
    const hmac = crypto_1.default.createHmac('sha256', secret).update(checkString).digest('hex');
    return hmac === hash;
}
const cleanupExpiredSessions = () => {
    const now = new Date();
    for (const [sessionId, session] of qrSessions.entries()) {
        if (now > session.expiresAt) {
            qrSessions.delete(sessionId);
        }
    }
};
exports.cleanupExpiredSessions = cleanupExpiredSessions;
setInterval(exports.cleanupExpiredSessions, 60 * 1000);
exports.promoteUser = (0, errorHandler_1.asyncHandler)(async (_req, _res) => {
    throw new errorHandler_1.AppError('User promotion should be handled through /api/users/{id}/role endpoint', 400);
});
//# sourceMappingURL=authController.js.map