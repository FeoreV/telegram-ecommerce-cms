"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inviteLinkController_1 = require("../controllers/inviteLinkController");
const inviteLinkWebController_1 = require("../controllers/inviteLinkWebController");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.get('/page/:token', inviteLinkWebController_1.handleInviteLinkPage);
router.get('/info/:token', inviteLinkController_1.getInviteLinkInfo);
router.post('/use', csrfProtection_1.csrfProtection, inviteLinkController_1.useInviteLink);
router.use(auth_1.authMiddleware);
router.post('/', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.USER_CREATE), inviteLinkController_1.createInviteLink);
router.get('/', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), inviteLinkController_1.getInviteLinks);
router.put('/:id', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), inviteLinkController_1.updateInviteLink);
router.delete('/:id', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.USER_DELETE), inviteLinkController_1.deleteInviteLink);
exports.default = router;
//# sourceMappingURL=inviteLinkRoutes.js.map