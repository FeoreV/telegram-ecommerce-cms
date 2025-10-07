import { Router } from 'express';
import {
    getStoreEmployees,
    inviteEmployee,
    removeEmployee,
    updateEmployeeRole
} from '../controllers/employeeController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';
import { requireStoreAccess } from '../middleware/rbacMiddleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

/**
 * @route GET /api/employees/stores/:storeId
 * @desc Получить список сотрудников магазина
 * @access ADMIN, OWNER
 */
router.get(
  '/stores/:storeId',
  requirePermission(Permission.USER_VIEW),
  requireStoreAccess('read'),
  getStoreEmployees
);

/**
 * @route POST /api/employees/invite
 * @desc Пригласить нового сотрудника
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.post(
  '/invite',
  csrfProtection(),
  requirePermission(Permission.USER_CREATE),
  inviteEmployee
);

/**
 * @route PUT /api/employees/role
 * @desc Обновить роль сотрудника
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.put(
  '/role',
  csrfProtection(),
  requirePermission(Permission.USER_UPDATE),
  updateEmployeeRole
);

/**
 * @route DELETE /api/employees/stores/:storeId/users/:userId
 * @desc Удалить сотрудника из магазина
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.delete(
  '/stores/:storeId/users/:userId',
  csrfProtection(),
  requirePermission(Permission.USER_DELETE),
  requireStoreAccess('write'),
  removeEmployee
);

export default router;
