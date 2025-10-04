import { Router } from 'express';
import {
    createInviteLink,
    deleteInviteLink,
    getInviteLinkInfo,
    getInviteLinks,
    updateInviteLink,
    useInviteLink
} from '../controllers/inviteLinkController';
import { handleInviteLinkPage } from '../controllers/inviteLinkWebController';
import { authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { Permission, requirePermission } from '../middleware/permissions';

const router = Router();

/**
 * @route GET /api/invite-links/page/:token
 * @desc Веб-страница для принятия инвайт ссылки
 * @access Public
 */
router.get('/page/:token', handleInviteLinkPage);

/**
 * @route GET /api/invite-links/info/:token
 * @desc Получить информацию об инвайт ссылке
 * @access Public
 */
router.get('/info/:token', getInviteLinkInfo);

/**
 * @route POST /api/invite-links/use
 * @desc Использовать инвайт ссылку для регистрации
 * @access Public
 * @security CSRF protected
 */
router.post('/use', csrfProtection, useInviteLink);

// Защищенные маршруты (требуют аутентификации)
router.use(authMiddleware);

/**
 * @route POST /api/invite-links
 * @desc Создать инвайт ссылку
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.post(
  '/',
  csrfProtection,
  requirePermission(Permission.USER_CREATE),
  createInviteLink
);

/**
 * @route GET /api/invite-links
 * @desc Получить список инвайт ссылок
 * @access ADMIN, OWNER
 */
router.get(
  '/',
  requirePermission(Permission.USER_VIEW),
  getInviteLinks
);

/**
 * @route PUT /api/invite-links/:id
 * @desc Обновить инвайт ссылку
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.put(
  '/:id',
  csrfProtection,
  requirePermission(Permission.USER_UPDATE),
  updateInviteLink
);

/**
 * @route DELETE /api/invite-links/:id
 * @desc Удалить инвайт ссылку
 * @access ADMIN, OWNER
 * @security CSRF protected
 */
router.delete(
  '/:id',
  csrfProtection,
  requirePermission(Permission.USER_DELETE),
  deleteInviteLink
);

export default router;
