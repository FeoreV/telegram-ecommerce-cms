import express from 'express';
import { 
  getUserBots,
  createBot,
  removeBot,
  updateBotSettings,
  getBotStats,
  getBotSettings,
  getGlobalBotStats,
  restartBot,
  enableWebhook,
  disableWebhook,
  getWebhookStatus,
  getGlobalWebhookStats
} from '../controllers/botController.js';
import { authMiddleware } from '../middleware/auth.js';

// Simple role-based middleware
const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    next();
  };
};

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route GET /api/bots
 * @desc Get all bots for current user's stores
 * @access Private (OWNER, ADMIN)
 */
router.get('/', requireRole(['OWNER', 'ADMIN']), getUserBots);

/**
 * @route POST /api/bots
 * @desc Create new bot for store
 * @access Private (OWNER, ADMIN)
 */
router.post('/', requireRole(['OWNER', 'ADMIN']), createBot);

/**
 * @route DELETE /api/bots/:storeId
 * @desc Remove bot from store
 * @access Private (OWNER, ADMIN)
 */
router.delete('/:storeId', requireRole(['OWNER', 'ADMIN']), removeBot);

/**
 * @route PUT /api/bots/:storeId/settings
 * @desc Update bot settings for store
 * @access Private (OWNER, ADMIN)
 */
router.put('/:storeId/settings', requireRole(['OWNER', 'ADMIN']), updateBotSettings);

/**
 * @route GET /api/bots/:storeId/stats
 * @desc Get bot statistics for store
 * @access Private (OWNER, ADMIN)
 */
router.get('/:storeId/stats', requireRole(['OWNER', 'ADMIN']), getBotStats);

/**
 * @route GET /api/bots/:storeId/settings
 * @desc Get bot settings for store
 * @access Private (OWNER, ADMIN)
 */
router.get('/:storeId/settings', requireRole(['OWNER', 'ADMIN']), getBotSettings);

/**
 * @route POST /api/bots/:storeId/restart
 * @desc Restart bot for store
 * @access Private (OWNER, ADMIN)
 */
router.post('/:storeId/restart', requireRole(['OWNER', 'ADMIN']), restartBot);

/**
 * @route GET /api/bots/global/stats
 * @desc Get global bot factory statistics
 * @access Private (OWNER only)
 */
router.get('/global/stats', requireRole(['OWNER']), getGlobalBotStats);

/**
 * @route POST /api/bots/:storeId/webhook/enable
 * @desc Enable webhook for bot
 * @access Private (OWNER, ADMIN)
 */
router.post('/:storeId/webhook/enable', requireRole(['OWNER', 'ADMIN']), enableWebhook);

/**
 * @route POST /api/bots/:storeId/webhook/disable
 * @desc Disable webhook for bot
 * @access Private (OWNER, ADMIN)
 */
router.post('/:storeId/webhook/disable', requireRole(['OWNER', 'ADMIN']), disableWebhook);

/**
 * @route GET /api/bots/:storeId/webhook/status
 * @desc Get webhook status for store
 * @access Private (OWNER, ADMIN)
 */
router.get('/:storeId/webhook/status', requireRole(['OWNER', 'ADMIN']), getWebhookStatus);

/**
 * @route GET /api/bots/webhooks/stats
 * @desc Get global webhook statistics
 * @access Private (OWNER only)
 */
router.get('/webhooks/stats', requireRole(['OWNER']), getGlobalWebhookStats);

export default router;
