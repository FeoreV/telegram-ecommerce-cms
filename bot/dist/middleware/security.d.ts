import TelegramBot from 'node-telegram-bot-api';
declare let RedisPackage: any;
interface SecurityConfig {
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        blockDuration: number;
    };
    spamDetection: {
        enabled: boolean;
        maxScore: number;
        scoreDecayMs: number;
        commonPhrases: string[];
    };
    adminSafety: {
        requireConfirmation: boolean;
        logAllActions: boolean;
    };
}
export declare const PRODUCTION_SECURITY_CONFIG: SecurityConfig;
export declare const DEFAULT_SECURITY_CONFIG: SecurityConfig;
type RedisClient = typeof RedisPackage extends {
    new (...args: any[]): infer R;
} ? R : undefined;
export declare class TelegramBotSecurity {
    private config;
    private redis;
    private requestCounts;
    private blockedUsers;
    private suspiciousUsers;
    private lastRedisError;
    constructor(config: SecurityConfig, redisClient?: RedisClient);
    private createRedisClient;
    init(): Promise<void>;
    close(): Promise<void>;
    checkRateLimit(userId: string): Promise<boolean>;
    isBlocked(userId: string): boolean;
    unblockUser(userId: string): Promise<void>;
    checkSpam(userId: string, message: string): boolean;
    private calculateSpamScore;
    private getRecentActivity;
    processMessage(msg: TelegramBot.Message): Promise<boolean>;
    logSecurityEvent(event: string, userId: string, details?: any): void;
    getSecurityStats(): {
        blockedUsers: number;
        suspiciousUsers: number;
        totalRequests: number;
        rateLimitedRequests: number;
    };
    requireAdminConfirmation(bot: TelegramBot, chatId: number, action: string, userId: string): Promise<boolean>;
    cleanup(): void;
    startPeriodicCleanup(): void;
}
export default TelegramBotSecurity;
//# sourceMappingURL=security.d.ts.map