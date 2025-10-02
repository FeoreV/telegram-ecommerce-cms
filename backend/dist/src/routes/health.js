"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const jwt_1 = require("../utils/jwt");
const healthController_1 = require("../controllers/healthController");
const router = (0, express_1.Router)();
router.get('/', healthController_1.getBasicHealth);
router.get('/diagnostics/public', healthController_1.getPublicDiagnostics);
router.get('/ready', healthController_1.getReadinessProbe);
router.get('/live', healthController_1.getLivenessProbe);
router.get('/detailed', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), healthController_1.getDetailedHealth);
router.get('/metrics', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), healthController_1.getPerformanceMetrics);
router.get('/history', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), healthController_1.getResourceHistory);
router.get('/system', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), healthController_1.getSystemInfo);
router.get('/diagnostics', auth_1.authMiddleware, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), healthController_1.getDiagnostics);
exports.default = router;
//# sourceMappingURL=health.js.map