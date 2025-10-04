"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const adminController_1 = require("../controllers/adminController");
const csrfProtection_1 = require("../middleware/csrfProtection");
const permissions_1 = require("../middleware/permissions");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.get('/dashboard', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [(0, express_validator_1.query)('timeRange').optional().isIn(['24h', '7d', '30d'])], validation_1.validate, adminController_1.getDashboardStats);
router.get('/logs', (0, permissions_1.requirePermission)(permissions_1.Permission.SYSTEM_LOGS), adminController_1.getAdminLogs);
router.get('/users', (0, permissions_1.requirePermission)(permissions_1.Permission.USER_VIEW), adminController_1.getUsers);
router.patch('/users/:userId/status', csrfProtection_1.csrfProtection, (0, permissions_1.requirePermission)(permissions_1.Permission.USER_UPDATE), [
    (0, express_validator_1.param)('userId').isString().withMessage('Valid user ID required'),
    (0, express_validator_1.body)('isActive').isBoolean().withMessage('isActive must be boolean'),
], validation_1.validate, adminController_1.updateUserStatus);
router.get('/revenue', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period').optional().isIn(['daily', 'weekly', 'day', 'week', 'month', 'quarter', 'year', 'today']),
    (0, express_validator_1.query)('days').optional().isInt({ min: 1, max: 365 }),
], validation_1.validate, adminController_1.getRevenueStats);
router.get('/top-products', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 50 }),
    (0, express_validator_1.query)('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    (0, express_validator_1.query)('storeId').optional().isString(),
], validation_1.validate, adminController_1.getTopProducts);
router.get('/top-stores', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 50 }),
    (0, express_validator_1.query)('period').optional().isIn(['week', 'month', 'quarter', 'year']),
], validation_1.validate, adminController_1.getTopStores);
router.get('/order-status-stats', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period').optional().isIn(['today', 'week', 'month', 'quarter']),
    (0, express_validator_1.query)('storeId').optional().isString(),
], validation_1.validate, adminController_1.getOrderStatusStats);
router.get('/comparison', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period').optional().isIn(['today', 'week', 'month', 'quarter']),
    (0, express_validator_1.query)('storeId').optional().isString(),
], validation_1.validate, adminController_1.getComparisonData);
router.get('/kpi', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    (0, express_validator_1.query)('storeId').optional().isString(),
], validation_1.validate, adminController_1.getKPIMetrics);
router.get('/customer-analytics', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    (0, express_validator_1.query)('storeId').optional().isString(),
], validation_1.validate, adminController_1.getCustomerAnalytics);
router.get('/inventory-analytics', (0, permissions_1.requirePermission)(permissions_1.Permission.ANALYTICS_VIEW), [
    (0, express_validator_1.query)('storeId').optional().isString(),
    (0, express_validator_1.query)('lowStockThreshold').optional().isInt({ min: 1, max: 100 }),
], validation_1.validate, adminController_1.getInventoryAnalytics);
exports.default = router;
//# sourceMappingURL=admin.js.map