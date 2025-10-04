import { Router } from 'express';
import {
    assignCustomRole,
    createCustomRole,
    deleteCustomRole,
    getAvailablePermissions,
    getCustomRole,
    getCustomRoles,
    updateCustomRole
} from '../controllers/customRoleController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

/**
 * @route GET /api/custom-roles/permissions
 * @desc Получить доступные разрешения
 * @access ADMIN, OWNER
 */
router.get(
  '/permissions',
  requirePermission(Permission.USER_VIEW),
  getAvailablePermissions
);

/**
 * @route POST /api/custom-roles
 * @desc Создать кастомную роль
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.post(
  '/',
  csrfProtection,
  requirePermission(Permission.USER_CREATE),
  createCustomRole
);

/**
 * @route GET /api/custom-roles
 * @desc Получить список кастомных ролей
 * @access ADMIN, OWNER
 */
router.get(
  '/',
  requirePermission(Permission.USER_VIEW),
  getCustomRoles
);

/**
 * @route GET /api/custom-roles/:id
 * @desc Получить кастомную роль по ID
 * @access ADMIN, OWNER
 */
router.get(
  '/:id',
  requirePermission(Permission.USER_VIEW),
  getCustomRole
);

/**
 * @route PUT /api/custom-roles/:id
 * @desc Обновить кастомную роль
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.put(
  '/:id',
  csrfProtection,
  requirePermission(Permission.USER_UPDATE),
  updateCustomRole
);

/**
 * @route DELETE /api/custom-roles/:id
 * @desc Удалить кастомную роль
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.delete(
  '/:id',
  csrfProtection,
  requirePermission(Permission.USER_DELETE),
  deleteCustomRole
);

/**
 * @route POST /api/custom-roles/assign
 * @desc Назначить кастомную роль пользователю
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.post(
  '/assign',
  csrfProtection,
  requirePermission(Permission.USER_UPDATE),
  assignCustomRole
);

export default router;
