import crypto from 'crypto';
import { logger } from './logger';

export interface TelegramWebhookValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Unified Telegram webhook signature validation utility
 * Supports both secret token and HMAC signature methods
 */
export class TelegramWebhookValidator {
  
  /**
   * Validate Telegram webhook using secret token method
   * This is the newer method recommended by Telegram
   */
  static validateSecretToken(
    secretToken: string,
    requestSecretToken: string | undefined
  ): TelegramWebhookValidationResult {
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
      isValid = crypto.timingSafeEqual(expected, provided);
    } catch (error) {
      logger.error('Error comparing secret tokens:', error);
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

  /**
   * Validate Telegram webhook using HMAC signature method
   * This is the legacy method but still supported
   */
  static validateHMACSignature(
    botToken: string,
    requestBody: string | Buffer,
    signature: string | undefined
  ): TelegramWebhookValidationResult {
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
      // Create HMAC using SHA256 and bot token
      const hmac = crypto.createHmac('sha256', botToken);
      hmac.update(requestBody);
      const expectedSignature = hmac.digest('hex');

      // Compare signatures using timing-safe comparison
      const providedSignature = signature.toLowerCase();
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      return {
        isValid,
        error: isValid ? undefined : 'Invalid HMAC signature'
      };
    } catch (error) {
      logger.error('Error validating HMAC signature:', error);
      return {
        isValid: false,
        error: 'Signature validation failed'
      };
    }
  }

  /**
   * Comprehensive webhook validation
   * Tries secret token first, then falls back to HMAC if needed
   */
  static validateWebhook(
    botToken: string,
    secretToken: string | undefined,
    requestBody: string | Buffer,
    headers: { [key: string]: string | string[] | undefined }
  ): TelegramWebhookValidationResult {
    // Extract relevant headers
    const requestSecretToken = headers['x-telegram-bot-api-secret-token'] as string;
    const signature = headers['x-hub-signature-256'] as string;

    // Try secret token validation first (preferred method)
    if (secretToken && requestSecretToken) {
      const result = this.validateSecretToken(secretToken, requestSecretToken);
      if (result.isValid) {
        return result;
      }
      logger.warn('Secret token validation failed, trying HMAC signature');
    }

    // Fall back to HMAC signature validation
    if (signature) {
      return this.validateHMACSignature(botToken, requestBody, signature);
    }

    // No valid authentication method found
    return {
      isValid: false,
      error: 'No valid authentication method provided (secret token or HMAC signature)'
    };
  }

  /**
   * Validate request body format and structure
   */
  static validateRequestBody(body: any): TelegramWebhookValidationResult {
    if (!body) {
      return {
        isValid: false,
        error: 'Empty request body'
      };
    }

    // Basic Telegram webhook structure validation
    if (typeof body !== 'object') {
      return {
        isValid: false,
        error: 'Request body must be a JSON object'
      };
    }

    // Check for required Telegram webhook fields
    const hasUpdateId = typeof body.update_id === 'number';
    if (!hasUpdateId) {
      return {
        isValid: false,
        error: 'Missing or invalid update_id field'
      };
    }

    // Check for at least one update type
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

  /**
   * Complete webhook validation including security and structure
   */
  static validateComplete(
    botToken: string,
    secretToken: string | undefined,
    requestBody: string | Buffer,
    headers: { [key: string]: string | string[] | undefined },
    parsedBody?: any
  ): TelegramWebhookValidationResult {
    // First validate authentication
    const authResult = this.validateWebhook(botToken, secretToken, requestBody, headers);
    if (!authResult.isValid) {
      return authResult;
    }

    // Then validate body structure if provided
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

  /**
   * Get validation method used for debugging
   */
  static getValidationMethod(
    secretToken: string | undefined,
    headers: { [key: string]: string | string[] | undefined }
  ): 'secret_token' | 'hmac_signature' | 'none' {
    const requestSecretToken = headers['x-telegram-bot-api-secret-token'] as string;
    const signature = headers['x-hub-signature-256'] as string;

    if (secretToken && requestSecretToken) {
      return 'secret_token';
    }

    if (signature) {
      return 'hmac_signature';
    }

    return 'none';
  }

  /**
   * Validate webhook with environment-based configuration
   */
  static validateWithEnvironment(options: {
    secretToken?: string;
    botToken?: string;
    requestBody: string | Buffer;
    headers: { [key: string]: string | string[] | undefined };
    environment?: string;
    requireValidation?: boolean;
  }): TelegramWebhookValidationResult {
    const { secretToken, botToken, requestBody, headers, environment, requireValidation } = options;

    // In development, validation might be optional
    if (environment === 'development' && !requireValidation) {
      logger.warn('Webhook validation disabled for development environment');
      return { isValid: true };
    }

    // Ensure we have necessary tokens
    if (!botToken) {
      return {
        isValid: false,
        error: 'Bot token not provided'
      };
    }

    // Use complete validation
    return this.validateComplete(botToken, secretToken, requestBody, headers);
  }
}
