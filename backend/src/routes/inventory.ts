import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
    getInventoryAlerts,
    getStockHistory,
    setStockAlertsConfig,
    updateStock
} from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';
import { validate } from '../middleware/validation';

const router = Router();

// All inventory routes require authentication
router.use(authMiddleware);

// Get inventory alerts
router.get(
  '/alerts',
  requirePermission(Permission.PRODUCT_VIEW),
  [
    query('storeId')
      .optional()
      .isString()
      .withMessage('Store ID must be a string'),
    query('severity')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('Invalid severity level'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validate,
  getInventoryAlerts
);

// Update stock levels (SECURITY: CSRF protected)
router.post(
  '/stock/update',
  csrfProtection(),
  requirePermission(Permission.PRODUCT_UPDATE),
  [
    body('productId')
      .optional()
      .isString()
      .withMessage('Product ID must be a string'),
    body('variantId')
      .optional()
      .isString()
      .withMessage('Variant ID must be a string'),
    body('stock')
      .isInt({ min: 0 })
      .withMessage('Stock must be a non-negative integer'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Reason must be 1-255 characters')
  ],
  validate,
  updateStock
);

// Get stock history for product/variant
router.get(
  '/stock/history/:productId/:variantId?',
  requirePermission(Permission.PRODUCT_VIEW),
  [
    param('productId')
      .isString()
      .withMessage('Product ID is required'),
    param('variantId')
      .optional()
      .isString()
      .withMessage('Variant ID must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
  ],
  validate,
  getStockHistory
);

// Set stock alerts configuration for store (SECURITY: CSRF protected)
router.post(
  '/alerts/config',
  csrfProtection(),
  requirePermission(Permission.STORE_UPDATE),
  [
    body('storeId')
      .isString()
      .withMessage('Store ID is required'),
    body('lowStockThreshold')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Low stock threshold must be between 1 and 1000'),
    body('criticalStockThreshold')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Critical stock threshold must be between 0 and 100'),
    body('enableAlerts')
      .optional()
      .isBoolean()
      .withMessage('Enable alerts must be a boolean')
  ],
  validate,
  setStockAlertsConfig
);

export default router;
