import { Router } from 'express';
import { body, param } from 'express-validator';
import {
    bulkUpdateProducts,
    createProduct,
    createProductVariant,
    deleteProduct,
    deleteProductVariant,
    getCategories,
    getProduct,
    getProductVariants,
    getProducts,
    updateProduct,
    updateProductVariant,
} from '../controllers/productController';
import { requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { validate } from '../middleware/validation';
import { UserRole } from '../utils/jwt';

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

// Create product (SECURITY: CSRF protected)
router.post(
  '/',
  csrfProtection(),
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

// Update product (SECURITY: CSRF protected)
router.put(
  '/:id',
  csrfProtection(),
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
    body('variants').optional().isArray(),
  ],
  validate,
  updateProduct
);

// Delete product (SECURITY: CSRF protected)
router.delete(
  '/:id',
  csrfProtection(),
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [param('id').isString().withMessage('Valid product ID required')],
  validate,
  deleteProduct
);

// Bulk update products (SECURITY: CSRF protected)
router.patch(
  '/bulk',
  csrfProtection(),
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

// ===============================================
// PRODUCT VARIANTS ROUTES
// ===============================================

// Get all variants for a product
router.get(
  '/:productId/variants',
  [param('productId').isString().withMessage('Valid product ID required')],
  validate,
  getProductVariants
);

// Create a new variant for a product (SECURITY: CSRF protected)
router.post(
  '/:productId/variants',
  csrfProtection(),
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    param('productId').isString().withMessage('Valid product ID required'),
    body('name').notEmpty().withMessage('Variant name is required'),
    body('value').notEmpty().withMessage('Variant value is required'),
    body('price').optional().isNumeric().withMessage('Valid price required'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    body('sku').optional().isString(),
  ],
  validate,
  createProductVariant
);

// Update a variant (SECURITY: CSRF protected)
router.put(
  '/:productId/variants/:variantId',
  csrfProtection(),
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    param('productId').isString().withMessage('Valid product ID required'),
    param('variantId').isString().withMessage('Valid variant ID required'),
    body('name').optional().notEmpty().withMessage('Variant name cannot be empty'),
    body('value').optional().notEmpty().withMessage('Variant value cannot be empty'),
    body('price').optional().isNumeric().withMessage('Valid price required'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    body('sku').optional().isString(),
  ],
  validate,
  updateProductVariant
);

// Delete a variant (SECURITY: CSRF protected)
router.delete(
  '/:productId/variants/:variantId',
  csrfProtection(),
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  [
    param('productId').isString().withMessage('Valid product ID required'),
    param('variantId').isString().withMessage('Valid variant ID required'),
  ],
  validate,
  deleteProductVariant
);

export default router;
