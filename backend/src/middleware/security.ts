import cors from 'cors';
import crypto from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { createClient, RedisClientType } from 'redis';
import { securityMetrics } from '../config/security';
import { logger } from '../utils/logger';
// SECURITY ENHANCEMENT: Import new security middleware
import { customSecurityHeaders } from './securityHeaders';

// Extend Request interface for brute force tracking
declare module 'express-serve-static-core' {
  interface Request {
    bruteForceKey?: string;
  }
}

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_IP_REPUTATION = process.env.ENABLE_IP_REPUTATION !== 'false';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://82.147.84.78:3000';
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'http://82.147.84.78:3001';
const REDIS_URL = process.env.REDIS_URL;

// Enhanced CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      FRONTEND_URL,
      ADMIN_PANEL_URL,
      'http://82.147.84.78:3000',
      'http://82.147.84.78:3001',
      'http://82.147.84.78:3000', // Vite dev server
      ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map(o => o.trim()) || [])
    ].filter(Boolean);

    // In production, be more strict
    if (NODE_ENV === 'production') {
      // Only allow explicitly whitelisted origins in production
      const productionOrigins = process.env.CORS_WHITELIST?.split(',').map(o => o.trim()) || [];
      if (productionOrigins.length > 0) {
        if (!origin || !productionOrigins.includes(origin)) {
          logger.warn('CORS blocked request from origin in production:', { origin, allowedOrigins: productionOrigins });
          return callback(new Error('Not allowed by CORS policy'));
        }
        return callback(null, true);
      }
    }

    // Allow requests with no origin in development (mobile apps, Postman, etc.)
    if (!origin && NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (NODE_ENV === 'development' && origin) {
      // In development, allow localhost only with specific ports
      // Allowed ports: 3000 (frontend), 3001 (admin), 5173 (Vite), 4173 (Vite preview)
      const allowedDevPorts = ['3000', '3001', '5173', '4173'];
      const localhostPattern = new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):(${allowedDevPorts.join('|')})$`);

      if (localhostPattern.test(origin)) {
        return callback(null, true);
      }

      // Log rejected localhost origins for debugging
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        logger.warn('CORS blocked localhost origin with non-allowed port', {
          origin,
          allowedPorts: allowedDevPorts
        });
      }
    }

    if (origin && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('CORS blocked request from origin:', { origin, allowedOrigins, userAgent: callback.toString() });
    callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
  methods: NODE_ENV === 'production'
    ? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
    : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
    'X-Request-ID',
    'x-csrf-token',
    'X-CSRF-Token'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: NODE_ENV === 'production' ? 86400 : 3600, // 24 hours in prod, 1 hour in dev
  optionsSuccessStatus: 200
};

// Enhanced Helmet configuration for security headers with nonce support in dev
const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: NODE_ENV === 'development' ? false : { // Disable default CSP in dev, use nonce-based
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://unpkg.com' // For admin panel styles
      ],
      scriptSrc: [
        "'self'",
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:'
      ],
      connectSrc: [
        "'self'",
        'wss:',
        'ws:',
        'https://api.telegram.org',
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        ...(process.env.ADMIN_PANEL_URL ? [process.env.ADMIN_PANEL_URL] : [])
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
    reportOnly: false,
  },
  crossOriginEmbedderPolicy: NODE_ENV === 'production' ? { policy: 'require-corp' } : false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
};

// Redis client for rate limiting (if available)
let redisClient: RedisClientType | null = null;
if (REDIS_URL) {
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 2000 // 2 second timeout
      }
    });

    redisClient.connect()
      .then(() => {
        logger.info('Redis connected for rate limiting');
      })
      .catch((err: unknown) => {
        const isDevelopment = NODE_ENV === 'development';
        if (isDevelopment) {
          logger.warn('Redis not available for rate limiting - using memory fallback (development mode)', {
            redisUrl: REDIS_URL?.replace(/\/\/[^@]*@/, '//***@') // Hide credentials in logs
          });
        } else {
          logger.error('Redis connection failed for rate limiting:', err as Record<string, unknown>);
        }
        redisClient = null;
      });

    // Handle connection errors gracefully
    redisClient.on('error', (err: unknown) => {
      const isDevelopment = NODE_ENV === 'development';
      if (!isDevelopment) {
        logger.error('Redis rate limiting client error:', err as Record<string, unknown>);
      }
      redisClient = null;
    });
  } catch (err: unknown) {
    const isDevelopment = NODE_ENV === 'development';
    if (isDevelopment) {
      logger.warn('Redis client creation failed for rate limiting - using memory fallback');
    } else {
      logger.error('Failed to create Redis client for rate limiting:', err as Record<string, unknown>);
    }
  }
}

// Enhanced rate limiting configurations with Redis support
const createRateLimit = (config: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}): RateLimitRequestHandler => {
  const options: { windowMs: number; max: number; message: { error: string; retryAfter: string; }; standardHeaders: boolean; legacyHeaders: boolean; skipSuccessfulRequests: boolean; skipFailedRequests: boolean; keyGenerator: (req: Request) => string; handler: (req: Request, res: Response) => void; } = {
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: config.message,
      retryAfter: Math.ceil(config.windowMs / 60000) + ' minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    keyGenerator: config.keyGenerator || ((req: Request) => {
      return req.ip || req.socket?.remoteAddress || 'unknown';
    }),
    handler: (req: Request, res: Response) => {
      securityMetrics.incrementRateLimitHits();
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        limit: config.max,
        window: config.windowMs
      });
      res.status(429).json({
        error: config.message,
        retryAfter: Math.ceil(config.windowMs / 60000) + ' minutes',
        limit: config.max,
        window: config.windowMs
      });
    }
  };

  // Use Redis store if available (currently disabled due to dependency issues)
  // Note: Redis rate limiting can be enabled when rate-limit-redis dependency is fixed
  // For production environments, consider using external rate limiting (nginx, cloudflare, etc.)

  return rateLimit(options);
};

export const globalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'development' ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Stricter rate limit for authentication endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'development' ? 100 : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limit for file uploads
export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: NODE_ENV === 'development' ? 50 : parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10'),
  message: 'Too many file uploads, please try again later.'
});

// Rate limit for API endpoints (more lenient than global)
export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'development' ? 5000 : parseInt(process.env.API_RATE_LIMIT_MAX || '200'),
  message: 'Too many API requests, please try again later.'
});

// Rate limit for admin endpoints (very strict)
export const adminRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'development' ? 200 : parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '50'),
  message: 'Too many admin requests, please try again later.',
  keyGenerator: (req: Request) => {
    // Include user ID in key for admin endpoints if available
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return userId ? `${ip}-${userId}` : ip;
  }
});

// Slow down repeated requests to sensitive endpoints
export const slowDownMiddleware: RequestHandler = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: NODE_ENV === 'development' ? 50 : 5, // Allow 5 requests per windowMs without delay
  delayMs: (used: number, _req: Request, _res: Response) => 500, // Fixed 500ms delay per request after delayAfter (new v2 format)
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false } // Disable the deprecation warning
});

// SECURITY: Redis-backed brute force protection (CWE-307, CWE-770)
// Scalable solution that works across multiple instances
const BRUTE_FORCE_PREFIX = 'bruteforce:';
const BRUTE_FORCE_WINDOW = 15 * 60; // 15 minutes in seconds
const BRUTE_FORCE_MAX_ATTEMPTS = 3;

// Fallback Map for when Redis is unavailable (development)
const bruteForceAttemptsFallback = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Get brute force attempt record from Redis or fallback to memory
 */
async function getBruteForceRecord(key: string): Promise<{ count: number; lastAttempt: number } | null> {
  if (redisClient && redisClient.isOpen) {
    try {
      const data = await redisClient.get(`${BRUTE_FORCE_PREFIX}${key}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Redis getBruteForceRecord error', { error, key });
    }
  }

  // Fallback to memory
  return bruteForceAttemptsFallback.get(key) || null;
}

