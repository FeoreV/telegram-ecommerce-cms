import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, Permission } from '../middleware/permissions';
import { validate } from '../middleware/validation';
import { query } from 'express-validator';
import {
  getDashboardAnalytics,
  getStoreComparison,
  getRevenueTrends,
  getCustomerAnalytics
} from '../controllers/analyticsController';

const router = Router();

// All analytics routes require authentication
router.use(authMiddleware);

// Get dashboard analytics
router.get(
  '/dashboard',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period')
      .optional()
      .isIn(['1d', '7d', '30d', '90d'])
      .withMessage('Period must be one of: 1d, 7d, 30d, 90d'),
    query('storeId')
      .optional()
      .isString()
      .withMessage('Store ID must be a string'),
    query('timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a valid timezone string')
  ],
  validate,
  getDashboardAnalytics
);

// Get store comparison (OWNER only)
router.get(
  '/stores/comparison',
  requirePermission(Permission.STORE_MANAGE),
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Period must be one of: 7d, 30d, 90d, 1y')
  ],
  validate,
  getStoreComparison
);

// Get revenue trends
router.get(
  '/revenue/trends',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Period must be one of: 7d, 30d, 90d, 1y'),
    query('storeId')
      .optional()
      .isString()
      .withMessage('Store ID must be a string'),
    query('granularity')
      .optional()
      .isIn(['hourly', 'daily', 'weekly', 'monthly'])
      .withMessage('Granularity must be one of: hourly, daily, weekly, monthly')
  ],
  validate,
  getRevenueTrends
);

// Get customer analytics
router.get(
  '/customers',
  requirePermission(Permission.ANALYTICS_VIEW),
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Period must be one of: 7d, 30d, 90d, 1y'),
    query('storeId')
      .optional()
      .isString()
      .withMessage('Store ID must be a string')
  ],
  validate,
  getCustomerAnalytics
);

export default router;
