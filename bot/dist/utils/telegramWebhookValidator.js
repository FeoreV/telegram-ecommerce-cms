"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramWebhookValidator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
class TelegramWebhookValidator {
    static validateSecretToken(secretToken, requestSecretToken) {
        if (!secretToken) {
            return {
                isValid: false,
                error: 'Secret token not configured'
            };
        }
        if (!requestSecretToken) {
            return {
                isValid: false,
                error: 'No secret token provided in request'
            };
        }
        const expected = Buffer.from(secretToken, 'utf8');
        const provided = Buffer.from(requestSecretToken, 'utf8');
        if (expected.length !== provided.length) {
            return {
                isValid: false,
                error: 'Invalid secret token'
            };
        }
        let isValid = false;
        try {
            isValid = crypto_1.default.timingSafeEqual(expected, provided);
        }
        catch (error) {
            logger_1.logger.error('Error comparing secret tokens:', error);
            return {
                isValid: false,
                error: 'Secret token comparison failed'
            };
        }
        return {
            isValid,
            error: isValid ? undefined : 'Invalid secret token'
        };
    }
    static validateHMACSignature(botToken, requestBody, signature) {
        if (!botToken) {
            return {
                isValid: false,
                error: 'Bot token not configured'
            };
        }
        if (!signature) {
            return {
                isValid: false,
                error: 'No signature provided in request'
            };
        }
        try {
            const hmac = crypto_1.default.createHmac('sha256', botToken);
            hmac.update(requestBody);
            const expectedSignature = hmac.digest('hex');
            const providedSignature = signature.toLowerCase();
            const isValid = crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(providedSignature, 'hex'));
            return {
                isValid,
                error: isValid ? undefined : 'Invalid HMAC signature'
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating HMAC signature:', error);
            return {
                isValid: false,
                error: 'Signature validation failed'
            };
        }
    }
    static validateWebhook(botToken, secretToken, requestBody, headers) {
        const requestSecretToken = headers['x-telegram-bot-api-secret-token'];
        const signature = headers['x-hub-signature-256'];
        if (secretToken && requestSecretToken) {
            const result = this.validateSecretToken(secretToken, requestSecretToken);
            if (result.isValid) {
                return result;
            }
            logger_1.logger.warn('Secret token validation failed, trying HMAC signature');
        }
        if (signature) {
            return this.validateHMACSignature(botToken, requestBody, signature);
        }
        return {
            isValid: false,
            error: 'No valid authentication method provided (secret token or HMAC signature)'
        };
    }
    static validateRequestBody(body) {
        if (!body) {
            return {
                isValid: false,
                error: 'Empty request body'
            };
        }
        if (typeof body !== 'object') {
            return {
                isValid: false,
                error: 'Request body must be a JSON object'
            };
        }
        const hasUpdateId = typeof body.update_id === 'number';
        if (!hasUpdateId) {
            return {
                isValid: false,
                error: 'Missing or invalid update_id field'
            };
        }
        const updateTypes = [
            'message', 'edited_message', 'channel_post', 'edited_channel_post',
            'inline_query', 'chosen_inline_result', 'callback_query',
            'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
            'my_chat_member', 'chat_member', 'chat_join_request'
        ];
        const hasValidUpdateType = updateTypes.some(type => body[type] !== undefined);
        if (!hasValidUpdateType) {
            return {
                isValid: false,
                error: 'No valid update type found in webhook payload'
            };
        }
        return {
            isValid: true
        };
    }
    static validateComplete(botToken, secretToken, requestBody, headers, parsedBody) {
        const authResult = this.validateWebhook(botToken, secretToken, requestBody, headers);
        if (!authResult.isValid) {
            return authResult;
        }
        if (parsedBody) {
            const bodyResult = this.validateRequestBody(parsedBody);
            if (!bodyResult.isValid) {
                return bodyResult;
            }
        }
        return {
            isValid: true
        };
    }
    static getValidationMethod(secretToken, headers) {
        const requestSecretToken = headers['x-telegram-bot-api-secret-token'];
        const signature = headers['x-hub-signature-256'];
        if (secretToken && requestSecretToken) {
            return 'secret_token';
        }
        if (signature) {
            return 'hmac_signature';
        }
        return 'none';
    }
    static validateWithEnvironment(options) {
        const { secretToken, botToken, requestBody, headers, environment, requireValidation } = options;
        if (environment === 'development' && !requireValidation) {
            logger_1.logger.warn('Webhook validation disabled for development environment');
            return { isValid: true };
        }
        if (!botToken) {
            return {
                isValid: false,
                error: 'Bot token not provided'
            };
        }
        return this.validateComplete(botToken, secretToken, requestBody, headers);
    }
}
exports.TelegramWebhookValidator = TelegramWebhookValidator;
//# sourceMappingURL=telegramWebhookValidator.js.map