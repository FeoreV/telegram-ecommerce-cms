import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { UserRole } from '../utils/jwt';
import { requireRole, requireStoreAccess } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  getStores,
  getStore,
  createStore,
  updateStore,
  deleteStore,
  addStoreAdmin,
  removeStoreAdmin,
  checkSlugAvailability,
  getUserStores,
} from '../controllers/storeController';

const router = Router();

// Get all stores (with role-based filtering)
router.get('/', getStores);

// Get user's own stores (for bot management)
router.get(
  '/my',
  requireRole([UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR]),
  getUserStores
);

// Check slug availability
router.get(
  '/check-slug/:slug',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [param('slug').isString().withMessage('Valid slug required')],
  validate,
  checkSlugAvailability
);

// Check slug availability (query-based, to support frontend calling style)
router.get(
  '/check-slug',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    query('slug').isString().withMessage('Valid slug required'),
    query('excludeId').optional().isString(),
  ],
  validate,
  checkSlugAvailability
);

// Get single store
router.get(
  '/:id',
  [param('id').isString().withMessage('Valid store ID required')],
  validate,
  requireStoreAccess,
  getStore
);

// Create store
router.post(
  '/',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    body('name').notEmpty().withMessage('Store name is required'),
    body('slug')
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens').customSanitizer((value) => value.toLowerCase()),
    body('description').notEmpty().isString().withMessage('Description is required'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be 3 characters')
      .customSanitizer((value) => (value ? value.toUpperCase() : value)),
    body('contactInfo').optional().isObject(),
    body('settings').optional().isObject(),
    body('domain').optional().isString().trim(),
    body('currency').custom((value) => {
      const allowed = ['USD', 'EUR', 'RUB', 'UAH'];
      if (value && !allowed.includes(value.toUpperCase())) {
        throw new Error(`Currency must be one of: ${allowed.join(', ')}`);
      }
      return true;
    })
  ],
  validate,
  createStore
);

// Update store
router.put(
  '/:id',
  [
    param('id').isString().withMessage('Valid store ID required'),
    body('name').optional().notEmpty().withMessage('Store name cannot be empty'),
    body('slug')
      .optional()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
    body('description').optional().isString(),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('contactInfo').optional().isObject(),
    body('settings').optional().isObject(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  ],
  validate,
  requireStoreAccess,
  updateStore
);

// Delete store
router.delete(
  '/:id',
  [param('id').isString().withMessage('Valid store ID required')],
  validate,
  requireStoreAccess,
  deleteStore
);

// Add store admin
router.post(
  '/:id/admins',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid store ID required'),
    body('userId').isString().withMessage('User ID is required'),
  ],
  validate,
  requireStoreAccess,
  addStoreAdmin
);

// Remove store admin
router.delete(
  '/:id/admins/:userId',
  requireRole([UserRole.OWNER, UserRole.ADMIN]),
  [
    param('id').isString().withMessage('Valid store ID required'),
    param('userId').isString().withMessage('Valid user ID required'),
  ],
  validate,
  requireStoreAccess,
  removeStoreAdmin
);

export default router;
