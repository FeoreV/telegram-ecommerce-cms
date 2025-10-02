import { Router } from 'express';
import { 
  getStoreEmployees,
  inviteEmployee,
  updateEmployeeRole,
  removeEmployee
} from '../controllers/employeeController';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { Permission } from '../middleware/permissions';
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
 */
router.post(
  '/invite',
  requirePermission(Permission.USER_CREATE),
  inviteEmployee
);

/**
 * @route PUT /api/employees/role
 * @desc Обновить роль сотрудника
 * @access ADMIN, OWNER
 */
router.put(
  '/role',
  requirePermission(Permission.USER_UPDATE),
  updateEmployeeRole
);

/**
 * @route DELETE /api/employees/stores/:storeId/users/:userId
 * @desc Удалить сотрудника из магазина
 * @access ADMIN, OWNER
 */
router.delete(
  '/stores/:storeId/users/:userId',
  requirePermission(Permission.USER_DELETE),
  requireStoreAccess('write'),
  removeEmployee
);

export default router;
