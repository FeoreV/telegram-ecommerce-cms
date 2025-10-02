import { Response } from 'express';
import { botFactoryService } from '../services/botFactoryService.js';
import { getWebhookManager } from '../services/webhookManagerService.js';
import { prisma } from '../lib/prisma.js';
import { logger, toLogMetadata } from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateInput } from '../utils/validation.js';
import { z } from 'zod';
import { UserRole } from '../utils/jwt';
import { AuthenticatedRequest } from '../auth/SecureAuthSystem';

// Validation schemas
const createBotSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  botToken: z.string().min(1, 'Bot token is required').regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid bot token format'),
  botUsername: z.string().optional()
});

const updateBotSettingsSchema = z.object({
  settings: z.object({
    welcome_message: z.string().optional(),
    language: z.enum(['ru', 'en', 'uk']).optional(),
    timezone: z.string().optional(),
    auto_responses: z.boolean().optional(),
    payment_methods: z.array(z.string()).optional()
  })
});

/**
 * Get all bots for user's stores
 */
export const getUserBots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;

  // Get user's stores based on role
  let storeQuery;
  if (req.user.role === 'OWNER') {
    storeQuery = { ownerId: userId };
  } else if (req.user.role === 'ADMIN') {
    // Get stores where user is admin
    const adminStores = await prisma.storeAdmin.findMany({
      where: { userId },
      select: { storeId: true }
    });
    storeQuery = { 
      id: { in: adminStores.map(admin => admin.storeId) }
    };
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Недостаточно прав для просмотра ботов' 
    });
  }

  const stores = await prisma.store.findMany({
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

  // Get real-time bot activity from Bot Factory Service
  const botsWithActivity = stores.map(store => {
    const activeBot = botFactoryService.getBotByStore(store.id);
    
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
    stats: botFactoryService.getBotStats()
  });
});

/**
 * Create new bot for store
 */
export const createBot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId, botToken, botUsername } = validateInput(createBotSchema, req.body);

  // Check if user has permission to manage this store
  await verifyStorePermission(req.user, storeId);

  // Check if store already has a bot
  const store = await prisma.store.findUnique({
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

  // Create bot using Bot Factory Service
  const result = await botFactoryService.createBot(storeId, botToken, botUsername);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error
    });
  }

  // Get updated store info
  const updatedStore = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      botUsername: true,
      botStatus: true,
      botCreatedAt: true
    }
  });

  logger.info(`✅ Bot created for store ${store.name} by user ${req.user.id}`);

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

/**
 * Remove bot from store
 */
export const removeBot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  // Get store info before removal
  const store = await prisma.store.findUnique({
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

  // Remove bot using Bot Factory Service
  const result = await botFactoryService.removeBot(storeId);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  logger.info(`🗑️ Bot @${store.botUsername} removed from store ${store.name} by user ${req.user.id}`);

  res.json({
    success: true,
    message: `Бот @${store.botUsername} успешно удален`
  });
});

/**
 * Update bot settings
 */
