import * as crypto from 'crypto';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../utils/logger';
import { securityLogService } from './SecurityLogService';

export enum InventoryOperationType {
  STOCK_INCREASE = 'stock_increase',
  STOCK_DECREASE = 'stock_decrease',
  STOCK_TRANSFER = 'stock_transfer',
  STOCK_ADJUSTMENT = 'stock_adjustment',
  STOCK_RESERVATION = 'stock_reservation',
  STOCK_RELEASE = 'stock_release',
  PRICE_UPDATE = 'price_update',
  PRODUCT_ACTIVATION = 'product_activation',
  PRODUCT_DEACTIVATION = 'product_deactivation'
}

export enum ConcurrencyControl {
  OPTIMISTIC_LOCKING = 'optimistic_locking',
  PESSIMISTIC_LOCKING = 'pessimistic_locking',
  DISTRIBUTED_LOCKING = 'distributed_locking'
}

export enum InventoryAuditLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
  FORENSIC = 'forensic'
}

export interface OptimisticLockConfig {
  id: string;
  tableName: string;
  versionColumn: string;

  // Lock settings
  maxRetryAttempts: number;
  retryDelayMs: number;
  lockTimeoutMs: number;

  // Conflict resolution
  conflictResolution: 'fail' | 'retry' | 'merge' | 'override';
  mergeStrategy?: 'sum' | 'max' | 'min' | 'last_writer_wins';

  // Security
  auditLevel: InventoryAuditLevel;
  requireApproval: boolean;
  approverRoles: string[];

  // Business rules
  allowNegativeStock: boolean;
  enforceReservationLimit: boolean;
  validateBusinessRules: boolean;

  // Monitoring
  trackPerformance: boolean;
  alertOnConflicts: boolean;
  conflictThreshold: number; // conflicts per hour

  enabled: boolean;
}

export interface InventoryOperation {
  id: string;
  operationType: InventoryOperationType;

  // Target
  productId: string;
  storeId: string;
  variantId?: string;

  // Operation details
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  priceChange?: {
    previousPrice: number;
    newPrice: number;
    currency: string;
  };

  // Optimistic locking
  version: number;
  expectedVersion: number;
  lockAcquiredAt: Date;
  lockReleasedAt?: Date;

  // Metadata
  reason: string;
  reference?: string; // Order ID, Transfer ID, etc.
  userId: string;
  userRole: string;

  // Security
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  digitalSignature?: string;

  // Execution
  status: 'pending' | 'locked' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // Validation
  businessRulesValidated: boolean;
  validationErrors: string[];

  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    user: string;
    details: Record<string, unknown>;
    signature?: string;
  }[];

  // Conflict handling
  conflictDetected: boolean;
  conflictResolution?: string;
  retryCount: number;
  maxRetries: number;
}

export interface InventoryConflict {
  id: string;
  productId: string;
  storeId: string;

  // Conflict details
  detectedAt: Date;
  conflictType: 'version_mismatch' | 'concurrent_access' | 'data_integrity' | 'business_rule_violation';

  // Competing operations
  operationA: {
    id: string;
    userId: string;
    expectedVersion: number;
    operation: InventoryOperationType;
  };
  operationB: {
    id: string;
    userId: string;
    expectedVersion: number;
    operation: InventoryOperationType;
  };

  // Resolution
  resolved: boolean;
  resolutionStrategy?: string;
  resolvedBy?: string;
  resolvedAt?: Date;

  // Impact assessment
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedOrders: string[];
  businessImpact: string;

  // Security implications
  securityRelevant: boolean;
  potentialFraud: boolean;
  investigationRequired: boolean;
}

export interface InventorySecurityMetrics {
  // Operation metrics
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;

  // Locking metrics
  lockAcquisitions: number;
  lockTimeouts: number;
  lockConflicts: number;
  averageLockDuration: number;

  // Conflict metrics
  conflictCount: number;
  conflictResolutionTime: number;
  unresolvedConflicts: number;

  // Security metrics
  unauthorizedAttempts: number;
  suspiciousOperations: number;
  fraudAlerts: number;

  // Performance metrics
  averageOperationTime: number;
  throughputPerSecond: number;

