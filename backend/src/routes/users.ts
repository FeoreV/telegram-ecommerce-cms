import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
    assignUserToStore,
    banUser,
    bulkUserActions,
    deleteUser,
    getRoleStatistics,
    getUser,
    getUserActivity,
    getUserDetailed,
    getUsers,
    removeUserFromStore,
    toggleUserStatus,
    unbanUser,
    updateUserRole
} from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';
import { validate } from '../middleware/validation';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

// Get all users with filtering
router.get(
  '/',
  requirePermission(Permission.USER_VIEW),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('role')
      .optional()
      .isIn(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER', 'all'])
      .withMessage('Invalid role filter'),
    query('search')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be 1-100 characters'),
    query('storeId')
      .optional()
      .isString()
      .withMessage('Store ID must be a string')
  ],
  validate,
  getUsers
);

// Get role statistics
router.get(
  '/statistics',
  requirePermission(Permission.USER_VIEW),
  getRoleStatistics
);

// Get user by ID
router.get(
  '/:id',
  requirePermission(Permission.USER_VIEW),
  [
    param('id')
      .isString()
      .withMessage('User ID is required')
  ],
  validate,
  getUser
);

// Update user role (OWNER only)
router.put(
  '/:id/role',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    param('id')
      .isString()
      .withMessage('User ID is required'),
    body('role')
      .isIn(['OWNER', 'ADMIN', 'VENDOR', 'CUSTOMER'])
      .withMessage('Invalid role'),
    body('storeAssignments')
      .optional()
      .isArray()
      .withMessage('Store assignments must be an array'),
    body('storeAssignments.*.storeId')
      .optional()
      .isString()
      .withMessage('Store ID is required'),
    body('storeAssignments.*.role')
      .optional()
      .isIn(['ADMIN', 'VENDOR'])
      .withMessage('Assignment role must be ADMIN or VENDOR')
  ],
  validate,
  updateUserRole
);

// Toggle user active status
router.patch(
  '/:id/status',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    param('id')
      .isString()
      .withMessage('User ID is required')
  ],
  validate,
  toggleUserStatus
);

// Assign user to store (SECURITY: CSRF protected)
router.post(
  '/assign-store',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    body('userId')
      .isString()
      .withMessage('User ID is required'),
    body('storeId')
      .isString()
      .withMessage('Store ID is required'),
    body('role')
      .isIn(['ADMIN', 'VENDOR'])
      .withMessage('Role must be ADMIN or VENDOR')
  ],
  validate,
  assignUserToStore
);

// Remove user from store (SECURITY: CSRF protected)
router.delete(
  '/remove-store',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    body('userId')
      .isString()
      .withMessage('User ID is required'),
    body('storeId')
      .isString()
      .withMessage('Store ID is required'),
    body('role')
      .isIn(['ADMIN', 'VENDOR'])
      .withMessage('Role must be ADMIN or VENDOR')
  ],
  validate,
  removeUserFromStore
);

// Get user detailed info (must be before /:id route)
router.get(
  '/:id/detailed',
  requirePermission(Permission.USER_VIEW),
  [
    param('id')
      .isString()
      .withMessage('User ID is required')
  ],
  validate,
  getUserDetailed
);

// Get user activity
router.get(
  '/:id/activity',
  requirePermission(Permission.USER_VIEW),
  [
    param('id')
      .isString()
      .withMessage('User ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validate,
  getUserActivity
);

// Ban user (SECURITY: CSRF protected)
router.post(
  '/:id/ban',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    param('id')
      .isString()
      .withMessage('User ID is required'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be 1-500 characters')
  ],
  validate,
  banUser
);

// Unban user (SECURITY: CSRF protected)
router.post(
  '/:id/unban',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    param('id')
      .isString()
      .withMessage('User ID is required')
  ],
  validate,
  unbanUser
);

// Delete user (SECURITY: CSRF protected)
router.delete(
  '/:id',
  csrfProtection(),
  requirePermission(Permission.USER_DELETE),
  [
    param('id')
      .isString()
      .withMessage('User ID is required')
  ],
  validate,
  deleteUser
);

// Bulk actions on users (SECURITY: CSRF protected)
router.post(
  '/bulk-action',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  [
    body('action')
      .isIn(['ban', 'unban', 'changeRole', 'delete'])
      .withMessage('Invalid bulk action'),
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs array is required'),
    body('userIds.*')
      .isString()
      .withMessage('Each user ID must be a string'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  validate,
  bulkUserActions
);

export default router;
