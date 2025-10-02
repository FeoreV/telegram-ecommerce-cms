export interface TelegramAuthData {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}
export interface TelegramWebhookData {
    update_id: number;
    message?: unknown;
    callback_query?: unknown;
}
export interface TelegramValidationResult {
    isValid: boolean;
    reason?: string;
    userData?: {
        telegramId: string;
        firstName?: string;
        lastName?: string;
        username?: string;
        photoUrl?: string;
        authDate: Date;
    };
}
export interface ValidatedTelegramUserData {
    telegramId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    authDate: Date;
}
export interface TelegramConfig {
    authTokenTTL: number;
    webhookSecretValidation: boolean;
    enforceAuthDateTTL: boolean;
    maxAuthAge: number;
    requireUserData: boolean;
}
export declare class TelegramAuthService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): TelegramAuthService;
    validateTelegramLogin(authData: TelegramAuthData, botToken: string): TelegramValidationResult;
    private validateTelegramHMAC;
    private constantTimeCompare;
    validateTelegramWebhook(webhookData: TelegramWebhookData, secretToken: string, receivedSignature: string): boolean;
    createTelegramSession(authData: TelegramAuthData, botToken: string, deviceInfo: unknown, role?: string, storeId?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: string;
        user: {
            id: string;
            telegramId: string;
            username?: string;
            firstName?: string;
            lastName?: string;
            role: string;
        };
    }>;
    private findOrCreateTelegramUser;
    validateBotTokenFormat(botToken: string): boolean;
    extractBotId(botToken: string): number | null;
    generateWebhookUrl(botToken: string, baseUrl: string): string;
    validateWebhookUrl(url: string, botToken: string): boolean;
    private telegramRateLimiter;
    checkTelegramRateLimit(identifier: string, limit?: number, windowMs?: number): boolean;
    healthCheck(): Promise<{
        status: string;
        config: TelegramConfig;
        rateLimiterSize: number;
    }>;
    getConfiguration(): TelegramConfig;
}
export declare const telegramAuthService: TelegramAuthService;
//# sourceMappingURL=TelegramAuthService.d.ts.map