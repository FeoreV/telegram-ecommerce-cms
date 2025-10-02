import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { TelegramBotSecurity, PRODUCTION_SECURITY_CONFIG, DEFAULT_SECURITY_CONFIG } from '../middleware/security';
import { TelegramWebhookValidator } from '../utils/telegramWebhookValidator';

interface WebhookConfig {
  port: number;
  path: string;
  secretToken?: string;
  maxRetries: number;
  retryDelay: number;
  enableSecurity: boolean;
  certificateFile?: string;
  privateKeyFile?: string;
}

interface WebhookStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  startTime: number;
  consecutiveFailures: number;
  lastFailureAt?: number;
  lastFailureMessage?: string;
}

export class TelegramWebhookService {
  private app: express.Application;
  private server: any;
  private bot: TelegramBot;
  private config: WebhookConfig;
  private security?: TelegramBotSecurity;
  private stats: WebhookStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isProduction: boolean;
  private signalHandlersRegistered = false;
  private readonly handleProcessSignal = () => {
    this.log('info', 'Termination signal received, stopping webhook service');
    void this.stop();
  };

  constructor(bot: TelegramBot, config: WebhookConfig) {
    this.bot = bot;
    this.config = config;
    this.app = express();
    this.isProduction = process.env.NODE_ENV === 'production';
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      startTime: Date.now(),
      consecutiveFailures: 0
    };

