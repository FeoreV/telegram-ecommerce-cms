/**
 * Secure logging wrapper that prevents log injection and sanitizes sensitive data
 */

import winston from 'winston';
import { sanitizeForLog, sanitizeObjectForLog, sanitizeError } from './sanitizer';

class SecureLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Log info level message
   */
  info(message: string, meta?: any): void {
    this.logger.info(sanitizeForLog(message), this.sanitizeMeta(meta));
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | any, meta?: any): void {
    const sanitizedMessage = sanitizeForLog(message);
    
    if (error instanceof Error) {
      const sanitizedError = sanitizeError(error);
      this.logger.error(sanitizedMessage, {
        error: sanitizedError,
        ...this.sanitizeMeta(meta)
      });
    } else if (error) {
      this.logger.error(sanitizedMessage, {
        error: sanitizeObjectForLog(error),
        ...this.sanitizeMeta(meta)
      });
    } else {
      this.logger.error(sanitizedMessage, this.sanitizeMeta(meta));
    }
  }

  /**
   * Log warn level message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(sanitizeForLog(message), this.sanitizeMeta(meta));
  }

  /**
   * Log debug level message
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(sanitizeForLog(message), this.sanitizeMeta(meta));
  }

  /**
   * Log HTTP request
   */
  http(message: string, meta?: any): void {
    this.logger.http(sanitizeForLog(message), this.sanitizeMeta(meta));
  }

  /**
   * Sanitize metadata object
   */
  private sanitizeMeta(meta?: any): any {
    if (!meta) return {};
    return sanitizeObjectForLog(meta);
  }

  /**
   * Log security event
   */
  security(event: string, details: any): void {
    this.logger.info(`[SECURITY] ${sanitizeForLog(event)}`, {
      securityEvent: true,
      ...this.sanitizeMeta(details)
    });
  }

  /**
   * Log audit event
   */
  audit(action: string, userId: string, details: any): void {
    this.logger.info(`[AUDIT] ${sanitizeForLog(action)}`, {
      auditEvent: true,
      userId: sanitizeForLog(userId),
      ...this.sanitizeMeta(details)
    });
  }
}

/**
 * Create a secure logger instance from a winston logger
 */
export function createSecureLogger(logger: winston.Logger): SecureLogger {
  return new SecureLogger(logger);
}

/**
 * Create a secure logger with default configuration
 */
export function createDefaultSecureLogger(): SecureLogger {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 5
      })
    ]
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return new SecureLogger(logger);
}

export default SecureLogger;

