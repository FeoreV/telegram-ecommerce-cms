"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botFactoryService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const prisma_js_1 = require("../lib/prisma.js");
const logger_js_1 = require("../utils/logger.js");
const sanitizer_js_1 = require("../utils/sanitizer.js");
const botHandlerService_js_1 = __importDefault(require("./botHandlerService.js"));
const EncryptionService_js_1 = require("./EncryptionService.js");
const notificationService_js_1 = require("./notificationService.js");
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
            logger_js_1.logger.info('Found active bots to restore', { count: activeBotStores.length });
            for (const store of activeBotStores) {
                if (store.botToken && store.botUsername) {
                    try {
                        let decryptedToken;
                        try {
                            decryptedToken = await EncryptionService_js_1.encryptionService.decryptData(store.botToken);
                        }
                        catch (error) {
                            logger_js_1.logger.warn('Failed to decrypt token, trying as plaintext', { storeId: (0, sanitizer_js_1.sanitizeForLog)(store.id) });
                            decryptedToken = store.botToken;
                        }
                        const sanitized = this.sanitizeAndValidateToken(decryptedToken);
                        if (!sanitized) {
                            logger_js_1.logger.error('Invalid bot token format, suspending bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(store.id) });
                            await this.updateBotStatus(store.id, 'SUSPENDED');
                            continue;
                        }
                        await this.createBotInstance({
                            token: sanitized,
                            username: store.botUsername,
                            storeId: store.id,
                            webhookUrl: store.botWebhookUrl || undefined,
                            settings: store.botSettings ? JSON.parse(store.botSettings) : undefined
                        });
                        logger_js_1.logger.info('Restored bot for store', { storeName: (0, sanitizer_js_1.sanitizeForLog)(store.name), botUsername: (0, sanitizer_js_1.sanitizeForLog)(store.botUsername || '') });
                    }
                    catch (error) {
                        logger_js_1.logger.error('Failed to restore bot', { storeName: (0, sanitizer_js_1.sanitizeForLog)(store.name), error });
                        await this.updateBotStatus(store.id, 'INACTIVE');
                    }
                }
            }
            this.isInitialized = true;
            logger_js_1.logger.info('Bot Factory Service initialized', { activeBotsCount: this.activeBots.size });
        }
        catch (error) {
            logger_js_1.logger.error('❌ Failed to initialize Bot Factory Service:', error);
            throw error;
        }
    }
    async createBot(storeId, botToken, botUsername) {
        try {
            logger_js_1.logger.info('Creating new bot for store', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId) });
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
            const encryptedToken = await EncryptionService_js_1.encryptionService.encryptData(sanitizedToken);
            const tokenHash = crypto_1.default.createHash('sha256').update(sanitizedToken).digest('hex');
            const allStores = await prisma_js_1.prisma.store.findMany({
                where: {
                    id: { not: storeId },
                    botToken: { not: null }
                },
                select: { id: true, botToken: true }
            });
            for (const store of allStores) {
                try {
                    if (store.botToken) {
                        const decryptedToken = await EncryptionService_js_1.encryptionService.decryptData(store.botToken);
                        if (crypto_1.default.timingSafeEqual(Buffer.from(decryptedToken, 'utf8'), Buffer.from(sanitizedToken, 'utf8'))) {
                            return { success: false, error: 'Этот бот уже используется другим магазином' };
                        }
                    }
                }
                catch (error) {
                    logger_js_1.logger.warn('Failed to decrypt token', { storeId: (0, sanitizer_js_1.sanitizeForLog)(store.id) });
                }
            }
            await prisma_js_1.prisma.store.update({
                where: { id: storeId },
                data: {
                    botToken: encryptedToken,
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
            logger_js_1.logger.info('Successfully created bot', { botUsername: (0, sanitizer_js_1.sanitizeForLog)(resolvedUsername), storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId) });
            return { success: true, bot: activeBot };
        }
        catch (error) {
            logger_js_1.logger.error('Failed to create bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error });
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
            logger_js_1.logger.info('Successfully removed bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId) });
            return { success: true };
        }
        catch (error) {
            logger_js_1.logger.error('Failed to remove bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error });
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
            logger_js_1.logger.info('Updated bot status', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), status: (0, sanitizer_js_1.sanitizeForLog)(status) });
        }
        catch (error) {
            logger_js_1.logger.error('Failed to update bot status', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error });
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
                logger_js_1.logger.error('Error handling message', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error });
                if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
                    logger_js_1.logger.error(`⛔ Stopping orphaned bot for deleted store ${(0, sanitizer_js_1.sanitizeForLog)(storeId)}`);
                    try {
                        await this.removeBot(storeId);
                    }
                    catch (stopError) {
                        logger_js_1.logger.error(`Error stopping orphaned bot for store ${(0, sanitizer_js_1.sanitizeForLog)(storeId)}:`, stopError);
                    }
                }
            }
        });
        bot.on('callback_query', async (query) => {
            try {
                await this.updateBotActivity(storeId);
                await handler.handleCallbackQuery(bot, query);
            }
            catch (error) {
                logger_js_1.logger.error(`Error handling callback query for store ${(0, sanitizer_js_1.sanitizeForLog)(storeId)}:`, error);
                if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
                    logger_js_1.logger.error(`⛔ Stopping orphaned bot for deleted store ${(0, sanitizer_js_1.sanitizeForLog)(storeId)}`);
                    try {
                        await this.removeBot(storeId);
                    }
                    catch (stopError) {
                        logger_js_1.logger.error(`Error stopping orphaned bot for store ${(0, sanitizer_js_1.sanitizeForLog)(storeId)}:`, stopError);
                    }
                }
            }
        });
        bot.on('error', (error) => {
            logger_js_1.logger.error('Bot error', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error: (0, logger_js_1.toLogMetadata)(error) });
        });
        bot.on('polling_error', async (error) => {
            logger_js_1.logger.error('Bot polling error', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error: (0, logger_js_1.toLogMetadata)(error) });
            const errorObj = error;
            const message = (errorObj && (errorObj.message || errorObj.code)) || '';
            if (typeof message === 'string' && (message.includes('ERR_INVALID_URL') || message.includes('Invalid URL'))) {
                try {
                    await this.updateBotStatus(storeId, 'SUSPENDED');
                    logger_js_1.logger.error('Suspended bot due to invalid Telegram API URL or malformed token', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId) });
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
                    logger_js_1.logger.info('Stopped bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(activeBot.storeId) });
                }
                catch (error) {
                    logger_js_1.logger.error('Error stopping bot', { storeId: (0, sanitizer_js_1.sanitizeForLog)(activeBot.storeId), error });
                }
            });
            await Promise.all(shutdownPromises);
            logger_js_1.logger.info('🛑 Bot Factory Service shutdown complete');
        };
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }
    async reloadBotSettings(storeId) {
        try {
            const activeBot = this.activeBots.get(storeId);
            if (!activeBot) {
                return { success: false, error: 'Bot not active for this store' };
            }
            const store = await prisma_js_1.prisma.store.findUnique({
                where: { id: storeId },
                select: {
                    botSettings: true,
                    name: true
                }
            });
            if (!store) {
                return { success: false, error: 'Store not found' };
            }
            const newSettings = store.botSettings ? JSON.parse(store.botSettings) : undefined;
            activeBot.config.settings = newSettings;
            activeBot.handler = new botHandlerService_js_1.default(storeId);
            logger_js_1.logger.info('Successfully reloaded settings', { storeName: (0, sanitizer_js_1.sanitizeForLog)(store.name) });
            return { success: true };
        }
        catch (error) {
            logger_js_1.logger.error('Failed to reload bot settings', { storeId: (0, sanitizer_js_1.sanitizeForLog)(storeId), error });
            return { success: false, error: 'Failed to reload bot settings' };
        }
    }
    getActiveBotsInfo() {
        return Array.from(this.activeBots.entries()).map(([storeId, bot]) => ({
            storeId,
            username: bot.config.username,
            status: 'ACTIVE'
        }));
    }
}
exports.botFactoryService = new BotFactoryService();
//# sourceMappingURL=botFactoryService.js.map