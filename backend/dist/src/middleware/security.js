"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupSecurityData = exports.adminSecurityBundle = exports.apiSecurityBundle = exports.securityMiddlewareBundle = exports.markSuspiciousIP = exports.ipReputationCheck = exports.nonceCSPMiddleware = exports.helmetMiddleware = exports.corsMiddleware = exports.adminIPWhitelist = exports.sanitizeInput = exports.securityMonitoring = exports.bruteForce = exports.slowDownMiddleware = exports.adminRateLimit = exports.apiRateLimit = exports.uploadRateLimit = exports.authRateLimit = exports.globalRateLimit = void 0;
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const helmet_1 = __importDefault(require("helmet"));
const redis_1 = require("redis");
const security_1 = require("../config/security");
const logger_1 = require("../utils/logger");
const securityHeaders_1 = require("./securityHeaders");
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
                return callback(null, true);
            }
        }
        if (!origin && NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (NODE_ENV === 'development' && origin) {
            const allowedDevPorts = ['3000', '3001', '5173', '4173'];
            const localhostPattern = new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):(${allowedDevPorts.join('|')})$`);
            if (localhostPattern.test(origin)) {
                return callback(null, true);
            }
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                logger_1.logger.warn('CORS blocked localhost origin with non-allowed port', {
                    origin,
                    allowedPorts: allowedDevPorts
                });
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
    maxAge: NODE_ENV === 'production' ? 86400 : 3600,
    optionsSuccessStatus: 200
};
const helmetOptions = {
    contentSecurityPolicy: NODE_ENV === 'development' ? false : {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'",
                'https://fonts.googleapis.com',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com'
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
    max: NODE_ENV === 'development' ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100'),
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
    max: NODE_ENV === 'development' ? 5000 : parseInt(process.env.API_RATE_LIMIT_MAX || '200'),
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
const BRUTE_FORCE_PREFIX = 'bruteforce:';
const BRUTE_FORCE_WINDOW = 15 * 60;
const BRUTE_FORCE_MAX_ATTEMPTS = 3;
const bruteForceAttemptsFallback = new Map();
async function getBruteForceRecord(key) {
    if (redisClient && redisClient.isOpen) {
        try {
            const data = await redisClient.get(`${BRUTE_FORCE_PREFIX}${key}`);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (error) {
            logger_1.logger.error('Redis getBruteForceRecord error', { error, key });
        }
    }
    return bruteForceAttemptsFallback.get(key) || null;
}
async function setBruteForceRecord(key, record) {
    if (redisClient && redisClient.isOpen) {
        try {
            const ttl = Math.ceil(Math.min(BRUTE_FORCE_WINDOW * Math.pow(2, record.count), 24 * 60 * 60));
            await redisClient.setEx(`${BRUTE_FORCE_PREFIX}${key}`, ttl, JSON.stringify(record));
            return;
        }
        catch (error) {
            logger_1.logger.error('Redis setBruteForceRecord error', { error, key });
        }
    }
    bruteForceAttemptsFallback.set(key, record);
}
async function deleteBruteForceRecord(key) {
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.del(`${BRUTE_FORCE_PREFIX}${key}`);
            return;
        }
        catch (error) {
            logger_1.logger.error('Redis deleteBruteForceRecord error', { error, key });
        }
    }
    bruteForceAttemptsFallback.delete(key);
}
exports.bruteForce = {
    prevent: async (req, res, next) => {
        const clientIP = req.ip || 'unknown';
        const now = Date.now();
        try {
            const record = await getBruteForceRecord(clientIP) || { count: 0, lastAttempt: now };
            if (now - record.lastAttempt > BRUTE_FORCE_WINDOW * 1000) {
                record.count = 0;
            }
            if (record.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
                const blockDuration = Math.min(15 * 60 * 1000 * Math.pow(2, record.count - BRUTE_FORCE_MAX_ATTEMPTS), 24 * 60 * 60 * 1000);
                const timeSinceLastAttempt = now - record.lastAttempt;
                if (timeSinceLastAttempt < blockDuration) {
                    const retryAfter = Math.ceil((blockDuration - timeSinceLastAttempt) / 1000);
                    logger_1.logger.warn('Brute force protection triggered', {
                        ip: clientIP,
                        userAgent: req.get('User-Agent'),
                        attempts: record.count,
                        blockDuration: Math.ceil(blockDuration / 1000 / 60) + ' minutes',
                        retryAfter: retryAfter + ' seconds',
                        backend: redisClient?.isOpen ? 'redis' : 'memory'
                    });
                    security_1.securityMetrics.incrementBruteForceAttempts();
                    return res.status(429).json({
                        error: 'Too many failed attempts',
                        message: 'Account temporarily locked. Please try again later.',
                        retryAfter: retryAfter
                    });
                }
            }
            req.bruteForceKey = clientIP;
            next();
        }
        catch (error) {
            logger_1.logger.error('Brute force protection error', { error, ip: clientIP });
            next();
        }
    },
    recordFailure: async (key) => {
        try {
            const now = Date.now();
            const record = await getBruteForceRecord(key) || { count: 0, lastAttempt: now };
            record.count++;
            record.lastAttempt = now;
            await setBruteForceRecord(key, record);
            logger_1.logger.info('Brute force failure recorded', {
                key,
                attempts: record.count,
                backend: redisClient?.isOpen ? 'redis' : 'memory'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to record brute force attempt', { error, key });
        }
    },
    reset: async (key) => {
        try {
            await deleteBruteForceRecord(key);
            logger_1.logger.info('Brute force counter reset', {
                key,
                backend: redisClient?.isOpen ? 'redis' : 'memory'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to reset brute force attempts', { error, key });
        }
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
    if (isKey) {
        return str.replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
    }
    let sanitized = str;
    sanitized = sanitized.normalize('NFKC');
    sanitized = sanitized.replace(/\0/g, '');
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:text\/html/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.replace(/<(script|object|embed|link|meta|style|iframe|frame|frameset|applet|base)[^>]*>/gi, '');
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
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
exports.corsMiddleware = (0, cors_1.default)(corsOptions);
exports.helmetMiddleware = (0, helmet_1.default)(helmetOptions);
const nonceCSPMiddleware = (req, res, next) => {
    if (NODE_ENV !== 'development') {
        return next();
    }
    const nonce = crypto_1.default.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;
    req.cspNonce = nonce;
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
exports.nonceCSPMiddleware = nonceCSPMiddleware;
const IPReputationService_1 = require("../services/IPReputationService");
const ipReputationCheck = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
        if (clientIP === 'unknown') {
            return next();
        }
        const blockStatus = await IPReputationService_1.ipReputationService.isBlocked(clientIP);
        if (blockStatus.blocked) {
            logger_1.logger.warn('Blocked IP attempted access', {
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
    }
    catch (error) {
        logger_1.logger.error('IP reputation check failed:', error);
        next();
    }
};
exports.ipReputationCheck = ipReputationCheck;
const markSuspiciousIP = async (ip, reason = 'suspicious_activity') => {
    try {
        await IPReputationService_1.ipReputationService.markSuspicious(ip, reason);
    }
    catch (error) {
        logger_1.logger.error('Failed to mark IP as suspicious:', { ip, reason, error });
    }
};
exports.markSuspiciousIP = markSuspiciousIP;
exports.securityMiddlewareBundle = [
    ...(NODE_ENV === 'development' || !ENABLE_IP_REPUTATION ? [] : [exports.ipReputationCheck]),
    exports.helmetMiddleware,
    ...(NODE_ENV === 'development' ? [exports.nonceCSPMiddleware] : []),
    securityHeaders_1.customSecurityHeaders,
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
const cleanupSecurityData = async () => {
    try {
        const now = Date.now();
        const cleanupThreshold = 24 * 60 * 60 * 1000;
        for (const [key, data] of bruteForceAttemptsFallback.entries()) {
            if (now - data.lastAttempt > cleanupThreshold) {
                bruteForceAttemptsFallback.delete(key);
            }
        }
        logger_1.logger.info('Security data cleanup completed', {
            fallbackRecords: bruteForceAttemptsFallback.size
        });
    }
    catch (error) {
        logger_1.logger.error('Security data cleanup error', { error });
    }
};
exports.cleanupSecurityData = cleanupSecurityData;
if (NODE_ENV === 'production') {
    setInterval(exports.cleanupSecurityData, 60 * 60 * 1000);
}
exports.default = exports.securityMiddlewareBundle;
//# sourceMappingURL=security.js.map