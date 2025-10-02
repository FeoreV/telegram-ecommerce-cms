import { Router } from 'express';
import { body, query } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { requirePermission, Permission } from '../middleware/permissions';
import {
  upload,
  importProducts,
  exportProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  getBulkTemplate,
} from '../controllers/bulkController';

const router = Router();

// All bulk operations require authentication
router.use(authMiddleware);

// Get bulk operation template
router.get(
  '/template',
  [query('type').optional().isIn(['products']).withMessage('Invalid template type')],
  validate,
  getBulkTemplate
);

// Import products from CSV
router.post(
  '/import/products',
  requirePermission(Permission.PRODUCT_CREATE),
  upload.single('csv'),
  [
    body('storeId').isString().withMessage('Store ID is required'),
    body('dryRun').optional().isBoolean().withMessage('Dry run must be boolean'),
  ],
  validate,
  importProducts
);

// Export products to CSV/JSON
router.get(
  '/export/products',
  requirePermission(Permission.ANALYTICS_EXPORT),
  [
    query('storeId').isString().withMessage('Store ID is required'),
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  ],
  validate,
  exportProducts
);

// Bulk update products
router.patch(
  '/update/products',
  requirePermission(Permission.PRODUCT_UPDATE),
  [
    body('storeId').isString().withMessage('Store ID is required'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isString().withMessage('Each product ID must be a string'),
    body('updates').isObject().withMessage('Updates object is required'),
  ],
  validate,
  bulkUpdateProducts
);

// Bulk delete products
router.delete(
  '/delete/products',
  requirePermission(Permission.PRODUCT_DELETE),
  [
    body('storeId').isString().withMessage('Store ID is required'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isString().withMessage('Each product ID must be a string'),
  ],
  validate,
  bulkDeleteProducts
);

export default router;