/**
 * Set brute force attempt record in Redis or fallback to memory
 */
async function setBruteForceRecord(key: string, record: { count: number; lastAttempt: number }): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      // Store in Redis with TTL
      const ttl = Math.ceil(
        Math.min(
          BRUTE_FORCE_WINDOW * Math.pow(2, record.count),
          24 * 60 * 60 // Max 24 hours
        )
      );
      await redisClient.setEx(
        `${BRUTE_FORCE_PREFIX}${key}`,
        ttl,
        JSON.stringify(record)
      );
      return;
    } catch (error) {
      logger.error('Redis setBruteForceRecord error', { error, key });
    }
  }

  // Fallback to memory
  bruteForceAttemptsFallback.set(key, record);
}

/**
 * Delete brute force attempt record from Redis or fallback
 */
async function deleteBruteForceRecord(key: string): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.del(`${BRUTE_FORCE_PREFIX}${key}`);
      return;
    } catch (error) {
      logger.error('Redis deleteBruteForceRecord error', { error, key });
    }
  }

  // Fallback to memory
  bruteForceAttemptsFallback.delete(key);
}

export const bruteForce = {
  prevent: async (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';
    const now = Date.now();

    try {
      const record = await getBruteForceRecord(clientIP) || { count: 0, lastAttempt: now };

      // Reset counter if more than 15 minutes have passed
      if (now - record.lastAttempt > BRUTE_FORCE_WINDOW * 1000) {
        record.count = 0;
      }

      // SECURITY: Reduced threshold from 5 to 3 attempts with exponential backoff (CWE-307)
      if (record.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
        // Calculate exponential backoff duration
        const blockDuration = Math.min(
          15 * 60 * 1000 * Math.pow(2, record.count - BRUTE_FORCE_MAX_ATTEMPTS), // Exponential: 15min, 30min, 1h, 2h, 4h...
          24 * 60 * 60 * 1000 // Maximum 24 hours
        );

        const timeSinceLastAttempt = now - record.lastAttempt;

        if (timeSinceLastAttempt < blockDuration) {
          const retryAfter = Math.ceil((blockDuration - timeSinceLastAttempt) / 1000);

          logger.warn('Brute force protection triggered', {
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            attempts: record.count,
            blockDuration: Math.ceil(blockDuration / 1000 / 60) + ' minutes',
            retryAfter: retryAfter + ' seconds',
            backend: redisClient?.isOpen ? 'redis' : 'memory'
          });

          securityMetrics.incrementBruteForceAttempts();

          return res.status(429).json({
            error: 'Too many failed attempts',
            message: 'Account temporarily locked. Please try again later.',
            retryAfter: retryAfter
          });
        }
      }

      // Store for potential failure
      req.bruteForceKey = clientIP;
      next();
    } catch (error) {
      logger.error('Brute force protection error', { error, ip: clientIP });
      // On error, allow the request but log it
      next();
    }
  },

  // Record failed attempt
  recordFailure: async (key: string) => {
    try {
      const now = Date.now();
      const record = await getBruteForceRecord(key) || { count: 0, lastAttempt: now };

      record.count++;
      record.lastAttempt = now;

      await setBruteForceRecord(key, record);

      logger.info('Brute force failure recorded', {
        key,
        attempts: record.count,
        backend: redisClient?.isOpen ? 'redis' : 'memory'
      });
    } catch (error) {
      logger.error('Failed to record brute force attempt', { error, key });
    }
  },

  // Reset attempts (on successful login)
  reset: async (key: string) => {
    try {
      await deleteBruteForceRecord(key);
      logger.info('Brute force counter reset', {
        key,
        backend: redisClient?.isOpen ? 'redis' : 'memory'
      });
    } catch (error) {
      logger.error('Failed to reset brute force attempts', { error, key });
    }
  }
};

