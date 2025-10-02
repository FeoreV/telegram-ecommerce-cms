"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const validation_1 = require("../middleware/validation");
const express_validator_1 = require("express-validator");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('role')
        .optional()
        .isIn(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER', 'all'])
        .withMessage('Invalid role filter'),
    (0, express_validator_1.query)('search')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be 1-100 characters'),
    (0, express_validator_1.query)('storeId')
        .optional()
        .isString()
        .withMessage('Store ID must be a string')
], validation_1.validate, userController_1.getUsers);
router.get('/statistics', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), userController_1.getRoleStatistics);
router.get('/:id', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required')
], validation_1.validate, userController_1.getUser);
router.put('/:id/role', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required'),
    (0, express_validator_1.body)('role')
        .isIn(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER'])
        .withMessage('Invalid role'),
    (0, express_validator_1.body)('storeAssignments')
        .optional()
        .isArray()
        .withMessage('Store assignments must be an array'),
    (0, express_validator_1.body)('storeAssignments.*.storeId')
        .optional()
        .isString()
        .withMessage('Store ID is required'),
    (0, express_validator_1.body)('storeAssignments.*.role')
        .optional()
        .isIn(['ADMIN', 'VENDOR'])
        .withMessage('Assignment role must be ADMIN or VENDOR')
], validation_1.validate, userController_1.updateUserRole);
router.patch('/:id/status', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required')
], validation_1.validate, userController_1.toggleUserStatus);
router.post('/assign-store', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.body)('userId')
        .isString()
        .withMessage('User ID is required'),
    (0, express_validator_1.body)('storeId')
        .isString()
        .withMessage('Store ID is required'),
    (0, express_validator_1.body)('role')
        .isIn(['ADMIN', 'VENDOR'])
        .withMessage('Role must be ADMIN or VENDOR')
], validation_1.validate, userController_1.assignUserToStore);
router.delete('/remove-store', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.body)('userId')
        .isString()
        .withMessage('User ID is required'),
    (0, express_validator_1.body)('storeId')
        .isString()
        .withMessage('Store ID is required'),
    (0, express_validator_1.body)('role')
        .isIn(['ADMIN', 'VENDOR'])
        .withMessage('Role must be ADMIN or VENDOR')
], validation_1.validate, userController_1.removeUserFromStore);
router.get('/:id/detailed', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required')
], validation_1.validate, userController_1.getUserDetailed);
router.get('/:id/activity', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required'),
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
], validation_1.validate, userController_1.getUserActivity);
router.post('/:id/ban', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required'),
    (0, express_validator_1.body)('reason')
        .optional()
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Reason must be 1-500 characters')
], validation_1.validate, userController_1.banUser);
router.post('/:id/unban', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required')
], validation_1.validate, userController_1.unbanUser);
router.delete('/:id', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_DELETE), [
    (0, express_validator_1.param)('id')
        .isString()
        .withMessage('User ID is required')
], validation_1.validate, userController_1.deleteUser);
router.post('/bulk-action', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.body)('action')
        .isIn(['ban', 'unban', 'changeRole', 'delete'])
        .withMessage('Invalid bulk action'),
    (0, express_validator_1.body)('userIds')
        .isArray({ min: 1 })
        .withMessage('User IDs array is required'),
    (0, express_validator_1.body)('userIds.*')
        .isString()
        .withMessage('Each user ID must be a string'),
    (0, express_validator_1.body)('data')
        .optional()
        .isObject()
        .withMessage('Data must be an object')
], validation_1.validate, userController_1.bulkUserActions);
exports.default = router;
//# sourceMappingURL=users.js.map