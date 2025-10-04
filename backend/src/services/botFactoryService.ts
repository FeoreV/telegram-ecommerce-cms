import crypto from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../lib/prisma.js';
import { logger, toLogMetadata } from '../utils/logger.js';
import { sanitizeForLog } from '../utils/sanitizer.js';
import BotHandlerService from './botHandlerService.js';
import { encryptionService } from './EncryptionService.js';
import { NotificationChannel, NotificationPriority, NotificationService, NotificationType } from './notificationService.js';

interface BotConfig {
  token: string;
  username: string;
  storeId: string;
  webhookUrl?: string;
  settings?: BotSettings;
}

interface BotSettings {
  welcome_message?: string;
  currency_symbol?: string;
  language?: string;
  timezone?: string;
  business_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
  auto_responses?: boolean;
  payment_methods?: string[];
}

interface ActiveBot {
  bot: TelegramBot;
  storeId: string;
  config: BotConfig;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastActivity: Date;
  messageCount: number;
  handler: BotHandlerService;
}

class BotFactoryService {
  private activeBots: Map<string, ActiveBot> = new Map(); // storeId -> ActiveBot
  private botTokenToStoreId: Map<string, string> = new Map(); // token -> storeId
  private isInitialized = false;

  constructor() {
    this.setupGracefulShutdown();
  }

  /**
   * Normalize and validate a Telegram bot token pasted in various formats.
   * - Trims whitespace
   * - If a full API URL was pasted (e.g. https://api.telegram.org/bot<token>), extracts the token
   * - Returns null if the token doesn't match expected pattern
   */
  private sanitizeAndValidateToken(rawToken: string | null | undefined): string | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    let token = rawToken.trim();

    // If someone pasted a full URL, try to extract token after '/bot'
    const urlMatch = token.match(/https?:\/\/[^\s]*\/bot([^\s/]+)/i);
    if (urlMatch && urlMatch[1]) {
      token = urlMatch[1];
    }