// Enhanced security monitoring middleware
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';

  // Enhanced suspicious patterns detection
  const suspiciousPatterns = [
    { pattern: /\.\.(\/|\\)/, severity: 'high', type: 'directory_traversal' },
    { pattern: /<script[^>]*>/i, severity: 'high', type: 'xss_script' },
    { pattern: /javascript:/i, severity: 'high', type: 'xss_javascript' },
    { pattern: /vbscript:/i, severity: 'high', type: 'xss_vbscript' },
    { pattern: /on\w+\s*=/i, severity: 'medium', type: 'xss_event_handler' },
    { pattern: /union.*select/i, severity: 'critical', type: 'sql_injection' },
    { pattern: /insert.*into/i, severity: 'critical', type: 'sql_injection' },
    { pattern: /drop.*table/i, severity: 'critical', type: 'sql_injection' },
    { pattern: /eval\s*\(/i, severity: 'high', type: 'code_injection' },
    { pattern: /exec\s*\(/i, severity: 'high', type: 'code_injection' },
    { pattern: /\${.*}/i, severity: 'medium', type: 'template_injection' },
    { pattern: /file:\/\//i, severity: 'medium', type: 'file_inclusion' },
    { pattern: /<\?php/i, severity: 'medium', type: 'php_injection' },
  ];

  const url = req.url.toLowerCase();
  const userAgent = req.get('User-Agent') || '';
  const body = req.body ? JSON.stringify(req.body).toLowerCase() : '';
  const queryParams = new URLSearchParams(req.url.split('?')[1] || '').toString().toLowerCase();

  const suspiciousFindings: Array<{type: string, severity: string, location: string}> = [];

  suspiciousPatterns.forEach(({ pattern, severity, type }) => {
    if (pattern.test(url)) {
      suspiciousFindings.push({ type, severity, location: 'url' });
    }
    if (pattern.test(userAgent)) {
      suspiciousFindings.push({ type, severity, location: 'user_agent' });
    }
    if (pattern.test(body)) {
      suspiciousFindings.push({ type, severity, location: 'body' });
    }
    if (pattern.test(queryParams)) {
      suspiciousFindings.push({ type, severity, location: 'query_params' });
    }
  });

  // Check for bot-like behavior
  const botPatterns = [
    /bot|crawler|spider|scraper|wget|curl/i,
    /^$/,  // Empty user agent
    /python|node|java|perl|ruby|php/i
  ];

  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  if (isBot && !url.includes('/api/health') && !url.includes('/robots.txt')) {
    suspiciousFindings.push({ type: 'bot_activity', severity: 'low', location: 'user_agent' });
  }

  // Log and handle suspicious activity
  if (suspiciousFindings.length > 0) {
    const highSeverityCount = suspiciousFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length;

    logger.warn('Suspicious request detected', {
      ip: clientIP,
      method: req.method,
      url: req.url,
      userAgent,
      findings: suspiciousFindings,
      severity: highSeverityCount > 0 ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    });

    // Increment security metrics
    securityMetrics.incrementSuspiciousRequests();

    // Mark IP as suspicious for repeated offenses
    markSuspiciousIP(clientIP);

    // Block critical security threats immediately
    if (suspiciousFindings.some(f => f.severity === 'critical')) {
      logger.error('Critical security threat detected - blocking request', {
        ip: clientIP,
        findings: suspiciousFindings.filter(f => f.severity === 'critical')
      } as Record<string, unknown>);
      return res.status(403).json({
        error: 'Request blocked due to security policy violation'
      });
    }
  }

  // Monitor response time and size for potential DoS
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseSizeHeader = res.get('Content-Length');
    const responseSize = responseSizeHeader ? parseInt(responseSizeHeader) : 0;

    if (duration > 10000) { // Requests taking longer than 10 seconds
      logger.warn('Slow request detected', {
        ip: clientIP,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
        responseSize
      });
    }

    // Log large responses that might indicate data exfiltration
    if (responseSize > 10 * 1024 * 1024) { // 10MB
      logger.warn('Large response detected', {
        ip: clientIP,
        method: req.method,
        url: req.url,
        duration,
        responseSize,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

// Enhanced request sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip sanitization for certain endpoints that need raw data
    const skipPaths = ['/api/cms/webhooks', '/api/upload'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query, true) as any;
    }

    // Sanitize body (for JSON requests)
    if (req.body && typeof req.body === 'object' && req.get('Content-Type')?.includes('application/json')) {
      req.body = sanitizeObject(req.body, false);
    }

    next();
  } catch (error) {
    logger.error('Error in input sanitization:', error);
    next(); // Continue processing even if sanitization fails
  }
};

function sanitizeObject(obj: unknown, isQueryParam: boolean = false): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, isQueryParam));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Sanitize key name
        const cleanKey = sanitizeString(key, true);
        sanitized[cleanKey] = sanitizeObject((obj as Record<string, unknown>)[key], isQueryParam);
      }
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, isQueryParam);
  }

  return obj;
}

