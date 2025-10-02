"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebhookManager = exports.WebhookManagerService = void 0;
const express_1 = __importDefault(require("express"));
const logger_js_1 = require("../utils/logger.js");
const prisma_js_1 = require("../lib/prisma.js");
const botFactoryService_js_1 = require("./botFactoryService.js");
const auth_js_1 = require("../middleware/auth.js");
const telegramWebhookValidator_js_1 = require("../utils/telegramWebhookValidator.js");
class WebhookManagerService {
    constructor(config) {
        this.webhooks = new Map();
        this.tokenToStoreId = new Map();
        this.isInitialized = false;
        this.config = config;
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.setupRoutes();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            logger_js_1.logger.info('🌐 Initializing Webhook Manager Service...');
            const activeBotStores = await prisma_js_1.prisma.store.findMany({
                where: {
                    botStatus: 'ACTIVE',
                    botToken: { not: null },
                    botWebhookUrl: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    botToken: true,
                    botWebhookUrl: true
                }
            });
            logger_js_1.logger.info(`Found ${activeBotStores.length} bots with webhooks to restore`);
            for (const store of activeBotStores) {
                if (store.botToken && store.botWebhookUrl) {
                    try {
                        await this.addWebhook(store.id, store.botToken);
                        logger_js_1.logger.info(`✅ Restored webhook for store: ${store.name}`);
                    }
                    catch (error) {
                        logger_js_1.logger.error(`❌ Failed to restore webhook for store ${store.name}:`, error);
                        await this.disableWebhook(store.id);
                    }
                }
            }
            await this.startServer();
            this.isInitialized = true;
            logger_js_1.logger.info(`🚀 Webhook Manager Service initialized with ${this.webhooks.size} active webhooks`);
        }
        catch (error) {
            logger_js_1.logger.error('❌ Failed to initialize Webhook Manager Service:', error);
            throw error;
        }
    }
    async addWebhook(storeId, botToken) {
        try {
            logger_js_1.logger.info(`🌐 Setting up webhook for store: ${storeId}`);
            const webhookPath = `/webhook/bot/${storeId}`;
            const webhookUrl = `${this.config.baseUrl}${webhookPath}`;
            const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
            if (!activeBot) {
                return { success: false, error: 'Бот не активен в системе' };
            }
            try {
                await activeBot.bot.stopPolling();
                logger_js_1.logger.info(`Stopped polling for store ${storeId}`);
            }
            catch (error) {
                logger_js_1.logger.warn(`Could not stop polling for store ${storeId}:`, error);
            }
            const success = await activeBot.bot.setWebHook(webhookUrl, {
                certificate: this.config.ssl?.cert,
                max_connections: 100,
                allowed_updates: ['message', 'callback_query']
            });
            if (!success) {
                return { success: false, error: 'Не удалось установить webhook в Telegram' };
            }
            const webhookInfo = {
                storeId,
                botToken,
                webhookUrl,
                isActive: true,
                lastUpdate: new Date(),
                errorCount: 0
            };
            this.webhooks.set(storeId, webhookInfo);
            this.tokenToStoreId.set(botToken, storeId);
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: {
                    botWebhookUrl: webhookUrl,
                    botLastActive: new Date()
                }
            });
            logger_js_1.logger.info(`✅ Successfully set webhook for store ${storeId}: ${webhookUrl}`);
            return { success: true, webhookUrl };
        }
        catch (error) {
            logger_js_1.logger.error(`❌ Failed to set webhook for store ${storeId}:`, error);
            return { success: false, error: 'Произошла ошибка при установке webhook' };
        }
    }
    async removeWebhook(storeId) {
        try {
            const webhookInfo = this.webhooks.get(storeId);
            if (webhookInfo) {
                const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
                if (activeBot) {
                    try {
                        await activeBot.bot.deleteWebHook();
                        logger_js_1.logger.info(`Deleted webhook for store ${storeId}`);
                    }
                    catch (error) {
                        logger_js_1.logger.warn(`Could not delete webhook for store ${storeId}:`, error);
                    }
                    try {
                        activeBot.bot.startPolling();
                        logger_js_1.logger.info(`Resumed polling for store ${storeId}`);
                    }
                    catch (error) {
                        logger_js_1.logger.warn(`Could not resume polling for store ${storeId}:`, error);
                    }
                }
                this.webhooks.delete(storeId);
                this.tokenToStoreId.delete(webhookInfo.botToken);
            }
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: {
                    botWebhookUrl: null
                }
            });
            logger_js_1.logger.info(`🗑️ Successfully removed webhook for store ${storeId}`);
            return { success: true };
        }
        catch (error) {
            logger_js_1.logger.error(`❌ Failed to remove webhook for store ${storeId}:`, error);
            return { success: false, error: 'Произошла ошибка при удалении webhook' };
        }
    }
    getWebhookStats() {
        const webhooks = Array.from(this.webhooks.values());
        return {
            totalWebhooks: webhooks.length,
            activeWebhooks: webhooks.filter(w => w.isActive).length,
            errorCount: webhooks.reduce((sum, w) => sum + w.errorCount, 0),
            webhooks
        };
    }
    async checkWebhookStatus(storeId) {
        const webhookInfo = this.webhooks.get(storeId);
        if (!webhookInfo) {
            return { isActive: false };
        }
        try {
            const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
            if (activeBot) {
                const webhookInfo = await activeBot.bot.getWebHookInfo();
                return {
                    isActive: !!webhookInfo.url,
                    lastUpdate: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000) : undefined,
                    errors: webhookInfo.last_error_message ? 1 : 0
                };
            }
        }
        catch (error) {
            logger_js_1.logger.warn(`Could not check webhook status for store ${storeId}:`, error);
        }
        return {
            isActive: webhookInfo.isActive,
            lastUpdate: webhookInfo.lastUpdate,
            errors: webhookInfo.errorCount
        };
    }
    setupMiddleware() {
        this.app.use('/webhook', express_1.default.json({ limit: '10mb' }));
        this.app.use('/webhook', (req, res, next) => {
            logger_js_1.logger.debug(`Webhook request: ${req.method} ${req.path}`, {
                headers: req.headers,
                body: req.body
            });
            next();
        });
        this.app.use('/webhook', (req, res, next) => {
            const storeId = req.params?.storeId || req.path.split('/')[3];
            if (storeId) {
                const webhook = this.webhooks.get(storeId);
                if (webhook) {
                    const validationResult = telegramWebhookValidator_js_1.TelegramWebhookValidator.validateWithEnvironment({
                        botToken: webhook.botToken,
                        secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
                        requestBody: JSON.stringify(req.body),
                        headers: req.headers,
                        environment: process.env.NODE_ENV,
                        requireValidation: true
                    });
                    if (!validationResult.isValid) {
                        logger_js_1.logger.warn('Telegram webhook validation failed', {
                            storeId,
                            error: validationResult.error,
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            hasBody: !!req.body,
                            headerKeys: Object.keys(req.headers)
                        });
                        return res.status(401).json({
                            error: 'Invalid webhook signature',
                            details: validationResult.error
                        });
                    }
                    logger_js_1.logger.debug('Telegram webhook validation passed', { storeId });
                }
                else {
                    logger_js_1.logger.warn('Webhook request for unknown store', { storeId });
                    return res.status(404).json({ error: 'Store not found' });
                }
            }
            next();
        });
    }
    setupRoutes() {
        this.app.post('/webhook/bot/:storeId', async (req, res) => {
            try {
                const storeId = req.params.storeId;
                const update = req.body;
                const webhookInfo = this.webhooks.get(storeId);
                if (!webhookInfo) {
                    logger_js_1.logger.warn(`Webhook request for unregistered store: ${storeId}`);
                    return res.status(404).json({ error: 'Webhook not found' });
                }
                const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
                if (!activeBot) {
                    logger_js_1.logger.warn(`Webhook request for inactive bot: ${storeId}`);
                    return res.status(503).json({ error: 'Bot not active' });
                }
                await this.processWebhookUpdate(storeId, activeBot.bot, update);
                webhookInfo.lastUpdate = new Date();
                webhookInfo.errorCount = 0;
                res.status(200).json({ ok: true });
            }
            catch (error) {
                logger_js_1.logger.error(`Error processing webhook for store ${req.params.storeId}:`, error);
                const webhookInfo = this.webhooks.get(req.params.storeId);
                if (webhookInfo) {
                    webhookInfo.errorCount++;
                    if (webhookInfo.errorCount > 10) {
                        await this.disableWebhook(req.params.storeId);
                    }
                }
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        this.app.get('/webhook/health', (req, res) => {
            const stats = this.getWebhookStats();
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                ...stats
            });
        });
        this.app.get('/webhook/stats', auth_js_1.authMiddleware, (req, res) => {
            const userRole = req.user?.role;
            if (!['OWNER', 'ADMIN'].includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Owner or Admin role required.'
                });
            }
            const stats = this.getWebhookStats();
            res.json({
                success: true,
                data: stats
            });
        });
    }
    async processWebhookUpdate(storeId, bot, update) {
        try {
            const botEmitter = bot;
            if (update.message) {
                botEmitter.emit('message', update.message);
            }
            else if (update.callback_query) {
                botEmitter.emit('callback_query', update.callback_query);
            }
            else if (update.inline_query) {
                botEmitter.emit('inline_query', update.inline_query);
            }
            else if (update.chosen_inline_result) {
                botEmitter.emit('chosen_inline_result', update.chosen_inline_result);
            }
            logger_js_1.logger.debug(`Processed webhook update for store ${storeId}`, {
                updateType: Object.keys(update).filter(key => key !== 'update_id'),
                updateId: update.update_id
            });
        }
        catch (error) {
            logger_js_1.logger.error(`Error processing webhook update for store ${storeId}:`, error);
            throw error;
        }
    }
    async disableWebhook(storeId) {
        try {
            logger_js_1.logger.warn(`Disabling webhook for store ${storeId} due to errors`);
            const webhookInfo = this.webhooks.get(storeId);
            if (webhookInfo) {
                webhookInfo.isActive = false;
                await prisma_js_1.prisma.store.update({
                    where: { id: storeId },
                    data: { botWebhookUrl: null }
                });
                const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
                if (activeBot) {
                    try {
                        await activeBot.bot.deleteWebHook();
                        activeBot.bot.startPolling();
                        logger_js_1.logger.info(`Resumed polling for store ${storeId} as fallback`);
                    }
                    catch (error) {
                        logger_js_1.logger.error(`Could not resume polling for store ${storeId}:`, error);
                    }
                }
            }
        }
        catch (error) {
            logger_js_1.logger.error(`Error disabling webhook for store ${storeId}:`, error);
        }
    }
    async startServer() {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(this.config.port, () => {
                logger_js_1.logger.info(`🌐 Webhook server started on port ${this.config.port}`);
                logger_js_1.logger.info(`📡 Webhook base URL: ${this.config.baseUrl}`);
                resolve();
            });
            server.on('error', (error) => {
                logger_js_1.logger.error('❌ Failed to start webhook server:', (0, logger_js_1.toLogMetadata)(error));
                reject(error);
            });
        });
    }
    async shutdown() {
        logger_js_1.logger.info('🔄 Shutting down Webhook Manager Service...');
        const shutdownPromises = Array.from(this.webhooks.keys()).map(async (storeId) => {
            try {
                await this.removeWebhook(storeId);
                logger_js_1.logger.info(`✅ Removed webhook for store: ${storeId}`);
            }
            catch (error) {
                logger_js_1.logger.error(`❌ Error removing webhook for store ${storeId}:`, error);
            }
        });
        await Promise.all(shutdownPromises);
        logger_js_1.logger.info('🛑 Webhook Manager Service shutdown complete');
    }
}
exports.WebhookManagerService = WebhookManagerService;
let webhookManager = null;
const getWebhookManager = (config) => {
    if (!webhookManager && config) {
        webhookManager = new WebhookManagerService(config);
    }
    if (!webhookManager) {
        throw new Error('Webhook Manager not initialized');
    }
    return webhookManager;
};
exports.getWebhookManager = getWebhookManager;
//# sourceMappingURL=webhookManagerService.js.map