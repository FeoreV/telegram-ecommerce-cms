"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCTION_WEBHOOK_CONFIG = exports.DEFAULT_WEBHOOK_CONFIG = exports.TelegramWebhookService = void 0;
const express_1 = __importDefault(require("express"));
const logger_1 = require("../utils/logger");
const security_1 = require("../middleware/security");
const telegramWebhookValidator_1 = require("../utils/telegramWebhookValidator");
class TelegramWebhookService {
    constructor(bot, config) {
        this.cleanupTimer = null;
        this.signalHandlersRegistered = false;
        this.handleProcessSignal = () => {
            this.log('info', 'Termination signal received, stopping webhook service');
            void this.stop();
        };
        this.bot = bot;
        this.config = config;
        this.app = (0, express_1.default)();
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
    log(level, message, meta = {}) {
        logger_1.logger[level](message, { service: 'telegram-webhook', ...meta });
    }
    setupSecurity() {
        if (!this.config.enableSecurity) {
            this.security = undefined;
            this.log('info', 'Telegram bot security disabled by configuration');
            return;
        }
        const securityConfig = this.isProduction ? security_1.PRODUCTION_SECURITY_CONFIG : security_1.DEFAULT_SECURITY_CONFIG;
        this.security = new security_1.TelegramBotSecurity(securityConfig);
        void this.security.init?.();
        this.log('info', 'Telegram bot security enabled', {
            config: securityConfig,
            environment: this.isProduction ? 'production' : 'development'
        });
    }
    registerCoreMiddleware() {
        this.app.set('trust proxy', true);
        this.app.use((req, res, next) => {
            const start = process.hrtime.bigint();
            res.on('finish', () => {
                const durationNs = process.hrtime.bigint() - start;
                const durationMs = Number(durationNs) / 1000000;
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
                }
                else {
                    this.log('warn', 'Webhook request failed', logPayload);
                }
            });
            next();
        });
    }
    registerSecurityMiddleware() {
        if (!this.config.enableSecurity || !this.security) {
            return;
        }
        this.app.use(this.config.path, async (req, res, next) => {
            try {
                const message = req.body?.message;
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
            }
            catch (error) {
                this.log('error', 'Security middleware error', { error });
                return res.status(500).json({ error: 'Security middleware failure' });
            }
            next();
        });
    }
    registerBodyParser() {
        this.app.use(express_1.default.json({
            limit: '10mb',
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            }
        }));
    }
    registerErrorHandling() {
        this.app.use((error, _req, res, _next) => {
            this.log('error', 'Webhook middleware error', { error });
            if (error.type === 'entity.parse.failed') {
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    setupRoutes() {
        this.app.post(this.config.path, async (req, res) => {
            const startTime = Date.now();
            try {
                const validationResult = telegramWebhookValidator_1.TelegramWebhookValidator.validateWithEnvironment({
                    secretToken: this.config.secretToken,
                    botToken: process.env.TELEGRAM_BOT_TOKEN,
                    requestBody: req.rawBody || JSON.stringify(req.body),
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
                const update = req.body;
                if (!update || typeof update !== 'object') {
                    this.log('warn', 'Invalid update format', { body: req.body });
                    return res.status(400).json({ error: 'Invalid update format' });
                }
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
                await this.processUpdateWithRetry(update);
                this.updateStats(true, Date.now() - startTime);
                res.status(200).json({ ok: true });
            }
            catch (error) {
                this.updateStats(false, Date.now() - startTime, error instanceof Error ? error.message : undefined);
                this.log('error', 'Webhook processing error', { error });
                res.status(500).json({ error: 'Processing failed' });
            }
        });
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
        this.app.get('/security-stats', async (req, res) => {
            try {
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
            }
            catch (error) {
                this.log('error', 'Error getting security stats', { error });
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
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
                await this.security.unblockUser(userId.toString());
                res.json({ message: `User ${userId} unblocked successfully` });
            }
            catch (error) {
                this.log('error', 'Error unblocking user', { error });
                res.status(500).json({ error: 'Failed to unblock user' });
            }
        });
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
    async processUpdateWithRetry(update) {
        let retries = 0;
        const maxRetries = this.config.maxRetries;
        while (retries <= maxRetries) {
            try {
                await this.bot.processUpdate(update);
                if (retries > 0) {
                    this.log('info', 'Update processed after retries', { retries });
                }
                return;
            }
            catch (error) {
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
    getRetryDelay(attempt) {
        const baseDelay = this.config.retryDelay;
        const cappedExponent = Math.min(attempt - 1, 5);
        const exponential = baseDelay * Math.pow(2, cappedExponent);
        const jitter = Math.floor(Math.random() * baseDelay);
        const maxDelay = 30000;
        return Math.min(exponential + jitter, maxDelay);
    }
    updateStats(success, responseTime, failureMessage) {
        this.stats.totalRequests += 1;
        if (success) {
            this.stats.successfulRequests += 1;
            this.stats.consecutiveFailures = 0;
        }
        else {
            this.stats.failedRequests += 1;
            this.stats.consecutiveFailures += 1;
            this.stats.lastFailureAt = Date.now();
            this.stats.lastFailureMessage = failureMessage;
        }
        const totalCount = this.stats.successfulRequests + this.stats.failedRequests;
        this.stats.averageResponseTime = ((this.stats.averageResponseTime * (totalCount - 1)) + responseTime) / totalCount;
    }
    async start() {
        try {
            const webhookUrl = `${process.env.WEBHOOK_BASE_URL}${this.config.path}`;
            const webhookOptions = {
                url: webhookUrl,
                max_connections: 40,
                allowed_updates: ['message', 'callback_query', 'inline_query']
            };
            if (this.config.secretToken) {
                webhookOptions.secret_token = this.config.secretToken;
            }
            const webhookSet = await this.bot.setWebHook(webhookUrl, webhookOptions);
            if (!webhookSet) {
                throw new Error('Failed to set webhook');
            }
            this.server = this.app.listen(this.config.port, () => {
                this.log('info', 'Telegram webhook service started', {
                    port: this.config.port,
                    path: this.config.path,
                    webhookUrl,
                    security: this.config.enableSecurity,
                    environment: this.isProduction ? 'production' : 'development'
                });
            });
            if (!this.signalHandlersRegistered) {
                process.once('SIGINT', this.handleProcessSignal);
                process.once('SIGTERM', this.handleProcessSignal);
                this.signalHandlersRegistered = true;
            }
            if (this.security) {
                this.cleanupTimer = setInterval(() => {
                    this.security?.cleanup();
                }, 300000);
            }
        }
        catch (error) {
            this.log('error', 'Failed to start webhook service', { error });
            throw error;
        }
    }
    async stop() {
        try {
            this.log('info', 'Stopping Telegram webhook service...');
            await this.bot.deleteWebHook();
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            if (this.security) {
                this.security.cleanup();
                await this.security.close();
            }
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
        }
        catch (error) {
            this.log('error', 'Error stopping webhook service', { error });
        }
    }
    async getWebhookInfo() {
        return await this.bot.getWebHookInfo();
    }
    getStats() {
        return { ...this.stats, uptime: Date.now() - this.stats.startTime };
    }
}
exports.TelegramWebhookService = TelegramWebhookService;
exports.DEFAULT_WEBHOOK_CONFIG = {
    port: parseInt(process.env.WEBHOOK_PORT || '8443'),
    path: process.env.WEBHOOK_PATH || '/webhook/telegram',
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    maxRetries: 3,
    retryDelay: 1000,
    enableSecurity: true
};
exports.PRODUCTION_WEBHOOK_CONFIG = {
    port: parseInt(process.env.WEBHOOK_PORT || '8443'),
    path: process.env.WEBHOOK_PATH || '/webhook/telegram',
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    maxRetries: 5,
    retryDelay: 2000,
    enableSecurity: true,
    certificateFile: process.env.WEBHOOK_CERT_FILE,
    privateKeyFile: process.env.WEBHOOK_KEY_FILE
};
//# sourceMappingURL=webhookService.js.map