// SECURITY: Enhanced sanitization with CORRECT order (CWE-79, CWE-116)
// CRITICAL: Order matters! Normalization → Removal → Escaping
// This prevents bypass attacks using unicode and encoding tricks
function sanitizeString(str: string, isKey: boolean = false): string {
  if (typeof str !== 'string') return str;

  // For keys - only safe characters allowed
  if (isKey) {
    // Use whitelist approach for keys
    return str.replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
  }

  let sanitized = str;

  // PHASE 1: NORMALIZATION (CWE-176, CWE-180)
  // Must happen FIRST to prevent unicode bypass attacks

  // Step 1: Normalize unicode to canonical form
  // This prevents attacks using unicode lookalikes and combining characters
  sanitized = sanitized.normalize('NFKC');

  // PHASE 2: REMOVAL (CWE-79, CWE-116)
  // Remove dangerous content AFTER normalization

  // Step 2: Remove null bytes and control characters
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // Step 3: Remove all script tags and their content (case-insensitive)
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');

  // Step 4: Remove javascript: and data: protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Step 5: Remove on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // Step 6: Remove dangerous HTML tags
  sanitized = sanitized.replace(/<(script|object|embed|link|meta|style|iframe|frame|frameset|applet|base)[^>]*>/gi, '');

  // PHASE 3: ESCAPING (CWE-79)
  // Must happen LAST after all removal to ensure proper encoding

  // Step 7: Escape HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized.trim();
}

