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
    receivedToken: string
  ): TelegramWebhookValidationResult {
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

      // Use constant-time comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(secretToken, 'utf8');
      const receivedBuffer = Buffer.from(receivedToken, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return { isValid: false, error: 'Token length mismatch' };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
      
      if (!isValid) {
        logger.warn('Telegram webhook secret token validation failed', {
          expectedLength: expectedBuffer.length,
          receivedLength: receivedBuffer.length
        });
      }

      return { isValid };
    } catch (error) {
      logger.error('Error validating Telegram secret token:', error);
      return { 
        isValid: false, 
        error: 'Token validation error' 
      };
    }
  }

  /**
   * Validate Telegram webhook using HMAC signature method
   * This is the older method but still supported for backwards compatibility
   */
  static validateHmacSignature(
    botToken: string,
    requestBody: string | Buffer,
    receivedSignature: string
  ): TelegramWebhookValidationResult {
    try {
      if (!botToken || !requestBody || !receivedSignature) {
        return { 
          isValid: false, 
          error: 'Missing bot token, request body, or signature' 
        };
      }

      // Convert body to string if it's a Buffer
      const bodyString = Buffer.isBuffer(requestBody) ? 
        requestBody.toString('utf8') : requestBody;

      // Calculate expected HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', botToken)
        .update(bodyString)
        .digest('hex');

      // Remove 'sha256=' prefix if present
      const cleanReceivedSignature = receivedSignature.replace(/^sha256=/, '');

      // Use constant-time comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(cleanReceivedSignature, 'hex');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return { isValid: false, error: 'Signature length mismatch' };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isValid) {
        logger.warn('Telegram webhook HMAC signature validation failed', {
          expectedLength: expectedBuffer.length,
          receivedLength: receivedBuffer.length,
          // Log only first 8 chars for debugging without exposing full signature
          expectedPrefix: expectedSignature.substring(0, 8),
          receivedPrefix: cleanReceivedSignature.substring(0, 8)
        });
      }

      return { isValid };
    } catch (error) {
      logger.error('Error validating Telegram HMAC signature:', error);
      return { 
        isValid: false, 
        error: 'HMAC signature validation error' 
      };
    }
  }

  /**
   * Comprehensive webhook validation that tries both methods
   * Prioritizes secret token method over HMAC
   */
  static validateWebhook(options: {
    secretToken?: string;
    botToken?: string;
    requestBody: string | Buffer;
    headers: { [key: string]: string | string[] | undefined };
  }): TelegramWebhookValidationResult {
    const { secretToken, botToken, requestBody, headers } = options;

    // Get signature headers
    const secretTokenHeader = headers['x-telegram-bot-api-secret-token'] as string;
    const hmacSignatureHeader = (headers['x-hub-signature-256'] || headers['x-telegram-signature']) as string;

    // Try secret token method first (recommended)
    if (secretToken && secretTokenHeader) {
      logger.debug('Validating Telegram webhook using secret token method');
      return this.validateSecretToken(secretToken, secretTokenHeader);
    }

    // Fallback to HMAC signature method
    if (botToken && hmacSignatureHeader) {
      logger.debug('Validating Telegram webhook using HMAC signature method');
      return this.validateHmacSignature(botToken, requestBody, hmacSignatureHeader);
    }

    // If we have a secret token but no header, this is suspicious
    if (secretToken && !secretTokenHeader) {
      logger.warn('Telegram webhook missing required secret token header', {
        hasSecretToken: !!secretToken,
        hasSecretTokenHeader: !!secretTokenHeader,
        headers: Object.keys(headers)
      });
      return { 
        isValid: false, 
        error: 'Missing X-Telegram-Bot-Api-Secret-Token header' 
      };
    }

    // If we have a bot token but no signature header, this is also suspicious
    if (botToken && !hmacSignatureHeader) {
      logger.warn('Telegram webhook missing signature header for HMAC validation', {
        hasBotToken: !!botToken,
        hasSignatureHeader: !!hmacSignatureHeader,
        headers: Object.keys(headers)
      });
      return { 
        isValid: false, 
        error: 'Missing signature header for HMAC validation' 
      };
    }

    // No validation method available
    logger.warn('No Telegram webhook validation method available', {
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

  /**
   * Validate webhook with environment-specific requirements
   * In production, validation is always required
   * In development, validation can be optional based on configuration
   */
  static validateWithEnvironment(options: {
    secretToken?: string;
    botToken?: string;
    requestBody: string | Buffer;
    headers: { [key: string]: string | string[] | undefined };
    environment?: string;
    requireValidation?: boolean;
  }): TelegramWebhookValidationResult {
    const { environment = process.env.NODE_ENV, requireValidation } = options;
    const isProduction = environment === 'production';
    const shouldRequireValidation = requireValidation ?? isProduction;

    const result = this.validateWebhook(options);

    // In production or when explicitly required, validation must pass
    if (shouldRequireValidation && !result.isValid) {
      logger.error('Telegram webhook validation failed in production environment', {
        environment,
        error: result.error
      });
      return result;
    }

    // In development, log warning but allow through if no validation configured
    if (!result.isValid && !shouldRequireValidation) {
      logger.warn('Telegram webhook validation failed in development environment - allowing through', {
        environment,
        error: result.error
      });
      return { isValid: true }; // Allow through in development
    }

    return result;
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use TelegramWebhookValidator.validateWebhook instead
 */
export function verifyTelegramSignature(
  body: Record<string, unknown>,
  signature: string,
  token: string
): boolean {
  const result = TelegramWebhookValidator.validateHmacSignature(
    token,
    JSON.stringify(body),
    signature
  );
  return result.isValid;
}
