import { Router } from 'express';
import { handleInvitationAcceptance } from '../controllers/invitationAcceptanceController';
import {
    acceptInvitation,
    getEmployeeActivity,
    getInvitationInfo,
    rejectInvitation
} from '../controllers/invitationController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';

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
 * @security CSRF protected (uses invitation token)
 */
router.post('/accept', csrfProtection(), acceptInvitation);

/**
 * @route POST /api/invitations/reject
 * @desc Отклонить приглашение
 * @access Public
 * @security CSRF protected (uses invitation token)
 */
router.post('/reject', csrfProtection(), rejectInvitation);

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
