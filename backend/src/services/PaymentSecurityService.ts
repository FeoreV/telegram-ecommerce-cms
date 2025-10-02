import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { databaseService } from '../lib/database';
import { TenantCacheService } from './TenantCacheService';
const tenantCacheService = TenantCacheService.getInstance();

export interface IdempotencyConfig {
  enableIdempotency: boolean;
  keyTTL: number; // seconds
  keyPrefix: string;
  maxRetries: number;
  retryDelay: number;
  enableDistributedLocking: boolean;
  lockTimeout: number;
}

export interface PaymentSecurityConfig {
  enableFraudDetection: boolean;
  maxDailyAmount: number;
  maxTransactionAmount: number;
  maxTransactionsPerHour: number;
  enableVelocityChecks: boolean;
  enableGeolocationChecks: boolean;
  enableDeviceFingerprinting: boolean;
  suspiciousAmountThreshold: number;
  requireManualReview: boolean;
  enableRiskScoring: boolean;
  maxRiskScore: number;
}

export interface IdempotencyKey {
  key: string;
  userId: string;
  endpoint: string;
  requestHash: string;
  response?: unknown;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  lockId?: string;
}

export interface TransactionContext {
  userId: string;
  storeId: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    lat: number;
    lon: number;
  };
  metadata: Record<string, unknown>;
}

export interface FraudAnalysisResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  requiresManualReview: boolean;
  blockedReasons: string[];
  recommendations: string[];
  analysis: {
    velocityCheck: { passed: boolean; details: unknown };
    amountCheck: { passed: boolean; details: unknown };
    geolocationCheck: { passed: boolean; details: unknown };
    deviceCheck: { passed: boolean; details: unknown };
    patternAnalysis: { passed: boolean; details: unknown };
  };
}

export class PaymentSecurityService {
  private static instance: PaymentSecurityService;
  private idempotencyConfig: IdempotencyConfig;
  private securityConfig: PaymentSecurityConfig;
  private activeKeys: Map<string, IdempotencyKey> = new Map();
  private distributedLocks: Map<string, { lockId: string; expiresAt: Date }> = new Map();

  private constructor() {
    this.idempotencyConfig = {
      enableIdempotency: process.env.ENABLE_PAYMENT_IDEMPOTENCY !== 'false',
      keyTTL: parseInt(process.env.IDEMPOTENCY_KEY_TTL || '3600'), // 1 hour
      keyPrefix: process.env.IDEMPOTENCY_KEY_PREFIX || 'idem',
      maxRetries: parseInt(process.env.IDEMPOTENCY_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.IDEMPOTENCY_RETRY_DELAY || '1000'), // 1 second
      enableDistributedLocking: process.env.ENABLE_DISTRIBUTED_LOCKING !== 'false',
      lockTimeout: parseInt(process.env.DISTRIBUTED_LOCK_TIMEOUT || '30000') // 30 seconds
    };

    this.securityConfig = {
      enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION !== 'false',
      maxDailyAmount: parseInt(process.env.MAX_DAILY_AMOUNT || '10000'), // $10,000
      maxTransactionAmount: parseInt(process.env.MAX_TRANSACTION_AMOUNT || '5000'), // $5,000
      maxTransactionsPerHour: parseInt(process.env.MAX_TRANSACTIONS_PER_HOUR || '10'),
      enableVelocityChecks: process.env.ENABLE_VELOCITY_CHECKS !== 'false',
      enableGeolocationChecks: process.env.ENABLE_GEOLOCATION_CHECKS !== 'false',
      enableDeviceFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING !== 'false',
      suspiciousAmountThreshold: parseInt(process.env.SUSPICIOUS_AMOUNT_THRESHOLD || '1000'), // $1,000
      requireManualReview: process.env.REQUIRE_MANUAL_REVIEW_HIGH_RISK === 'true',
      enableRiskScoring: process.env.ENABLE_RISK_SCORING !== 'false',
      maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || '75')
    };

