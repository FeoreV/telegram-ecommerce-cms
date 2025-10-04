/**
 * Advanced Rate Limiting Middleware
 * Продвинутое ограничение частоты запросов с защитой от различных атак
 *
 * SECURITY: CWE-307 - Improper Restriction of Excessive Authentication Attempts
 * SECURITY: CWE-770 - Allocation of Resources Without Limits
 * SECURITY: CWE-799 - Improper Control of Interaction Frequency
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableSlowDown?: boolean;
  slowDownAfter?: number;
  slowDownMs?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  slowDownActive: boolean;
}

// In-memory storage (в продакшене использовать Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Получение идентификатора клиента для rate limiting
 */
function getClientIdentifier(req: Request): string {
  // Приоритет: authenticated user > IP address
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Используем IP, учитывая proxy
  const ip = req.ip ||
              req.headers['x-forwarded-for'] as string ||
              req.headers['x-real-ip'] as string ||
              req.socket.remoteAddress ||
              'unknown';

  return `ip:${ip}`;
}

/**
 * Advanced Rate Limiting Middleware
 */
export const advancedRateLimit = (config: RateLimitConfig) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 минут по умолчанию
    maxRequests = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    enableSlowDown = true,
    slowDownAfter = maxRequests * 0.8, // 80% от лимита
    slowDownMs = 1000, // 1 секунда задержки
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientIdentifier(req);
      const key = `${req.path}:${clientId}`;
      const now = Date.now();

      // Получаем или создаем запись для клиента
      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetTime < now) {
        // Создаем новую запись
        entry = {
          count: 0,
          resetTime: now + windowMs,
          slowDownActive: false,
        };
        rateLimitStore.set(key, entry);
      }

      // Увеличиваем счетчик
      entry.count++;

      // Проверяем лимит
      if (entry.count > maxRequests) {
        logger.warn('Rate limit exceeded', {
          clientId,
          path: req.path,
          count: entry.count,
          limit: maxRequests,
          ip: req.ip,
        });

        // Возвращаем 429 Too Many Requests
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You have exceeded the rate limit. Please try again later.',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000), // секунды до сброса
        });
      }

      // Slow down если включено
      if (enableSlowDown && entry.count > slowDownAfter) {
        entry.slowDownActive = true;

        // Задержка увеличивается с каждым запросом после порога
        const delayMultiplier = entry.count - slowDownAfter;
        const delay = slowDownMs * delayMultiplier;

        logger.debug('Rate limit slowdown active', {
          clientId,
          delay,
          count: entry.count,
        });

        // Добавляем задержку
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Устанавливаем заголовки rate limit
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

      if (entry.slowDownActive) {
        res.setHeader('X-RateLimit-SlowDown', 'true');
      }

      // Сохраняем функцию для обновления после ответа
      const originalSend = res.send;
      res.send = function(data: any) {
        // Если нужно пропустить успешные/неуспешные запросы
        if (skipSuccessfulRequests && res.statusCode >= 200 && res.statusCode < 300) {
          entry!.count--;
        }
        if (skipFailedRequests && res.statusCode >= 400) {
          entry!.count--;
        }

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Rate limiter error', { error });
      // Fail-open в случае ошибки rate limiter
      next();
    }
  };
};

/**
 * Специализированный rate limiter для аутентификации
 */
export const authRateLimit = advancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  maxRequests: 5, // Только 5 попыток входа
  skipSuccessfulRequests: true, // Не считаем успешные входы
  enableSlowDown: true,
  slowDownAfter: 3, // Замедляем после 3 попытки
  slowDownMs: 2000, // 2 секунды задержки
});

/**
 * Rate limiter для API endpoints
 */
export const apiRateLimit = advancedRateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  maxRequests: 60, // 60 запросов в минуту
  enableSlowDown: true,
  slowDownAfter: 50,
  slowDownMs: 500,
});

/**
 * Строгий rate limiter для критических операций
 */
export const strictRateLimit = advancedRateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  maxRequests: 10, // Только 10 операций в час
  skipSuccessfulRequests: false,
  enableSlowDown: true,
  slowDownAfter: 5,
  slowDownMs: 5000, // 5 секунд задержки
});

