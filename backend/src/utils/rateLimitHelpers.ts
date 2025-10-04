/**
 * Rate Limiting Helpers
 * Advanced rate limiting configurations for different scenarios
 */

import { Request } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from './logger';

/**
 * Create a custom rate limiter with logging
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator: options.keyGenerator || ((req) => req.ip || 'unknown'),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });

      res.status(429).json({
        error: options.message || 'Too many requests',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
}

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts
  message: 'Too many login attempts, please try again in 15 minutes'
});

/**
 * Moderate rate limiter for API endpoints
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 60,                   // 60 requests
  message: 'API rate limit exceeded'
});

/**
 * Lenient rate limiter for public endpoints
 */
export const publicRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 100,                  // 100 requests
  message: 'Too many requests'
});

/**
 * Strict rate limiter for file uploads
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 uploads
  message: 'Upload limit exceeded, please try again later'
});

/**
 * Slow down middleware for progressive delays
 */
export const progressiveSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5,             // Start slowing down after 5 requests
  delayMs: () => 500,        // Add 500ms delay per request (must be function)
  maxDelayMs: 5000           // Maximum 5 second delay
});

/**
 * Per-user rate limiter (requires authentication)
 */
export const perUserRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip || 'unknown';
  },
  message: 'User rate limit exceeded'
});

/**
 * Endpoint-specific rate limiter factory
 */
export function createEndpointRateLimiter(endpoint: string, config: {
  windowMs: number;
  max: number;
  perUser?: boolean;
}) {
  return createRateLimiter({
    ...config,
    message: `Rate limit exceeded for ${endpoint}`,
    keyGenerator: config.perUser
      ? (req: any) => `${endpoint}:${req.user?.id || req.ip}`
      : (req) => `${endpoint}:${req.ip}`
  });
}

/**
 * Burst rate limiter - allows bursts but limits sustained requests
 */
export const burstRateLimiter = {
  // Allow 10 requests immediately
  burst: createRateLimiter({
    windowMs: 1000,  // 1 second
    max: 10
  }),

  // But only 100 per minute sustained
  sustained: createRateLimiter({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,
    skipSuccessfulRequests: true
  })
};

/**
 * Dynamic rate limiter based on user role
 */
export function createRoleBasedRateLimiter(config: {
  [role: string]: { windowMs: number; max: number };
}) {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role || 'guest';
    const roleConfig = config[role] || config['guest'];

    if (!roleConfig) {
      return next();
    }

    const limiter = createRateLimiter(roleConfig);
    return limiter(req, res, next);
  };
}

/**
 * Example: Role-based rate limiter
 */
export const roleBasedApiLimiter = createRoleBasedRateLimiter({
  'OWNER': { windowMs: 60000, max: 1000 },
  'ADMIN': { windowMs: 60000, max: 500 },
  'VENDOR': { windowMs: 60000, max: 200 },
  'CUSTOMER': { windowMs: 60000, max: 100 },
  'guest': { windowMs: 60000, max: 50 }
});

/**
 * Conditional rate limiter
 */
export function conditionalRateLimiter(
  condition: (req: Request) => boolean,
  limiter: RateLimitRequestHandler
) {
  return (req: any, res: any, next: any) => {
    if (condition(req)) {
      return limiter(req, res, next);
    }
    next();
  };
}

/**
 * IP-based rate limiter with whitelist
 */
export function createWhitelistRateLimiter(
  whitelist: string[],
  limiter: RateLimitRequestHandler
) {
  return conditionalRateLimiter(
    (req) => !whitelist.includes(req.ip || ''),
    limiter
  );
}

/**
 * Example usage in routes:
 *
 * import { authRateLimiter, perUserRateLimiter } from '../utils/rateLimitHelpers';
 *
 * router.post('/login', authRateLimiter, controller.login);
 * router.get('/api/data', perUserRateLimiter, controller.getData);
 */

