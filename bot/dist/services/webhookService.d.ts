import TelegramBot from 'node-telegram-bot-api';
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
export declare class TelegramWebhookService {
    private app;
    private server;
    private bot;
    private config;
    private security?;
    private stats;
    private cleanupTimer;
    private isProduction;
    private signalHandlersRegistered;
    private readonly handleProcessSignal;
    constructor(bot: TelegramBot, config: WebhookConfig);
    private log;
    private setupSecurity;
    private registerCoreMiddleware;
    private registerSecurityMiddleware;
    private registerBodyParser;
    private registerErrorHandling;
    private setupRoutes;
    private processUpdateWithRetry;
    private getRetryDelay;
    private updateStats;
    start(): Promise<void>;
    stop(): Promise<void>;
    getWebhookInfo(): Promise<TelegramBot.WebhookInfo>;
    getStats(): WebhookStats;
}
export declare const DEFAULT_WEBHOOK_CONFIG: WebhookConfig;
export declare const PRODUCTION_WEBHOOK_CONFIG: WebhookConfig;
export {};
//# sourceMappingURL=webhookService.d.ts.map