    this.setupSecurity();
    this.registerCoreMiddleware();
    this.registerSecurityMiddleware();
    this.registerBodyParser();
    this.registerErrorHandling();
    this.setupRoutes();
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta: Record<string, unknown> = {}): void {
    logger[level](message, { service: 'telegram-webhook', ...meta });
  }

  private setupSecurity(): void {
    if (!this.config.enableSecurity) {
      this.security = undefined;
      this.log('info', 'Telegram bot security disabled by configuration');
      return;
    }

    const securityConfig = this.isProduction ? PRODUCTION_SECURITY_CONFIG : DEFAULT_SECURITY_CONFIG;
    this.security = new TelegramBotSecurity(securityConfig);
    void this.security.init?.();

    this.log('info', 'Telegram bot security enabled', {
      config: securityConfig,
      environment: this.isProduction ? 'production' : 'development'
    });
  }

  private registerCoreMiddleware(): void {
    this.app.set('trust proxy', true);

    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const start = process.hrtime.bigint();

      res.on('finish', () => {
        const durationNs = process.hrtime.bigint() - start;
        const durationMs = Number(durationNs) / 1_000_000;
        const success = res.statusCode < 400;

        this.updateStats(success, durationMs);

        const logPayload = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        };

        if (success) {
          this.log('info', 'Webhook request processed', logPayload);
        } else {
          this.log('warn', 'Webhook request failed', logPayload);
        }
      });

      next();
    });
  }

  private registerSecurityMiddleware(): void {
    if (!this.config.enableSecurity || !this.security) {
      return;
    }

    this.app.use(this.config.path, async (req: express.Request & { rawBody?: Buffer }, res: express.Response, next: express.NextFunction) => {
      try {
        const message = (req.body as TelegramBot.Update)?.message;
        if (message && this.security) {
          const allowed = await this.security.processMessage(message);
          if (!allowed) {
            this.log('warn', 'Security middleware blocked request', {
              userId: message.from?.id,
              path: req.path
            });
            return res.status(429).json({ error: 'Request blocked by security middleware' });
          }
        }
      } catch (error) {
        this.log('error', 'Security middleware error', { error });
        return res.status(500).json({ error: 'Security middleware failure' });
      }

      next();
    });
  }

  private registerBodyParser(): void {
    this.app.use(express.json({
      limit: '10mb',
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      }
    }));
  }

  private registerErrorHandling(): void {
    this.app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.log('error', 'Webhook middleware error', { error });

      if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupRoutes(): void {
    // Main webhook endpoint
    this.app.post(this.config.path, async (req, res) => {
      const startTime = Date.now();
      try {
        // Validate request signature using unified validator
        const validationResult = TelegramWebhookValidator.validateWithEnvironment({
          secretToken: this.config.secretToken,
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          requestBody: (req as any).rawBody || JSON.stringify(req.body),
          headers: req.headers,
          environment: process.env.NODE_ENV,
          requireValidation: !!this.config.secretToken || process.env.NODE_ENV === 'production'
        });

        if (!validationResult.isValid) {
          this.log('warn', 'Telegram webhook validation failed', { 
            ip: req.ip,
            error: validationResult.error,
            hasSecretToken: !!this.config.secretToken,
            hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
          });
          return res.status(401).json({ 
            error: 'Invalid webhook signature',
            details: validationResult.error
          });
        }

        // Extract update from request
        const update: TelegramBot.Update = req.body;
        
        if (!update || typeof update !== 'object') {
          this.log('warn', 'Invalid update format', { body: req.body });
          return res.status(400).json({ error: 'Invalid update format' });
        }

        // Security checks
        if (this.security && update.message) {
          const rateLimitPassed = await this.security.checkRateLimit(update.message?.from?.id?.toString() || '');
          if (!rateLimitPassed) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }

          const antiSpamPassed = !this.security.checkSpam(update.message?.from?.id?.toString() || '', update.message?.text || '');
          if (!antiSpamPassed) {
            return res.status(429).json({ error: 'Message blocked by spam filter' });
          }
        }

        // Process update with retry logic
        await this.processUpdateWithRetry(update);
        
        this.updateStats(true, Date.now() - startTime);
        res.status(200).json({ ok: true });

      } catch (error) {
        this.updateStats(false, Date.now() - startTime, error instanceof Error ? error.message : undefined);
        this.log('error', 'Webhook processing error', { error });
        res.status(500).json({ error: 'Processing failed' });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const uptime = Date.now() - this.stats.startTime;
      this.stats.uptime = uptime;
      
      res.json({
        status: 'ok',
        service: 'telegram-webhook',
        uptime,
        stats: this.stats,
        timestamp: new Date().toISOString()
      });
    });

    // Security stats endpoint (protected)
    this.app.get('/security-stats', async (req, res) => {
      try {
        // Simple auth check (in production, use proper authentication)
        const authToken = req.headers.authorization;
        if (!authToken || authToken !== `Bearer ${process.env.WEBHOOK_ADMIN_TOKEN}`) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!this.security) {
          return res.json({ message: 'Security not enabled' });
        }

        const securityStats = await this.security.getSecurityStats();
        res.json({
          ...securityStats,
          service: 'telegram-bot-security',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.log('error', 'Error getting security stats', { error });
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // Unblock user endpoint (admin only)
    this.app.post('/unblock-user', async (req, res) => {
      try {
        const authToken = req.headers.authorization;
        if (!authToken || authToken !== `Bearer ${process.env.WEBHOOK_ADMIN_TOKEN}`) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { userId } = req.body;
        if (!userId || typeof userId !== 'number') {
          return res.status(400).json({ error: 'Valid userId required' });
        }

        if (!this.security) {
          return res.json({ message: 'Security not enabled' });
        }

        // Unblock user by clearing from blocked users map
        await this.security.unblockUser(userId.toString());
        res.json({ message: `User ${userId} unblocked successfully` });
      } catch (error) {
        this.log('error', 'Error unblocking user', { error });
        res.status(500).json({ error: 'Failed to unblock user' });
      }
    });

    // Graceful shutdown endpoint
    this.app.post('/shutdown', (req, res) => {
      const authToken = req.headers.authorization;
      if (!authToken || authToken !== `Bearer ${process.env.WEBHOOK_ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.json({ message: 'Shutting down gracefully...' });
      
      setTimeout(() => {
        this.stop();
        process.exit(0);
      }, 1000);
    });
  }


  private async processUpdateWithRetry(update: TelegramBot.Update): Promise<void> {
    let retries = 0;
    const maxRetries = this.config.maxRetries;

    while (retries <= maxRetries) {
      try {
        await this.bot.processUpdate(update);
        if (retries > 0) {
          this.log('info', 'Update processed after retries', { retries });
        }
        return;
      } catch (error) {
        retries++;

        if (retries > maxRetries) {
          this.log('error', `Failed to process update after ${maxRetries} retries`, { error });
          throw error;
        }

        this.log('warn', `Update processing failed, retrying (${retries}/${maxRetries})`, { error });

        const delay = this.getRetryDelay(retries);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private getRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const cappedExponent = Math.min(attempt - 1, 5);
    const exponential = baseDelay * Math.pow(2, cappedExponent);
    const jitter = Math.floor(Math.random() * baseDelay);
    const maxDelay = 30000;
    return Math.min(exponential + jitter, maxDelay);
  }

  private updateStats(success: boolean, responseTime: number, failureMessage?: string): void {
    this.stats.totalRequests += 1;

    if (success) {
      this.stats.successfulRequests += 1;
      this.stats.consecutiveFailures = 0;
    } else {
      this.stats.failedRequests += 1;
      this.stats.consecutiveFailures += 1;
      this.stats.lastFailureAt = Date.now();
      this.stats.lastFailureMessage = failureMessage;
    }

    const totalCount = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime = ((this.stats.averageResponseTime * (totalCount - 1)) + responseTime) / totalCount;
  }

  async start(): Promise<void> {
    try {
      // Setup webhook URL
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL}${this.config.path}`;
      
      const webhookOptions: any = {
        url: webhookUrl,
        max_connections: 40,
        allowed_updates: ['message', 'callback_query', 'inline_query']
      };

      if (this.config.secretToken) {
        webhookOptions.secret_token = this.config.secretToken;
      }

      // Set webhook
      const webhookSet = await this.bot.setWebHook(webhookUrl, webhookOptions);
      if (!webhookSet) {
        throw new Error('Failed to set webhook');
      }

      // Start express server
      this.server = this.app.listen(this.config.port, () => {
        this.log('info', 'Telegram webhook service started', {
          port: this.config.port,
          path: this.config.path,
          webhookUrl,
          security: this.config.enableSecurity,
          environment: this.isProduction ? 'production' : 'development'
        });
      });

      // Graceful shutdown handling
      if (!this.signalHandlersRegistered) {
        process.once('SIGINT', this.handleProcessSignal);
        process.once('SIGTERM', this.handleProcessSignal);
        this.signalHandlersRegistered = true;
      }

      // Periodic cleanup
      if (this.security) {
        this.cleanupTimer = setInterval(() => {
          this.security?.cleanup();
        }, 300000);
      }

    } catch (error) {
      this.log('error', 'Failed to start webhook service', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('info', 'Stopping Telegram webhook service...');

      // Delete webhook
      await this.bot.deleteWebHook();
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      if (this.security) {
        this.security.cleanup();
        await this.security.close();
      }

      // Close server
      if (this.server) {
        this.server.close();
        this.server = null;
      }

      if (this.signalHandlersRegistered) {
        process.removeListener('SIGINT', this.handleProcessSignal);
        process.removeListener('SIGTERM', this.handleProcessSignal);
        this.signalHandlersRegistered = false;
      }
      this.log('info', 'Telegram webhook service stopped');
    } catch (error) {
      this.log('error', 'Error stopping webhook service', { error });
    }
  }

  async getWebhookInfo(): Promise<TelegramBot.WebhookInfo> {
    return await this.bot.getWebHookInfo();
  }

  getStats(): WebhookStats {
    return { ...this.stats, uptime: Date.now() - this.stats.startTime };
  }
}

// Default webhook configuration
export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  port: parseInt(process.env.WEBHOOK_PORT || '8443'),
  path: process.env.WEBHOOK_PATH || '/webhook/telegram',
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  maxRetries: 3,
  retryDelay: 1000,
  enableSecurity: true
};

// Production webhook configuration
export const PRODUCTION_WEBHOOK_CONFIG: WebhookConfig = {
  port: parseInt(process.env.WEBHOOK_PORT || '8443'),
  path: process.env.WEBHOOK_PATH || '/webhook/telegram',
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  maxRetries: 5,
  retryDelay: 2000,
  enableSecurity: true,
  certificateFile: process.env.WEBHOOK_CERT_FILE,
  privateKeyFile: process.env.WEBHOOK_KEY_FILE
};
