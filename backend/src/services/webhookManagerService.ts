import TelegramBot from 'node-telegram-bot-api';
import express, { Request, Response, NextFunction } from 'express';
import { logger, toLogMetadata } from '../utils/logger.js';
import { prisma } from '../lib/prisma.js';
import { botFactoryService } from './botFactoryService.js';
import { authMiddleware } from '../middleware/auth.js';
import { TelegramWebhookValidator } from '../utils/telegramWebhookValidator.js';

interface WebhookConfig {
  baseUrl: string;
  port: number;
  path: string;
  ssl?: {
    cert: string;
    key: string;
  };
}

interface ActiveWebhook {
  storeId: string;
  botToken: string;
  webhookUrl: string;
  isActive: boolean;
  lastUpdate: Date;
  errorCount: number;
}

/**
 * Webhook Manager Service - Управление webhook для множественных ботов
 * Обеспечивает правильную маршрутизацию webhook запросов к нужным ботам
 */
export class WebhookManagerService {
  private webhooks: Map<string, ActiveWebhook> = new Map(); // storeId -> ActiveWebhook
  private tokenToStoreId: Map<string, string> = new Map(); // token -> storeId
  private app: express.Application;
  private config: WebhookConfig;
  private isInitialized = false;

  constructor(config: WebhookConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Инициализация Webhook Manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🌐 Initializing Webhook Manager Service...');

      // Загружаем существующие активные боты
      const activeBotStores = await prisma.store.findMany({
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

      logger.info(`Found ${activeBotStores.length} bots with webhooks to restore`);

      // Восстанавливаем webhook для каждого бота
      for (const store of activeBotStores) {
        if (store.botToken && store.botWebhookUrl) {
          try {
            await this.addWebhook(store.id, store.botToken);
            logger.info(`✅ Restored webhook for store: ${store.name}`);
          } catch (error) {
            logger.error(`❌ Failed to restore webhook for store ${store.name}:`, error);
            
            // Отключаем webhook в базе данных при ошибке
            await this.disableWebhook(store.id);
          }
        }
      }

      // Запускаем веб-сервер
      await this.startServer();

      this.isInitialized = true;
      logger.info(`🚀 Webhook Manager Service initialized with ${this.webhooks.size} active webhooks`);

    } catch (error) {
      logger.error('❌ Failed to initialize Webhook Manager Service:', error);
      throw error;
    }
  }

  /**
   * Добавить webhook для бота
   */
  async addWebhook(storeId: string, botToken: string): Promise<{ success: boolean; error?: string; webhookUrl?: string }> {
    try {
      logger.info(`🌐 Setting up webhook for store: ${storeId}`);

      // Генерируем уникальный путь для этого бота
      const webhookPath = `/webhook/bot/${storeId}`;
      const webhookUrl = `${this.config.baseUrl}${webhookPath}`;

      // Проверяем, что бот активен в Bot Factory
      const activeBot = botFactoryService.getBotByStore(storeId);
      if (!activeBot) {
        return { success: false, error: 'Бот не активен в системе' };
      }

      // Останавливаем polling если он активен
      try {
        await activeBot.bot.stopPolling();
        logger.info(`Stopped polling for store ${storeId}`);
      } catch (error) {
        logger.warn(`Could not stop polling for store ${storeId}:`, error);
      }

      // Устанавливаем webhook через Telegram API
      const success = await activeBot.bot.setWebHook(webhookUrl, {
        certificate: this.config.ssl?.cert,
        max_connections: 100,
        allowed_updates: ['message', 'callback_query']
      });

      if (!success) {
        return { success: false, error: 'Не удалось установить webhook в Telegram' };
      }

      // Добавляем в наше управление
      const webhookInfo: ActiveWebhook = {
        storeId,
        botToken,
        webhookUrl,
        isActive: true,
        lastUpdate: new Date(),
        errorCount: 0
      };

      this.webhooks.set(storeId, webhookInfo);
      this.tokenToStoreId.set(botToken, storeId);

      // Обновляем в базе данных
      await prisma.store.update({
        where: { id: storeId },
        data: {
          botWebhookUrl: webhookUrl,
          botLastActive: new Date()
        }
      });

      logger.info(`✅ Successfully set webhook for store ${storeId}: ${webhookUrl}`);
      
      return { success: true, webhookUrl };

    } catch (error) {
      logger.error(`❌ Failed to set webhook for store ${storeId}:`, error);
      return { success: false, error: 'Произошла ошибка при установке webhook' };
    }
  }

  /**
   * Удалить webhook для бота
   */
  async removeWebhook(storeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookInfo = this.webhooks.get(storeId);
      
      if (webhookInfo) {
        // Удаляем webhook через Telegram API
        const activeBot = botFactoryService.getBotByStore(storeId);
        if (activeBot) {
          try {
            await activeBot.bot.deleteWebHook();
            logger.info(`Deleted webhook for store ${storeId}`);
          } catch (error) {
            logger.warn(`Could not delete webhook for store ${storeId}:`, error);
          }

          // Возобновляем polling
          try {
            activeBot.bot.startPolling();
            logger.info(`Resumed polling for store ${storeId}`);
          } catch (error) {
            logger.warn(`Could not resume polling for store ${storeId}:`, error);
          }
        }

        // Удаляем из нашего управления
        this.webhooks.delete(storeId);
        this.tokenToStoreId.delete(webhookInfo.botToken);
      }

      // Обновляем базу данных
      await prisma.store.update({
        where: { id: storeId },
        data: {
          botWebhookUrl: null
        }
      });

      logger.info(`🗑️ Successfully removed webhook for store ${storeId}`);
      return { success: true };

    } catch (error) {
      logger.error(`❌ Failed to remove webhook for store ${storeId}:`, error);
      return { success: false, error: 'Произошла ошибка при удалении webhook' };
    }
  }

