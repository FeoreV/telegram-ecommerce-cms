export interface TelegramWebhookValidationResult {
    isValid: boolean;
    error?: string;
}
export declare class TelegramWebhookValidator {
    static validateSecretToken(secretToken: string, requestSecretToken: string | undefined): TelegramWebhookValidationResult;
    static validateHMACSignature(botToken: string, requestBody: string | Buffer, signature: string | undefined): TelegramWebhookValidationResult;
    static validateWebhook(botToken: string, secretToken: string | undefined, requestBody: string | Buffer, headers: {
        [key: string]: string | string[] | undefined;
    }): TelegramWebhookValidationResult;
    static validateRequestBody(body: any): TelegramWebhookValidationResult;
    static validateComplete(botToken: string, secretToken: string | undefined, requestBody: string | Buffer, headers: {
        [key: string]: string | string[] | undefined;
    }, parsedBody?: any): TelegramWebhookValidationResult;
    static getValidationMethod(secretToken: string | undefined, headers: {
        [key: string]: string | string[] | undefined;
    }): 'secret_token' | 'hmac_signature' | 'none';
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
//# sourceMappingURL=telegramWebhookValidator.d.ts.map