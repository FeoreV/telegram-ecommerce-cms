import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
// import { RedisStore as RateLimitRedisStore } from 'rate-limit-redis';
import slowDown from 'express-slow-down';
// import ExpressBrute from 'express-brute';
// import { RedisStore } from 'express-brute-redis';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';
import { securityMetrics } from '../config/security';
import { createClient } from 'redis';
import { RedisClientType } from 'redis';

// Extend Request interface for brute force tracking
declare module 'express-serve-static-core' {
  interface Request {
    bruteForceKey?: string;
  }
}

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_IP_REPUTATION = process.env.ENABLE_IP_REPUTATION !== 'false';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'http://localhost:3001';
const REDIS_URL = process.env.REDIS_URL;

// Enhanced CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      FRONTEND_URL,
      ADMIN_PANEL_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3000', // Vite dev server
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
      }
    }

    // Allow requests with no origin in development (mobile apps, Postman, etc.)
    if (!origin && NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (NODE_ENV === 'development' && origin) {
      // In development, allow localhost with any port
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || 
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
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
    'X-Request-ID'
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

// Enhanced Helmet configuration for security headers
const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        ...(NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://unpkg.com' // For admin panel styles
      ],
      scriptSrc: [
        "'self'",
        ...(NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:',
        ...(NODE_ENV === 'development' ? ['http:'] : []) // Only allow http images in dev
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
    reportOnly: NODE_ENV === 'development',
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
  max: NODE_ENV === 'development' ? 1000 : parseInt(process.env.RATE_LIMIT_MAX || '100'),
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
  max: NODE_ENV === 'development' ? 500 : parseInt(process.env.API_RATE_LIMIT_MAX || '200'),
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

// Simple brute force protection fallback
// Note: Using custom implementation due to express-brute compatibility issues
// In production, consider using more robust solutions like fail2ban or cloud-based protection
const bruteForceAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const bruteForce = {
  prevent: (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';
    const now = Date.now();
    const record = bruteForceAttempts.get(clientIP) || { count: 0, lastAttempt: now };

    // Reset counter if more than 15 minutes have passed
    if (now - record.lastAttempt > 15 * 60 * 1000) {
      record.count = 0;
    }

    if (record.count >= 5) {
      logger.warn('Brute force protection triggered', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        attempts: record.count
      });
      return res.status(429).json({
        error: 'Too many failed attempts. Account temporarily locked.',
        message: 'Please try again later or contact support if this continues.'
      });
    }

    // Store for potential failure
    req.bruteForceKey = clientIP;
    next();
  },
  
  // Mock method for compatibility
  reset: (key: string) => {
    bruteForceAttempts.delete(key);
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

function sanitizeString(str: string, isKey: boolean = false): string {
  if (typeof str !== 'string') return str;

  let sanitized = str;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  
  // Remove potentially dangerous HTML tags
  sanitized = sanitized.replace(/<(script|object|embed|link|meta|style|iframe)[^>]*>/gi, '');
  
  // For keys, be more restrictive
  if (isKey) {
    sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '');
  } else {
    // Remove HTML tags but preserve content
    sanitized = sanitized.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    sanitized = sanitized
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&amp;/g, '&'); // This should be last
  }
  
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
  
  // In development, also allow common localhost variants
  if (NODE_ENV === 'development') {
    const devIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
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

// Security health check endpoint data
export const getSecurityStatus = () => {
  const suspiciousIPsArray = Array.from(suspiciousIPs.entries()).map(([ip, data]) => ({
    ip,
    count: data.count,
    lastSeen: data.lastSeen,
    blocked: data.blocked
  }));

  return {
    suspiciousIPs: suspiciousIPsArray.length,
    blockedIPs: suspiciousIPsArray.filter(ip => ip.blocked).length,
    redisConnected: !!redisClient,
    environment: NODE_ENV,
    corsOriginsConfigured: !!process.env.CORS_WHITELIST,
    adminIPWhitelistConfigured: !!process.env.ADMIN_IP_WHITELIST,
    httpsEnabled: process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true'
  };
};

// Export configured middleware
export const corsMiddleware = cors(corsOptions);
export const helmetMiddleware = helmet(helmetOptions);

// Enhanced security monitoring with IP reputation tracking
const suspiciousIPs = new Map<string, { count: number; lastSeen: Date; blocked: boolean }>();
const SUSPICIOUS_THRESHOLD = 10;
const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour

// IP reputation middleware
export const ipReputationCheck = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = new Date();
  
  const ipData = suspiciousIPs.get(clientIP);
  if (ipData) {
    // Check if IP is currently blocked
    if (ipData.blocked && (now.getTime() - ipData.lastSeen.getTime()) < BLOCK_DURATION) {
      logger.warn('Blocked IP attempted access', { ip: clientIP, blockedUntil: new Date(ipData.lastSeen.getTime() + BLOCK_DURATION) });
      return res.status(403).json({ 
        error: 'Access denied. IP temporarily blocked due to suspicious activity.',
        blockedUntil: new Date(ipData.lastSeen.getTime() + BLOCK_DURATION)
      });
    }
    
    // Reset block if duration has passed
    if (ipData.blocked && (now.getTime() - ipData.lastSeen.getTime()) >= BLOCK_DURATION) {
      ipData.blocked = false;
      ipData.count = 0;
      logger.info('IP unblocked after timeout', { ip: clientIP });
    }
  }
  
  next();
};

// Function to mark IP as suspicious
export const markSuspiciousIP = (ip: string) => {
  const now = new Date();
  const ipData = suspiciousIPs.get(ip) || { count: 0, lastSeen: now, blocked: false };
  
  ipData.count++;
  ipData.lastSeen = now;
  
  if (ipData.count >= SUSPICIOUS_THRESHOLD && !ipData.blocked) {
    ipData.blocked = true;
    logger.warn('IP blocked due to suspicious activity', { ip, count: ipData.count });
  }
  
  suspiciousIPs.set(ip, ipData);
};

// Enhanced security middleware bundle for easy application
export const securityMiddlewareBundle = [
  ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [ipReputationCheck]),
  helmetMiddleware,
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

// Cleanup function for production
export const cleanupSecurityData = () => {
  const now = new Date();
  const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [ip, data] of suspiciousIPs.entries()) {
    if (now.getTime() - data.lastSeen.getTime() > cleanupThreshold) {
      suspiciousIPs.delete(ip);
    }
  }
  
  logger.info('Security data cleanup completed', {
    remainingSuspiciousIPs: suspiciousIPs.size
  });
};

// Run cleanup every hour in production
if (NODE_ENV === 'production') {
  setInterval(cleanupSecurityData, 60 * 60 * 1000);
}

export default securityMiddlewareBundle;