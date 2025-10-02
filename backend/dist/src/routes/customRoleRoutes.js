"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customRoleController_1 = require("../controllers/customRoleController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const permissions_2 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/permissions', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_VIEW), customRoleController_1.getAvailablePermissions);
router.post('/', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_CREATE), customRoleController_1.createCustomRole);
router.get('/', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_VIEW), customRoleController_1.getCustomRoles);
router.get('/:id', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_VIEW), customRoleController_1.getCustomRole);
router.put('/:id', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_UPDATE), customRoleController_1.updateCustomRole);
router.delete('/:id', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_DELETE), customRoleController_1.deleteCustomRole);
router.post('/assign', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_UPDATE), customRoleController_1.assignCustomRole);
exports.default = router;
//# sourceMappingURL=customRoleRoutes.js.map