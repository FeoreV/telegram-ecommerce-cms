"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const validation_1 = require("../middleware/validation");
const express_validator_1 = require("express-validator");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/dashboard', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period')
        .optional()
        .isIn(['1d', '7d', '30d', '90d'])
        .withMessage('Period must be one of: 1d, 7d, 30d, 90d'),
    (0, express_validator_1.query)('storeId')
        .optional()
        .isString()
        .withMessage('Store ID must be a string'),
    (0, express_validator_1.query)('timezone')
        .optional()
        .isString()
        .withMessage('Timezone must be a valid timezone string')
], validation_1.validate, analyticsController_1.getDashboardAnalytics);
router.get('/stores/comparison', (0, permissions_1.requirePermission)(permissions_1.Permission.STORE_MANAGE), [
    (0, express_validator_1.query)('period')
        .optional()
        .isIn(['7d', '30d', '90d', '1y'])
        .withMessage('Period must be one of: 7d, 30d, 90d, 1y')
], validation_1.validate, analyticsController_1.getStoreComparison);
router.get('/revenue/trends', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period')
        .optional()
        .isIn(['7d', '30d', '90d', '1y'])
        .withMessage('Period must be one of: 7d, 30d, 90d, 1y'),
    (0, express_validator_1.query)('storeId')
        .optional()
        .isString()
        .withMessage('Store ID must be a string'),
    (0, express_validator_1.query)('granularity')
        .optional()
        .isIn(['hourly', 'daily', 'weekly', 'monthly'])
        .withMessage('Granularity must be one of: hourly, daily, weekly, monthly')
], validation_1.validate, analyticsController_1.getRevenueTrends);
router.get('/customers', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period')
        .optional()
        .isIn(['7d', '30d', '90d', '1y'])
        .withMessage('Period must be one of: 7d, 30d, 90d, 1y'),
    (0, express_validator_1.query)('storeId')
        .optional()
        .isString()
        .withMessage('Store ID must be a string')
], validation_1.validate, analyticsController_1.getCustomerAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.js.map