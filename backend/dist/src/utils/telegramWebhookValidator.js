"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramWebhookValidator = void 0;
exports.verifyTelegramSignature = verifyTelegramSignature;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
class TelegramWebhookValidator {
    static validateSecretToken(secretToken, receivedToken) {
        try {
            if (!secretToken || !receivedToken) {
                return {
                    isValid: false,
                    error: 'Missing secret token or received token'
                };
            }
            if (typeof secretToken !== 'string' || typeof receivedToken !== 'string') {
                return {
                    isValid: false,
                    error: 'Invalid token format'
                };
            }
            const expectedBuffer = Buffer.from(secretToken, 'utf8');
            const receivedBuffer = Buffer.from(receivedToken, 'utf8');
            if (expectedBuffer.length !== receivedBuffer.length) {
                return { isValid: false, error: 'Token length mismatch' };
            }
            const isValid = crypto_1.default.timingSafeEqual(expectedBuffer, receivedBuffer);
            if (!isValid) {
                logger_1.logger.warn('Telegram webhook secret token validation failed', {
                    expectedLength: expectedBuffer.length,
                    receivedLength: receivedBuffer.length
                });
            }
            return { isValid };
        }
        catch (error) {
            logger_1.logger.error('Error validating Telegram secret token:', error);
            return {
                isValid: false,
                error: 'Token validation error'
            };
        }
    }
    static validateHmacSignature(botToken, requestBody, receivedSignature) {
        try {
            if (!botToken || !requestBody || !receivedSignature) {
                return {
                    isValid: false,
                    error: 'Missing bot token, request body, or signature'
                };
            }
            const bodyString = Buffer.isBuffer(requestBody) ?
                requestBody.toString('utf8') : requestBody;
            const expectedSignature = crypto_1.default
                .createHmac('sha256', botToken)
                .update(bodyString)
                .digest('hex');
            const cleanReceivedSignature = receivedSignature.replace(/^sha256=/, '');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');
            const receivedBuffer = Buffer.from(cleanReceivedSignature, 'hex');
            if (expectedBuffer.length !== receivedBuffer.length) {
                return { isValid: false, error: 'Signature length mismatch' };
            }
            const isValid = crypto_1.default.timingSafeEqual(expectedBuffer, receivedBuffer);
            if (!isValid) {
                logger_1.logger.warn('Telegram webhook HMAC signature validation failed', {
                    expectedLength: expectedBuffer.length,
                    receivedLength: receivedBuffer.length,
                    expectedPrefix: expectedSignature.substring(0, 8),
                    receivedPrefix: cleanReceivedSignature.substring(0, 8)
                });
            }
            return { isValid };
        }
        catch (error) {
            logger_1.logger.error('Error validating Telegram HMAC signature:', error);
            return {
                isValid: false,
                error: 'HMAC signature validation error'
            };
        }
    }
    static validateWebhook(options) {
        const { secretToken, botToken, requestBody, headers } = options;
        const secretTokenHeader = headers['x-telegram-bot-api-secret-token'];
        const hmacSignatureHeader = (headers['x-hub-signature-256'] || headers['x-telegram-signature']);
        if (secretToken && secretTokenHeader) {
            logger_1.logger.debug('Validating Telegram webhook using secret token method');
            return this.validateSecretToken(secretToken, secretTokenHeader);
        }
        if (botToken && hmacSignatureHeader) {
            logger_1.logger.debug('Validating Telegram webhook using HMAC signature method');
            return this.validateHmacSignature(botToken, requestBody, hmacSignatureHeader);
        }
        if (secretToken && !secretTokenHeader) {
            logger_1.logger.warn('Telegram webhook missing required secret token header', {
                hasSecretToken: !!secretToken,
                hasSecretTokenHeader: !!secretTokenHeader,
                headers: Object.keys(headers)
            });
            return {
                isValid: false,
                error: 'Missing X-Telegram-Bot-Api-Secret-Token header'
            };
        }
        if (botToken && !hmacSignatureHeader) {
            logger_1.logger.warn('Telegram webhook missing signature header for HMAC validation', {
                hasBotToken: !!botToken,
                hasSignatureHeader: !!hmacSignatureHeader,
                headers: Object.keys(headers)
            });
            return {
                isValid: false,
                error: 'Missing signature header for HMAC validation'
            };
        }
        logger_1.logger.warn('No Telegram webhook validation method available', {
            hasSecretToken: !!secretToken,
            hasBotToken: !!botToken,
            hasSecretTokenHeader: !!secretTokenHeader,
            hasSignatureHeader: !!hmacSignatureHeader
        });
        return {
            isValid: false,
            error: 'No validation method available'
        };
    }
    static validateWithEnvironment(options) {
        const { environment = process.env.NODE_ENV, requireValidation } = options;
        const isProduction = environment === 'production';
        const shouldRequireValidation = requireValidation ?? isProduction;
        const result = this.validateWebhook(options);
        if (shouldRequireValidation && !result.isValid) {
            logger_1.logger.error('Telegram webhook validation failed in production environment', {
                environment,
                error: result.error
            });
            return result;
        }
        if (!result.isValid && !shouldRequireValidation) {
            logger_1.logger.warn('Telegram webhook validation failed in development environment - allowing through', {
                environment,
                error: result.error
            });
            return { isValid: true };
        }
        return result;
    }
}
exports.TelegramWebhookValidator = TelegramWebhookValidator;
function verifyTelegramSignature(body, signature, token) {
    const result = TelegramWebhookValidator.validateHmacSignature(token, JSON.stringify(body), signature);
    return result.isValid;
}
//# sourceMappingURL=telegramWebhookValidator.js.map