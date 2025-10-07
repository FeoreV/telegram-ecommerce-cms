"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotSettings = exports.getGlobalWebhookStats = exports.getWebhookStatus = exports.disableWebhook = exports.enableWebhook = exports.restartBot = exports.getGlobalBotStats = exports.getBotStats = exports.updateBotSettings = exports.removeBot = exports.createBot = exports.getUserBots = void 0;
const zod_1 = require("zod");
const prisma_js_1 = require("../lib/prisma.js");
const botFactoryService_js_1 = require("../services/botFactoryService.js");
const webhookManagerService_js_1 = require("../services/webhookManagerService.js");
const asyncHandler_js_1 = require("../utils/asyncHandler.js");
const logger_js_1 = require("../utils/logger.js");
const sanitizer_1 = require("../utils/sanitizer");
const validation_js_1 = require("../utils/validation.js");
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
        payment_methods: zod_1.z.array(zod_1.z.string()).optional(),
        welcomeMessage: zod_1.z.string().optional(),
        currency: zod_1.z.string().optional(),
        startCustomization: zod_1.z.object({
            emoji: zod_1.z.string().optional(),
            greeting: zod_1.z.string().optional(),
            welcomeText: zod_1.z.string().optional(),
            showStats: zod_1.z.boolean().optional(),
            showDescription: zod_1.z.boolean().optional(),
            additionalText: zod_1.z.string().optional(),
            headerImage: zod_1.z.string().optional(),
            catalogButton: zod_1.z.object({ text: zod_1.z.string(), emoji: zod_1.z.string().optional() }).optional(),
            profileButton: zod_1.z.object({ text: zod_1.z.string(), emoji: zod_1.z.string().optional() }).optional(),
            helpButton: zod_1.z.object({ text: zod_1.z.string(), emoji: zod_1.z.string().optional() }).optional(),
            extraButtons: zod_1.z.array(zod_1.z.object({
                text: zod_1.z.string(),
                url: zod_1.z.string().optional(),
                callback_data: zod_1.z.string().optional()
            })).optional()
        }).optional(),
        menuCustomization: zod_1.z.object({
            catalogText: zod_1.z.string().optional(),
            ordersText: zod_1.z.string().optional(),
            profileText: zod_1.z.string().optional(),
            helpText: zod_1.z.string().optional()
        }).optional(),
        autoResponses: zod_1.z.object({
            responses: zod_1.z.array(zod_1.z.object({
                trigger: zod_1.z.string(),
                response: zod_1.z.string(),
                enabled: zod_1.z.boolean().optional()
            })).optional()
        }).optional(),
        faqs: zod_1.z.array(zod_1.z.object({
            question: zod_1.z.string(),
            answer: zod_1.z.string()
        })).optional(),
        customCommands: zod_1.z.array(zod_1.z.object({
            command: zod_1.z.string(),
            description: zod_1.z.string().optional(),
            response: zod_1.z.string(),
            enabled: zod_1.z.boolean().optional()
        })).optional(),
        paymentSettings: zod_1.z.object({
            enabled: zod_1.z.boolean().optional(),
            instructions: zod_1.z.string().optional(),
            bankDetails: zod_1.z.object({
                accountName: zod_1.z.string().optional(),
                accountNumber: zod_1.z.string().optional(),
                bankName: zod_1.z.string().optional(),
                notes: zod_1.z.string().optional()
            }).optional()
        }).optional(),
        notificationSettings: zod_1.z.object({
            newOrderAlert: zod_1.z.boolean().optional(),
            paymentConfirmation: zod_1.z.boolean().optional(),
            orderStatusUpdate: zod_1.z.boolean().optional()
        }).optional(),
        appearance: zod_1.z.object({
            theme: zod_1.z.string().optional(),
            primaryColor: zod_1.z.string().optional(),
            useEmojis: zod_1.z.boolean().optional()
        }).optional(),
        catalog: zod_1.z.object({
            itemsPerPage: zod_1.z.number().optional(),
            showImages: zod_1.z.boolean().optional(),
            sortBy: zod_1.z.string().optional()
        }).optional(),
        notifications: zod_1.z.object({
            orderCreated: zod_1.z.boolean().optional(),
            orderPaid: zod_1.z.boolean().optional(),
            stockLow: zod_1.z.boolean().optional()
        }).optional(),
        advanced: zod_1.z.object({
            enableAnalytics: zod_1.z.boolean().optional(),
            sessionTimeout: zod_1.z.number().optional(),
            debugMode: zod_1.z.boolean().optional()
        }).optional()
    }).passthrough()
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
        where: {
            ...storeQuery,
            OR: [
                { botToken: { not: null } },
                { botUsername: { not: null } }
            ]
        },
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
    logger_js_1.logger.info('Bot created for store', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
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
    if (!store.botUsername && !store.botToken) {
        return res.status(400).json({
            success: false,
            message: 'У этого магазина нет данных бота для удаления'
        });
    }
    const result = await botFactoryService_js_1.botFactoryService.removeBot(storeId);
    if (!result.success) {
        return res.status(500).json({
            success: false,
            message: result.error
        });
    }
    const botIdentifier = store.botUsername ? `@${store.botUsername}` : 'Бот';
    logger_js_1.logger.info('Bot removed from store', { bot: (0, sanitizer_1.sanitizeForLog)(botIdentifier), storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
    res.json({
        success: true,
        message: `${botIdentifier} успешно удален из магазина ${store.name}`
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
    logger_js_1.logger.info('Bot settings updated', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
    try {
        const reloadResult = await botFactoryService_js_1.botFactoryService.reloadBotSettings(storeId);
        if (reloadResult.success) {
            logger_js_1.logger.info('Bot settings reloaded', { storeId: (0, sanitizer_1.sanitizeForLog)(storeId) });
        }
        else {
            logger_js_1.logger.warn('Could not reload bot settings', { error: (0, sanitizer_1.sanitizeForLog)(reloadResult.error) });
        }
    }
    catch (error) {
        logger_js_1.logger.error('Error reloading bot settings:', error);
    }
    res.json({
        success: true,
        message: 'Настройки бота обновлены и применены',
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
    logger_js_1.logger.info('Bot restarted', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
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
        logger_js_1.logger.info('Webhook enabled', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
        res.json({
            success: true,
            message: 'Webhook успешно включен',
            webhookUrl: result.webhookUrl
        });
    }
    catch (error) {
        logger_js_1.logger.error('Error enabling webhook', {
            storeId: (0, sanitizer_1.sanitizeForLog)(storeId),
            error: error instanceof Error ? error.message : String(error)
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
        logger_js_1.logger.info('Webhook disabled', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
        res.json({
            success: true,
            message: 'Webhook отключен, бот переведен на polling'
        });
    }
    catch (error) {
        logger_js_1.logger.error('Error disabling webhook', {
            storeId: (0, sanitizer_1.sanitizeForLog)(storeId),
            error: error instanceof Error ? error.message : String(error)
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
    catch {
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
    catch {
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
            logger_js_1.logger.warn('Failed to parse bot settings', { storeId: (0, sanitizer_1.sanitizeForLog)(storeId), error: (0, logger_js_1.toLogMetadata)(error) });
            settings = {};
        }
    }
    logger_js_1.logger.info('Bot settings retrieved', { storeName: (0, sanitizer_1.sanitizeForLog)(store.name), userId: (0, sanitizer_1.sanitizeForLog)(req.user.id) });
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