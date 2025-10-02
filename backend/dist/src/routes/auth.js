"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
router.post('/telegram', [
    (0, express_validator_1.body)('telegramId').isNumeric().withMessage('Valid Telegram ID required'),
    (0, express_validator_1.body)('username').optional().isString(),
    (0, express_validator_1.body)('firstName').optional().isString(),
    (0, express_validator_1.body)('lastName').optional().isString(),
], validation_1.validate, authController_1.telegramAuth);
router.get('/profile', auth_1.authMiddleware, authController_1.getProfile);
router.put('/profile', auth_1.authMiddleware, [
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('phone').optional().isString(),
], validation_1.validate, authController_1.updateProfile);
router.post('/promote', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.body)('userId').isString().withMessage('User ID required'),
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'VENDOR']).withMessage('Invalid role'),
], validation_1.validate, authController_1.promoteUser);
router.get('/adminjs-token', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Authentication required', 401);
    }
    const adminJsToken = req.headers.authorization?.replace('Bearer ', '');
    if (!adminJsToken) {
        throw new errorHandler_1.AppError('No token available', 400);
    }
    logger_1.logger.info(`AdminJS token requested by user: ${req.user.id} (${req.user.role})`);
    await (0, auditLog_1.auditAuthAction)(req.user.id, auditLog_1.AuditAction.ADMINJS_ACCESS, req, {
        action: 'token_requested',
        role: req.user.role
    });
    res.json({
        token: adminJsToken,
        email: req.user.telegramId,
        expiresIn: '7d',
        adminJsUrl: process.env.ADMIN_JS_URL || 'http://localhost:3001/admin',
        instructions: {
            ru: 'Используйте Telegram ID как логин и этот токен как пароль для входа в AdminJS',
            en: 'Use your Telegram ID as login and this token as password for AdminJS login'
        }
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map