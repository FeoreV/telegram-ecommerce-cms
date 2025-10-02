"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employeeController_1 = require("../controllers/employeeController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const permissions_2 = require("../middleware/permissions");
const rbacMiddleware_1 = require("../middleware/rbacMiddleware");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/stores/:storeId', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_VIEW), (0, rbacMiddleware_1.requireStoreAccess)('read'), employeeController_1.getStoreEmployees);
router.post('/invite', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_CREATE), employeeController_1.inviteEmployee);
router.put('/role', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_UPDATE), employeeController_1.updateEmployeeRole);
router.delete('/stores/:storeId/users/:userId', (0, permissions_1.requirePermission)(permissions_2.Permission.USER_DELETE), (0, rbacMiddleware_1.requireStoreAccess)('write'), employeeController_1.removeEmployee);
exports.default = router;
//# sourceMappingURL=employeeRoutes.js.map