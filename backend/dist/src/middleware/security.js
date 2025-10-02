"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupSecurityData = exports.adminSecurityBundle = exports.apiSecurityBundle = exports.securityMiddlewareBundle = exports.markSuspiciousIP = exports.ipReputationCheck = exports.helmetMiddleware = exports.corsMiddleware = exports.getSecurityStatus = exports.adminIPWhitelist = exports.sanitizeInput = exports.securityMonitoring = exports.bruteForce = exports.slowDownMiddleware = exports.adminRateLimit = exports.apiRateLimit = exports.uploadRateLimit = exports.authRateLimit = exports.globalRateLimit = void 0;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const logger_1 = require("../utils/logger");
const security_1 = require("../config/security");
const redis_1 = require("redis");
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_IP_REPUTATION = process.env.ENABLE_IP_REPUTATION !== 'false';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'http://localhost:3001';
const REDIS_URL = process.env.REDIS_URL;
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            FRONTEND_URL,
            ADMIN_PANEL_URL,
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3000',
            ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map(o => o.trim()) || [])
        ].filter(Boolean);
        if (NODE_ENV === 'production') {
            const productionOrigins = process.env.CORS_WHITELIST?.split(',').map(o => o.trim()) || [];
            if (productionOrigins.length > 0) {
                if (!origin || !productionOrigins.includes(origin)) {
                    logger_1.logger.warn('CORS blocked request from origin in production:', { origin, allowedOrigins: productionOrigins });
                    return callback(new Error('Not allowed by CORS policy'));
                }
            }
        }
        if (!origin && NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (NODE_ENV === 'development' && origin) {
            if (/^https?:\/\/localhost(:\d+)?$/.test(origin) ||
                /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
        }
        if (origin && allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        logger_1.logger.warn('CORS blocked request from origin:', { origin, allowedOrigins, userAgent: callback.toString() });
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
    maxAge: NODE_ENV === 'production' ? 86400 : 3600,
    optionsSuccessStatus: 200
};
const helmetOptions = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'",
                ...(NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
                'https://fonts.googleapis.com',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com'
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
                ...(NODE_ENV === 'development' ? ['http:'] : [])
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
        maxAge: 31536000,
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
let redisClient = null;
if (REDIS_URL) {
    try {
        redisClient = (0, redis_1.createClient)({
            url: REDIS_URL,
            socket: {
                connectTimeout: 2000
            }
        });
        redisClient.connect()
            .then(() => {
            logger_1.logger.info('Redis connected for rate limiting');
        })
            .catch((err) => {
            const isDevelopment = NODE_ENV === 'development';
            if (isDevelopment) {
                logger_1.logger.warn('Redis not available for rate limiting - using memory fallback (development mode)', {
                    redisUrl: REDIS_URL?.replace(/\/\/[^@]*@/, '//***@')
                });
            }
            else {
                logger_1.logger.error('Redis connection failed for rate limiting:', err);
            }
            redisClient = null;
        });
        redisClient.on('error', (err) => {
            const isDevelopment = NODE_ENV === 'development';
            if (!isDevelopment) {
                logger_1.logger.error('Redis rate limiting client error:', err);
            }
            redisClient = null;
        });
    }
    catch (err) {
        const isDevelopment = NODE_ENV === 'development';
        if (isDevelopment) {
            logger_1.logger.warn('Redis client creation failed for rate limiting - using memory fallback');
        }
        else {
            logger_1.logger.error('Failed to create Redis client for rate limiting:', err);
        }
    }
}
const createRateLimit = (config) => {
    const options = {
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
        keyGenerator: config.keyGenerator || ((req) => {
            return req.ip || req.socket?.remoteAddress || 'unknown';
        }),
        handler: (req, res) => {
            security_1.securityMetrics.incrementRateLimitHits();
            logger_1.logger.warn('Rate limit exceeded', {
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
    return (0, express_rate_limit_1.default)(options);
};
exports.globalRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'development' ? 1000 : parseInt(process.env.RATE_LIMIT_MAX || '100'),
    message: 'Too many requests from this IP, please try again later.'
});
exports.authRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'development' ? 100 : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
});
exports.uploadRateLimit = createRateLimit({
    windowMs: 60 * 1000,
    max: NODE_ENV === 'development' ? 50 : parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10'),
    message: 'Too many file uploads, please try again later.'
});
exports.apiRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'development' ? 500 : parseInt(process.env.API_RATE_LIMIT_MAX || '200'),
    message: 'Too many API requests, please try again later.'
});
exports.adminRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'development' ? 200 : parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '50'),
    message: 'Too many admin requests, please try again later.',
    keyGenerator: (req) => {
        const userId = req.user?.id;
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        return userId ? `${ip}-${userId}` : ip;
    }
});
exports.slowDownMiddleware = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000,
    delayAfter: NODE_ENV === 'development' ? 50 : 5,
    delayMs: (used, _req, _res) => 500,
    maxDelayMs: 20000,
    validate: { delayMs: false }
});
const bruteForceAttempts = new Map();
exports.bruteForce = {
    prevent: (req, res, next) => {
        const clientIP = req.ip || 'unknown';
        const now = Date.now();
        const record = bruteForceAttempts.get(clientIP) || { count: 0, lastAttempt: now };
        if (now - record.lastAttempt > 15 * 60 * 1000) {
            record.count = 0;
        }
        if (record.count >= 5) {
            logger_1.logger.warn('Brute force protection triggered', {
                ip: clientIP,
                userAgent: req.get('User-Agent'),
                attempts: record.count
            });
            return res.status(429).json({
                error: 'Too many failed attempts. Account temporarily locked.',
                message: 'Please try again later or contact support if this continues.'
            });
        }
        req.bruteForceKey = clientIP;
        next();
    },
    reset: (key) => {
        bruteForceAttempts.delete(key);
    }
};
const securityMonitoring = (req, res, next) => {
    const startTime = Date.now();
    const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
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
    const suspiciousFindings = [];
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
    const botPatterns = [
        /bot|crawler|spider|scraper|wget|curl/i,
        /^$/,
        /python|node|java|perl|ruby|php/i
    ];
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    if (isBot && !url.includes('/api/health') && !url.includes('/robots.txt')) {
        suspiciousFindings.push({ type: 'bot_activity', severity: 'low', location: 'user_agent' });
    }
    if (suspiciousFindings.length > 0) {
        const highSeverityCount = suspiciousFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
        logger_1.logger.warn('Suspicious request detected', {
            ip: clientIP,
            method: req.method,
            url: req.url,
            userAgent,
            findings: suspiciousFindings,
            severity: highSeverityCount > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString()
        });
        security_1.securityMetrics.incrementSuspiciousRequests();
        (0, exports.markSuspiciousIP)(clientIP);
        if (suspiciousFindings.some(f => f.severity === 'critical')) {
            logger_1.logger.error('Critical security threat detected - blocking request', {
                ip: clientIP,
                findings: suspiciousFindings.filter(f => f.severity === 'critical')
            });
            return res.status(403).json({
                error: 'Request blocked due to security policy violation'
            });
        }
    }
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const responseSizeHeader = res.get('Content-Length');
        const responseSize = responseSizeHeader ? parseInt(responseSizeHeader) : 0;
        if (duration > 10000) {
            logger_1.logger.warn('Slow request detected', {
                ip: clientIP,
                method: req.method,
                url: req.url,
                duration,
                statusCode: res.statusCode,
                responseSize
            });
        }
        if (responseSize > 10 * 1024 * 1024) {
            logger_1.logger.warn('Large response detected', {
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
exports.securityMonitoring = securityMonitoring;
const sanitizeInput = (req, res, next) => {
    try {
        const skipPaths = ['/api/cms/webhooks', '/api/upload'];
        if (skipPaths.some(path => req.path.startsWith(path))) {
            return next();
        }
        if (req.query) {
            req.query = sanitizeObject(req.query, true);
        }
        if (req.body && typeof req.body === 'object' && req.get('Content-Type')?.includes('application/json')) {
            req.body = sanitizeObject(req.body, false);
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in input sanitization:', error);
        next();
    }
};
exports.sanitizeInput = sanitizeInput;
function sanitizeObject(obj, isQueryParam = false) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, isQueryParam));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const cleanKey = sanitizeString(key, true);
                sanitized[cleanKey] = sanitizeObject(obj[key], isQueryParam);
            }
        }
        return sanitized;
    }
    if (typeof obj === 'string') {
        return sanitizeString(obj, isQueryParam);
    }
    return obj;
}
function sanitizeString(str, isKey = false) {
    if (typeof str !== 'string')
        return str;
    let sanitized = str;
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<(script|object|embed|link|meta|style|iframe)[^>]*>/gi, '');
    if (isKey) {
        sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '');
    }
    else {
        sanitized = sanitized.replace(/<[^>]+>/g, '');
        sanitized = sanitized
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/')
            .replace(/&amp;/g, '&');
    }
    return sanitized.trim();
}
const adminIPWhitelist = (req, res, next) => {
    const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST;
    if (NODE_ENV === 'development' && !ADMIN_IP_WHITELIST) {
        return next();
    }
    if (!ADMIN_IP_WHITELIST) {
        logger_1.logger.warn('Admin IP whitelist not configured in production');
        return next();
    }
    const allowedIPs = ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim());
    const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
    let isAllowed = allowedIPs.includes(clientIP);
    if (NODE_ENV === 'development') {
        const devIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
        isAllowed = isAllowed || devIPs.includes(clientIP);
    }
    if (!isAllowed) {
        for (const allowedIP of allowedIPs) {
            if (allowedIP.includes('/')) {
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
    }
    else {
        logger_1.logger.warn('Admin access attempt from non-whitelisted IP', {
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            url: req.url,
            method: req.method,
            allowedIPs: allowedIPs.length,
            timestamp: new Date().toISOString()
        });
        res.status(403).json({
            error: 'Access denied. Your IP address is not authorized for admin access.',
            ip: clientIP,
            timestamp: new Date().toISOString()
        });
    }
};
exports.adminIPWhitelist = adminIPWhitelist;
const getSecurityStatus = () => {
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
exports.getSecurityStatus = getSecurityStatus;
exports.corsMiddleware = (0, cors_1.default)(corsOptions);
exports.helmetMiddleware = (0, helmet_1.default)(helmetOptions);
const suspiciousIPs = new Map();
const SUSPICIOUS_THRESHOLD = 10;
const BLOCK_DURATION = 60 * 60 * 1000;
const ipReputationCheck = (req, res, next) => {
    const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = new Date();
    const ipData = suspiciousIPs.get(clientIP);
    if (ipData) {
        if (ipData.blocked && (now.getTime() - ipData.lastSeen.getTime()) < BLOCK_DURATION) {
            logger_1.logger.warn('Blocked IP attempted access', { ip: clientIP, blockedUntil: new Date(ipData.lastSeen.getTime() + BLOCK_DURATION) });
            return res.status(403).json({
                error: 'Access denied. IP temporarily blocked due to suspicious activity.',
                blockedUntil: new Date(ipData.lastSeen.getTime() + BLOCK_DURATION)
            });
        }
        if (ipData.blocked && (now.getTime() - ipData.lastSeen.getTime()) >= BLOCK_DURATION) {
            ipData.blocked = false;
            ipData.count = 0;
            logger_1.logger.info('IP unblocked after timeout', { ip: clientIP });
        }
    }
    next();
};
exports.ipReputationCheck = ipReputationCheck;
const markSuspiciousIP = (ip) => {
    const now = new Date();
    const ipData = suspiciousIPs.get(ip) || { count: 0, lastSeen: now, blocked: false };
    ipData.count++;
    ipData.lastSeen = now;
    if (ipData.count >= SUSPICIOUS_THRESHOLD && !ipData.blocked) {
        ipData.blocked = true;
        logger_1.logger.warn('IP blocked due to suspicious activity', { ip, count: ipData.count });
    }
    suspiciousIPs.set(ip, ipData);
};
exports.markSuspiciousIP = markSuspiciousIP;
exports.securityMiddlewareBundle = [
    ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [exports.ipReputationCheck]),
    exports.helmetMiddleware,
    exports.corsMiddleware,
    exports.securityMonitoring,
    exports.sanitizeInput,
    exports.globalRateLimit,
    exports.slowDownMiddleware
];
exports.apiSecurityBundle = [
    ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [exports.ipReputationCheck]),
    exports.helmetMiddleware,
    exports.corsMiddleware,
    exports.securityMonitoring,
    exports.sanitizeInput,
    exports.apiRateLimit
];
exports.adminSecurityBundle = [
    ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [exports.ipReputationCheck]),
    exports.helmetMiddleware,
    exports.corsMiddleware,
    exports.securityMonitoring,
    exports.sanitizeInput,
    exports.adminRateLimit,
    exports.slowDownMiddleware,
    exports.adminIPWhitelist
];
const cleanupSecurityData = () => {
    const now = new Date();
    const cleanupThreshold = 24 * 60 * 60 * 1000;
    for (const [ip, data] of suspiciousIPs.entries()) {
        if (now.getTime() - data.lastSeen.getTime() > cleanupThreshold) {
            suspiciousIPs.delete(ip);
        }
    }
    logger_1.logger.info('Security data cleanup completed', {
        remainingSuspiciousIPs: suspiciousIPs.size
    });
};
exports.cleanupSecurityData = cleanupSecurityData;
if (NODE_ENV === 'production') {
    setInterval(exports.cleanupSecurityData, 60 * 60 * 1000);
}
exports.default = exports.securityMiddlewareBundle;
//# sourceMappingURL=security.js.map