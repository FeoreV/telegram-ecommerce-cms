import TelegramBot from 'node-telegram-bot-api';
import BotHandlerService from './botHandlerService.js';
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
declare class BotFactoryService {
    private activeBots;
    private botTokenToStoreId;
    private isInitialized;
    constructor();
    private sanitizeAndValidateToken;
    initialize(): Promise<void>;
    createBot(storeId: string, botToken: string, botUsername?: string): Promise<{
        success: boolean;
        error?: string;
        bot?: ActiveBot;
    }>;
    removeBot(storeId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getBotByStore(storeId: string): ActiveBot | undefined;
    getStoreByBotToken(token: string): string | undefined;
    getActiveBots(): ActiveBot[];
    updateBotStatus(storeId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<void>;
    updateBotActivity(storeId: string): Promise<void>;
    getBotStats(): {
        totalBots: number;
        activeBots: number;
        inactiveBots: number;
        suspendedBots: number;
        totalMessages: number;
    };
    private createBotInstance;
    private setupBotHandlers;
    private getDefaultBotSettings;
    private notifyBotCreated;
    private setupGracefulShutdown;
}
export declare const botFactoryService: BotFactoryService;
export { BotConfig, BotSettings, ActiveBot };
//# sourceMappingURL=botFactoryService.d.ts.map