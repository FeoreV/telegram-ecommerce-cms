import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { setupHandlers } from './handlers';
import { CustomerNotificationData, NotificationHandler } from './handlers/notificationHandler';
import { DEFAULT_SECURITY_CONFIG, PRODUCTION_SECURITY_CONFIG, TelegramBotSecurity } from './middleware/security';
import { apiService } from './services/apiService';
import { cmsService } from './services/cmsService';
import { DEFAULT_WEBHOOK_CONFIG, PRODUCTION_WEBHOOK_CONFIG, TelegramWebhookService } from './services/webhookService';
import { logger } from './utils/logger';
import { redisSessionStore } from './utils/redisStore';
import { sanitizeForLog } from './utils/sanitizer';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;
const PORT = process.env.BOT_PORT || 3003;
const isProduction = process.env.NODE_ENV === 'production';
const useWebhook = !!WEBHOOK_BASE_URL;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

logger.info('Initializing Telegram Bot', {
  useWebhook,
  isProduction,
  port: PORT,
  webhookBaseUrl: WEBHOOK_BASE_URL
});

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, {
  polling: !useWebhook, // Use polling when no webhook URL provided
  webHook: false // We'll handle webhook setup ourselves
});

// Global variables
let webhookService: TelegramWebhookService | null = null;
let security: TelegramBotSecurity | null = null;

// Initialize security middleware for polling mode
if (!useWebhook) {
  const securityConfig = isProduction ? PRODUCTION_SECURITY_CONFIG : DEFAULT_SECURITY_CONFIG;
  security = new TelegramBotSecurity(securityConfig);

  // Apply security middleware to bot messages
  bot.on('message', async (msg) => {
    if (security) {
      const rateLimitPassed = await security.checkRateLimit(msg.from?.id?.toString() || '');
      const antiSpamPassed = rateLimitPassed ? !security.checkSpam(msg.from?.id?.toString() || '', msg.text || '') : false;

      if (!rateLimitPassed || !antiSpamPassed) {
        // SECURITY FIX (CWE-117): Sanitize for logging
        const { sanitizeForLog } = require('./utils/sanitizer');
        logger.warn(`Message blocked from user ${sanitizeForLog(msg.from?.id)}`, {
          rateLimitPassed,
          antiSpamPassed,
          userId: msg.from?.id,
          messageText: msg.text?.substring(0, 100)
        });
        return; // Block the message
      }
    }
  });
}

// Set up services based on mode
async function initializeServices() {
  // Initialize notification handler
  const notificationHandler = new NotificationHandler(bot);

  if (useWebhook) {
    // Use secure webhook service
    const webhookConfig = isProduction ? PRODUCTION_WEBHOOK_CONFIG : DEFAULT_WEBHOOK_CONFIG;
    webhookService = new TelegramWebhookService(bot, webhookConfig);

    try {
      await webhookService.start();
      logger.info('✅ Secure webhook service started successfully');
    } catch (error) {
      logger.error('❌ Failed to start webhook service:', error);
      process.exit(1);
    }
  } else {
    // Set up API server for polling mode
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
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

    // API endpoint for customer notifications
    app.post('/api/notify-customer', async (req: Request, res: Response) => {
      try {
        const notification: CustomerNotificationData = req.body;

        // Validate required fields
        if (!notification.telegramId || !notification.type || !notification.orderData) {
          return res.status(400).json({
            error: 'Missing required fields: telegramId, type, orderData'
          });
        }

        // Send notification
        const success = await notificationHandler.sendCustomerNotificationWithRetry(notification, 3);

        if (success) {
          res.json({
            success: true,
            message: 'Notification sent successfully',
            telegramId: notification.telegramId,
            type: notification.type
          });
        } else {
          res.status(500).json({
            error: 'Failed to send notification after retries',
            telegramId: notification.telegramId,
            type: notification.type
          });
        }
      } catch (error) {
        logger.error('Error processing customer notification:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Security admin endpoints (protected)
    app.get('/api/security-stats', async (req: Request, res: Response) => {
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
      } catch (error) {
        logger.error('Error getting security stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    app.post('/api/unblock-user', async (req: Request, res: Response) => {
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

        // Unblock user by clearing from blocked users map
        security['blockedUsers'].delete(userId.toString());
        res.json({ message: `User ${userId} unblocked successfully` });
      } catch (error) {
        logger.error('Error unblocking user:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
      }
    });

    app.listen(PORT, () => {
      logger.info(`🤖 Bot API server running on port ${PORT} (polling mode with security)`);
    });

    logger.info('🤖 Bot running in polling mode with enhanced security');
  }

  return notificationHandler;
}

// Main initialization function
async function main() {
  try {
    // Initialize API service
    apiService.initialize(process.env.API_URL || 'http://localhost:3001');

    // Initialize Redis session store if configured
    if (process.env.REDIS_URL) {
      try {
        await redisSessionStore.init(process.env.REDIS_URL);
        logger.info('Redis session store initialized');
      } catch (error) {
        logger.warn('Redis session store initialization failed, using in-memory fallback:', error);
        logger.info('Bot will continue without Redis (development mode)');
      }
    } else {
      logger.info('Redis not configured, using in-memory session store (development mode)');
    }

    // Initialize CMS service if configured
    const cmsBase = process.env.CMS_BASE_URL;
    if (cmsBase) {
      try {
        cmsService.initialize(cmsBase);
        logger.info(`CMS initialized at ${cmsBase}`);
      } catch (err) {
        logger.error('Failed to initialize CMS service', err);
      }
    }

    // Set up bot handlers
    setupHandlers(bot);

    // Initialize services (webhook or polling + API server)
    const notificationHandler = await initializeServices();

    // Error handling
    bot.on('error', (error) => {
      logger.error('Bot error:', { error: error instanceof Error ? error.message : String(error) });
    });

    bot.on('polling_error', (error) => {
      logger.error('Polling error:', { error: error instanceof Error ? error.message : String(error) });

      // Restart polling on persistent errors
      setTimeout(() => {
        if (!useWebhook) {
          bot.startPolling({ restart: true });
        }
      }, 5000);
    });

    // Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${sanitizeForLog(signal)} received, shutting down bot gracefully`);

      try {
        // Stop webhook service
        if (webhookService) {
          await webhookService.stop();
          logger.info('Webhook service stopped');
        }

        // Stop polling
        if (!useWebhook) {
          await bot.stopPolling();
          logger.info('Polling stopped');
        }

        // Close security connections
        if (security) {
          await security.close();
          logger.info('Security service stopped');
        }

        // Close Redis connections
        await redisSessionStore.disconnect();
        logger.info('Redis connections closed');

        logger.info('Bot shutdown completed gracefully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Periodic security maintenance
    if (security || webhookService) {
      setInterval(async () => {
        try {
          if (security) {
            security.cleanup();
          }

          if (webhookService) {
            const stats = webhookService.getStats();
            logger.debug('Webhook stats:', stats);
          }
        } catch (error) {
          logger.error('Error during periodic maintenance:', error);
        }
      }, 600000); // Every 10 minutes
    }

    logger.info('🚀 Telegram bot started successfully with enhanced security');

  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  // Sanitize error to prevent log injection
  const errorMsg = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ');
  logger.error('Unhandled error during bot startup:', errorMsg);
  process.exit(1);
});

export { bot };
