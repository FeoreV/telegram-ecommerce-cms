import { Router } from 'express';
import { body, param } from 'express-validator';
import { UserRole } from '../utils/jwt';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  getCategories,
} from '../controllers/productController';

const router = Router();

// Get categories (must be before /:id route)
router.get('/categories', getCategories);

// Get all products (with filtering)
router.get('/', getProducts);

// Get single product
router.get(
  '/:id',
  [param('id').isString().withMessage('Valid product ID required')],
  validate,
  getProduct
);

// Create product
router.post(
  '/',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isNumeric().withMessage('Valid price is required'),
    body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    body('storeId').isString().withMessage('Store ID is required'),
    body('sku').optional().isString(),
    body('description').optional().isString(),
    body('images').optional().isArray(),
    body('categoryId').optional().isString(),
    body('variants').optional().isArray(),
  ],
  validate,
  createProduct
);

// Update product
router.put(
  '/:id',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    param('id').isString().withMessage('Valid product ID required'),
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('price').optional().isNumeric().withMessage('Valid price required'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    body('sku').optional().isString(),
    body('description').optional().isString(),
    body('images').optional().isArray(),
    body('categoryId').optional().isString(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  updateProduct
);

// Delete product
router.delete(
  '/:id',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [param('id').isString().withMessage('Valid product ID required')],
  validate,
  deleteProduct
);

// Bulk update products
router.patch(
  '/bulk',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('updates').isObject().withMessage('Updates object is required'),
    body('updates.isActive').optional().isBoolean(),
    body('updates.stock').optional().isInt({ min: 0 }),
    body('updates.price').optional().isNumeric(),
  ],
  validate,
  bulkUpdateProducts
);

export default router;
