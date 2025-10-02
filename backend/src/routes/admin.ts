import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { requirePermission, Permission } from '../middleware/permissions';
import {
  getDashboardStats,
  getAdminLogs,
  getUsers,
  updateUserStatus,
  getRevenueStats,
  getTopProducts,
  getTopStores,
  getOrderStatusStats,
  getComparisonData,
  getKPIMetrics,
  getCustomerAnalytics,
  getInventoryAnalytics,
} from '../controllers/adminController';

const router = Router();

// Dashboard statistics - enhanced with permissions
router.get(
  '/dashboard',
  requirePermission(Permission.ANALYTICS_VIEW),
  [query('timeRange').optional().isIn(['24h', '7d', '30d'])],
  validate,
  getDashboardStats
);

// Admin action logs - system logs access
router.get(
  '/logs',
  requirePermission(Permission.SYSTEM_LOGS),
  getAdminLogs
);

// User management - view users
router.get(
  '/users',
  requirePermission(Permission.USER_VIEW),
  getUsers
);

// Update user status - user management
router.patch(
  '/users/:userId/status',
  requirePermission(Permission.USER_UPDATE),
  [
    param('userId').isString().withMessage('Valid user ID required'),
    body('isActive').isBoolean().withMessage('isActive must be boolean'),
  ],
  validate,
  updateUserStatus
);

// Revenue statistics - analytics access
router.get(
  '/revenue',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period').optional().isIn(['daily', 'weekly', 'day', 'week', 'month', 'quarter', 'year', 'today']),
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  getRevenueStats
);

// Top products by revenue
router.get(
  '/top-products',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    query('storeId').optional().isString(),
  ],
  validate,
  getTopProducts
);

// Top stores by revenue (owners only)
router.get(
  '/top-stores',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  ],
  validate,
  getTopStores
);

// Order status statistics
router.get(
  '/order-status-stats',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period').optional().isIn(['today', 'week', 'month', 'quarter']),
    query('storeId').optional().isString(),
  ],
  validate,
  getOrderStatusStats
);

// Comparison data with previous period
router.get(
  '/comparison',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period').optional().isIn(['today', 'week', 'month', 'quarter']),
    query('storeId').optional().isString(),
  ],
  validate,
  getComparisonData
);

// KPI metrics
router.get(
  '/kpi',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    query('storeId').optional().isString(),
  ],
  validate,
  getKPIMetrics
);

// Customer analytics
router.get(
  '/customer-analytics',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    query('storeId').optional().isString(),
  ],
  validate,
  getCustomerAnalytics
);

// Inventory analytics
router.get(
  '/inventory-analytics',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('storeId').optional().isString(),
    query('lowStockThreshold').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getInventoryAnalytics
);

export default router;