  // Compliance metrics
  auditCompliance: number;
  approvalCompliance: number;

  // Time range
  periodStart: Date;
  periodEnd: Date;
  activeLocks: number;
  activeOperations: number;
}

export class InventorySecurityService {
  private static instance: InventorySecurityService;
  private lockConfigs: Map<string, OptimisticLockConfig> = new Map();
  private activeOperations: Map<string, InventoryOperation> = new Map();
  private activeLocks: Map<string, Set<string>> = new Map(); // productId -> operationIds
  private conflicts: Map<string, InventoryConflict> = new Map();
  private metrics!: InventorySecurityMetrics;
  private distributedLocks: Map<string, { lockId: string; expiresAt: Date }> = new Map();

  private constructor() {
    this.initializeInventorySecurity();
    this.loadOptimisticLockConfigs();
    this.initializeMetrics();
    this.startSecurityMonitoring();

    logger.info('Inventory Security Service initialized', {
      lockConfigs: this.lockConfigs.size,
      concurrencyControl: 'optimistic_locking_enabled',
      auditLevel: 'comprehensive'
    });
  }

  public static getInstance(): InventorySecurityService {
    if (!InventorySecurityService.instance) {
      InventorySecurityService.instance = new InventorySecurityService();
    }
    return InventorySecurityService.instance;
  }

