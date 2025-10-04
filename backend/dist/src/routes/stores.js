"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const storeController_1 = require("../controllers/storeController");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const validation_1 = require("../middleware/validation");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
router.get('/', storeController_1.getStores);
router.get('/my', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN, jwt_1.UserRole.VENDOR]), storeController_1.getUserStores);
router.get('/check-slug/:slug', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [(0, express_validator_1.param)('slug').isString().withMessage('Valid slug required')], validation_1.validate, storeController_1.checkSlugAvailability);
router.get('/check-slug', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.query)('slug').isString().withMessage('Valid slug required'),
    (0, express_validator_1.query)('excludeId').optional().isString(),
], validation_1.validate, storeController_1.checkSlugAvailability);
router.get('/:id', [(0, express_validator_1.param)('id').isString().withMessage('Valid store ID required')], validation_1.validate, auth_1.requireStoreAccess, storeController_1.getStore);
router.post('/', csrfProtection_1.csrfProtection, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Store name is required'),
    (0, express_validator_1.body)('slug')
        .notEmpty()
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Slug can only contain lowercase letters, numbers, and hyphens').customSanitizer((value) => value.toLowerCase()),
    (0, express_validator_1.body)('description').notEmpty().isString().withMessage('Description is required'),
    (0, express_validator_1.body)('currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be 3 characters')
        .customSanitizer((value) => (value ? value.toUpperCase() : value)),
    (0, express_validator_1.body)('contactInfo').optional().isObject(),
    (0, express_validator_1.body)('settings').optional().isObject(),
    (0, express_validator_1.body)('domain').optional().isString().trim(),
    (0, express_validator_1.body)('currency').custom((value) => {
        const allowed = ['USD', 'EUR', 'RUB', 'UAH'];
        if (value && !allowed.includes(value.toUpperCase())) {
            throw new Error(`Currency must be one of: ${allowed.join(', ')}`);
        }
        return true;
    })
], validation_1.validate, storeController_1.createStore);
router.put('/:id', csrfProtection_1.csrfProtection, [
    (0, express_validator_1.param)('id').isString().withMessage('Valid store ID required'),
    (0, express_validator_1.body)('name').optional().notEmpty().withMessage('Store name cannot be empty'),
    (0, express_validator_1.body)('slug')
        .optional()
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    (0, express_validator_1.body)('contactInfo').optional().isObject(),
    (0, express_validator_1.body)('settings').optional().isObject(),
    (0, express_validator_1.body)('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
], validation_1.validate, auth_1.requireStoreAccess, storeController_1.updateStore);
router.delete('/:id', csrfProtection_1.csrfProtection, [(0, express_validator_1.param)('id').isString().withMessage('Valid store ID required')], validation_1.validate, auth_1.requireStoreAccess, storeController_1.deleteStore);
router.post('/:id/admins', csrfProtection_1.csrfProtection, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid store ID required'),
    (0, express_validator_1.body)('userId').isString().withMessage('User ID is required'),
], validation_1.validate, auth_1.requireStoreAccess, storeController_1.addStoreAdmin);
router.delete('/:id/admins/:userId', csrfProtection_1.csrfProtection, (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('id').isString().withMessage('Valid store ID required'),
    (0, express_validator_1.param)('userId').isString().withMessage('Valid user ID required'),
], validation_1.validate, auth_1.requireStoreAccess, storeController_1.removeStoreAdmin);
exports.default = router;
//# sourceMappingURL=stores.js.map