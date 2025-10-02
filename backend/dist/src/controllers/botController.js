"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotSettings = exports.getGlobalWebhookStats = exports.getWebhookStatus = exports.disableWebhook = exports.enableWebhook = exports.restartBot = exports.getGlobalBotStats = exports.getBotStats = exports.updateBotSettings = exports.removeBot = exports.createBot = exports.getUserBots = void 0;
const botFactoryService_js_1 = require("../services/botFactoryService.js");
const webhookManagerService_js_1 = require("../services/webhookManagerService.js");
const prisma_js_1 = require("../lib/prisma.js");
const logger_js_1 = require("../utils/logger.js");
const asyncHandler_js_1 = require("../utils/asyncHandler.js");
const validation_js_1 = require("../utils/validation.js");
const zod_1 = require("zod");
const createBotSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1, 'Store ID is required'),
    botToken: zod_1.z.string().min(1, 'Bot token is required').regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid bot token format'),
    botUsername: zod_1.z.string().optional()
});
const updateBotSettingsSchema = zod_1.z.object({
    settings: zod_1.z.object({
        welcome_message: zod_1.z.string().optional(),
        language: zod_1.z.enum(['ru', 'en', 'uk']).optional(),
        timezone: zod_1.z.string().optional(),
        auto_responses: zod_1.z.boolean().optional(),
        payment_methods: zod_1.z.array(zod_1.z.string()).optional()
    })
});
exports.getUserBots = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    let storeQuery;
    if (req.user.role === 'OWNER') {
        storeQuery = { ownerId: userId };
    }
    else if (req.user.role === 'ADMIN') {
        const adminStores = await prisma_js_1.prisma.storeAdmin.findMany({
            where: { userId },
            select: { storeId: true }
        });
        storeQuery = {
            id: { in: adminStores.map(admin => admin.storeId) }
        };
    }
    else {
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав для просмотра ботов'
        });
    }
    const stores = await prisma_js_1.prisma.store.findMany({
        where: storeQuery,
        select: {
            id: true,
            name: true,
            slug: true,
            botToken: true,
            botUsername: true,
            botStatus: true,
            botCreatedAt: true,
            botLastActive: true,
            botSettings: true,
            _count: {
                select: {
                    orders: true,
                    products: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    const botsWithActivity = stores.map(store => {
        const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(store.id);
        return {
            storeId: store.id,
            storeName: store.name,
            storeSlug: store.slug,
            botUsername: store.botUsername,
            botStatus: store.botStatus,
            botCreatedAt: store.botCreatedAt,
            botLastActive: store.botLastActive,
            botSettings: store.botSettings ? JSON.parse(store.botSettings) : null,
            hasToken: !!store.botToken,
            isActive: !!activeBot,
            messageCount: activeBot?.messageCount || 0,
            lastActivity: activeBot?.lastActivity || store.botLastActive,
            orderCount: store._count.orders,
            productCount: store._count.products
        };
    });
    res.json({
        success: true,
        bots: botsWithActivity,
        stats: botFactoryService_js_1.botFactoryService.getBotStats()
    });
});
exports.createBot = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId, botToken, botUsername } = (0, validation_js_1.validateInput)(createBotSchema, req.body);
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botToken: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (store.botToken && store.botStatus === 'ACTIVE') {
        return res.status(400).json({
            success: false,
            message: 'У этого магазина уже есть активный бот'
        });
    }
    const result = await botFactoryService_js_1.botFactoryService.createBot(storeId, botToken, botUsername);
    if (!result.success) {
        return res.status(400).json({
            success: false,
            message: result.error
        });
    }
    const updatedStore = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botUsername: true,
            botStatus: true,
            botCreatedAt: true
        }
    });
    logger_js_1.logger.info(`✅ Bot created for store ${store.name} by user ${req.user.id}`);
    res.status(201).json({
        success: true,
        message: `Бот @${updatedStore?.botUsername} успешно создан`,
        bot: {
            storeId: updatedStore?.id,
            storeName: updatedStore?.name,
            botUsername: updatedStore?.botUsername,
            botStatus: updatedStore?.botStatus,
            botCreatedAt: updatedStore?.botCreatedAt,
            isActive: true
        }
    });
});
exports.removeBot = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botUsername: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (!store.botUsername) {
        return res.status(400).json({
            success: false,
            message: 'У этого магазина нет бота'
        });
    }
    const result = await botFactoryService_js_1.botFactoryService.removeBot(storeId);
    if (!result.success) {
        return res.status(500).json({
            success: false,
            message: result.error
        });
    }
    logger_js_1.logger.info(`🗑️ Bot @${store.botUsername} removed from store ${store.name} by user ${req.user.id}`);
    res.json({
        success: true,
        message: `Бот @${store.botUsername} успешно удален`
    });
});
exports.updateBotSettings = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    const { settings } = (0, validation_js_1.validateInput)(updateBotSettingsSchema, req.body);
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botSettings: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (store.botStatus !== 'ACTIVE') {
        return res.status(400).json({
            success: false,
            message: 'Бот не активен'
        });
    }
    const currentSettings = store.botSettings ? JSON.parse(store.botSettings) : {};
    const newSettings = { ...currentSettings, ...settings };
    await prisma_js_1.prisma.store.update({
        where: { id: storeId },
        data: {
            botSettings: JSON.stringify(newSettings),
            updatedAt: new Date()
        }
    });
    logger_js_1.logger.info(`⚙️ Bot settings updated for store ${store.name} by user ${req.user.id}`);
    res.json({
        success: true,
        message: 'Настройки бота обновлены',
        settings: newSettings
    });
});
exports.getBotStats = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botUsername: true,
            botStatus: true,
            botCreatedAt: true,
            botLastActive: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    const activeBot = botFactoryService_js_1.botFactoryService.getBotByStore(storeId);
    const orderStats = await prisma_js_1.prisma.order.groupBy({
        by: ['status'],
        where: { storeId },
        _count: { status: true }
    });
    const recentOrders = await prisma_js_1.prisma.order.count({
        where: {
            storeId,
            createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    });
    res.json({
        success: true,
        stats: {
            botInfo: {
                username: store.botUsername,
                status: store.botStatus,
                createdAt: store.botCreatedAt,
                lastActive: activeBot?.lastActivity || store.botLastActive,
                isActive: !!activeBot,
                messageCount: activeBot?.messageCount || 0
            },
            orderStats: orderStats.reduce((acc, stat) => {
                acc[stat.status] = stat._count.status;
                return acc;
            }, {}),
            recentActivity: {
                orders24h: recentOrders
            }
        }
    });
});
exports.getGlobalBotStats = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'OWNER') {
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав доступа'
        });
    }
    const factoryStats = botFactoryService_js_1.botFactoryService.getBotStats();
    const dbStats = await prisma_js_1.prisma.store.groupBy({
        by: ['botStatus'],
        where: {
            botToken: { not: null }
        },
        _count: { botStatus: true }
    });
    const totalStores = await prisma_js_1.prisma.store.count();
    const storesWithBots = await prisma_js_1.prisma.store.count({
        where: { botToken: { not: null } }
    });
    res.json({
        success: true,
        stats: {
            factory: factoryStats,
            database: dbStats.reduce((acc, stat) => {
                acc[stat.botStatus] = stat._count.botStatus;
                return acc;
            }, {}),
            overview: {
                totalStores,
                storesWithBots,
                storesWithoutBots: totalStores - storesWithBots
            }
        }
    });
});
exports.restartBot = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botToken: true,
            botUsername: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (!store.botToken || !store.botUsername) {
        return res.status(400).json({
            success: false,
            message: 'У магазина нет настроенного бота'
        });
    }
    await botFactoryService_js_1.botFactoryService.removeBot(storeId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const result = await botFactoryService_js_1.botFactoryService.createBot(storeId, store.botToken, store.botUsername);
    if (!result.success) {
        return res.status(500).json({
            success: false,
            message: result.error || 'Не удалось перезапустить бота'
        });
    }
    logger_js_1.logger.info(`🔄 Bot restarted for store ${store.name} by user ${req.user.id}`);
    res.json({
        success: true,
        message: `Бот @${store.botUsername} успешно перезапущен`
    });
});
exports.enableWebhook = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botToken: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (!store.botToken || store.botStatus !== 'ACTIVE') {
        return res.status(400).json({
            success: false,
            message: 'Бот неактивен или не настроен'
        });
    }
    try {
        const webhookManager = (0, webhookManagerService_js_1.getWebhookManager)();
        const result = await webhookManager.addWebhook(storeId, store.botToken);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }
        logger_js_1.logger.info(`✅ Webhook enabled for store ${store.name} by user ${req.user.id}`);
        res.json({
            success: true,
            message: 'Webhook успешно включен',
            webhookUrl: result.webhookUrl
        });
    }
    catch (error) {
        logger_js_1.logger.error(`Error enabling webhook for store ${storeId}:`, {
            error: error instanceof Error ? error.message : String(error),
            storeId
        });
        res.status(500).json({
            success: false,
            message: 'Webhook Manager не инициализирован'
        });
    }
});
exports.disableWebhook = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    try {
        const webhookManager = (0, webhookManagerService_js_1.getWebhookManager)();
        const result = await webhookManager.removeWebhook(storeId);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }
        logger_js_1.logger.info(`🔄 Webhook disabled for store ${store.name} by user ${req.user.id}`);
        res.json({
            success: true,
            message: 'Webhook отключен, бот переведен на polling'
        });
    }
    catch (error) {
        logger_js_1.logger.error(`Error disabling webhook for store ${storeId}:`, {
            error: error instanceof Error ? error.message : String(error),
            storeId
        });
        res.status(500).json({
            success: false,
            message: 'Webhook Manager не инициализирован'
        });
    }
});
exports.getWebhookStatus = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botWebhookUrl: true,
            botStatus: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    try {
        const webhookManager = (0, webhookManagerService_js_1.getWebhookManager)();
        const status = await webhookManager.checkWebhookStatus(storeId);
        res.json({
            success: true,
            webhook: {
                enabled: !!store.botWebhookUrl,
                url: store.botWebhookUrl,
                isActive: status.isActive,
                lastUpdate: status.lastUpdate,
                errors: status.errors,
                botStatus: store.botStatus
            }
        });
    }
    catch (error) {
        res.json({
            success: true,
            webhook: {
                enabled: !!store.botWebhookUrl,
                url: store.botWebhookUrl,
                isActive: false,
                botStatus: store.botStatus,
                note: 'Webhook Manager не инициализирован (используется polling)'
            }
        });
    }
});
exports.getGlobalWebhookStats = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'OWNER') {
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав доступа'
        });
    }
    try {
        const webhookManager = (0, webhookManagerService_js_1.getWebhookManager)();
        const stats = webhookManager.getWebhookStats();
        const dbStats = await prisma_js_1.prisma.store.count({
            where: {
                botWebhookUrl: { not: null },
                botStatus: 'ACTIVE'
            }
        });
        res.json({
            success: true,
            stats: {
                ...stats,
                dbWebhookCount: dbStats
            }
        });
    }
    catch (error) {
        const dbStats = await prisma_js_1.prisma.store.count({
            where: {
                botWebhookUrl: { not: null },
                botStatus: 'ACTIVE'
            }
        });
        res.json({
            success: true,
            stats: {
                totalWebhooks: 0,
                activeWebhooks: 0,
                errorCount: 0,
                webhooks: [],
                dbWebhookCount: dbStats,
                note: 'Webhook Manager не инициализирован'
            }
        });
    }
});
exports.getBotSettings = (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    await verifyStorePermission(req.user, storeId);
    const store = await prisma_js_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            botUsername: true,
            botStatus: true,
            botSettings: true,
            botCreatedAt: true
        }
    });
    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Магазин не найден'
        });
    }
    if (!store.botUsername) {
        return res.status(404).json({
            success: false,
            message: 'У этого магазина нет бота'
        });
    }
    let settings = {};
    if (store.botSettings) {
        try {
            settings = JSON.parse(store.botSettings);
        }
        catch (error) {
            logger_js_1.logger.warn(`Failed to parse bot settings for store ${storeId}:`, (0, logger_js_1.toLogMetadata)(error));
            settings = {};
        }
    }
    logger_js_1.logger.info(`Bot settings retrieved for store ${store.name} by user ${req.user.id}`);
    res.json({
        success: true,
        settings: {
            welcomeMessage: 'Добро пожаловать в наш магазин! 🛍️',
            language: 'ru',
            currency: 'USD',
            timezone: 'UTC',
            theme: 'light',
            primaryColor: '#1976d2',
            accentColor: '#ff4081',
            catalogStyle: 'grid',
            showPrices: true,
            showStock: true,
            enableSearch: true,
            categoriesPerPage: 6,
            productsPerPage: 8,
            autoResponses: {
                enabled: true,
                responses: []
            },
            notifications: {
                newOrder: true,
                lowStock: true,
                paymentConfirmation: true,
                orderStatusUpdate: true,
                customNotifications: []
            },
            paymentMethods: ['manual_verification'],
            paymentInstructions: 'Переведите указанную сумму по реквизитам ниже и прикрепите скриншот чека для подтверждения.',
            paymentRequisites: {
                card: null,
                bank: null,
                receiver: null,
                comment: null
            },
            enableAnalytics: true,
            enableReferralSystem: false,
            enableReviews: true,
            customCommands: [],
            ...settings
        },
        botInfo: {
            username: store.botUsername,
            status: store.botStatus,
            createdAt: store.botCreatedAt
        }
    });
});
async function verifyStorePermission(user, storeId) {
    if (user.role === 'OWNER') {
        const store = await prisma_js_1.prisma.store.findFirst({
            where: {
                id: storeId,
                ownerId: user.id
            }
        });
        if (!store) {
            throw new Error('У вас нет доступа к этому магазину');
        }
    }
    else if (user.role === 'ADMIN') {
        const storeAdmin = await prisma_js_1.prisma.storeAdmin.findFirst({
            where: {
                storeId,
                userId: user.id
            }
        });
        if (!storeAdmin) {
            throw new Error('У вас нет доступа к этому магазину');
        }
    }
    else {
        throw new Error('Недостаточно прав для управления ботами');
    }
}
//# sourceMappingURL=botController.js.map