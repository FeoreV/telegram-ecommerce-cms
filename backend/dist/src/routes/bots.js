"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const botController_js_1 = require("../controllers/botController.js");
const auth_js_1 = require("../middleware/auth.js");
const csrfProtection_js_1 = require("../middleware/csrfProtection.js");
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        next();
    };
};
const router = express_1.default.Router();
router.use(auth_js_1.authMiddleware);
router.get('/', requireRole(['OWNER', 'ADMIN']), botController_js_1.getUserBots);
router.post('/', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.createBot);
router.delete('/:storeId', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.removeBot);
router.put('/:storeId/settings', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.updateBotSettings);
router.get('/:storeId/stats', requireRole(['OWNER', 'ADMIN']), botController_js_1.getBotStats);
router.get('/:storeId/settings', requireRole(['OWNER', 'ADMIN']), botController_js_1.getBotSettings);
router.post('/:storeId/restart', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.restartBot);
router.get('/global/stats', requireRole(['OWNER']), botController_js_1.getGlobalBotStats);
router.post('/:storeId/webhook/enable', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.enableWebhook);
router.post('/:storeId/webhook/disable', csrfProtection_js_1.csrfProtection, requireRole(['OWNER', 'ADMIN']), botController_js_1.disableWebhook);
router.get('/:storeId/webhook/status', requireRole(['OWNER', 'ADMIN']), botController_js_1.getWebhookStatus);
router.get('/webhooks/stats', requireRole(['OWNER']), botController_js_1.getGlobalWebhookStats);
exports.default = router;
//# sourceMappingURL=bots.js.map