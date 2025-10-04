/**
 * Complete Security Stack Integration
 * Централизованная интеграция всех уровней защиты
 *
 * SECURITY: Defense in Depth - многоуровневая защита
 */

import { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger';
import {
    apiRateLimit,
    authRateLimit,
    strictRateLimit
} from './advancedRateLimiting';
import { runtimeSecurityValidator } from './runtimeSecurityValidator';
import { securityMonitoring } from './securityMonitoring';

/**
 * Security Stack Configuration
 */
export interface SecurityStackConfig {
  enableHelmet?: boolean;
  enableRuntimeValidation?: boolean;
  enableRateLimiting?: boolean;
  enableMonitoring?: boolean;
  customRateLimits?: {
    auth?: any;
    api?: any;
    strict?: any;
  };
}

/**
 * Применить полный стек безопасности к Express приложению
 */
export function applySecurityStack(
  app: Express,
  config: SecurityStackConfig = {}
): void {
  const {
    enableHelmet = true,
    enableRuntimeValidation = true,
    enableRateLimiting = true,
    enableMonitoring = true,
    customRateLimits = {},
  } = config;

  logger.info('Applying security stack...', {
    helmet: enableHelmet,
    runtimeValidation: enableRuntimeValidation,
    rateLimiting: enableRateLimiting,
    monitoring: enableMonitoring,
  });

  // 1. Helmet - HTTP headers security
  if (enableHelmet) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 год
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      xssFilter: true,
    }));

    logger.info('✅ Helmet security headers applied');
  }

  // 2. Security Monitoring
  if (enableMonitoring) {
    app.use(securityMonitoring);
    logger.info('✅ Security monitoring enabled');
  }

  // 3. Runtime Security Validation
  if (enableRuntimeValidation) {
    app.use(runtimeSecurityValidator({
      blockOnViolation: true,
      logViolations: true,
      excludePaths: [/^\/health/, /^\/metrics/, /^\/api\/docs/],
    }));
    logger.info('✅ Runtime security validation enabled');
  }

  // 4. Rate Limiting
  if (enableRateLimiting) {
    // Глобальный rate limit для всех API
    app.use('/api', apiRateLimit);

    // Специальные rate limits для аутентификации
    app.use('/api/auth/login', authRateLimit);
    app.use('/api/auth/register', authRateLimit);
    app.use('/api/auth/refresh', authRateLimit);

    // Строгий rate limit для чувствительных операций
    app.use('/api/admin/users/delete', strictRateLimit);
    app.use('/api/admin/stores/delete', strictRateLimit);
    app.use('/api/payments/approve', strictRateLimit);

    logger.info('✅ Advanced rate limiting enabled');
  }

  // 5. Дополнительные security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // SECURITY: Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // SECURITY: Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // SECURITY: XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // SECURITY: Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // SECURITY: Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  });

  logger.info('✅ Additional security headers applied');
  logger.info('🔐 Complete security stack initialized successfully');
}

/**
 * Получение статуса безопасности
 */
export function getSecurityStackStatus(): {
  enabled: boolean;
  components: Record<string, boolean>;
  stats: any;
} {
  return {
    enabled: true,
    components: {
      helmet: true,
      runtimeValidation: true,
      rateLimiting: true,
      monitoring: true,
      customHeaders: true,
    },
    stats: {
      // Можно добавить статистику из различных компонентов
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  };
}

export default applySecurityStack;

