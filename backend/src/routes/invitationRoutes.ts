import { Router } from 'express';
import { 
  acceptInvitation,
  rejectInvitation,
  getInvitationInfo,
  getEmployeeActivity
} from '../controllers/invitationController';
import { handleInvitationAcceptance } from '../controllers/invitationAcceptanceController';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { Permission } from '../middleware/permissions';

const router = Router();

/**
 * @route GET /api/invitations/accept/:token
 * @desc Веб-интерфейс для принятия приглашения
 * @access Public
 */
router.get('/accept/:token', handleInvitationAcceptance);

/**
 * @route GET /api/invitations/:token
 * @desc Получить информацию о приглашении
 * @access Public
 */
router.get('/:token', getInvitationInfo);

/**
 * @route POST /api/invitations/accept
 * @desc Принять приглашение
 * @access Public
 */
router.post('/accept', acceptInvitation);

/**
 * @route POST /api/invitations/reject
 * @desc Отклонить приглашение
 * @access Public
 */
router.post('/reject', rejectInvitation);

// Защищенные маршруты (требуют аутентификации)
router.use(authMiddleware);

/**
 * @route GET /api/invitations/activity/:storeId
 * @desc Получить активность сотрудников
 * @access ADMIN, OWNER
 */
router.get(
  '/activity/:storeId',
  requirePermission(Permission.ANALYTICS_VIEW),
  getEmployeeActivity
);

export default router;
