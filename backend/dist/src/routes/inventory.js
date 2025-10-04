"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const inventoryController_1 = require("../controllers/inventoryController");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const permissions_1 = require("../middleware/permissions");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/alerts', (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_VIEW), [
    (0, express_validator_1.query)('storeId')
        .optional()
        .isString()
        .withMessage('Store ID must be a string'),
    (0, express_validator_1.query)('severity')
        .optional()
        .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
        .withMessage('Invalid severity level'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
], validation_1.validate, inventoryController_1.getInventoryAlerts);
router.post('/stock/update', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_UPDATE), [
    (0, express_validator_1.body)('productId')
        .optional()
        .isString()
        .withMessage('Product ID must be a string'),
    (0, express_validator_1.body)('variantId')
        .optional()
        .isString()
        .withMessage('Variant ID must be a string'),
    (0, express_validator_1.body)('stock')
        .isInt({ min: 0 })
        .withMessage('Stock must be a non-negative integer'),
    (0, express_validator_1.body)('reason')
        .optional()
        .isString()
        .isLength({ min: 1, max: 255 })
        .withMessage('Reason must be 1-255 characters')
], validation_1.validate, inventoryController_1.updateStock);
router.get('/stock/history/:productId/:variantId?', (0, permissions_1.requirePermission)(permissions_1.Permission.PRODUCT_VIEW), [
    (0, express_validator_1.param)('productId')
        .isString()
        .withMessage('Product ID is required'),
    (0, express_validator_1.param)('variantId')
        .optional()
        .isString()
        .withMessage('Variant ID must be a string'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
], validation_1.validate, inventoryController_1.getStockHistory);
router.post('/alerts/config', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.STORE_UPDATE), [
    (0, express_validator_1.body)('storeId')
        .isString()
        .withMessage('Store ID is required'),
    (0, express_validator_1.body)('lowStockThreshold')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Low stock threshold must be between 1 and 1000'),
    (0, express_validator_1.body)('criticalStockThreshold')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Critical stock threshold must be between 0 and 100'),
    (0, express_validator_1.body)('enableAlerts')
        .optional()
        .isBoolean()
        .withMessage('Enable alerts must be a boolean')
], validation_1.validate, inventoryController_1.setStockAlertsConfig);
exports.default = router;
//# sourceMappingURL=inventory.js.map