    // Basic Telegram token format: digits ':' then base64-like string with - and _ allowed
    const tokenPattern = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;
    if (!tokenPattern.test(token)) {
      return null;
    }
    return token;
  }

  /**
   * Initialize Bot Factory Service
   * Loads existing active bots from database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🤖 Initializing Bot Factory Service...');

      // Load active bots from database
      const activeBotStores = await prisma.store.findMany({
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

      logger.info('Found active bots to restore', { count: activeBotStores.length });

      // Restore each bot
      for (const store of activeBotStores) {
        if (store.botToken && store.botUsername) {
          try {
            // SECURITY: Decrypt bot token from database (CWE-312)
            let decryptedToken: string;
            try {
              decryptedToken = await encryptionService.decryptData(store.botToken);
            } catch (error) {
              // If decryption fails, token might not be encrypted (legacy data)
              logger.warn('Failed to decrypt token, trying as plaintext', { storeId: sanitizeForLog(store.id) });
              decryptedToken = store.botToken;
            }

            const sanitized = this.sanitizeAndValidateToken(decryptedToken);
            if (!sanitized) {
              logger.error('Invalid bot token format, suspending bot', { storeId: sanitizeForLog(store.id) });
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

            logger.info('Restored bot for store', { storeName: sanitizeForLog(store.name), botUsername: sanitizeForLog(store.botUsername || '') });
          } catch (error) {
            logger.error('Failed to restore bot', { storeName: sanitizeForLog(store.name), error });

            // Mark bot as inactive in database
            await this.updateBotStatus(store.id, 'INACTIVE');
          }
        }
      }

      this.isInitialized = true;
      logger.info('Bot Factory Service initialized', { activeBotsCount: this.activeBots.size });

    } catch (error) {
      logger.error('❌ Failed to initialize Bot Factory Service:', error);
      throw error;
    }
  }

  /**
   * Create a new bot for a store
   */
  async createBot(storeId: string, botToken: string, botUsername?: string): Promise<{ success: boolean; error?: string; bot?: ActiveBot }> {
    try {
      logger.info('Creating new bot for store', { storeId: sanitizeForLog(storeId) });

      // Sanitize & validate token
      const sanitizedToken = this.sanitizeAndValidateToken(botToken);
      if (!sanitizedToken) {
        return { success: false, error: 'Неверный формат токена бота. Вставьте только сам токен из @BotFather.' };
      }

      // Validate bot token by calling getMe
      const testBot = new TelegramBot(sanitizedToken, { polling: false, webHook: false });

      let botInfo;
      try {
        botInfo = await testBot.getMe();
      } catch (error) {
        logger.error('Invalid bot token:', error);
        return { success: false, error: 'Неверный токен бота. Проверьте токен в @BotFather' };
      }

      const resolvedUsername = botUsername || botInfo.username;
      if (!resolvedUsername) {
        return { success: false, error: 'Не удалось получить имя пользователя бота' };
      }

      // SECURITY: Encrypt bot token before storing in database (CWE-312)
      const encryptedToken = await encryptionService.encryptData(sanitizedToken);

      // Create hash for duplicate detection
      const tokenHash = crypto.createHash('sha256').update(sanitizedToken).digest('hex');

      // Check if bot token is already used by another store
      // We can't directly search encrypted tokens, so we'll check all stores and decrypt
      const allStores = await prisma.store.findMany({
        where: {
          id: { not: storeId },
          botToken: { not: null }
        },
        select: { id: true, botToken: true }
      });

      for (const store of allStores) {
        try {
          if (store.botToken) {
            const decryptedToken = await encryptionService.decryptData(store.botToken);
            // SECURITY FIX: CWE-208 - Use timing-safe comparison for tokens
            if (crypto.timingSafeEqual(
              Buffer.from(decryptedToken, 'utf8'),
              Buffer.from(sanitizedToken, 'utf8')
            )) {
              return { success: false, error: 'Этот бот уже используется другим магазином' };
            }
          }
        } catch (error) {
          // Skip if decryption fails (might be old unencrypted token)
          logger.warn('Failed to decrypt token', { storeId: sanitizeForLog(store.id) });
        }
      }

      // Update store with bot information
      await prisma.store.update({
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

      // Create bot instance
      const activeBot = await this.createBotInstance({
        token: sanitizedToken,
        username: resolvedUsername,
        storeId: storeId,
        settings: this.getDefaultBotSettings()
      });

      // Send notification about successful bot creation
      await this.notifyBotCreated(storeId, resolvedUsername);

      logger.info('Successfully created bot', { botUsername: sanitizeForLog(resolvedUsername), storeId: sanitizeForLog(storeId) });

      return { success: true, bot: activeBot };

    } catch (error) {
      logger.error('Failed to create bot', { storeId: sanitizeForLog(storeId), error });
      return { success: false, error: 'Произошла ошибка при создании бота' };
    }
  }

  /**
   * Remove bot for a store
   */
  async removeBot(storeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const activeBot = this.activeBots.get(storeId);

      if (activeBot) {
        // Stop bot polling/webhook
        try {
          await activeBot.bot.stopPolling();
        } catch (error) {
          logger.warn('Error stopping bot polling:', error);
        }

        // Clean up handler
        activeBot.handler.cleanup();

        // Remove from active bots
        this.activeBots.delete(storeId);
        this.botTokenToStoreId.delete(activeBot.config.token);
      }

      // Update database
      await prisma.store.update({
        where: { id: storeId },
        data: {
          botToken: null,
          botUsername: null,
          botStatus: 'INACTIVE',
          botWebhookUrl: null,
          botSettings: null
        }
      });

      logger.info('Successfully removed bot', { storeId: sanitizeForLog(storeId) });
      return { success: true };

    } catch (error) {
      logger.error('Failed to remove bot', { storeId: sanitizeForLog(storeId), error });
      return { success: false, error: 'Произошла ошибка при удалении бота' };
    }
  }

  /**
   * Get bot instance by store ID
   */
  getBotByStore(storeId: string): ActiveBot | undefined {
    return this.activeBots.get(storeId);
  }

  /**
   * Get store ID by bot token
   */
  getStoreByBotToken(token: string): string | undefined {
    return this.botTokenToStoreId.get(token);
  }

  /**
   * Get all active bots
   */
  getActiveBots(): ActiveBot[] {
    return Array.from(this.activeBots.values());
  }

  /**
   * Update bot status
   */
  async updateBotStatus(storeId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<void> {
    try {
      await prisma.store.update({
        where: { id: storeId },
        data: { botStatus: status }
      });

      const activeBot = this.activeBots.get(storeId);
      if (activeBot) {
        activeBot.status = status;

        if (status === 'SUSPENDED' || status === 'INACTIVE') {
          try {
            await activeBot.bot.stopPolling();
          } catch (error) {
            logger.warn('Error stopping bot:', error);
          }
        }
      }

      logger.info('Updated bot status', { storeId: sanitizeForLog(storeId), status: sanitizeForLog(status) });
    } catch (error) {
      logger.error('Failed to update bot status', { storeId: sanitizeForLog(storeId), error });
    }
  }

  /**
   * Update bot activity timestamp
   */
  async updateBotActivity(storeId: string): Promise<void> {
    const activeBot = this.activeBots.get(storeId);
    if (activeBot) {
      activeBot.lastActivity = new Date();
      activeBot.messageCount += 1;

      // Update database every 10 messages to reduce DB load
      if (activeBot.messageCount % 10 === 0) {
        try {
          await prisma.store.update({
            where: { id: storeId },
            data: { botLastActive: new Date() }
          });
        } catch (error) {
          logger.warn('Failed to update bot activity in database:', error);
        }
      }
    }
  }

  /**
   * Get bot statistics
   */
  getBotStats(): {
    totalBots: number;
    activeBots: number;
    inactiveBots: number;
    suspendedBots: number;
    totalMessages: number;
  } {
    const bots = this.getActiveBots();

    return {
      totalBots: bots.length,
      activeBots: bots.filter(bot => bot.status === 'ACTIVE').length,
      inactiveBots: bots.filter(bot => bot.status === 'INACTIVE').length,
      suspendedBots: bots.filter(bot => bot.status === 'SUSPENDED').length,
      totalMessages: bots.reduce((sum, bot) => sum + bot.messageCount, 0)
    };
  }

  /**
   * Private: Create bot instance
   */
  private async createBotInstance(config: BotConfig): Promise<ActiveBot> {
    // Support alternative Telegram API base URL if provided (e.g. self-hosted)
    let baseApiUrl: string | undefined;
    const baseApiUrlEnv = process.env.TELEGRAM_BASE_API_URL && process.env.TELEGRAM_BASE_API_URL.trim();
    if (baseApiUrlEnv) {
      try {
        const parsed = new URL(baseApiUrlEnv);
        if (parsed.protocol !== 'https:') {
          logger.warn('Ignoring TELEGRAM_BASE_API_URL because it is not HTTPS', { value: baseApiUrlEnv });
        } else {
          // node-telegram-bot-api expects baseApiUrl without trailing slash handling, we pass as-is
          baseApiUrl = baseApiUrlEnv;
        }
      } catch (error) {
        logger.warn('Ignoring TELEGRAM_BASE_API_URL because it is not a valid URL', { value: baseApiUrlEnv });
      }
    }

    const bot = new TelegramBot(config.token, {
      polling: true,
      webHook: false,
      ...(baseApiUrl ? { baseApiUrl } as any : {}),
    });

    // Create isolated handler for this store
    const handler = new BotHandlerService(config.storeId);

    const activeBot: ActiveBot = {
      bot,
      storeId: config.storeId,
      config,
      status: 'ACTIVE',
      lastActivity: new Date(),
      messageCount: 0,
      handler
    };

    // Set up bot handlers with isolation
    this.setupBotHandlers(activeBot);

    // Add to active bots
    this.activeBots.set(config.storeId, activeBot);
    this.botTokenToStoreId.set(config.token, config.storeId);

    return activeBot;
  }

  /**
   * Private: Set up handlers for bot instance
   */
  private setupBotHandlers(activeBot: ActiveBot): void {
    const { bot, storeId, handler } = activeBot;

    // Message handler with full isolation
    bot.on('message', async (msg: any) => {
      try {
        await this.updateBotActivity(storeId);

        // Use isolated handler for this store
        await handler.handleMessage(bot, msg);
      } catch (error) {
        logger.error('Error handling message', { storeId: sanitizeForLog(storeId), error });

        // If store doesn't exist, stop the bot
        if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
          logger.error(`⛔ Stopping orphaned bot for deleted store ${sanitizeForLog(storeId)}`);
          try {
            await this.removeBot(storeId);
          } catch (stopError) {
            logger.error(`Error stopping orphaned bot for store ${sanitizeForLog(storeId)}:`, stopError);
          }
        }
      }
    });

    // Callback query handler
    bot.on('callback_query', async (query: unknown) => {
      try {
        await this.updateBotActivity(storeId);

        // Use isolated handler for this store
        await handler.handleCallbackQuery(bot, query);
      } catch (error) {
        logger.error(`Error handling callback query for store ${sanitizeForLog(storeId)}:`, error);

        // If store doesn't exist, stop the bot
        if (error instanceof Error && error.message.startsWith('STORE_NOT_FOUND')) {
          logger.error(`⛔ Stopping orphaned bot for deleted store ${sanitizeForLog(storeId)}`);
          try {
            await this.removeBot(storeId);
          } catch (stopError) {
            logger.error(`Error stopping orphaned bot for store ${sanitizeForLog(storeId)}:`, stopError);
          }
        }
      }
    });

    // Error handlers
    bot.on('error', (error: unknown) => {
      logger.error('Bot error', { storeId: sanitizeForLog(storeId), error: toLogMetadata(error) });
    });

    bot.on('polling_error', async (error: unknown) => {
      logger.error('Bot polling error', { storeId: sanitizeForLog(storeId), error: toLogMetadata(error) });
      const errorObj = error as any;
      const message = (errorObj && (errorObj.message || errorObj.code)) || '';
      if (typeof message === 'string' && (message.includes('ERR_INVALID_URL') || message.includes('Invalid URL'))) {
        // Suspend bot to prevent tight error loops and notify
        try {
          await this.updateBotStatus(storeId, 'SUSPENDED');
          logger.error('Suspended bot due to invalid Telegram API URL or malformed token', { storeId: sanitizeForLog(storeId) });
        } catch (e) {
          logger.error('Failed to update bot status after invalid URL error:', e);
        }
      }
    });
  }


  /**
   * Private: Get default bot settings
   */
  private getDefaultBotSettings(): BotSettings {
    return {
      welcome_message: "Добро пожаловать в наш магазин!",
      language: "ru",
      timezone: "UTC",
      auto_responses: true,
      payment_methods: ["manual_verification"]
    };
  }

  /**
   * Private: Send notification about bot creation
   */
  private async notifyBotCreated(storeId: string, botUsername: string): Promise<void> {
    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true }
      });

      if (store) {
        await NotificationService.send({
          title: 'Telegram бот создан',
          message: `Бот @${botUsername} успешно создан для магазина "${store.name}"`,
          type: NotificationType.BOT_CREATED,
          priority: NotificationPriority.HIGH,
          recipients: [store.owner.id],
          channels: [NotificationChannel.SOCKET, NotificationChannel.TELEGRAM],
          data: {
            storeId,
            storeName: store.name,
            botUsername,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to send bot creation notification:', error);
    }
  }

  /**
   * Private: Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async () => {
      logger.info('🔄 Shutting down Bot Factory Service...');

      const shutdownPromises = Array.from(this.activeBots.values()).map(async (activeBot) => {
        try {
          await activeBot.bot.stopPolling();
          activeBot.handler.cleanup();
          logger.info('Stopped bot', { storeId: sanitizeForLog(activeBot.storeId) });
        } catch (error) {
          logger.error('Error stopping bot', { storeId: sanitizeForLog(activeBot.storeId), error });
        }
      });

      await Promise.all(shutdownPromises);
      logger.info('🛑 Bot Factory Service shutdown complete');
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  /**
   * Reload bot settings without full restart
   * Useful for applying configuration changes on-the-fly
   */
  async reloadBotSettings(storeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const activeBot = this.activeBots.get(storeId);

      if (!activeBot) {
        return { success: false, error: 'Bot not active for this store' };
      }

      // Fetch updated settings from database
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          botSettings: true,
          name: true
        }
      });

      if (!store) {
        return { success: false, error: 'Store not found' };
      }

      // Update bot config with new settings
      const newSettings = store.botSettings ? JSON.parse(store.botSettings) : undefined;
      activeBot.config.settings = newSettings;

      // Reinitialize handler to apply language and other settings
      activeBot.handler = new BotHandlerService(storeId);

      logger.info('Successfully reloaded settings', { storeName: sanitizeForLog(store.name) });

      return { success: true };
    } catch (error) {
      logger.error('Failed to reload bot settings', { storeId: sanitizeForLog(storeId), error });
      return { success: false, error: 'Failed to reload bot settings' };
    }
  }

  /**
   * Get all active bots info (simplified)
   */
  getActiveBotsInfo(): Array<{ storeId: string; username: string; status: string }> {
    return Array.from(this.activeBots.entries()).map(([storeId, bot]) => ({
      storeId,
      username: bot.config.username,
      status: 'ACTIVE'
    }));
  }
}

export const botFactoryService = new BotFactoryService();
export { ActiveBot, BotConfig, BotSettings };