export const updateBotSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;
  const { settings } = validateInput(updateBotSettingsSchema, req.body);

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  // Get current settings
  const store = await prisma.store.findUnique({
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

  // Merge with existing settings
  const currentSettings = store.botSettings ? JSON.parse(store.botSettings) : {};
  const newSettings = { ...currentSettings, ...settings };

  // Update in database
  await prisma.store.update({
    where: { id: storeId },
    data: { 
      botSettings: JSON.stringify(newSettings),
      updatedAt: new Date()
    }
  });

  logger.info(`⚙️ Bot settings updated for store ${store.name} by user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Настройки бота обновлены',
    settings: newSettings
  });
});

/**
 * Get bot statistics for store
 */
export const getBotStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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

  // Get real-time stats from Bot Factory Service
  const activeBot = botFactoryService.getBotByStore(storeId);

  // Get order statistics
  const orderStats = await prisma.order.groupBy({
    by: ['status'],
    where: { storeId },
    _count: { status: true }
  });

  // Get recent activity (last 24 hours)
  const recentOrders = await prisma.order.count({
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
      }, {} as Record<string, number>),
      recentActivity: {
        orders24h: recentOrders
      }
    }
  });
});

/**
 * Get global bot factory statistics (OWNER/SUPER_ADMIN only)
 */
export const getGlobalBotStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Only allow OWNER role access to global stats
  if (req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Недостаточно прав доступа'
    });
  }

  const factoryStats = botFactoryService.getBotStats();

  // Get database statistics
  const dbStats = await prisma.store.groupBy({
    by: ['botStatus'],
    where: {
      botToken: { not: null }
    },
    _count: { botStatus: true }
  });

  const totalStores = await prisma.store.count();
  const storesWithBots = await prisma.store.count({
    where: { botToken: { not: null } }
  });

  res.json({
    success: true,
    stats: {
      factory: factoryStats,
      database: dbStats.reduce((acc, stat) => {
        acc[stat.botStatus] = stat._count.botStatus;
        return acc;
      }, {} as Record<string, number>),
      overview: {
        totalStores,
        storesWithBots,
        storesWithoutBots: totalStores - storesWithBots
      }
    }
  });
});

/**
 * Restart bot for store (in case of issues)
 */
export const restartBot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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

  // Remove old instance
  await botFactoryService.removeBot(storeId);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create new instance
  const result = await botFactoryService.createBot(storeId, store.botToken, store.botUsername);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: result.error || 'Не удалось перезапустить бота'
    });
  }

  logger.info(`🔄 Bot restarted for store ${store.name} by user ${req.user.id}`);

  res.json({
    success: true,
    message: `Бот @${store.botUsername} успешно перезапущен`
  });
});

/**
 * Enable webhook for bot
 */
export const enableWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;
  // const { _baseUrl } = validateInput(webhookConfigSchema, { ...req.body, enabled: true });
 // Unused variable removed

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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
    const webhookManager = getWebhookManager();
    const result = await webhookManager.addWebhook(storeId, store.botToken);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    logger.info(`✅ Webhook enabled for store ${store.name} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Webhook успешно включен',
      webhookUrl: result.webhookUrl
    });
  } catch (error: unknown) {
    logger.error(`Error enabling webhook for store ${storeId}:`, {
      error: error instanceof Error ? error.message : String(error),
      storeId
    });
    res.status(500).json({
      success: false,
      message: 'Webhook Manager не инициализирован'
    });
  }
});

/**
 * Disable webhook for bot
 */
export const disableWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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
    const webhookManager = getWebhookManager();
    const result = await webhookManager.removeWebhook(storeId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    logger.info(`🔄 Webhook disabled for store ${store.name} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Webhook отключен, бот переведен на polling'
    });
  } catch (error: unknown) {
    logger.error(`Error disabling webhook for store ${storeId}:`, {
      error: error instanceof Error ? error.message : String(error),
      storeId
    });
    res.status(500).json({
      success: false,
      message: 'Webhook Manager не инициализирован'
    });
  }
});

/**
 * Get webhook status for store
 */
export const getWebhookStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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
    const webhookManager = getWebhookManager();
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
  } catch (error) {
    // Webhook Manager может быть не инициализирован
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

/**
 * Get global webhook statistics (OWNER only)
 */
export const getGlobalWebhookStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Only allow OWNER role access to global stats
  if (req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Недостаточно прав доступа'
    });
  }

  try {
    const webhookManager = getWebhookManager();
    const stats = webhookManager.getWebhookStats();

    // Get database statistics
    const dbStats = await prisma.store.count({
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
  } catch (error) {
    // Webhook Manager может быть не инициализирован
    const dbStats = await prisma.store.count({
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

/**
 * Get bot settings for store
 */
export const getBotSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Check permissions
  await verifyStorePermission(req.user, storeId);

  const store = await prisma.store.findUnique({
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

  // Parse bot settings or return defaults
  let settings: Record<string, any> = {};
  if (store.botSettings) {
    try {
      settings = JSON.parse(store.botSettings);
    } catch (error: unknown) {
      logger.warn(`Failed to parse bot settings for store ${storeId}:`, toLogMetadata(error));
      settings = {};
    }
  }

  logger.info(`Bot settings retrieved for store ${store.name} by user ${req.user.id}`);

  res.json({
    success: true,
    settings: {
      // Default settings merged with stored settings
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
      ...settings // Override defaults with stored settings
    },
    botInfo: {
      username: store.botUsername,
      status: store.botStatus,
      createdAt: store.botCreatedAt
    }
  });
});

/**
 * Helper function to verify store permission
 */
async function verifyStorePermission(user: { id: string; role: UserRole }, storeId: string): Promise<void> {
  if (user.role === 'OWNER') {
    // Owners can access stores they own
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: user.id
      }
    });
    
    if (!store) {
      throw new Error('У вас нет доступа к этому магазину');
    }
  } else if (user.role === 'ADMIN') {
    // Admins can access stores they're assigned to
    const storeAdmin = await prisma.storeAdmin.findFirst({
      where: {
        storeId,
        userId: user.id
      }
    });
    
    if (!storeAdmin) {
      throw new Error('У вас нет доступа к этому магазину');
    }
  } else {
    throw new Error('Недостаточно прав для управления ботами');
  }
}