// Enhanced IP whitelist for admin endpoints with CIDR support
export const adminIPWhitelist = (req: Request, res: Response, next: NextFunction) => {
  const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST;

  // Skip in development unless explicitly set
  if (NODE_ENV === 'development' && !ADMIN_IP_WHITELIST) {
    return next();
  }

  if (!ADMIN_IP_WHITELIST) {
    logger.warn('Admin IP whitelist not configured in production');
    return next();
  }

  const allowedIPs = ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim());
  const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';

  // Check exact IP matches and common local IPs in development
  let isAllowed = allowedIPs.includes(clientIP);

  // In development, also allow common 82.147.84.78 variants
  if (NODE_ENV === 'development') {
    const devIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '82.147.84.78'];
    isAllowed = isAllowed || devIPs.includes(clientIP);
  }

  // Simple CIDR support for IPv4 (basic implementation)
  if (!isAllowed) {
    for (const allowedIP of allowedIPs) {
      if (allowedIP.includes('/')) {
        // Basic CIDR check (simplified)
        const [network, prefixLength] = allowedIP.split('/');
        if (clientIP.startsWith(network.split('.').slice(0, Math.floor(parseInt(prefixLength) / 8)).join('.'))) {
          isAllowed = true;
          break;
        }
      }
    }
  }

  if (isAllowed) {
    next();
  } else {
    logger.warn('Admin access attempt from non-whitelisted IP', {
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      allowedIPs: allowedIPs.length,
      timestamp: new Date().toISOString()
    });

    res.status(403).json({
      error: 'Access denied. Your IP address is not authorized for admin access.',
      ip: clientIP, // Include IP in response for debugging
      timestamp: new Date().toISOString()
    });
  }
};

// Export configured middleware
export const corsMiddleware = cors(corsOptions);
export const helmetMiddleware = helmet(helmetOptions);