    this.startCleanupTimer();

    logger.info('Payment security service initialized', {
      idempotencyEnabled: this.idempotencyConfig.enableIdempotency,
      fraudDetectionEnabled: this.securityConfig.enableFraudDetection,
      maxTransactionAmount: this.securityConfig.maxTransactionAmount
    });
  }

  public static getInstance(): PaymentSecurityService {
    if (!PaymentSecurityService.instance) {
      PaymentSecurityService.instance = new PaymentSecurityService();
    }
    return PaymentSecurityService.instance;
  }

  /**
   * Generate idempotency key
   */
  generateIdempotencyKey(
    userId: string,
    endpoint: string,
    requestData: unknown
  ): string {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(requestData))
      .digest('hex');

    const keyData = {
      userId,
      endpoint,
      requestHash,
      timestamp: Date.now()
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Process idempotent request
   */
  async processIdempotentRequest<T>(
    idempotencyKey: string,
    userId: string,
    endpoint: string,
    requestData: unknown,
    processor: () => Promise<T>
  ): Promise<{
    result: T;
    isRetry: boolean;
    attempts: number;
  }> {
    if (!this.idempotencyConfig.enableIdempotency) {
      const result = await processor();
      return { result, isRetry: false, attempts: 1 };
    }

    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(requestData))
      .digest('hex');

    // Check for existing key
    const existingKey = await this.getIdempotencyKey(idempotencyKey);
    
    if (existingKey) {
      // Validate request matches
      if (existingKey.requestHash !== requestHash) {
        throw new Error('Idempotency key conflict: different request data');
      }

      if (existingKey.userId !== userId) {
        throw new Error('Idempotency key conflict: different user');
      }

      if (existingKey.endpoint !== endpoint) {
        throw new Error('Idempotency key conflict: different endpoint');
      }

      // Return cached response if completed
      if (existingKey.status === 'completed' && existingKey.response) {
        logger.info('Idempotent request returned cached response', {
          idempotencyKey: idempotencyKey.substring(0, 8) + '...',
          userId,
          endpoint,
          attempts: existingKey.attempts
        });

        return {
          result: existingKey.response as T, // Cast to T
          isRetry: true,
          attempts: existingKey.attempts
        };
      }

      // Handle processing state
      if (existingKey.status === 'processing') {
        // Wait and retry if still processing
        await this.waitForProcessing(idempotencyKey);
        return await this.processIdempotentRequest(
          idempotencyKey,
          userId,
          endpoint,
          requestData,
          processor
        );
      }

      // Handle failed state - allow retry if within limits
      if (existingKey.status === 'failed') {
        if (existingKey.attempts >= this.idempotencyConfig.maxRetries) {
          throw new Error('Maximum retry attempts exceeded for idempotency key');
        }
      }
    }

    // Acquire distributed lock
    const lockId = await this.acquireDistributedLock(idempotencyKey);

    try {
      // Create or update idempotency key
      const keyRecord: IdempotencyKey = {
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

      // Process request
      let result: T;
      try {
        result = await processor();
        
        // Update key with successful result
        keyRecord.response = result;
        keyRecord.status = 'completed';
        await this.storeIdempotencyKey(keyRecord);

        logger.info('Idempotent request processed successfully', {
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

      } catch (err: unknown) {
        // Update key with failure
        keyRecord.status = 'failed';
        await this.storeIdempotencyKey(keyRecord);

        logger.error('Idempotent request processing failed', {
          idempotencyKey: idempotencyKey.substring(0, 8) + '...',
          userId,
          endpoint,
          attempts: keyRecord.attempts,
          error: getErrorMessage(err as Error)
        });

        throw err;
      }

    } finally {
      // Release distributed lock
      await this.releaseDistributedLock(idempotencyKey, lockId);
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireDistributedLock(key: string): Promise<string> {
    if (!this.idempotencyConfig.enableDistributedLocking) {
      return 'no-lock';
    }

    const lockId = crypto.randomBytes(16).toString('hex');
    const lockKey = `lock_${this.idempotencyConfig.keyPrefix}_${key}`;
    const expiresAt = new Date(Date.now() + this.idempotencyConfig.lockTimeout);

    try {
      // Try to acquire lock in cache
      const acquired = await tenantCacheService.setIfNotExists(
        'system',
        lockKey,
        { lockId, expiresAt },
        {
          ttl: Math.floor(this.idempotencyConfig.lockTimeout / 1000),
          namespace: 'locks'
        }
      );

      if (!acquired) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, this.idempotencyConfig.retryDelay));
        return await this.acquireDistributedLock(key);
      }

      this.distributedLocks.set(key, { lockId, expiresAt });
      return lockId;

    } catch (err: unknown) {
      logger.error('Failed to acquire distributed lock:', err as Record<string, unknown>);
      throw new Error('Could not acquire distributed lock');
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseDistributedLock(key: string, lockId: string): Promise<void> {
    if (!this.idempotencyConfig.enableDistributedLocking || lockId === 'no-lock') {
      return;
    }

    try {
      const lockKey = `lock_${this.idempotencyConfig.keyPrefix}_${key}`;
      
      // Only release if we own the lock
      const currentLock = this.distributedLocks.get(key);
      if (currentLock && currentLock.lockId === lockId) {
        await tenantCacheService.delete('system', lockKey, { namespace: 'locks' });
        this.distributedLocks.delete(key);
      }

    } catch (err: unknown) {
      logger.error('Failed to release distributed lock:', err as Record<string, unknown>);
    }
  }

  /**
   * Wait for processing to complete
   */
  private async waitForProcessing(key: string): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const pollInterval = 1000; // 1 second
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

  /**
   * Store idempotency key
   */
  private async storeIdempotencyKey(keyRecord: IdempotencyKey): Promise<void> {
    try {
      // Store in cache for fast access
      await tenantCacheService.set(
        'system',
        `${this.idempotencyConfig.keyPrefix}_${keyRecord.key}`,
        keyRecord,
        {
          ttl: this.idempotencyConfig.keyTTL,
          namespace: 'idempotency'
        }
      );

      // Store in database for persistence
      const prisma = databaseService.getPrisma();
      await prisma.$executeRaw`
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

    } catch (err: unknown) {
      logger.error('Failed to store idempotency key:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Get idempotency key
   */
  private async getIdempotencyKey(key: string): Promise<IdempotencyKey | null> {
    try {
      // Check cache first
      const cached = await tenantCacheService.get<IdempotencyKey>(
        'system',
        `${this.idempotencyConfig.keyPrefix}_${key}`,
        { namespace: 'idempotency' }
      );

      if (cached) {
        return cached;
      }

      // Fallback to database
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<unknown[]>`
        SELECT * FROM idempotency_keys 
        WHERE key = ${key} AND expires_at > NOW()
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      const keyRecord: IdempotencyKey = {
        key: (row as any).key,
        userId: (row as any).user_id,
        endpoint: (row as any).endpoint,
        requestHash: (row as any).request_hash,
        response: (row as any).response,
        status: (row as any).status,
        createdAt: (row as any).created_at,
        expiresAt: (row as any).expires_at,
        attempts: (row as any).attempts,
        lockId: (row as any).lock_id
      };

      // Cache for future use
      await tenantCacheService.set(
        'system',
        `${this.idempotencyConfig.keyPrefix}_${key}`,
        keyRecord,
        {
          ttl: Math.floor((keyRecord.expiresAt.getTime() - Date.now()) / 1000),
          namespace: 'idempotency'
        }
      );

      return keyRecord;

    } catch (err: unknown) {
      logger.error('Failed to get idempotency key:', err as Record<string, unknown>);
      return null;
    }
  }

  /**
   * Analyze transaction for fraud
   */
  async analyzeFraud(context: TransactionContext): Promise<FraudAnalysisResult> {
    const result: FraudAnalysisResult = {
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
      // Amount-based checks
      await this.performAmountChecks(context, result);

      // Velocity checks
      if (this.securityConfig.enableVelocityChecks) {
        await this.performVelocityChecks(context, result);
      }

      // Geolocation checks
      if (this.securityConfig.enableGeolocationChecks && context.geolocation) {
        await this.performGeolocationChecks(context, result);
      }

      // Device fingerprinting checks
      if (this.securityConfig.enableDeviceFingerprinting && context.deviceFingerprint) {
        await this.performDeviceChecks(context, result);
      }

      // Pattern analysis
      await this.performPatternAnalysis(context, result);

      // Calculate final risk score and level
      this.calculateRiskScore(result);
      this.determineRiskLevel(result);

      // Determine if manual review is required
      if (result.riskScore >= this.securityConfig.maxRiskScore) {
        result.requiresManualReview = true;
        result.recommendations.push('Transaction requires manual review due to high risk score');
      }

      if (this.securityConfig.requireManualReview && result.riskLevel === 'HIGH') {
        result.requiresManualReview = true;
      }

      logger.info('Fraud analysis completed', {
        userId: context.userId,
        orderId: context.orderId,
        amount: context.amount,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        flagsCount: result.flags.length,
        requiresReview: result.requiresManualReview
      });

      return result;

    } catch (err: unknown) {
      logger.error('Fraud analysis error:', err as Record<string, unknown>);
      
      // Fail secure - mark as high risk on error
      result.riskScore = 100;
      result.riskLevel = 'CRITICAL';
      result.requiresManualReview = true;
      result.blockedReasons.push('Fraud analysis system error');
      
      return result;
    }
  }

  /**
   * Amount-based fraud checks
   */
  private async performAmountChecks(
    context: TransactionContext,
    result: FraudAnalysisResult
  ): Promise<void> {
    const { amount, currency } = context;

    // Convert to USD for comparison (simplified)
    const usdAmount = amount; // In real implementation, use currency conversion

    result.analysis.amountCheck.details = {
      amount: usdAmount,
      currency: currency, // Added currency to details
      maxTransaction: this.securityConfig.maxTransactionAmount,
      suspiciousThreshold: this.securityConfig.suspiciousAmountThreshold
    };

    // Check maximum transaction amount
    if (usdAmount > this.securityConfig.maxTransactionAmount) {
      result.riskScore += 50;
      result.flags.push('amount_exceeds_maximum');
      result.blockedReasons.push(`Transaction amount $${usdAmount} exceeds maximum of $${this.securityConfig.maxTransactionAmount}`);
      result.analysis.amountCheck.passed = false;
    }

    // Check suspicious amount threshold
    if (usdAmount >= this.securityConfig.suspiciousAmountThreshold) {
      result.riskScore += 20;
      result.flags.push('suspicious_amount');
      result.recommendations.push('High-value transaction detected');
    }

    // Check for round numbers (potential fraud indicator)
    if (usdAmount % 100 === 0 && usdAmount >= 500) {
      result.riskScore += 10;
      result.flags.push('round_amount');
      result.recommendations.push('Round amount transaction');
    }
  }

  /**
   * Velocity-based fraud checks
   */
  private async performVelocityChecks(
    context: TransactionContext,
    result: FraudAnalysisResult
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Check transactions in last hour
      const hourlyTransactions = await prisma.$queryRaw<{ count: number; total_amount: number }[]>`
        SELECT COUNT(*)::integer as count, COALESCE(SUM(amount), 0)::integer as total_amount
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '1 hour'
        AND status IN ('completed', 'pending')
      `;

      const hourlyCount = hourlyTransactions[0]?.count || 0;
      const hourlyAmount = hourlyTransactions[0]?.total_amount || 0;

      // Check daily transactions
      const dailyTransactions = await prisma.$queryRaw<{ count: number; total_amount: number }[]>`
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

      // Check hourly transaction limit
      if (hourlyCount >= this.securityConfig.maxTransactionsPerHour) {
        result.riskScore += 40;
        result.flags.push('hourly_transaction_limit_exceeded');
        result.blockedReasons.push(`Hourly transaction limit of ${this.securityConfig.maxTransactionsPerHour} exceeded`);
        result.analysis.velocityCheck.passed = false;
      }

      // Check daily amount limit
      if (dailyAmount + context.amount > this.securityConfig.maxDailyAmount) {
        result.riskScore += 30;
        result.flags.push('daily_amount_limit_exceeded');
        result.blockedReasons.push(`Daily amount limit of $${this.securityConfig.maxDailyAmount} would be exceeded`);
        result.analysis.velocityCheck.passed = false;
      }

      // Check for rapid successive transactions
      if (hourlyCount >= 3) {
        result.riskScore += 15;
        result.flags.push('rapid_transactions');
        result.recommendations.push('Multiple transactions in short timeframe');
      }

    } catch (err: unknown) {
      logger.error('Velocity check error:', err as Record<string, unknown>);
      result.analysis.velocityCheck.passed = false;
    }
  }

  /**
   * Geolocation-based fraud checks
   */
  private async performGeolocationChecks(
    context: TransactionContext,
    result: FraudAnalysisResult
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Get user's recent transaction locations
      const recentLocations = await prisma.$queryRaw<unknown[]>`
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
      const knownCountries = recentLocations.map(loc => (loc as { country: string }).country).filter(Boolean);

      result.analysis.geolocationCheck.details = {
        currentCountry,
        knownCountries,
        isNewCountry: !knownCountries.includes(currentCountry)
      };

      // Check for new country
      if (knownCountries.length > 0 && !knownCountries.includes(currentCountry)) {
        result.riskScore += 25;
        result.flags.push('new_country');
        result.recommendations.push(`Transaction from new country: ${currentCountry}`);
      }

      // Check for high-risk countries (simplified list)
      const highRiskCountries = ['XX', 'YY']; // Replace with actual high-risk country codes
      if (currentCountry && highRiskCountries.includes(currentCountry)) {
        result.riskScore += 20;
        result.flags.push('high_risk_country');
        result.recommendations.push('Transaction from high-risk country');
      }

      // Check for impossible travel (transactions from different countries within short timeframe)
      if (recentLocations.length > 0) {
        const lastLocation = recentLocations[0] as { created_at: string, country: string };
        const timeDiff = Date.now() - new Date(lastLocation.created_at).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (lastLocation.country !== currentCountry && hoursDiff < 6) {
          result.riskScore += 35;
          result.flags.push('impossible_travel');
          result.recommendations.push('Impossible travel pattern detected');
        }
      }

    } catch (err: unknown) {
      logger.error('Geolocation check error:', err as Record<string, unknown>);
      result.analysis.geolocationCheck.passed = false;
    }
  }

  /**
   * Device-based fraud checks
   */
  private async performDeviceChecks(
    context: TransactionContext,
    result: FraudAnalysisResult
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Get user's known devices
      const knownDevices = await prisma.$queryRaw<unknown[]>`
        SELECT DISTINCT metadata->>'deviceFingerprint' as device_fingerprint
        FROM payment_transactions 
        WHERE user_id = ${context.userId}::UUID 
        AND created_at > NOW() - INTERVAL '90 days'
        AND metadata->>'deviceFingerprint' IS NOT NULL
      `;

      const deviceFingerprints = knownDevices
        .map(d => (d as { device_fingerprint: string }).device_fingerprint)
        .filter(Boolean);

      const isNewDevice = !deviceFingerprints.includes(context.deviceFingerprint);

      result.analysis.deviceCheck.details = {
        currentDevice: context.deviceFingerprint,
        knownDevices: deviceFingerprints.length,
        isNewDevice
      };

      // Check for new device
      if (deviceFingerprints.length > 0 && isNewDevice) {
        result.riskScore += 15;
        result.flags.push('new_device');
        result.recommendations.push('Transaction from new device');
      }

      // Check for suspicious user agent patterns
      if (this.isSuspiciousUserAgent(context.userAgent)) {
        result.riskScore += 10;
        result.flags.push('suspicious_user_agent');
        result.recommendations.push('Suspicious user agent detected');
      }

    } catch (err: unknown) {
      logger.error('Device check error:', err as Record<string, unknown>);
      result.analysis.deviceCheck.passed = false;
    }
  }

  /**
   * Pattern analysis for fraud detection
   */
  private async performPatternAnalysis(
    context: TransactionContext,
    result: FraudAnalysisResult
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      // Check for duplicate orders
      const duplicateOrders = await prisma.$queryRaw<{ count: number }[]>`
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

      // Check for payment method switching
      const recentPaymentMethods = await prisma.$queryRaw<unknown[]>`
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

    } catch (err: unknown) {
      logger.error('Pattern analysis error:', err as Record<string, unknown>);
      result.analysis.patternAnalysis.passed = false;
    }
  }

  /**
   * Calculate final risk score
   */
  private calculateRiskScore(result: FraudAnalysisResult): void {
    // Risk score is already accumulated during checks
    // Apply any final adjustments here
    
    // Bonus for passing all checks
    const allChecksPassed = Object.values(result.analysis).every(check => check.passed);
    if (allChecksPassed && result.flags.length === 0) {
      result.riskScore = Math.max(0, result.riskScore - 5);
    }

    // Cap at 100
    result.riskScore = Math.min(100, result.riskScore);
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(result: FraudAnalysisResult): void {
    if (result.riskScore >= 80) {
      result.riskLevel = 'CRITICAL';
    } else if (result.riskScore >= 60) {
      result.riskLevel = 'HIGH';
    } else if (result.riskScore >= 30) {
      result.riskLevel = 'MEDIUM';
    } else {
      result.riskLevel = 'LOW';
    }
  }

  /**
   * Check for suspicious user agent
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
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

  /**
   * Clean up expired keys and locks
   */
  private startCleanupTimer(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredKeys();
        await this.cleanupExpiredLocks();
      } catch (err: unknown) {
        logger.error('Payment security cleanup error:', err as Record<string, unknown>);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async cleanupExpiredKeys(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, keyRecord] of this.activeKeys.entries()) {
      if (keyRecord.expiresAt.getTime() < now) {
        this.activeKeys.delete(key);
        cleanedCount++;
      }
    }

    // Clean up database
    const prisma = databaseService.getPrisma();
    await prisma.$executeRaw`
      DELETE FROM idempotency_keys WHERE expires_at < NOW()
    `;

    if (cleanedCount > 0) {
      logger.debug('Expired idempotency keys cleaned up', {
        cleanedCount,
        remainingKeys: this.activeKeys.size
      });
    }
  }

  private async cleanupExpiredLocks(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, lock] of this.distributedLocks.entries()) {
      if (lock.expiresAt.getTime() < now) {
        this.distributedLocks.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Expired distributed locks cleaned up', {
        cleanedCount,
        remainingLocks: this.distributedLocks.size
      });
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    idempotencyConfig: IdempotencyConfig;
    securityConfig: PaymentSecurityConfig;
    activeKeys: number;
    activeLocks: number;
  } {
    return {
      idempotencyConfig: this.idempotencyConfig,
      securityConfig: this.securityConfig,
      activeKeys: this.activeKeys.size,
      activeLocks: this.distributedLocks.size
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: { idempotencyConfig: IdempotencyConfig; securityConfig: PaymentSecurityConfig; activeKeys: number; activeLocks: number; };
  }> {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        stats
      };

    } catch (err: unknown) {
      logger.error('Payment security service health check failed:', err as Record<string, unknown>);
      return {
        status: 'error',
        stats: null
      };
    }
  }
}

// Export singleton instance
export const paymentSecurityService = PaymentSecurityService.getInstance();
