"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const handlers_1 = require("./handlers");
const notificationHandler_1 = require("./handlers/notificationHandler");
const security_1 = require("./middleware/security");
const apiService_1 = require("./services/apiService");
const cmsService_1 = require("./services/cmsService");
const webhookService_1 = require("./services/webhookService");
const logger_1 = require("./utils/logger");
const redisStore_1 = require("./utils/redisStore");
const sanitizer_1 = require("./utils/sanitizer");
dotenv_1.default.config();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;
const PORT = process.env.BOT_PORT || 3003;
const isProduction = process.env.NODE_ENV === 'production';
const useWebhook = !!WEBHOOK_BASE_URL;
if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_FROM_BOTFATHER') {
    logger_1.logger.error('❌ TELEGRAM_BOT_TOKEN is not configured properly!');
    logger_1.logger.error('Please follow these steps:');
    logger_1.logger.error('1. Open @BotFather in Telegram');
    logger_1.logger.error('2. Create a new bot with /newbot or use existing bot');
    logger_1.logger.error('3. Copy the bot token');
    logger_1.logger.error('4. Set TELEGRAM_BOT_TOKEN in bot/.env file');
    logger_1.logger.error('5. Restart the bot service');
    process.exit(1);
}
logger_1.logger.info('Initializing Telegram Bot', {
    useWebhook,
    isProduction,
    port: PORT,
    webhookBaseUrl: WEBHOOK_BASE_URL
});
const bot = new node_telegram_bot_api_1.default(BOT_TOKEN, {
    polling: !useWebhook,
    webHook: false
});
exports.bot = bot;
let webhookService = null;
let security = null;
if (!useWebhook) {
    const securityConfig = isProduction ? security_1.PRODUCTION_SECURITY_CONFIG : security_1.DEFAULT_SECURITY_CONFIG;
    security = new security_1.TelegramBotSecurity(securityConfig);
    bot.on('message', async (msg) => {
        if (security) {
            const rateLimitPassed = await security.checkRateLimit(msg.from?.id?.toString() || '');
            const antiSpamPassed = rateLimitPassed ? !security.checkSpam(msg.from?.id?.toString() || '', msg.text || '') : false;
            if (!rateLimitPassed || !antiSpamPassed) {
                const { sanitizeForLog } = require('./utils/sanitizer');
                logger_1.logger.warn(`Message blocked from user ${sanitizeForLog(msg.from?.id)}`, {
                    rateLimitPassed,
                    antiSpamPassed,
                    userId: msg.from?.id,
                    messageText: msg.text?.substring(0, 100)
                });
                return;
            }
        }
    });
}
async function initializeServices() {
    const notificationHandler = new notificationHandler_1.NotificationHandler(bot);
    if (useWebhook) {
        const webhookConfig = isProduction ? webhookService_1.PRODUCTION_WEBHOOK_CONFIG : webhookService_1.DEFAULT_WEBHOOK_CONFIG;
        webhookService = new webhookService_1.TelegramWebhookService(bot, webhookConfig);
        try {
            await webhookService.start();
            logger_1.logger.info('✅ Secure webhook service started successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to start webhook service:', error);
            process.exit(1);
        }
    }
    else {
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.get('/health', (req, res) => {
            const stats = security?.getSecurityStats() || Promise.resolve({});
            Promise.resolve(stats).then(securityStats => {
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    bot: 'telegram-ecommerce',
                    version: '1.0.0',
                    mode: 'polling',
                    security: securityStats
                });
            });
        });
        app.post('/api/notify-customer', async (req, res) => {
            try {
                const notification = req.body;
                if (!notification.telegramId || !notification.type || !notification.orderData) {
                    return res.status(400).json({
                        error: 'Missing required fields: telegramId, type, orderData'
                    });
                }
                const success = await notificationHandler.sendCustomerNotificationWithRetry(notification, 3);
                if (success) {
                    res.json({
                        success: true,
                        message: 'Notification sent successfully',
                        telegramId: notification.telegramId,
                        type: notification.type
                    });
                }
                else {
                    res.status(500).json({
                        error: 'Failed to send notification after retries',
                        telegramId: notification.telegramId,
                        type: notification.type
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Error processing customer notification:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
        app.get('/api/security-stats', async (req, res) => {
            try {
                const authToken = req.headers.authorization;
                if (!authToken || authToken !== `Bearer ${process.env.WEBHOOK_ADMIN_TOKEN}`) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                if (!security) {
                    return res.json({ message: 'Security not enabled' });
                }
                const stats = await security.getSecurityStats();
                res.json(stats);
            }
            catch (error) {
                logger_1.logger.error('Error getting security stats:', error);
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
        app.post('/api/unblock-user', async (req, res) => {
            try {
                const authToken = req.headers.authorization;
                if (!authToken || authToken !== `Bearer ${process.env.WEBHOOK_ADMIN_TOKEN}`) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                const { userId } = req.body;
                if (!userId || typeof userId !== 'number') {
                    return res.status(400).json({ error: 'Valid userId required' });
                }
                if (!security) {
                    return res.json({ message: 'Security not enabled' });
                }
                security['blockedUsers'].delete(userId.toString());
                res.json({ message: `User ${userId} unblocked successfully` });
            }
            catch (error) {
                logger_1.logger.error('Error unblocking user:', error);
                res.status(500).json({ error: 'Failed to unblock user' });
            }
        });
        app.listen(PORT, () => {
            logger_1.logger.info(`🤖 Bot API server running on port ${PORT} (polling mode with security)`);
        });
        logger_1.logger.info('🤖 Bot running in polling mode with enhanced security');
    }
    return notificationHandler;
}
async function main() {
    try {
        apiService_1.apiService.initialize(process.env.API_URL || 'http://82.147.84.78:3001');
        if (process.env.REDIS_URL) {
            try {
                await redisStore_1.redisSessionStore.init(process.env.REDIS_URL);
                logger_1.logger.info('Redis session store initialized');
            }
            catch (error) {
                logger_1.logger.warn('Redis session store initialization failed, using in-memory fallback:', error);
                logger_1.logger.info('Bot will continue without Redis (development mode)');
            }
        }
        else {
            logger_1.logger.info('Redis not configured, using in-memory session store (development mode)');
        }
        const cmsBase = process.env.CMS_BASE_URL;
        if (cmsBase) {
            try {
                cmsService_1.cmsService.initialize(cmsBase);
                logger_1.logger.info(`CMS initialized at ${cmsBase}`);
            }
            catch (err) {
                logger_1.logger.error('Failed to initialize CMS service', err);
            }
        }
        (0, handlers_1.setupHandlers)(bot);
        const notificationHandler = await initializeServices();
        bot.on('error', (error) => {
            logger_1.logger.error('Bot error:', { error: error instanceof Error ? error.message : String(error) });
        });
        bot.on('polling_error', (error) => {
            logger_1.logger.error('Polling error:', { error: error instanceof Error ? error.message : String(error) });
            setTimeout(() => {
                if (!useWebhook) {
                    bot.startPolling({ restart: true });
                }
            }, 5000);
        });
        const gracefulShutdown = async (signal) => {
            logger_1.logger.info(`${(0, sanitizer_1.sanitizeForLog)(signal)} received, shutting down bot gracefully`);
            try {
                if (webhookService) {
                    await webhookService.stop();
                    logger_1.logger.info('Webhook service stopped');
                }
                if (!useWebhook) {
                    await bot.stopPolling();
                    logger_1.logger.info('Polling stopped');
                }
                if (security) {
                    await security.close();
                    logger_1.logger.info('Security service stopped');
                }
                await redisStore_1.redisSessionStore.disconnect();
                logger_1.logger.info('Redis connections closed');
                logger_1.logger.info('Bot shutdown completed gracefully');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        if (security || webhookService) {
            setInterval(async () => {
                try {
                    if (security) {
                        security.cleanup();
                    }
                    if (webhookService) {
                        const stats = webhookService.getStats();
                        logger_1.logger.debug('Webhook stats:', stats);
                    }
                }
                catch (error) {
                    logger_1.logger.error('Error during periodic maintenance:', error);
                }
            }, 600000);
        }
        logger_1.logger.info('🚀 Telegram bot started successfully with enhanced security');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
}
main().catch((error) => {
    const errorMsg = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
    logger_1.logger.error('Unhandled error during bot startup:', errorMsg);
    process.exit(1);
});
//# sourceMappingURL=index.js.map