// Nonce-based CSP middleware for development
export const nonceCSPMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (NODE_ENV !== 'development') {
    return next();
  }

  // Generate a unique nonce for this request
  const nonce = crypto.randomBytes(16).toString('base64');

  // Make nonce available to views/templates
  res.locals.cspNonce = nonce;
  (req as any).cspNonce = nonce;

  // Set nonce-based CSP headers for development
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net https://unpkg.com`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com`,
    "img-src 'self' data: https: http:",
    "connect-src 'self' wss: ws: https://api.telegram.org" +
      (process.env.FRONTEND_URL ? ` ${process.env.FRONTEND_URL}` : '') +
      (process.env.ADMIN_PANEL_URL ? ` ${process.env.ADMIN_PANEL_URL}` : ''),
    "font-src 'self' https://fonts.gstatic.com data:",
    "object-src 'none'",
    "media-src 'self' data: https:",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ];

  res.setHeader('Content-Security-Policy-Report-Only', cspDirectives.join('; '));

  next();
};

// Enhanced security monitoring with Redis-backed IP reputation tracking
import { ipReputationService } from '../services/IPReputationService';

// IP reputation middleware (Redis-backed)
export const ipReputationCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';

    if (clientIP === 'unknown') {
      return next();
    }

    // Check if IP is blocked
    const blockStatus = await ipReputationService.isBlocked(clientIP);

    if (blockStatus.blocked) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        reason: blockStatus.reason,
        blockedUntil: blockStatus.blockedUntil
      });

      return res.status(403).json({
        error: 'Access denied. IP temporarily blocked due to suspicious activity.',
        blockedUntil: blockStatus.blockedUntil,
        reason: blockStatus.reason
      });
    }

    next();
  } catch (error) {
    logger.error('IP reputation check failed:', error);
    // Fail open - allow request on error to prevent blocking legitimate traffic
    next();
  }
};

// Function to mark IP as suspicious (Redis-backed)
export const markSuspiciousIP = async (ip: string, reason: string = 'suspicious_activity') => {
  try {
    await ipReputationService.markSuspicious(ip, reason);
  } catch (error) {
    logger.error('Failed to mark IP as suspicious:', { ip, reason, error });
  }
};

// Enhanced security middleware bundle for easy application
// SECURITY ENHANCEMENT: Added customSecurityHeaders, nonce-based CSP for dev
export const securityMiddlewareBundle = [
  ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [ipReputationCheck]),
  helmetMiddleware,
  ...(NODE_ENV === 'development' ? [nonceCSPMiddleware] : []), // NEW: Nonce-based CSP for dev
  customSecurityHeaders, // NEW: Additional security headers (Permissions-Policy, etc.)
  corsMiddleware,
  securityMonitoring,
  sanitizeInput,
  globalRateLimit,
  slowDownMiddleware
];

// API-specific security bundle (more lenient)
export const apiSecurityBundle = [
  ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [ipReputationCheck]),
  helmetMiddleware,
  corsMiddleware,
  securityMonitoring,
  sanitizeInput,
  apiRateLimit
];

// Admin-specific security bundle (more strict)
export const adminSecurityBundle = [
  ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [ipReputationCheck]),
  helmetMiddleware,
  corsMiddleware,
  securityMonitoring,
  sanitizeInput,
  adminRateLimit,
  slowDownMiddleware,
  adminIPWhitelist
];

// Cleanup function for production (Redis-backed, auto-expires via TTL)
export const cleanupSecurityData = async () => {
  try {
    // Redis automatically expires old data via TTL
    // IP reputation service has its own cleanup task running

    // Clean up fallback memory storage
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, data] of bruteForceAttemptsFallback.entries()) {
      if (now - data.lastAttempt > cleanupThreshold) {
        bruteForceAttemptsFallback.delete(key);
      }
    }

    logger.info('Security data cleanup completed', {
      fallbackRecords: bruteForceAttemptsFallback.size
    });
  } catch (error) {
    logger.error('Security data cleanup error', { error });
  }
};

// Run cleanup every hour in production
if (NODE_ENV === 'production') {
  setInterval(cleanupSecurityData, 60 * 60 * 1000);
}

export default securityMiddlewareBundle;
