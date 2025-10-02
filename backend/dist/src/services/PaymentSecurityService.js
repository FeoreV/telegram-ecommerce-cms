"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentSecurityService = exports.PaymentSecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const database_1 = require("../lib/database");
const TenantCacheService_1 = require("./TenantCacheService");
const tenantCacheService = TenantCacheService_1.TenantCacheService.getInstance();
class PaymentSecurityService {
    constructor() {
        this.activeKeys = new Map();
        this.distributedLocks = new Map();
        this.idempotencyConfig = {
            enableIdempotency: process.env.ENABLE_PAYMENT_IDEMPOTENCY !== 'false',
            keyTTL: parseInt(process.env.IDEMPOTENCY_KEY_TTL || '3600'),
            keyPrefix: process.env.IDEMPOTENCY_KEY_PREFIX || 'idem',
            maxRetries: parseInt(process.env.IDEMPOTENCY_MAX_RETRIES || '3'),
            retryDelay: parseInt(process.env.IDEMPOTENCY_RETRY_DELAY || '1000'),
            enableDistributedLocking: process.env.ENABLE_DISTRIBUTED_LOCKING !== 'false',
            lockTimeout: parseInt(process.env.DISTRIBUTED_LOCK_TIMEOUT || '30000')
        };
        this.securityConfig = {
            enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION !== 'false',
            maxDailyAmount: parseInt(process.env.MAX_DAILY_AMOUNT || '10000'),
            maxTransactionAmount: parseInt(process.env.MAX_TRANSACTION_AMOUNT || '5000'),
            maxTransactionsPerHour: parseInt(process.env.MAX_TRANSACTIONS_PER_HOUR || '10'),
            enableVelocityChecks: process.env.ENABLE_VELOCITY_CHECKS !== 'false',
            enableGeolocationChecks: process.env.ENABLE_GEOLOCATION_CHECKS !== 'false',
            enableDeviceFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING !== 'false',
            suspiciousAmountThreshold: parseInt(process.env.SUSPICIOUS_AMOUNT_THRESHOLD || '1000'),
            requireManualReview: process.env.REQUIRE_MANUAL_REVIEW_HIGH_RISK === 'true',
            enableRiskScoring: process.env.ENABLE_RISK_SCORING !== 'false',
            maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || '75')
        };
        this.startCleanupTimer();
        logger_1.logger.info('Payment security service initialized', {
            idempotencyEnabled: this.idempotencyConfig.enableIdempotency,
            fraudDetectionEnabled: this.securityConfig.enableFraudDetection,
            maxTransactionAmount: this.securityConfig.maxTransactionAmount
        });
    }
    static getInstance() {
        if (!PaymentSecurityService.instance) {
            PaymentSecurityService.instance = new PaymentSecurityService();
        }
        return PaymentSecurityService.instance;
    }
    generateIdempotencyKey(userId, endpoint, requestData) {
        const requestHash = crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(requestData))
            .digest('hex');
        const keyData = {
            userId,
            endpoint,
            requestHash,
            timestamp: Date.now()
        };
        return crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(keyData))
            .digest('hex');
    }
    async processIdempotentRequest(idempotencyKey, userId, endpoint, requestData, processor) {
        if (!this.idempotencyConfig.enableIdempotency) {
            const result = await processor();
            return { result, isRetry: false, attempts: 1 };
        }
        const requestHash = crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(requestData))
            .digest('hex');
        const existingKey = await this.getIdempotencyKey(idempotencyKey);
        if (existingKey) {
            if (existingKey.requestHash !== requestHash) {
                throw new Error('Idempotency key conflict: different request data');
            }
            if (existingKey.userId !== userId) {
                throw new Error('Idempotency key conflict: different user');
            }
            if (existingKey.endpoint !== endpoint) {
                throw new Error('Idempotency key conflict: different endpoint');
            }
            if (existingKey.status === 'completed' && existingKey.response) {
                logger_1.logger.info('Idempotent request returned cached response', {
                    idempotencyKey: idempotencyKey.substring(0, 8) + '...',
                    userId,
                    endpoint,
                    attempts: existingKey.attempts
                });
                return {
                    result: existingKey.response,
                    isRetry: true,
                    attempts: existingKey.attempts
                };
            }
            if (existingKey.status === 'processing') {
                await this.waitForProcessing(idempotencyKey);
                return await this.processIdempotentRequest(idempotencyKey, userId, endpoint, requestData, processor);
            }
            if (existingKey.status === 'failed') {
                if (existingKey.attempts >= this.idempotencyConfig.maxRetries) {
                    throw new Error('Maximum retry attempts exceeded for idempotency key');
                }
            }
        }
        const lockId = await this.acquireDistributedLock(idempotencyKey);
        try {
            const keyRecord = {
                key: idempotencyKey,
                userId,
                endpoint,
                requestHash,
                status: 'processing',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + this.idempotencyConfig.keyTTL * 1000),
                attempts: (existingKey?.attempts || 0) + 1,
                lockId
            };
            await this.storeIdempotencyKey(keyRecord);
            let result;
            try {
                result = await processor();
                keyRecord.response = result;
                keyRecord.status = 'completed';
                await this.storeIdempotencyKey(keyRecord);
                logger_1.logger.info('Idempotent request processed successfully', {
                    idempotencyKey: idempotencyKey.substring(0, 8) + '...',
                    userId,
                    endpoint,
                    attempts: keyRecord.attempts
                });
                return {
                    result,
                    isRetry: existingKey !== null,
                    attempts: keyRecord.attempts
                };
            }
            catch (err) {
                keyRecord.status = 'failed';
                await this.storeIdempotencyKey(keyRecord);
                logger_1.logger.error('Idempotent request processing failed', {
                    idempotencyKey: idempotencyKey.substring(0, 8) + '...',
                    userId,
                    endpoint,
                    attempts: keyRecord.attempts,
                    error: (0, errorUtils_1.getErrorMessage)(err)
                });
                throw err;
            }
        }
        finally {
            await this.releaseDistributedLock(idempotencyKey, lockId);
        }
    }
    async acquireDistributedLock(key) {
        if (!this.idempotencyConfig.enableDistributedLocking) {
            return 'no-lock';
        }
        const lockId = crypto_1.default.randomBytes(16).toString('hex');
        const lockKey = `lock_${this.idempotencyConfig.keyPrefix}_${key}`;
        const expiresAt = new Date(Date.now() + this.idempotencyConfig.lockTimeout);
        try {
            const acquired = await tenantCacheService.setIfNotExists('system', lockKey, { lockId, expiresAt }, {
                ttl: Math.floor(this.idempotencyConfig.lockTimeout / 1000),
                namespace: 'locks'
            });
            if (!acquired) {
                await new Promise(resolve => setTimeout(resolve, this.idempotencyConfig.retryDelay));
                return await this.acquireDistributedLock(key);
            }
            this.distributedLocks.set(key, { lockId, expiresAt });
            return lockId;
        }
        catch (err) {
            logger_1.logger.error('Failed to acquire distributed lock:', err);
            throw new Error('Could not acquire distributed lock');
        }
    }
    async releaseDistributedLock(key, lockId) {
        if (!this.idempotencyConfig.enableDistributedLocking || lockId === 'no-lock') {
            return;
        }
        try {
            const lockKey = `lock_${this.idempotencyConfig.keyPrefix}_${key}`;
            const currentLock = this.distributedLocks.get(key);
            if (currentLock && currentLock.lockId === lockId) {
                await tenantCacheService.delete('system', lockKey, { namespace: 'locks' });
                this.distributedLocks.delete(key);
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to release distributed lock:', err);
        }
    }
    async waitForProcessing(key) {
        const maxWait = 30000;
        const pollInterval = 1000;
        let waited = 0;
        while (waited < maxWait) {
            const keyRecord = await this.getIdempotencyKey(key);
            if (!keyRecord || keyRecord.status !== 'processing') {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            waited += pollInterval;
        }
        throw new Error('Timeout waiting for idempotent request to complete');
    }
    async storeIdempotencyKey(keyRecord) {
        try {
            await tenantCacheService.set('system', `${this.idempotencyConfig.keyPrefix}_${keyRecord.key}`, keyRecord, {
                ttl: this.idempotencyConfig.keyTTL,
                namespace: 'idempotency'
            });
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
        INSERT INTO idempotency_keys (
          key, user_id, endpoint, request_hash, response,
          status, created_at, expires_at, attempts, lock_id
        ) VALUES (
          ${keyRecord.key},
          ${keyRecord.userId}::UUID,
          ${keyRecord.endpoint},
          ${keyRecord.requestHash},
          ${JSON.stringify(keyRecord.response)}::JSONB,
          ${keyRecord.status},
          ${keyRecord.createdAt},
          ${keyRecord.expiresAt},
          ${keyRecord.attempts},
          ${keyRecord.lockId}
        )
        ON CONFLICT (key) DO UPDATE SET
          response = EXCLUDED.response,
          status = EXCLUDED.status,
          attempts = EXCLUDED.attempts,
          lock_id = EXCLUDED.lock_id,
          updated_at = NOW()
      `;
            this.activeKeys.set(keyRecord.key, keyRecord);
        }
        catch (err) {
            logger_1.logger.error('Failed to store idempotency key:', err);
            throw err;
        }
    }
    async getIdempotencyKey(key) {
        try {
            const cached = await tenantCacheService.get('system', `${this.idempotencyConfig.keyPrefix}_${key}`, { namespace: 'idempotency' });
            if (cached) {
                return cached;
            }
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM idempotency_keys 
        WHERE key = ${key} AND expires_at > NOW()
      `;
            if (result.length === 0) {
                return null;
            }
            const row = result[0];
            const keyRecord = {
                key: row.key,
                userId: row.user_id,
                endpoint: row.endpoint,
                requestHash: row.request_hash,
                response: row.response,
                status: row.status,
                createdAt: row.created_at,
                expiresAt: row.expires_at,
                attempts: row.attempts,
                lockId: row.lock_id
            };
            await tenantCacheService.set('system', `${this.idempotencyConfig.keyPrefix}_${key}`, keyRecord, {
                ttl: Math.floor((keyRecord.expiresAt.getTime() - Date.now()) / 1000),
                namespace: 'idempotency'
            });
            return keyRecord;
        }
        catch (err) {
            logger_1.logger.error('Failed to get idempotency key:', err);
            return null;
        }
    }
    async analyzeFraud(context) {
        const result = {
            riskScore: 0,
            riskLevel: 'LOW',
            flags: [],
            requiresManualReview: false,
            blockedReasons: [],
            recommendations: [],
            analysis: {
                velocityCheck: { passed: true, details: {} },
                amountCheck: { passed: true, details: {} },
                geolocationCheck: { passed: true, details: {} },
                deviceCheck: { passed: true, details: {} },
                patternAnalysis: { passed: true, details: {} }
            }
        };
        if (!this.securityConfig.enableFraudDetection) {
            return result;
        }
        try {
            await this.performAmountChecks(context, result);
            if (this.securityConfig.enableVelocityChecks) {
                await this.performVelocityChecks(context, result);
            }
            if (this.securityConfig.enableGeolocationChecks && context.geolocation) {
                await this.performGeolocationChecks(context, result);
            }
            if (this.securityConfig.enableDeviceFingerprinting && context.deviceFingerprint) {
                await this.performDeviceChecks(context, result);
            }
            await this.performPatternAnalysis(context, result);
            this.calculateRiskScore(result);
            this.determineRiskLevel(result);
            if (result.riskScore >= this.securityConfig.maxRiskScore) {
                result.requiresManualReview = true;
                result.recommendations.push('Transaction requires manual review due to high risk score');
            }
            if (this.securityConfig.requireManualReview && result.riskLevel === 'HIGH') {
                result.requiresManualReview = true;
            }
            logger_1.logger.info('Fraud analysis completed', {
                userId: context.userId,
                orderId: context.orderId,
                amount: context.amount,
                riskScore: result.riskScore,
                riskLevel: result.riskLevel,
                flagsCount: result.flags.length,
                requiresReview: result.requiresManualReview
            });
            return result;
        }
        catch (err) {
            logger_1.logger.error('Fraud analysis error:', err);
            result.riskScore = 100;
            result.riskLevel = 'CRITICAL';
            result.requiresManualReview = true;
            result.blockedReasons.push('Fraud analysis system error');
            return result;
        }
    }
    async performAmountChecks(context, result) {
        const { amount, currency } = context;
        const usdAmount = amount;
        result.analysis.amountCheck.details = {
            amount: usdAmount,
            currency: currency,
            maxTransaction: this.securityConfig.maxTransactionAmount,
            suspiciousThreshold: this.securityConfig.suspiciousAmountThreshold
        };
        if (usdAmount > this.securityConfig.maxTransactionAmount) {
            result.riskScore += 50;
            result.flags.push('amount_exceeds_maximum');
            result.blockedReasons.push(`Transaction amount $${usdAmount} exceeds maximum of $${this.securityConfig.maxTransactionAmount}`);
            result.analysis.amountCheck.passed = false;
        }
        if (usdAmount >= this.securityConfig.suspiciousAmountThreshold) {
            result.riskScore += 20;
            result.flags.push('suspicious_amount');
            result.recommendations.push('High-value transaction detected');
        }
        if (usdAmount % 100 === 0 && usdAmount >= 500) {
            result.riskScore += 10;
            result.flags.push('round_amount');
            result.recommendations.push('Round amount transaction');
        }
    }
    async performVelocityChecks(context, result) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const hourlyTransactions = await prisma.$queryRaw `
        SELECT COUNT(*)::integer as count, COALESCE(SUM(amount), 0)::integer as total_amount
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '1 hour'
        AND status IN ('completed', 'pending')
      `;
            const hourlyCount = hourlyTransactions[0]?.count || 0;
            const hourlyAmount = hourlyTransactions[0]?.total_amount || 0;
            const dailyTransactions = await prisma.$queryRaw `
        SELECT COUNT(*)::integer as count, COALESCE(SUM(amount), 0)::integer as total_amount
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('completed', 'pending')
      `;
            const dailyCount = dailyTransactions[0]?.count || 0;
            const dailyAmount = dailyTransactions[0]?.total_amount || 0;
            result.analysis.velocityCheck.details = {
                hourlyCount,
                hourlyAmount,
                dailyCount,
                dailyAmount,
                maxHourly: this.securityConfig.maxTransactionsPerHour,
                maxDaily: this.securityConfig.maxDailyAmount
            };
            if (hourlyCount >= this.securityConfig.maxTransactionsPerHour) {
                result.riskScore += 40;
                result.flags.push('hourly_transaction_limit_exceeded');
                result.blockedReasons.push(`Hourly transaction limit of ${this.securityConfig.maxTransactionsPerHour} exceeded`);
                result.analysis.velocityCheck.passed = false;
            }
            if (dailyAmount + context.amount > this.securityConfig.maxDailyAmount) {
                result.riskScore += 30;
                result.flags.push('daily_amount_limit_exceeded');
                result.blockedReasons.push(`Daily amount limit of $${this.securityConfig.maxDailyAmount} would be exceeded`);
                result.analysis.velocityCheck.passed = false;
            }
            if (hourlyCount >= 3) {
                result.riskScore += 15;
                result.flags.push('rapid_transactions');
                result.recommendations.push('Multiple transactions in short timeframe');
            }
        }
        catch (err) {
            logger_1.logger.error('Velocity check error:', err);
            result.analysis.velocityCheck.passed = false;
        }
    }
    async performGeolocationChecks(context, result) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const recentLocations = await prisma.$queryRaw `
        SELECT DISTINCT 
          metadata->>'country' as country,
          metadata->>'region' as region,
          created_at
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '30 days'
        AND metadata->>'country' IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      `;
            const currentCountry = context.geolocation?.country;
            const knownCountries = recentLocations.map(loc => loc.country).filter(Boolean);
            result.analysis.geolocationCheck.details = {
                currentCountry,
                knownCountries,
                isNewCountry: !knownCountries.includes(currentCountry)
            };
            if (knownCountries.length > 0 && !knownCountries.includes(currentCountry)) {
                result.riskScore += 25;
                result.flags.push('new_country');
                result.recommendations.push(`Transaction from new country: ${currentCountry}`);
            }
            const highRiskCountries = ['XX', 'YY'];
            if (currentCountry && highRiskCountries.includes(currentCountry)) {
                result.riskScore += 20;
                result.flags.push('high_risk_country');
                result.recommendations.push('Transaction from high-risk country');
            }
            if (recentLocations.length > 0) {
                const lastLocation = recentLocations[0];
                const timeDiff = Date.now() - new Date(lastLocation.created_at).getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                if (lastLocation.country !== currentCountry && hoursDiff < 6) {
                    result.riskScore += 35;
                    result.flags.push('impossible_travel');
                    result.recommendations.push('Impossible travel pattern detected');
                }
            }
        }
        catch (err) {
            logger_1.logger.error('Geolocation check error:', err);
            result.analysis.geolocationCheck.passed = false;
        }
    }
    async performDeviceChecks(context, result) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const knownDevices = await prisma.$queryRaw `
        SELECT DISTINCT metadata->>'deviceFingerprint' as device_fingerprint
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '90 days'
        AND metadata->>'deviceFingerprint' IS NOT NULL
      `;
            const deviceFingerprints = knownDevices
                .map(d => d.device_fingerprint)
                .filter(Boolean);
            const isNewDevice = !deviceFingerprints.includes(context.deviceFingerprint);
            result.analysis.deviceCheck.details = {
                currentDevice: context.deviceFingerprint,
                knownDevices: deviceFingerprints.length,
                isNewDevice
            };
            if (deviceFingerprints.length > 0 && isNewDevice) {
                result.riskScore += 15;
                result.flags.push('new_device');
                result.recommendations.push('Transaction from new device');
            }
            if (this.isSuspiciousUserAgent(context.userAgent)) {
                result.riskScore += 10;
                result.flags.push('suspicious_user_agent');
                result.recommendations.push('Suspicious user agent detected');
            }
        }
        catch (err) {
            logger_1.logger.error('Device check error:', err);
            result.analysis.deviceCheck.passed = false;
        }
    }
    async performPatternAnalysis(context, result) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const duplicateOrders = await prisma.$queryRaw `
        SELECT COUNT(*)::integer as count
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND order_id = ${context.orderId}::UUID
        AND status IN ('completed', 'pending')
      `;
            if (duplicateOrders[0]?.count > 0) {
                result.riskScore += 30;
                result.flags.push('duplicate_order');
                result.blockedReasons.push('Duplicate order detected');
                result.analysis.patternAnalysis.passed = false;
            }
            const recentPaymentMethods = await prisma.$queryRaw `
        SELECT DISTINCT payment_method, COUNT(*) as count
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY payment_method
        ORDER BY count DESC
      `;
            if (recentPaymentMethods.length > 3) {
                result.riskScore += 10;
                result.flags.push('multiple_payment_methods');
                result.recommendations.push('Multiple payment methods used recently');
            }
            result.analysis.patternAnalysis.details = {
                duplicateOrders: duplicateOrders[0]?.count || 0,
                recentPaymentMethods: recentPaymentMethods.length
            };
        }
        catch (err) {
            logger_1.logger.error('Pattern analysis error:', err);
            result.analysis.patternAnalysis.passed = false;
        }
    }
    calculateRiskScore(result) {
        const allChecksPassed = Object.values(result.analysis).every(check => check.passed);
        if (allChecksPassed && result.flags.length === 0) {
            result.riskScore = Math.max(0, result.riskScore - 5);
        }
        result.riskScore = Math.min(100, result.riskScore);
    }
    determineRiskLevel(result) {
        if (result.riskScore >= 80) {
            result.riskLevel = 'CRITICAL';
        }
        else if (result.riskScore >= 60) {
            result.riskLevel = 'HIGH';
        }
        else if (result.riskScore >= 30) {
            result.riskLevel = 'MEDIUM';
        }
        else {
            result.riskLevel = 'LOW';
        }
    }
    isSuspiciousUserAgent(userAgent) {
        const suspiciousPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /curl/i,
            /wget/i,
            /python/i,
            /java/i,
            /^$/
        ];
        return suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }
    startCleanupTimer() {
        setInterval(async () => {
            try {
                await this.cleanupExpiredKeys();
                await this.cleanupExpiredLocks();
            }
            catch (err) {
                logger_1.logger.error('Payment security cleanup error:', err);
            }
        }, 5 * 60 * 1000);
    }
    async cleanupExpiredKeys() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, keyRecord] of this.activeKeys.entries()) {
            if (keyRecord.expiresAt.getTime() < now) {
                this.activeKeys.delete(key);
                cleanedCount++;
            }
        }
        const prisma = database_1.databaseService.getPrisma();
        await prisma.$executeRaw `
      DELETE FROM idempotency_keys WHERE expires_at < NOW()
    `;
        if (cleanedCount > 0) {
            logger_1.logger.debug('Expired idempotency keys cleaned up', {
                cleanedCount,
                remainingKeys: this.activeKeys.size
            });
        }
    }
    async cleanupExpiredLocks() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, lock] of this.distributedLocks.entries()) {
            if (lock.expiresAt.getTime() < now) {
                this.distributedLocks.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Expired distributed locks cleaned up', {
                cleanedCount,
                remainingLocks: this.distributedLocks.size
            });
        }
    }
    getStats() {
        return {
            idempotencyConfig: this.idempotencyConfig,
            securityConfig: this.securityConfig,
            activeKeys: this.activeKeys.size,
            activeLocks: this.distributedLocks.size
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            return {
                status: 'healthy',
                stats
            };
        }
        catch (err) {
            logger_1.logger.error('Payment security service health check failed:', err);
            return {
                status: 'error',
                stats: null
            };
        }
    }
}
exports.PaymentSecurityService = PaymentSecurityService;
exports.paymentSecurityService = PaymentSecurityService.getInstance();
//# sourceMappingURL=PaymentSecurityService.js.map