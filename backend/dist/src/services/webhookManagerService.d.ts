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
export declare class WebhookManagerService {
    private webhooks;
    private tokenToStoreId;
    private app;
    private config;
    private isInitialized;
    constructor(config: WebhookConfig);
    initialize(): Promise<void>;
    addWebhook(storeId: string, botToken: string): Promise<{
        success: boolean;
        error?: string;
        webhookUrl?: string;
    }>;
    removeWebhook(storeId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getWebhookStats(): {
        totalWebhooks: number;
        activeWebhooks: number;
        errorCount: number;
        webhooks: ActiveWebhook[];
    };
    checkWebhookStatus(storeId: string): Promise<{
        isActive: boolean;
        lastUpdate?: Date;
        errors?: number;
    }>;
    private setupMiddleware;
    private setupRoutes;
    private processWebhookUpdate;
    private disableWebhook;
    private startServer;
    shutdown(): Promise<void>;
}
export declare const getWebhookManager: (config?: WebhookConfig) => WebhookManagerService;
export type { WebhookConfig, ActiveWebhook };
//# sourceMappingURL=webhookManagerService.d.ts.map