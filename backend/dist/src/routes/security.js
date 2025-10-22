"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CompromiseResponseService_1 = require("../services/CompromiseResponseService");
const auth_1 = require("../middleware/auth");
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("../middleware/errorHandler");
const security_1 = require("../config/security");
const jwtSecurity_1 = require("../middleware/jwtSecurity");
const logger_1 = require("../utils/logger");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
router.get('/health', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthCheck = (0, security_1.performSecurityHealthCheck)();
    logger_1.logger.info('Security health check requested', {
        userId: req.user.id,
        status: healthCheck.status
    });
    res.json({
        timestamp: new Date().toISOString(),
        ...healthCheck
    });
}));
router.get('/metrics', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const metrics = security_1.securityMetrics.getMetrics();
    res.json({
        timestamp: new Date().toISOString(),
        metrics,
        period: '24h'
    });
}));
router.post('/metrics/reset', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    security_1.securityMetrics.resetMetrics();
    logger_1.logger.info('Security metrics reset', {
        userId: req.user.id,
        timestamp: new Date().toISOString()
    });
    res.json({
        message: 'Security metrics reset successfully',
        timestamp: new Date().toISOString()
    });
}));
router.post('/refresh-token', [
    (0, express_validator_1.body)('refreshToken')
        .isString()
        .notEmpty()
        .withMessage('Refresh token is required')
], (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    return (0, jwtSecurity_1.tokenRefreshMiddleware)(req, res, next);
}));
router.post('/logout', auth_1.authMiddleware, [
    (0, express_validator_1.body)('refreshToken')
        .optional()
        .isString()
        .withMessage('Refresh token must be a string')
], (0, errorHandler_1.asyncHandler)(async (req, res, _next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    return (0, jwtSecurity_1.logoutMiddleware)(req, res);
}));
router.post('/logout-all', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const currentToken = req.token;
    if (currentToken) {
        jwtSecurity_1.JWTSecurity.blacklistToken(currentToken);
    }
    logger_1.logger.info('User logged out from all devices', {
        userId: user.id,
        ip: req.ip
    });
    res.json({
        message: 'Logged out from all devices successfully'
    });
}));
router.get('/validate-token', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const sessionId = req.sessionId;
    res.json({
        valid: true,
        user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        },
        sessionId,
        timestamp: new Date().toISOString()
    });
}));
router.get('/config', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const config = {
        environment: process.env.NODE_ENV,
        security: {
            rateLimiting: {
                enabled: true,
                windowMs: 15 * 60 * 1000,
                maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100
            },
            cors: {
                enabled: true,
                allowedOrigins: [
                    process.env.FRONTEND_URL || 'http://localhost:3000',
                    process.env.ADMIN_PANEL_URL || 'http://localhost:3001'
                ].filter(Boolean)
            },
            security: {
                headers: true,
                bruteForceProtection: process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false',
                requestSanitization: process.env.ENABLE_REQUEST_SANITIZATION !== 'false',
                securityMonitoring: process.env.ENABLE_SECURITY_MONITORING !== 'false'
            },
            jwt: {
                accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
                refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
                issuer: process.env.JWT_ISSUER || 'telegram-store-api'
            }
        }
    };
    res.json({
        timestamp: new Date().toISOString(),
        config
    });
}));
router.post('/kill-switch/activate', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await CompromiseResponseService_1.compromiseResponseService.activateKillSwitch(req.body?.reason || 'manual');
    res.json({ status: 'kill_switch_activated' });
}));
router.post('/kill-switch/deactivate', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await CompromiseResponseService_1.compromiseResponseService.deactivateKillSwitch();
    res.json({ status: 'kill_switch_deactivated' });
}));
router.post('/quarantine/activate', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await CompromiseResponseService_1.compromiseResponseService.activateQuarantine(req.body?.reason || 'manual');
    res.json({ status: 'quarantine_activated' });
}));
router.post('/quarantine/deactivate', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await CompromiseResponseService_1.compromiseResponseService.deactivateQuarantine();
    res.json({ status: 'quarantine_deactivated' });
}));
router.post('/report-incident', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.body)('type')
        .isIn(['suspicious_activity', 'brute_force', 'token_abuse', 'unauthorized_access'])
        .withMessage('Invalid incident type'),
    (0, express_validator_1.body)('description')
        .isString()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    (0, express_validator_1.body)('severity')
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid severity level'),
    (0, express_validator_1.body)('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    const { type, description, severity, metadata } = req.body;
    const reporter = req.user;
    const incident = {
        id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        description,
        severity,
        metadata,
        reporter: {
            id: reporter.id,
            username: reporter.username,
            role: reporter.role
        },
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };
    logger_1.logger.warn('Security incident reported', incident);
    res.status(201).json({
        message: 'Security incident reported successfully',
        incidentId: incident.id,
        timestamp: incident.timestamp
    });
}));
router.post('/new-session', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const currentToken = req.token;
    if (currentToken) {
        jwtSecurity_1.JWTSecurity.blacklistToken(currentToken);
    }
    const sessionId = jwtSecurity_1.JWTSecurity.generateSessionId();
    const newAccessToken = jwtSecurity_1.JWTSecurity.generateAccessToken({
        userId: user.id,
        role: user.role,
        telegramId: user.telegramId,
        sessionId
    });
    logger_1.logger.info('New session created', {
        userId: user.id,
        sessionId,
        ip: req.ip
    });
    res.json({
        message: 'New session created successfully',
        accessToken: newAccessToken,
        sessionId,
        user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        }
    });
}));
exports.default = router;
//# sourceMappingURL=security.js.map