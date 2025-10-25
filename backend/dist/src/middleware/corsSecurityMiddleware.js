"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfTokenEndpoint = exports.securityHeadersMiddleware = exports.csrfMiddleware = exports.corsMiddleware = exports.corsSecurityService = exports.CorsSecurityService = void 0;
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
class CorsSecurityService {
    constructor() {
        this.csrfTokens = new Map();
        this.originWhitelist = new Set();
        this.suspiciousOrigins = new Map();
        this.config = {
            allowedOrigins: this.parseAllowedOrigins(),
            allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Origin',
                'X-Requested-With',
                'Content-Type',
                'Accept',
                'Authorization',
                'X-CSRF-Token',
                'X-API-Key',
                'X-Request-ID',
                'X-Forwarded-For',
                'User-Agent'
            ],
            exposedHeaders: [
                'X-Request-ID',
                'X-Rate-Limit-Remaining',
                'X-Rate-Limit-Reset',
                'X-CSRF-Token'
            ],
            maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
            credentials: process.env.CORS_CREDENTIALS === 'true',
            enableCSRF: process.env.ENABLE_CSRF_PROTECTION !== 'false',
            csrfTokenName: process.env.CSRF_TOKEN_NAME || '_csrf',
            csrfHeaderName: process.env.CSRF_HEADER_NAME || 'X-CSRF-Token',
            csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrf-token',
            csrfTokenTTL: parseInt(process.env.CSRF_TOKEN_TTL || '3600'),
            enableOriginValidation: process.env.ENABLE_ORIGIN_VALIDATION !== 'false',
            enableReferrerValidation: process.env.ENABLE_REFERRER_VALIDATION !== 'false',
            strictModeEnabled: process.env.CORS_STRICT_MODE === 'true'
        };
        this.initializeOriginWhitelist();
        this.startCleanupTimer();
    }
    static getInstance() {
        if (!CorsSecurityService.instance) {
            CorsSecurityService.instance = new CorsSecurityService();
        }
        return CorsSecurityService.instance;
    }
    parseAllowedOrigins() {
        const origins = process.env.ALLOWED_ORIGINS || 'http://82.147.84.78:3000,http://82.147.84.78:3001';
        return origins.split(',').map(origin => origin.trim()).filter(Boolean);
    }
    initializeOriginWhitelist() {
        this.config.allowedOrigins.forEach(origin => {
            this.originWhitelist.add(origin);
        });
        if (process.env.NODE_ENV === 'development') {
            const devOrigins = [
                'http://82.147.84.78:3000',
                'http://82.147.84.78:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001'
            ];
            devOrigins.forEach(origin => this.originWhitelist.add(origin));
        }
        logger_1.logger.info('CORS origin whitelist initialized', {
            allowedOrigins: Array.from(this.originWhitelist),
            strictMode: this.config.strictModeEnabled
        });
    }
    getCorsMiddleware() {
        const corsOptions = {
            origin: (origin, callback) => {
                if (!origin && !this.config.strictModeEnabled) {
                    return callback(null, true);
                }
                if (!origin) {
                    logger_1.logger.warn('Request blocked: No origin header in strict mode');
                    return callback(new Error('Origin header required'), false);
                }
                if (this.isOriginAllowed(origin)) {
                    return callback(null, true);
                }
                this.logSuspiciousOrigin(origin);
                logger_1.logger.warn('Request blocked: Origin not allowed', {
                    origin,
                    allowedOrigins: Array.from(this.originWhitelist)
                });
                callback(new Error('Origin not allowed by CORS policy'), false);
            },
            methods: this.config.allowedMethods,
            allowedHeaders: this.config.allowedHeaders,
            exposedHeaders: this.config.exposedHeaders,
            credentials: this.config.credentials,
            maxAge: this.config.maxAge,
            optionsSuccessStatus: 200
        };
        return (0, cors_1.default)(corsOptions);
    }
    isOriginAllowed(origin) {
        if (this.originWhitelist.has(origin)) {
            return true;
        }
        for (const allowedOrigin of this.originWhitelist) {
            if (this.matchOriginPattern(origin, allowedOrigin)) {
                return true;
            }
        }
        return false;
    }
    matchOriginPattern(origin, pattern) {
        const escapeRegex = (str) => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        if (pattern.length > 200) {
            throw new Error('SECURITY: Pattern too long');
        }
        const escapedPattern = escapeRegex(pattern);
        const regexPattern = escapedPattern.replace(/\\\*/g, '.*');
        try {
            const regex = new RegExp(`^${regexPattern}$`, 'i');
            if (!pattern.includes('*')) {
                return origin.toLowerCase() === pattern.toLowerCase();
            }
            return regex.test(origin);
        }
        catch (error) {
            return origin.toLowerCase() === pattern.toLowerCase();
        }
    }
    logSuspiciousOrigin(origin) {
        const now = new Date();
        const existing = this.suspiciousOrigins.get(origin);
        if (existing) {
            existing.count++;
            existing.lastSeen = now;
        }
        else {
            this.suspiciousOrigins.set(origin, {
                count: 1,
                lastSeen: now
            });
        }
        const suspiciousData = this.suspiciousOrigins.get(origin);
        if (!suspiciousData) {
            logger_1.logger.warn('Suspicious origin data missing after update', { origin });
            return;
        }
        if (suspiciousData.count > 10) {
            logger_1.logger.security('Potential CORS attack detected', {
                origin,
                attemptCount: suspiciousData.count,
                firstSeen: suspiciousData.lastSeen,
                severity: 'HIGH'
            });
        }
    }
    generateCSRFToken(userId, sessionId, ipAddress) {
        const tokenData = {
            random: crypto_1.default.randomBytes(32).toString('hex'),
            timestamp: Date.now(),
            userId: userId || 'anonymous',
            sessionId: sessionId || 'no-session'
        };
        const token = crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(tokenData))
            .digest('hex');
        const csrfToken = {
            token,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.config.csrfTokenTTL * 1000),
            userId,
            sessionId,
            ipAddress: ipAddress || 'unknown'
        };
        this.csrfTokens.set(token, csrfToken);
        logger_1.logger.debug('CSRF token generated', {
            userId,
            sessionId,
            expiresAt: csrfToken.expiresAt
        });
        return token;
    }
    validateCSRFToken(token, userId, sessionId, ipAddress) {
        if (!token) {
            return false;
        }
        const csrfToken = this.csrfTokens.get(token);
        if (!csrfToken) {
            logger_1.logger.warn('CSRF token validation failed: Token not found', {
                userId,
                sessionId
            });
            return false;
        }
        if (csrfToken.expiresAt < new Date()) {
            this.csrfTokens.delete(token);
            logger_1.logger.warn('CSRF token validation failed: Token expired', {
                userId,
                expiresAt: csrfToken.expiresAt
            });
            return false;
        }
        if (userId && csrfToken.userId) {
            try {
                const userMatch = crypto_1.default.timingSafeEqual(Buffer.from(csrfToken.userId), Buffer.from(userId));
                if (!userMatch) {
                    logger_1.logger.warn('CSRF token validation failed: User mismatch', {
                        expectedUser: csrfToken.userId,
                        actualUser: userId
                    });
                    return false;
                }
            }
            catch {
                logger_1.logger.warn('CSRF token validation failed: User ID length mismatch');
                return false;
            }
        }
        if (sessionId && csrfToken.sessionId) {
            try {
                const sessionMatch = crypto_1.default.timingSafeEqual(Buffer.from(csrfToken.sessionId), Buffer.from(sessionId));
                if (!sessionMatch) {
                    logger_1.logger.warn('CSRF token validation failed: Session mismatch', {
                        expectedSession: csrfToken.sessionId,
                        actualSession: sessionId
                    });
                    return false;
                }
            }
            catch {
                logger_1.logger.warn('CSRF token validation failed: Session ID length mismatch');
                return false;
            }
        }
        if (ipAddress && csrfToken.ipAddress && csrfToken.ipAddress !== ipAddress) {
            logger_1.logger.warn('CSRF token validation failed: IP address mismatch', {
                expectedIP: csrfToken.ipAddress,
                actualIP: ipAddress
            });
        }
        return true;
    }
    getCSRFMiddleware() {
        return (req, res, next) => {
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }
            if (!this.config.enableCSRF) {
                return next();
            }
            const token = req.get(this.config.csrfHeaderName) ||
                req.body[this.config.csrfTokenName] ||
                req.query[this.config.csrfTokenName];
            const userId = req.user?.id;
            const sessionId = req.sessionId;
            const ipAddress = req.ip || req.connection.remoteAddress;
            if (!this.validateCSRFToken(token, userId, sessionId, ipAddress)) {
                logger_1.logger.warn('CSRF protection triggered', {
                    path: req.path,
                    method: req.method,
                    origin: req.get('Origin'),
                    referer: req.get('Referer'),
                    userAgent: req.get('User-Agent'),
                    ipAddress,
                    userId,
                    sessionId
                });
                return res.status(403).json({
                    error: 'CSRF token validation failed',
                    message: 'Invalid or missing CSRF token',
                    timestamp: new Date().toISOString()
                });
            }
            next();
        };
    }
    getCSRFTokenEndpoint() {
        return (req, res) => {
            const userId = req.user?.id;
            const sessionId = req.sessionId;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const token = this.generateCSRFToken(userId, sessionId, ipAddress);
            if (this.config.csrfCookieName) {
                res.cookie(this.config.csrfCookieName, token, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: this.config.csrfTokenTTL * 1000
                });
            }
            res.json({
                [this.config.csrfTokenName]: token,
                expiresAt: new Date(Date.now() + this.config.csrfTokenTTL * 1000).toISOString()
            });
        };
    }
    getSecurityHeadersMiddleware() {
        return (req, res, next) => {
            if (this.config.enableOriginValidation) {
                const origin = req.get('Origin');
                if (origin && !this.isOriginAllowed(origin)) {
                    logger_1.logger.warn('Request blocked: Invalid Origin header', {
                        origin,
                        path: req.path,
                        method: req.method
                    });
                    return res.status(403).json({
                        error: 'Origin not allowed',
                        message: 'Request origin is not in the allowed list',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            if (this.config.enableReferrerValidation &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                const referer = req.get('Referer');
                const origin = req.get('Origin');
                if (referer && !this.isRefererValid(referer, origin)) {
                    logger_1.logger.warn('Request blocked: Invalid Referer header', {
                        referer,
                        origin,
                        path: req.path,
                        method: req.method
                    });
                    return res.status(403).json({
                        error: 'Invalid referer',
                        message: 'Request referer is not allowed',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Resource-Policy': 'same-origin'
            });
            next();
        };
    }
    isRefererValid(referer, origin) {
        try {
            const refererUrl = new URL(referer);
            const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
            if (origin && refererOrigin !== origin) {
                return false;
            }
            return this.isOriginAllowed(refererOrigin);
        }
        catch {
            return false;
        }
    }
    startCleanupTimer() {
        setInterval(() => {
            const now = new Date();
            let cleanedCount = 0;
            for (const [token, csrfToken] of this.csrfTokens.entries()) {
                if (csrfToken.expiresAt < now) {
                    this.csrfTokens.delete(token);
                    cleanedCount++;
                }
            }
            for (const [origin, data] of this.suspiciousOrigins.entries()) {
                if (now.getTime() - data.lastSeen.getTime() > 24 * 60 * 60 * 1000) {
                    this.suspiciousOrigins.delete(origin);
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.debug('CSRF tokens cleaned up', {
                    cleanedCount,
                    remainingTokens: this.csrfTokens.size
                });
            }
        }, 5 * 60 * 1000);
    }
    addAllowedOrigin(origin) {
        this.originWhitelist.add(origin);
        logger_1.logger.info('Origin added to whitelist', { origin });
    }
    removeAllowedOrigin(origin) {
        this.originWhitelist.delete(origin);
        logger_1.logger.info('Origin removed from whitelist', { origin });
    }
    getSecurityStats() {
        return {
            activeCSRFTokens: this.csrfTokens.size,
            suspiciousOrigins: this.suspiciousOrigins.size,
            allowedOrigins: Array.from(this.originWhitelist),
            config: this.config
        };
    }
    async healthCheck() {
        try {
            const stats = this.getSecurityStats();
            return {
                status: 'healthy',
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('CORS security service health check failed:', error);
            return {
                status: 'error',
                stats: null
            };
        }
    }
}
exports.CorsSecurityService = CorsSecurityService;
exports.corsSecurityService = CorsSecurityService.getInstance();
exports.corsMiddleware = exports.corsSecurityService.getCorsMiddleware();
exports.csrfMiddleware = exports.corsSecurityService.getCSRFMiddleware();
exports.securityHeadersMiddleware = exports.corsSecurityService.getSecurityHeadersMiddleware();
exports.csrfTokenEndpoint = exports.corsSecurityService.getCSRFTokenEndpoint();
//# sourceMappingURL=corsSecurityMiddleware.js.map