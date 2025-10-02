"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botFactoryService = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const prisma_js_1 = require("../lib/prisma.js");
const logger_js_1 = require("../utils/logger.js");
const notificationService_js_1 = require("./notificationService.js");
const botHandlerService_js_1 = __importDefault(require("./botHandlerService.js"));
class BotFactoryService {
    constructor() {
        this.activeBots = new Map();
        this.botTokenToStoreId = new Map();
        this.isInitialized = false;
        this.setupGracefulShutdown();
    }
    sanitizeAndValidateToken(rawToken) {
        if (!rawToken || typeof rawToken !== 'string')
            return null;
        let token = rawToken.trim();
        const urlMatch = token.match(/https?:\/\/[^\s]*\/bot([^\s/]+)/i);
        if (urlMatch && urlMatch[1]) {
            token = urlMatch[1];
        }
        const tokenPattern = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;
        if (!tokenPattern.test(token)) {
            return null;
        }
        return token;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            logger_js_1.logger.info('🤖 Initializing Bot Factory Service...');
            const activeBotStores = await prisma_js_1.prisma.store.findMany({
                where: {
                    botStatus: 'ACTIVE',
                    botToken: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    botToken: true,
                    botUsername: true,
                    botWebhookUrl: true,
                    botSettings: true,
                    botLastActive: true
                }
            });
            logger_js_1.logger.info(`Found ${activeBotStores.length} active bots to restore`);
            for (const store of activeBotStores) {
                if (store.botToken && store.botUsername) {
                    const sanitized = this.sanitizeAndValidateToken(store.botToken);
                    if (!sanitized) {
                        logger_js_1.logger.error(`❌ Invalid bot token format for store ${store.id}. Suspending bot to avoid polling errors.`);
                        await this.updateBotStatus(store.id, 'SUSPENDED');
                        continue;
                    }
                    try {
                        await this.createBotInstance({
                            token: sanitized,
                            username: store.botUsername,
                            storeId: store.id,
                            webhookUrl: store.botWebhookUrl || undefined,
                            settings: store.botSettings ? JSON.parse(store.botSettings) : undefined
                        });
                        logger_js_1.logger.info(`✅ Restored bot for store: ${store.name} (@${store.botUsername})`);
                    }
                    catch (error) {
                        logger_js_1.logger.error(`❌ Failed to restore bot for store ${store.name}:`, error);
                        await this.updateBotStatus(store.id, 'INACTIVE');
                    }
                }
            }
            this.isInitialized = true;
            logger_js_1.logger.info(`🚀 Bot Factory Service initialized with ${this.activeBots.size} active bots`);
        }
        catch (error) {
            logger_js_1.logger.error('❌ Failed to initialize Bot Factory Service:', error);
            throw error;
        }
    }
    async createBot(storeId, botToken, botUsername) {
        try {
            logger_js_1.logger.info(`🤖 Creating new bot for store: ${storeId}`);
            const sanitizedToken = this.sanitizeAndValidateToken(botToken);
            if (!sanitizedToken) {
                return { success: false, error: 'Неверный формат токена бота. Вставьте только сам токен из @BotFather.' };
            }
            const testBot = new node_telegram_bot_api_1.default(sanitizedToken, { polling: false, webHook: false });
            let botInfo;
            try {
                botInfo = await testBot.getMe();
            }
            catch (error) {
                logger_js_1.logger.error('Invalid bot token:', error);
                return { success: false, error: 'Неверный токен бота. Проверьте токен в @BotFather' };
            }
            const resolvedUsername = botUsername || botInfo.username;
            if (!resolvedUsername) {
                return { success: false, error: 'Не удалось получить имя пользователя бота' };
            }
            const existingStore = await prisma_js_1.prisma.store.findFirst({
                where: {
                    botToken: sanitizedToken,
                    id: { not: storeId }
                }
            });
            if (existingStore) {
                return { success: false, error: 'Этот бот уже используется другим магазином' };
            }
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: {
                    botToken: sanitizedToken,
                    botUsername: resolvedUsername,
                    botStatus: 'ACTIVE',
                    botCreatedAt: new Date(),
                    botLastActive: new Date(),
                    botSettings: JSON.stringify(this.getDefaultBotSettings())
                }
            });
            const activeBot = await this.createBotInstance({
                token: sanitizedToken,
                username: resolvedUsername,
                storeId: storeId,
                settings: this.getDefaultBotSettings()
            });
            await this.notifyBotCreated(storeId, resolvedUsername);
            logger_js_1.logger.info(`✅ Successfully created bot @${resolvedUsername} for store ${storeId}`);
            return { success: true, bot: activeBot };
        }
        catch (error) {
            logger_js_1.logger.error(`❌ Failed to create bot for store ${storeId}:`, error);
            return { success: false, error: 'Произошла ошибка при создании бота' };
        }
    }
    async removeBot(storeId) {
        try {
            const activeBot = this.activeBots.get(storeId);
            if (activeBot) {
                try {
                    await activeBot.bot.stopPolling();
                }
                catch (error) {
                    logger_js_1.logger.warn('Error stopping bot polling:', error);
                }
                activeBot.handler.cleanup();
                this.activeBots.delete(storeId);
                this.botTokenToStoreId.delete(activeBot.config.token);
            }
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: {
                    botToken: null,
                    botUsername: null,
                    botStatus: 'INACTIVE',
                    botWebhookUrl: null,
                    botSettings: null
                }
            });
            logger_js_1.logger.info(`🗑️ Successfully removed bot for store ${storeId}`);
            return { success: true };
        }
        catch (error) {
            logger_js_1.logger.error(`❌ Failed to remove bot for store ${storeId}:`, error);
            return { success: false, error: 'Произошла ошибка при удалении бота' };
        }
    }
    getBotByStore(storeId) {
        return this.activeBots.get(storeId);
    }
    getStoreByBotToken(token) {
        return this.botTokenToStoreId.get(token);
    }
    getActiveBots() {
        return Array.from(this.activeBots.values());
    }
    async updateBotStatus(storeId, status) {
        try {
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: { botStatus: status }
            });
            const activeBot = this.activeBots.get(storeId);
            if (activeBot) {
                activeBot.status = status;
                if (status === 'SUSPENDED' || status === 'INACTIVE') {
                    try {
                        await activeBot.bot.stopPolling();
                    }
                    catch (error) {
                        logger_js_1.logger.warn('Error stopping bot:', error);
                    }
                }
            }
            logger_js_1.logger.info(`📊 Updated bot status for store ${storeId} to ${status}`);
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to update bot status for store ${storeId}:`, error);
        }
    }
    async updateBotActivity(storeId) {
        const activeBot = this.activeBots.get(storeId);
        if (activeBot) {
            activeBot.lastActivity = new Date();
            activeBot.messageCount += 1;
            if (activeBot.messageCount % 10 === 0) {
                try {
                    await prisma_js_1.prisma.store.update({
                        where: { id: storeId },
                        data: { botLastActive: new Date() }
                    });
                }
                catch (error) {
                    logger_js_1.logger.warn('Failed to update bot activity in database:', error);
                }
            }
        }
    }
    getBotStats() {
        const bots = this.getActiveBots();
        return {
            totalBots: bots.length,
            activeBots: bots.filter(bot => bot.status === 'ACTIVE').length,
            inactiveBots: bots.filter(bot => bot.status === 'INACTIVE').length,
            suspendedBots: bots.filter(bot => bot.status === 'SUSPENDED').length,
            totalMessages: bots.reduce((sum, bot) => sum + bot.messageCount, 0)
        };
    }
    async createBotInstance(config) {
        let baseApiUrl;
        const baseApiUrlEnv = process.env.TELEGRAM_BASE_API_URL && process.env.TELEGRAM_BASE_API_URL.trim();
        if (baseApiUrlEnv) {
            try {
                const parsed = new URL(baseApiUrlEnv);
                if (parsed.protocol !== 'https:') {
                    logger_js_1.logger.warn('Ignoring TELEGRAM_BASE_API_URL because it is not HTTPS', { value: baseApiUrlEnv });
                }
                else {
                    baseApiUrl = baseApiUrlEnv;
                }
            }
            catch (error) {
                logger_js_1.logger.warn('Ignoring TELEGRAM_BASE_API_URL because it is not a valid URL', { value: baseApiUrlEnv });
            }
        }
        const bot = new node_telegram_bot_api_1.default(config.token, {
            polling: true,
            webHook: false,
            ...(baseApiUrl ? { baseApiUrl } : {}),
        });
        const handler = new botHandlerService_js_1.default(config.storeId);
        const activeBot = {
            bot,
            storeId: config.storeId,
            config,
            status: 'ACTIVE',
            lastActivity: new Date(),
            messageCount: 0,
            handler
        };
        this.setupBotHandlers(activeBot);
        this.activeBots.set(config.storeId, activeBot);
        this.botTokenToStoreId.set(config.token, config.storeId);
        return activeBot;
    }
    setupBotHandlers(activeBot) {
        const { bot, storeId, handler } = activeBot;
        bot.on('message', async (msg) => {
            try {
                await this.updateBotActivity(storeId);
                await handler.handleMessage(bot, msg);
            }
            catch (error) {
                logger_js_1.logger.error(`Error handling message for store ${storeId}:`, error);
            }
        });
        bot.on('callback_query', async (query) => {
            try {
                await this.updateBotActivity(storeId);
                await handler.handleCallbackQuery(bot, query);
            }
            catch (error) {
                logger_js_1.logger.error(`Error handling callback query for store ${storeId}:`, error);
            }
        });
        bot.on('error', (error) => {
            logger_js_1.logger.error(`Bot error for store ${storeId}:`, (0, logger_js_1.toLogMetadata)(error));
        });
        bot.on('polling_error', async (error) => {
            logger_js_1.logger.error(`Bot polling error for store ${storeId}:`, (0, logger_js_1.toLogMetadata)(error));
            const errorObj = error;
            const message = (errorObj && (errorObj.message || errorObj.code)) || '';
            if (typeof message === 'string' && (message.includes('ERR_INVALID_URL') || message.includes('Invalid URL'))) {
                try {
                    await this.updateBotStatus(storeId, 'SUSPENDED');
                    logger_js_1.logger.error(`⛔ Suspended bot for store ${storeId} due to invalid Telegram API URL or malformed token.`);
                }
                catch (e) {
                    logger_js_1.logger.error('Failed to update bot status after invalid URL error:', e);
                }
            }
        });
    }
    getDefaultBotSettings() {
        return {
            welcome_message: "Добро пожаловать в наш магазин!",
            language: "ru",
            timezone: "UTC",
            auto_responses: true,
            payment_methods: ["manual_verification"]
        };
    }
    async notifyBotCreated(storeId, botUsername) {
        try {
            const store = await prisma_js_1.prisma.store.findUnique({
                where: { id: storeId },
                include: { owner: true }
            });
            if (store) {
                await notificationService_js_1.NotificationService.send({
                    title: 'Telegram бот создан',
                    message: `Бот @${botUsername} успешно создан для магазина "${store.name}"`,
                    type: notificationService_js_1.NotificationType.BOT_CREATED,
                    priority: notificationService_js_1.NotificationPriority.HIGH,
                    recipients: [store.owner.id],
                    channels: [notificationService_js_1.NotificationChannel.SOCKET, notificationService_js_1.NotificationChannel.TELEGRAM],
                    data: {
                        storeId,
                        storeName: store.name,
                        botUsername,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }
        catch (error) {
            logger_js_1.logger.warn('Failed to send bot creation notification:', error);
        }
    }
    setupGracefulShutdown() {
        const gracefulShutdown = async () => {
            logger_js_1.logger.info('🔄 Shutting down Bot Factory Service...');
            const shutdownPromises = Array.from(this.activeBots.values()).map(async (activeBot) => {
                try {
                    await activeBot.bot.stopPolling();
                    activeBot.handler.cleanup();
                    logger_js_1.logger.info(`✅ Stopped bot for store: ${activeBot.storeId}`);
                }
                catch (error) {
                    logger_js_1.logger.error(`❌ Error stopping bot for store ${activeBot.storeId}:`, error);
                }
            });
            await Promise.all(shutdownPromises);
            logger_js_1.logger.info('🛑 Bot Factory Service shutdown complete');
        };
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }
}
exports.botFactoryService = new BotFactoryService();
//# sourceMappingURL=botFactoryService.js.map