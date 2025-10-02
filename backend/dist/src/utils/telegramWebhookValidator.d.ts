export interface TelegramWebhookValidationResult {
    isValid: boolean;
    error?: string;
}
export declare class TelegramWebhookValidator {
    static validateSecretToken(secretToken: string, receivedToken: string): TelegramWebhookValidationResult;
    static validateHmacSignature(botToken: string, requestBody: string | Buffer, receivedSignature: string): TelegramWebhookValidationResult;
    static validateWebhook(options: {
        secretToken?: string;
        botToken?: string;
        requestBody: string | Buffer;
        headers: {
            [key: string]: string | string[] | undefined;
        };
    }): TelegramWebhookValidationResult;
    static validateWithEnvironment(options: {
        secretToken?: string;
        botToken?: string;
        requestBody: string | Buffer;
        headers: {
            [key: string]: string | string[] | undefined;
        };
        environment?: string;
        requireValidation?: boolean;
    }): TelegramWebhookValidationResult;
}
export declare function verifyTelegramSignature(body: Record<string, unknown>, signature: string, token: string): boolean;
//# sourceMappingURL=telegramWebhookValidator.d.ts.map