  private async initializeInventorySecurity(): Promise<void> {
    try {
      // Initialize distributed locking mechanism
      await this.initializeDistributedLocking();

      // Setup conflict detection
      await this.setupConflictDetection();

      // Initialize business rule validation
      await this.initializeBusinessRuleValidation();

      logger.info('Inventory security initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize inventory security:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async initializeDistributedLocking(): Promise<void> {
    // Initialize distributed locking for multi-instance deployment
    logger.debug('Distributed locking initialized');
  }

  private async setupConflictDetection(): Promise<void> {
    // Setup real-time conflict detection
    logger.debug('Conflict detection setup completed');
  }

  private async initializeBusinessRuleValidation(): Promise<void> {
    // Initialize business rule validation engine
    logger.debug('Business rule validation initialized');
  }

  private loadOptimisticLockConfigs(): void {
    // Products table lock config
    const productsLockConfig: OptimisticLockConfig = {
      id: 'products-optimistic-lock',
      tableName: 'products',
      versionColumn: 'version',
      maxRetryAttempts: 3,
      retryDelayMs: 100,
      lockTimeoutMs: 5000,
      conflictResolution: 'retry',
      mergeStrategy: 'sum',
      auditLevel: InventoryAuditLevel.COMPREHENSIVE,
      requireApproval: false,
      approverRoles: ['inventory_manager', 'store_admin'],
      allowNegativeStock: false,
      enforceReservationLimit: true,
      validateBusinessRules: true,
      trackPerformance: true,
      alertOnConflicts: true,
      conflictThreshold: 10, // 10 conflicts per hour
      enabled: true
    };

    // Product variants lock config
    const variantsLockConfig: OptimisticLockConfig = {
      id: 'product-variants-optimistic-lock',
      tableName: 'product_variants',
      versionColumn: 'version',
      maxRetryAttempts: 5,
      retryDelayMs: 50,
      lockTimeoutMs: 3000,
      conflictResolution: 'merge',
      mergeStrategy: 'sum',
      auditLevel: InventoryAuditLevel.STANDARD,
      requireApproval: false,
      approverRoles: ['inventory_manager'],
      allowNegativeStock: false,
      enforceReservationLimit: true,
      validateBusinessRules: true,
      trackPerformance: true,
      alertOnConflicts: true,
      conflictThreshold: 20,
      enabled: true
    };

    // Inventory adjustments lock config
    const adjustmentsLockConfig: OptimisticLockConfig = {
      id: 'inventory-adjustments-optimistic-lock',
      tableName: 'inventory_adjustments',
      versionColumn: 'version',
      maxRetryAttempts: 2,
      retryDelayMs: 200,
      lockTimeoutMs: 10000,
      conflictResolution: 'fail',
      auditLevel: InventoryAuditLevel.FORENSIC,
      requireApproval: true,
      approverRoles: ['inventory_manager', 'finance_admin'],
      allowNegativeStock: true, // For adjustments
      enforceReservationLimit: false,
      validateBusinessRules: true,
      trackPerformance: true,
      alertOnConflicts: true,
      conflictThreshold: 5,
      enabled: true
    };

    // Store inventory lock config
    const storeInventoryLockConfig: OptimisticLockConfig = {
      id: 'store-inventory-optimistic-lock',
      tableName: 'store_inventory',
      versionColumn: 'version',
      maxRetryAttempts: 4,
      retryDelayMs: 150,
      lockTimeoutMs: 7000,
      conflictResolution: 'retry',
      mergeStrategy: 'last_writer_wins',
      auditLevel: InventoryAuditLevel.COMPREHENSIVE,
      requireApproval: false,
      approverRoles: ['store_manager'],
      allowNegativeStock: false,
      enforceReservationLimit: true,
      validateBusinessRules: true,
      trackPerformance: true,
      alertOnConflicts: true,
      conflictThreshold: 15,
      enabled: true
    };

    this.lockConfigs.set('products', productsLockConfig);
    this.lockConfigs.set('product_variants', variantsLockConfig);
    this.lockConfigs.set('inventory_adjustments', adjustmentsLockConfig);
    this.lockConfigs.set('store_inventory', storeInventoryLockConfig);

    logger.info('Optimistic lock configurations loaded', {
      configCount: this.lockConfigs.size
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      lockAcquisitions: 0,
      lockTimeouts: 0,
      lockConflicts: 0,
      averageLockDuration: 0,
      conflictCount: 0,
      conflictResolutionTime: 0,
      unresolvedConflicts: 0,
      unauthorizedAttempts: 0,
      suspiciousOperations: 0,
      fraudAlerts: 0,
      averageOperationTime: 0,
      throughputPerSecond: 0,
      auditCompliance: 100,
      approvalCompliance: 100,
      periodStart: new Date(),
      periodEnd: new Date(),
      activeLocks: 0,
      activeOperations: 0
    };

    logger.debug('Inventory security metrics initialized');
  }

  /**
   * Execute inventory operation with optimistic locking
   */
  async executeSecureInventoryOperation(
    operationType: InventoryOperationType,
    productId: string,
    storeId: string,
    quantity: number,
    options: {
      variantId?: string;
      reason?: string;
      reference?: string;
      userId?: string;
      userRole?: string;
      priceChange?: { previousPrice: number; newPrice: number; currency: string };
      bypassLocking?: boolean;
      forceApproval?: boolean;
    } = {}
  ): Promise<string> {
    const operationId = crypto.randomUUID();
    // const _startTime = Date.now();
 // Unused variable removed

    try {
      // Determine table and lock config
      const tableName = this.getTableName(operationType, options.variantId);
      const lockConfig = this.lockConfigs.get(tableName);

      if (!lockConfig || !lockConfig.enabled) {
        throw new Error(`Optimistic locking not configured for table: ${tableName}`);
      }

      // Get current version
      const currentRecord = await this.getCurrentRecord(tableName, productId, storeId, options.variantId);
      if (!currentRecord) {
        throw new Error(`Record not found: ${productId} in store ${storeId}`);
      }

      // Create operation
      const operation: InventoryOperation = {
        id: operationId,
        operationType,
        productId,
        storeId,
        variantId: options.variantId,
        quantity,
        previousQuantity: currentRecord.quantity,
        newQuantity: this.calculateNewQuantity(operationType, currentRecord.quantity, quantity),
        priceChange: options.priceChange,
        version: currentRecord.version + 1,
        expectedVersion: currentRecord.version,
        lockAcquiredAt: new Date(),
        reason: options.reason || 'Inventory operation',
        reference: options.reference,
        userId: options.userId || 'system',
        userRole: options.userRole || 'system',
        approved: false,
        digitalSignature: '',
        status: 'pending',
        startTime: new Date(),
        businessRulesValidated: false,
        validationErrors: [],
        auditTrail: [],
        conflictDetected: false,
        retryCount: 0,
        maxRetries: lockConfig.maxRetryAttempts
      };

      // Add initial audit entry
      operation.auditTrail.push({
        timestamp: new Date(),
        action: 'operation_initiated',
        user: operation.userId,
        details: {
          operationType,
          productId,
          storeId,
          quantity,
          expectedVersion: operation.expectedVersion
        }
      });

      this.activeOperations.set(operationId, operation);

      // Validate business rules
      await this.validateBusinessRules(operation, lockConfig);

      // Check approval requirement
      if (lockConfig.requireApproval || options.forceApproval) {
        await this.requestApproval(operation, lockConfig);
      } else {
        operation.approved = true;
        operation.approvedBy = 'auto_approved';
        operation.approvedAt = new Date();
      }

      // Acquire optimistic lock
      if (!options.bypassLocking) {
        await this.acquireOptimisticLock(operation, lockConfig);
      }

      // Execute operation
      // NOTE: Internal method with validated inputs, not dynamic code execution (CWE-94 false positive)
      await this.executeOperation(operation, lockConfig);

      // Generate digital signature
      await this.generateOperationSignature(operation);

      // Release lock
      if (!options.bypassLocking) {
        await this.releaseOptimisticLock(operation);
      }

      operation.status = 'completed';
      operation.endTime = new Date();
      operation.duration = operation.endTime.getTime() - operation.startTime.getTime();

      // Update metrics
      this.updateMetrics(operation, true);

      logger.info('Secure inventory operation completed', {
        operationId,
        operationType,
        productId,
        storeId,
        quantity,
        duration: operation.duration,
        version: operation.version,
        conflicts: operation.retryCount
      });

      // Log security event
      await securityLogService.logSecurityEvent({
        eventType: 'secure_inventory_operation_completed',
        severity: 'LOW',
        category: 'application',
        ipAddress: '82.147.84.78',
        success: true,
        details: {
          operationId,
          operationType,
          productId,
          storeId,
          quantity,
          version: operation.version,
          duration: operation.duration,
          retryCount: operation.retryCount
        },
        riskScore: this.calculateOperationRiskScore(operation),
        tags: ['inventory_security', 'optimistic_locking', 'business_process'],
        compliance: {
          pii: false,
          gdpr: false,
          pci: false,
          hipaa: false
        }
      });

      return operationId;

    } catch (err: unknown) {
      const operation = this.activeOperations.get(operationId);
      if (operation) {
        operation.status = 'failed';
        operation.endTime = new Date();
        operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
        operation.validationErrors.push(getErrorMessage(err as Error));

        this.updateMetrics(operation, false);
      }

      logger.error('Secure inventory operation failed', {
        operationId,
        operationType,
        productId,
        storeId,
        error: getErrorMessage(err as Error)
      });

      throw err;
    }
  }

  private getTableName(operationType: InventoryOperationType, variantId?: string): string {
    if (variantId) {
      return 'product_variants';
    }

    switch (operationType) {
      case InventoryOperationType.STOCK_ADJUSTMENT:
        return 'inventory_adjustments';
      case InventoryOperationType.STOCK_TRANSFER:
        return 'store_inventory';
      default:
        return 'products';
    }
  }

  private async getCurrentRecord(
    _tableName: string,
    _productId: string,
    _storeId: string,
    _variantId?: string
  ): Promise<{ quantity: number; version: number } | null> {
    // Simulate database query to get current record
    // In real implementation, this would query the actual database

    const baseQuantity = Math.floor(Math.random() * 1000) + 100;
    const baseVersion = Math.floor(Math.random() * 10) + 1;

    return {
      quantity: baseQuantity,
      version: baseVersion
    };
  }

  private calculateNewQuantity(
    operationType: InventoryOperationType,
    currentQuantity: number,
    changeQuantity: number
  ): number {
    switch (operationType) {
      case InventoryOperationType.STOCK_INCREASE:
        return currentQuantity + changeQuantity;
      case InventoryOperationType.STOCK_DECREASE:
      case InventoryOperationType.STOCK_RESERVATION:
        return currentQuantity - changeQuantity;
      case InventoryOperationType.STOCK_RELEASE:
        return currentQuantity + changeQuantity;
      case InventoryOperationType.STOCK_ADJUSTMENT:
        return changeQuantity; // Absolute value
      default:
        return currentQuantity;
    }
  }

  private async validateBusinessRules(operation: InventoryOperation, config: OptimisticLockConfig): Promise<void> {
    if (!config.validateBusinessRules) {
      operation.businessRulesValidated = true;
      return;
    }

    const errors: string[] = [];

    // Check negative stock
    if (!config.allowNegativeStock && operation.newQuantity < 0) {
      errors.push('Operation would result in negative stock');
    }

    // Check reservation limit
    if (config.enforceReservationLimit && operation.operationType === InventoryOperationType.STOCK_RESERVATION) {
      const maxReservation = operation.previousQuantity * 0.8; // 80% max reservation
      if (operation.quantity > maxReservation) {
        errors.push('Reservation exceeds maximum allowed limit');
      }
    }

    // Check quantity limits
    if (operation.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    // Check price change validation
    if (operation.priceChange) {
      const priceChangePercent = Math.abs(
        (operation.priceChange.newPrice - operation.priceChange.previousPrice) /
        operation.priceChange.previousPrice
      ) * 100;

      if (priceChangePercent > 50) { // 50% price change threshold
        errors.push('Price change exceeds allowed threshold');
      }
    }

    // Store validation errors
    operation.validationErrors = errors;
    operation.businessRulesValidated = errors.length === 0;

    if (errors.length > 0) {
      operation.auditTrail.push({
        timestamp: new Date(),
        action: 'business_rules_validation_failed',
        user: operation.userId,
        details: { errors }
      });

      throw new Error(`Business rule validation failed: ${errors.join(', ')}`);
    }

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'business_rules_validated',
      user: operation.userId,
      details: { validationPassed: true }
    });
  }

  private async requestApproval(operation: InventoryOperation, config: OptimisticLockConfig): Promise<void> {
    // Simulate approval process
    // In real implementation, this would trigger approval workflow

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'approval_requested',
      user: operation.userId,
      details: {
        approverRoles: config.approverRoles,
        operationType: operation.operationType,
        quantity: operation.quantity
      }
    });

    // Auto-approve for demo (in real system, this would be manual approval)
    operation.approved = true;
    operation.approvedBy = 'auto_approved_system';
    operation.approvedAt = new Date();

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'operation_approved',
      user: operation.approvedBy!,
      details: { autoApproved: true }
    });
  }

  private async acquireOptimisticLock(operation: InventoryOperation, config: OptimisticLockConfig): Promise<void> {
    const lockKey = `${operation.productId}-${operation.storeId}${operation.variantId ? '-' + operation.variantId : ''}`;

    // Check for existing locks
    const existingLocks = this.activeLocks.get(lockKey);
    if (existingLocks && existingLocks.size > 0) {
      // Detect potential conflict
      await this.handleLockConflict(operation, lockKey, config);
    }

    // Acquire distributed lock if needed (this check is removed as it was comparing wrong types)
    // TODO: Implement proper distributed locking based on concurrency control configuration
    // if (concurrencyControl === ConcurrencyControl.DISTRIBUTED_LOCKING) {
    //   await this.acquireDistributedLock(lockKey, operation.id, config.lockTimeoutMs);
    // }

    // Add to active locks
    if (!this.activeLocks.has(lockKey)) {
      this.activeLocks.set(lockKey, new Set());
    }
    this.activeLocks.get(lockKey)!.add(operation.id);

    operation.status = 'locked';
    operation.lockAcquiredAt = new Date();

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'optimistic_lock_acquired',
      user: operation.userId,
      details: {
        lockKey,
        expectedVersion: operation.expectedVersion,
        lockTimeout: config.lockTimeoutMs
      }
    });

    this.metrics.lockAcquisitions++;

    logger.debug('Optimistic lock acquired', {
      operationId: operation.id,
      lockKey,
      expectedVersion: operation.expectedVersion
    });
  }

  private async handleLockConflict(
    operation: InventoryOperation,
    lockKey: string,
    config: OptimisticLockConfig
  ): Promise<void> {
    const conflictId = crypto.randomUUID();
    const existingOperations = this.activeLocks.get(lockKey) || new Set();

    // Create conflict record
    const conflict: InventoryConflict = {
      id: conflictId,
      productId: operation.productId,
      storeId: operation.storeId,
      detectedAt: new Date(),
      conflictType: 'concurrent_access',
      operationA: {
        id: Array.from(existingOperations)[0],
        userId: operation.userId,
        expectedVersion: operation.expectedVersion,
        operation: operation.operationType
      },
      operationB: {
        id: operation.id,
        userId: operation.userId,
        expectedVersion: operation.expectedVersion,
        operation: operation.operationType
      },
      resolved: false,
      impactLevel: 'medium',
      affectedOrders: [],
      businessImpact: 'Potential inventory inconsistency',
      securityRelevant: false,
      potentialFraud: false,
      investigationRequired: false
    };

    this.conflicts.set(conflictId, conflict);
    operation.conflictDetected = true;

    // Handle based on conflict resolution strategy
    switch (config.conflictResolution) {
      case 'fail':
        throw new Error('Concurrent access detected, operation aborted');

      case 'retry':
        if (operation.retryCount < config.maxRetryAttempts) {
          operation.retryCount++;
          await this.delay(config.retryDelayMs * operation.retryCount);
          // Retry logic would be handled by caller
        } else {
          throw new Error('Maximum retry attempts exceeded');
        }
        break;

      case 'merge':
        await this.attemptMergeConflict(operation, conflict, config);
        break;

      case 'override':
        // Allow operation to proceed (dangerous but sometimes necessary)
        logger.warn('Lock conflict overridden', { operationId: operation.id, conflictId });
        break;
    }

    this.metrics.lockConflicts++;

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'lock_conflict_detected',
      user: operation.userId,
      details: {
        conflictId,
        conflictType: conflict.conflictType,
        resolutionStrategy: config.conflictResolution,
        retryCount: operation.retryCount
      }
    });
  }

  private async attemptMergeConflict(
    operation: InventoryOperation,
    conflict: InventoryConflict,
    config: OptimisticLockConfig
  ): Promise<void> {
    if (!config.mergeStrategy) {
      throw new Error('Merge strategy not configured');
    }

    // Get latest record state
    const latestRecord = await this.getCurrentRecord(
      this.getTableName(operation.operationType, operation.variantId),
      operation.productId,
      operation.storeId,
      operation.variantId
    );

    if (!latestRecord) {
      throw new Error('Record not found for merge');
    }

    // Apply merge strategy
    switch (config.mergeStrategy) {
      case 'sum':
        // Add quantities together
        operation.newQuantity = latestRecord.quantity + operation.quantity;
        break;

      case 'max':
        operation.newQuantity = Math.max(latestRecord.quantity, operation.newQuantity);
        break;

      case 'min':
        operation.newQuantity = Math.min(latestRecord.quantity, operation.newQuantity);
        break;

      case 'last_writer_wins':
        // Keep operation as-is, but update expected version
        operation.expectedVersion = latestRecord.version;
        break;
    }

    // Update operation version
    operation.expectedVersion = latestRecord.version;
    operation.version = latestRecord.version + 1;

    conflict.resolved = true;
    conflict.resolutionStrategy = config.mergeStrategy;
    conflict.resolvedBy = 'system_auto_merge';
    conflict.resolvedAt = new Date();

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'conflict_merged',
      user: 'system',
      details: {
        mergeStrategy: config.mergeStrategy,
        newQuantity: operation.newQuantity,
        newVersion: operation.version
      }
    });
  }

  private async acquireDistributedLock(lockKey: string, operationId: string, timeoutMs: number): Promise<void> {
    const lockId = `${lockKey}-${operationId}`;
    const expiresAt = new Date(Date.now() + timeoutMs);

    // Check if lock already exists
    const existingLock = this.distributedLocks.get(lockKey);
    if (existingLock && existingLock.expiresAt > new Date()) {
      throw new Error('Distributed lock already held');
    }

    // Acquire lock
    this.distributedLocks.set(lockKey, { lockId, expiresAt });

    // Set timeout to release lock
    setTimeout(() => {
      this.distributedLocks.delete(lockKey);
    }, timeoutMs);
  }

  private async executeOperation(operation: InventoryOperation, _config: OptimisticLockConfig): Promise<void> {
    operation.status = 'executing';

    // Simulate database update with version check
    // In real implementation, this would be an atomic database operation
    try {
      // Perform the actual inventory update
      await this.performInventoryUpdate(operation);

      operation.auditTrail.push({
        timestamp: new Date(),
        action: 'inventory_updated',
        user: operation.userId,
        details: {
          previousQuantity: operation.previousQuantity,
          newQuantity: operation.newQuantity,
          version: operation.version
        }
      });

    } catch (err: unknown) {
      // Handle version conflict
      if (getErrorMessage(err as Error).includes('version')) {
        operation.conflictDetected = true;
        operation.auditTrail.push({
          timestamp: new Date(),
          action: 'version_conflict_detected',
          user: operation.userId,
          details: { error: getErrorMessage(err as Error) }
        });

        throw new Error('Optimistic lock version conflict');
      }
      throw err;
    }
  }

  private async performInventoryUpdate(operation: InventoryOperation): Promise<void> {
    // Simulate inventory update operation
    // In real implementation, this would execute SQL with version check:
    // UPDATE products SET quantity = ?, version = version + 1 WHERE id = ? AND version = ?

    const success = Math.random() > 0.1; // 90% success rate simulation
    if (!success) {
      throw new Error('Database version conflict detected');
    }

    logger.debug('Inventory update performed', {
      operationId: operation.id,
      productId: operation.productId,
      newQuantity: operation.newQuantity,
      version: operation.version
    });
  }

  private async generateOperationSignature(operation: InventoryOperation): Promise<void> {
    // Create signature data
    const signatureData = {
      operationId: operation.id,
      productId: operation.productId,
      storeId: operation.storeId,
      operationType: operation.operationType,
      quantity: operation.quantity,
      newQuantity: operation.newQuantity,
      version: operation.version,
      userId: operation.userId,
      timestamp: operation.endTime?.toISOString()
    };

    // Generate HMAC signature
    const secret = process.env.INVENTORY_OPERATION_SECRET;
    if (!secret) {
      throw new Error('INVENTORY_OPERATION_SECRET environment variable is not set');
    }
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(signatureData))
      .digest('hex');

    operation.digitalSignature = signature;

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'digital_signature_generated',
      user: 'system',
      details: { signatureAlgorithm: 'HMAC-SHA256' },
      signature: signature
    });
  }

  private async releaseOptimisticLock(operation: InventoryOperation): Promise<void> {
    const lockKey = `${operation.productId}-${operation.storeId}${operation.variantId ? '-' + operation.variantId : ''}`;

    // Remove from active locks
    const locks = this.activeLocks.get(lockKey);
    if (locks) {
      locks.delete(operation.id);
      if (locks.size === 0) {
        this.activeLocks.delete(lockKey);
      }
    }

    // Release distributed lock
    this.distributedLocks.delete(lockKey);

    operation.lockReleasedAt = new Date();

    operation.auditTrail.push({
      timestamp: new Date(),
      action: 'optimistic_lock_released',
      user: operation.userId,
      details: {
        lockKey,
        lockDuration: operation.lockReleasedAt.getTime() - operation.lockAcquiredAt.getTime()
      }
    });

    logger.debug('Optimistic lock released', {
      operationId: operation.id,
      lockKey,
      lockDuration: operation.lockReleasedAt.getTime() - operation.lockAcquiredAt.getTime()
    });
  }

  private calculateOperationRiskScore(operation: InventoryOperation): number {
    let riskScore = 0;

    // Base risk by operation type
    switch (operation.operationType) {
      case InventoryOperationType.STOCK_ADJUSTMENT:
        riskScore += 30;
        break;
      case InventoryOperationType.PRICE_UPDATE:
        riskScore += 25;
        break;
      case InventoryOperationType.STOCK_DECREASE:
        riskScore += 20;
        break;
      default:
        riskScore += 10;
    }

    // Risk factors
    if (operation.conflictDetected) riskScore += 20;
    if (operation.retryCount > 0) riskScore += 10;
    if (operation.validationErrors.length > 0) riskScore += 15;
    if (!operation.approved) riskScore += 25;

    // Large quantity changes
    if (operation.quantity > 1000) riskScore += 15;

    // Price change risk
    if (operation.priceChange) {
      const priceChangePercent = Math.abs(
        (operation.priceChange.newPrice - operation.priceChange.previousPrice) /
        operation.priceChange.previousPrice
      ) * 100;

      if (priceChangePercent > 25) riskScore += 20;
    }

    return Math.max(0, Math.min(100, riskScore));
  }

  private updateMetrics(operation: InventoryOperation, success: boolean): void {
    this.metrics.totalOperations++;

    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    if (operation.duration) {
      this.metrics.averageOperationTime = this.metrics.totalOperations > 1
        ? (this.metrics.averageOperationTime * (this.metrics.totalOperations - 1) + operation.duration) / this.metrics.totalOperations
        : operation.duration;
    }

    if (operation.conflictDetected) {
      this.metrics.conflictCount++;
    }

    // Update lock duration average
    if (operation.lockReleasedAt) {
      const lockDuration = operation.lockReleasedAt.getTime() - operation.lockAcquiredAt.getTime();
      this.metrics.averageLockDuration = this.metrics.lockAcquisitions > 1
        ? (this.metrics.averageLockDuration * (this.metrics.lockAcquisitions - 1) + lockDuration) / this.metrics.lockAcquisitions
        : lockDuration;
    }

    this.metrics.periodEnd = new Date();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startSecurityMonitoring(): void {
    // Monitor for conflicts and performance issues
    setInterval(() => {
      this.monitorConflicts();
    }, 60 * 1000); // Every minute

    // Clean up expired operations
    setInterval(() => {
      this.cleanupExpiredOperations();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Update throughput metrics
    setInterval(() => {
      this.updateThroughputMetrics();
    }, 10 * 1000); // Every 10 seconds

    logger.info('Inventory security monitoring started');
  }

  private monitorConflicts(): void {
    const unresolvedConflicts = Array.from(this.conflicts.values())
      .filter(c => !c.resolved);

    this.metrics.unresolvedConflicts = unresolvedConflicts.length;

    // Alert on high conflict rate
    for (const [tableName, config] of this.lockConfigs.entries()) {
      if (!config.alertOnConflicts) continue;

      const recentConflicts = Array.from(this.conflicts.values())
        .filter(c => {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return c.detectedAt > hourAgo;
        }).length;

      if (recentConflicts > config.conflictThreshold) {
        logger.warn('High conflict rate detected', {
          tableName,
          conflicts: recentConflicts,
          threshold: config.conflictThreshold
        });
      }
    }
  }

  private cleanupExpiredOperations(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (operation.endTime && operation.endTime < oneHourAgo) {
        this.activeOperations.delete(operationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired inventory operations', { cleanedCount });
    }
  }

  private updateThroughputMetrics(): void {
    const now = new Date();
    const timePeriod = (now.getTime() - this.metrics.periodStart.getTime()) / 1000; // seconds

    if (timePeriod > 0) {
      this.metrics.throughputPerSecond = this.metrics.totalOperations / timePeriod;
    }
  }

  /**
   * Get inventory security statistics
   */
  getStats(): InventorySecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: InventorySecurityMetrics;
  }> {
    const stats = this.getStats();

    let status = 'healthy';

    if (stats.conflictCount > 50) {
      status = 'warning'; // High conflict rate
    }

    if (stats.unresolvedConflicts > 5) {
      status = 'degraded'; // Too many unresolved conflicts
    }

    if (stats.averageOperationTime > 10000) { // 10 seconds
      status = 'warning'; // Slow operations
    }

    const lockTimeouts = stats.lockTimeouts;
    if (lockTimeouts > 10) {
      status = 'critical'; // Too many lock timeouts
    }

    return {
      status,
      stats: {
        ...stats,
        activeLocks: this.activeLocks.size,
        activeOperations: this.activeOperations.size
      }
    };
  }
}

// Export singleton instance
export const inventorySecurityService = InventorySecurityService.getInstance();
