"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupUploadRateLimit = exports.getUploadStats = exports.uploadRateLimitMiddleware = exports.ipUploadRateLimit = exports.orderUploadRateLimit = exports.userUploadRateLimit = exports.globalUploadRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
class UploadRateLimitStore {
    constructor() {
        this.attempts = new Map();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    cleanup() {
        const now = Date.now();
        const cutoff = now - (24 * 60 * 60 * 1000);
        for (const [key, attempts] of this.attempts.entries()) {
            const filteredAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
            if (filteredAttempts.length === 0) {
                this.attempts.delete(key);
            }
            else {
                this.attempts.set(key, filteredAttempts);
            }
        }
    }
    addAttempt(userId, orderId, ip) {
        const now = Date.now();
        const userKey = `user:${userId}`;
        const orderKey = orderId ? `order:${orderId}` : undefined;
        if (!this.attempts.has(userKey)) {
            this.attempts.set(userKey, []);
        }
        const attempts = this.attempts.get(userKey);
        if (attempts) {
            attempts.push({ userId, orderId, timestamp: now, ip });
        }
        if (orderKey) {
            if (!this.attempts.has(orderKey)) {
                this.attempts.set(orderKey, []);
            }
            const attempts = this.attempts.get(orderKey);
            if (attempts) {
                attempts.push({ userId, orderId, timestamp: now, ip });
            }
        }
    }
    getAttempts(key, windowMs) {
        const attempts = this.attempts.get(key) || [];
        const cutoff = Date.now() - windowMs;
        return attempts.filter(attempt => attempt.timestamp > cutoff);
    }
    getUserAttempts(userId, windowMs) {
        return this.getAttempts(`user:${userId}`, windowMs);
    }
    getOrderAttempts(orderId, windowMs) {
        return this.getAttempts(`order:${orderId}`, windowMs);
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
const uploadStore = new UploadRateLimitStore();
exports.globalUploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many upload requests from all users, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.logger.warn('Global upload rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        res.status(429).json({
            error: 'Too many upload requests, please try again later.',
            retryAfter: '15 minutes'
        });
    }
});
const userUploadRateLimit = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const userId = req.user.id;
    const windowMs = 60 * 60 * 1000;
    const maxUploads = 20;
    const userAttempts = uploadStore.getUserAttempts(userId, windowMs);
    if (userAttempts.length >= maxUploads) {
        logger_1.logger.warn('User upload rate limit exceeded', {
            userId,
            attempts: userAttempts.length,
            maxUploads,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(429).json({
            error: `Too many uploads. Maximum ${maxUploads} uploads per hour allowed.`,
            attempts: userAttempts.length,
            maxUploads,
            retryAfter: '1 hour'
        });
    }
    const orderId = req.params.id || req.body.orderId;
    uploadStore.addAttempt(userId, orderId, req.ip || 'unknown');
    next();
};
exports.userUploadRateLimit = userUploadRateLimit;
const orderUploadRateLimit = (req, res, next) => {
    const orderId = req.params.id || req.body.orderId;
    if (!orderId) {
        return next();
    }
    const windowMs = 24 * 60 * 60 * 1000;
    const maxUploads = 5;
    const orderAttempts = uploadStore.getOrderAttempts(orderId, windowMs);
    if (orderAttempts.length >= maxUploads) {
        logger_1.logger.warn('Order upload rate limit exceeded', {
            orderId,
            userId: req.user?.id,
            attempts: orderAttempts.length,
            maxUploads,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(429).json({
            error: `Too many uploads for this order. Maximum ${maxUploads} uploads per order per day allowed.`,
            orderId,
            attempts: orderAttempts.length,
            maxUploads,
            retryAfter: '24 hours'
        });
    }
    next();
};
exports.orderUploadRateLimit = orderUploadRateLimit;
exports.ipUploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip || 'unknown',
    message: {
        error: 'Too many upload requests from this IP address, please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.logger.warn('IP upload rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        res.status(429).json({
            error: 'Too many upload requests from this IP, please try again later.',
            retryAfter: '1 hour'
        });
    }
});
exports.uploadRateLimitMiddleware = [
    exports.globalUploadRateLimit,
    exports.ipUploadRateLimit,
    exports.userUploadRateLimit,
    exports.orderUploadRateLimit
];
const getUploadStats = (req, res) => {
    if (!req.user || req.user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Access denied' });
    }
    const stats = {
        totalUsers: 0,
        totalOrders: 0,
        recentUploads: 0,
        timestamp: new Date().toISOString()
    };
    const windowMs = 24 * 60 * 60 * 1000;
    const users = new Set();
    const orders = new Set();
    let recentCount = 0;
    for (const [key, attempts] of uploadStore.attempts.entries()) {
        const recentAttempts = attempts.filter((attempt) => attempt.timestamp > Date.now() - windowMs);
        if (recentAttempts.length > 0) {
            recentCount += recentAttempts.length;
            if (key.startsWith('user:')) {
                users.add(key.substring(5));
            }
            else if (key.startsWith('order:')) {
                orders.add(key.substring(6));
            }
        }
    }
    stats.totalUsers = users.size;
    stats.totalOrders = orders.size;
    stats.recentUploads = recentCount;
    res.json({
        success: true,
        stats
    });
};
exports.getUploadStats = getUploadStats;
const cleanupUploadRateLimit = () => {
    uploadStore.destroy();
};
exports.cleanupUploadRateLimit = cleanupUploadRateLimit;
//# sourceMappingURL=uploadRateLimit.js.map