  /**
   * Получить статистику webhook
   */
  getWebhookStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
    errorCount: number;
    webhooks: ActiveWebhook[];
  } {
    const webhooks = Array.from(this.webhooks.values());
    
    return {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.isActive).length,
      errorCount: webhooks.reduce((sum, w) => sum + w.errorCount, 0),
      webhooks
    };
  }

  /**
   * Проверить статус webhook
   */
  async checkWebhookStatus(storeId: string): Promise<{ isActive: boolean; lastUpdate?: Date; errors?: number }> {
    const webhookInfo = this.webhooks.get(storeId);
    
    if (!webhookInfo) {
      return { isActive: false };
    }

    // Проверяем через Telegram API
    try {
      const activeBot = botFactoryService.getBotByStore(storeId);
      if (activeBot) {
        const webhookInfo = await activeBot.bot.getWebHookInfo();
        return {
          isActive: !!webhookInfo.url,
          lastUpdate: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000) : undefined,
          errors: webhookInfo.last_error_message ? 1 : 0
        };
      }
    } catch (error) {
      logger.warn(`Could not check webhook status for store ${storeId}:`, error);
    }

    return {
      isActive: webhookInfo.isActive,
      lastUpdate: webhookInfo.lastUpdate,
      errors: webhookInfo.errorCount
    };
  }

  /**
   * Private: Настройка middleware
   */
  private setupMiddleware(): void {
    // Парсинг JSON для webhook запросов
    this.app.use('/webhook', express.json({ limit: '10mb' }));
    
    // Логирование webhook запросов
    this.app.use('/webhook', (req, res, next) => {
      logger.debug(`Webhook request: ${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body
      });
      next();
    });

    // Security middleware with enhanced validation
    this.app.use('/webhook', (req: Request, res: Response, next: NextFunction) => {
      // Always validate webhook signatures, not just in production
      const storeId = req.params?.storeId || req.path.split('/')[3]; // Extract from path if not in params yet
      
      if (storeId) {
        const webhook = this.webhooks.get(storeId);
        if (webhook) {
          // Use the unified validator with both secret token and HMAC support
          const validationResult = TelegramWebhookValidator.validateWithEnvironment({
            botToken: webhook.botToken,
            secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
            requestBody: JSON.stringify(req.body),
            headers: req.headers,
            environment: process.env.NODE_ENV,
            requireValidation: true // Always require validation
          });

          if (!validationResult.isValid) {
            logger.warn('Telegram webhook validation failed', {
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

          logger.debug('Telegram webhook validation passed', { storeId });
        } else {
          logger.warn('Webhook request for unknown store', { storeId });
          return res.status(404).json({ error: 'Store not found' });
        }
      }
      
      next();
    });
  }

  /**
   * Private: Настройка маршрутов
   */
  private setupRoutes(): void {
    // Основной обработчик webhook для конкретного бота
    this.app.post('/webhook/bot/:storeId', async (req, res) => {
      try {
        const storeId = req.params.storeId;
        const update = req.body;

        // Проверяем, что webhook зарегистрирован
        const webhookInfo = this.webhooks.get(storeId);
        if (!webhookInfo) {
          logger.warn(`Webhook request for unregistered store: ${storeId}`);
          return res.status(404).json({ error: 'Webhook not found' });
        }

        // Получаем активного бота
        const activeBot = botFactoryService.getBotByStore(storeId);
        if (!activeBot) {
          logger.warn(`Webhook request for inactive bot: ${storeId}`);
          return res.status(503).json({ error: 'Bot not active' });
        }

        // Обрабатываем update через процессор бота
        await this.processWebhookUpdate(storeId, activeBot.bot, update);

        // Обновляем статистику
        webhookInfo.lastUpdate = new Date();
        webhookInfo.errorCount = 0; // Сбрасываем счетчик ошибок при успешной обработке

        res.status(200).json({ ok: true });

      } catch (error) {
        logger.error(`Error processing webhook for store ${req.params.storeId}:`, error);
        
        // Увеличиваем счетчик ошибок
        const webhookInfo = this.webhooks.get(req.params.storeId);
        if (webhookInfo) {
          webhookInfo.errorCount++;
          
          // Отключаем webhook при многих ошибках
          if (webhookInfo.errorCount > 10) {
            await this.disableWebhook(req.params.storeId);
          }
        }

        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Healthcheck для webhook
    this.app.get('/webhook/health', (req, res) => {
      const stats = this.getWebhookStats();
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        ...stats
      });
    });

    // Статистика webhook (требует авторизации)
    this.app.get('/webhook/stats', authMiddleware, (req, res) => {
      // Only OWNER and ADMIN roles can view webhook stats
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

  /**
   * Private: Обработка webhook update
   */
  private async processWebhookUpdate(storeId: string, bot: TelegramBot, update: TelegramBot.Update): Promise<void> {
    try {
      // Обрабатываем различные типы updates
      const botEmitter = bot as unknown as { emit: (event: string, data: unknown) => void };
      if (update.message) {
        botEmitter.emit('message', update.message);
      } else if (update.callback_query) {
        botEmitter.emit('callback_query', update.callback_query);
      } else if (update.inline_query) {
        botEmitter.emit('inline_query', update.inline_query);
      } else if (update.chosen_inline_result) {
        botEmitter.emit('chosen_inline_result', update.chosen_inline_result);
      }
      // Добавить другие типы update по необходимости

      logger.debug(`Processed webhook update for store ${storeId}`, {
        updateType: Object.keys(update).filter(key => key !== 'update_id'),
        updateId: update.update_id
      });

    } catch (error) {
      logger.error(`Error processing webhook update for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Private: Отключить webhook при ошибках
   */
  private async disableWebhook(storeId: string): Promise<void> {
    try {
      logger.warn(`Disabling webhook for store ${storeId} due to errors`);
      
      const webhookInfo = this.webhooks.get(storeId);
      if (webhookInfo) {
        webhookInfo.isActive = false;
        
        // Отключаем в базе данных
        await prisma.store.update({
          where: { id: storeId },
          data: { botWebhookUrl: null }
        });
        
        // Возобновляем polling как fallback
        const activeBot = botFactoryService.getBotByStore(storeId);
        if (activeBot) {
          try {
            await activeBot.bot.deleteWebHook();
            activeBot.bot.startPolling();
            logger.info(`Resumed polling for store ${storeId} as fallback`);
          } catch (error) {
            logger.error(`Could not resume polling for store ${storeId}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Error disabling webhook for store ${storeId}:`, error);
    }
  }

  /**
   * Private: Запуск веб-сервера
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.config.port, () => {
        logger.info(`🌐 Webhook server started on port ${this.config.port}`);
        logger.info(`📡 Webhook base URL: ${this.config.baseUrl}`);
        resolve();
      });

      server.on('error', (error) => {
        logger.error('❌ Failed to start webhook server:', toLogMetadata(error));
        reject(error);
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Webhook Manager Service...');

    const shutdownPromises = Array.from(this.webhooks.keys()).map(async (storeId) => {
      try {
        await this.removeWebhook(storeId);
        logger.info(`✅ Removed webhook for store: ${storeId}`);
      } catch (error) {
        logger.error(`❌ Error removing webhook for store ${storeId}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    logger.info('🛑 Webhook Manager Service shutdown complete');
  }
}

// Создаем singleton instance
let webhookManager: WebhookManagerService | null = null;

export const getWebhookManager = (config?: WebhookConfig): WebhookManagerService => {
  if (!webhookManager && config) {
    webhookManager = new WebhookManagerService(config);
  }
  
  if (!webhookManager) {
    throw new Error('Webhook Manager not initialized');
  }
  
  return webhookManager;
};

export type { WebhookConfig, ActiveWebhook };
