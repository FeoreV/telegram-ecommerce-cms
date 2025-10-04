"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invitationAcceptanceController_1 = require("../controllers/invitationAcceptanceController");
const invitationController_1 = require("../controllers/invitationController");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.get('/accept/:token', invitationAcceptanceController_1.handleInvitationAcceptance);
router.get('/:token', invitationController_1.getInvitationInfo);
router.post('/accept', csrfProtection_1.csrfProtection, invitationController_1.acceptInvitation);
router.post('/reject', csrfProtection_1.csrfProtection, invitationController_1.rejectInvitation);
router.use(auth_1.authMiddleware);
router.get('/activity/:storeId', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), invitationController_1.getEmployeeActivity);
exports.default = router;
//# sourceMappingURL=invitationRoutes.js.map