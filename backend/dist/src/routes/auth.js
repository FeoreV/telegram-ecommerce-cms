"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const auditLog_1 = require("../middleware/auditLog");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const validation_1 = require("../middleware/validation");
const jwt_1 = require("../utils/jwt");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const qrRateLimit = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many QR code generation requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});
const telegramAuthRateLimit = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many Telegram authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const telegramId = req.body?.telegramId;
        const ip = req.ip || 'unknown';
        return telegramId ? `telegram_auth:${ip}:${telegramId}` : `telegram_auth:${ip}`;
    }
});
router.post('/telegram', telegramAuthRateLimit, authController_1.telegramAuth);
router.get('/profile', auth_1.authMiddleware, authController_1.getProfile);
router.put('/profile', auth_1.authMiddleware, [
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('phone').optional().isString(),
], validation_1.validate, authController_1.updateProfile);
router.post('/promote', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.body)('userId').isString().withMessage('User ID required'),
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'VENDOR']).withMessage('Invalid role'),
], validation_1.validate, authController_1.promoteUser);
router.post('/qr-auth', qrRateLimit, authController_1.generateQRAuth);
router.get('/qr-auth/:sessionId', qrRateLimit, authController_1.checkQRAuth);
router.post('/refresh', authController_1.refreshToken);
router.post('/logout', auth_1.authMiddleware, authController_1.logout);
router.get('/sessions', auth_1.authMiddleware, authController_1.getActiveSessions);
router.delete('/sessions/:sessionId', auth_1.authMiddleware, authController_1.revokeSession);
router.get('/adminjs-token', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const adminJsToken = req.headers.authorization?.replace('Bearer ', '');
    if (!adminJsToken) {
        throw new errorHandler_1.AppError('No token available', 400);
    }
    logger_1.logger.info('AdminJS token requested', {
        userId: req.user.id,
        role: req.user.role
    });
    await (0, auditLog_1.auditAuthAction)(req.user.id, auditLog_1.AuditAction.ADMINJS_ACCESS, req, {
        action: 'token_requested',
        role: req.user.role
    });
    res.json({
        token: adminJsToken,
        email: req.user.telegramId,
        expiresIn: '7d',
        adminJsUrl: process.env.ADMIN_JS_URL || 'http://82.147.84.78:3001/admin',
        instructions: {
            ru: 'Используйте Telegram ID как логин и этот токен как пароль для входа в AdminJS',
            en: 'Use your Telegram ID as login and this token as password for AdminJS login'
        }
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map