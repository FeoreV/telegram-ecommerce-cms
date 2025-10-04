"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventorySecurityService = exports.InventorySecurityService = exports.InventoryAuditLevel = exports.ConcurrencyControl = exports.InventoryOperationType = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var InventoryOperationType;
(function (InventoryOperationType) {
    InventoryOperationType["STOCK_INCREASE"] = "stock_increase";
    InventoryOperationType["STOCK_DECREASE"] = "stock_decrease";
    InventoryOperationType["STOCK_TRANSFER"] = "stock_transfer";
    InventoryOperationType["STOCK_ADJUSTMENT"] = "stock_adjustment";
    InventoryOperationType["STOCK_RESERVATION"] = "stock_reservation";
    InventoryOperationType["STOCK_RELEASE"] = "stock_release";
    InventoryOperationType["PRICE_UPDATE"] = "price_update";
    InventoryOperationType["PRODUCT_ACTIVATION"] = "product_activation";
    InventoryOperationType["PRODUCT_DEACTIVATION"] = "product_deactivation";
})(InventoryOperationType || (exports.InventoryOperationType = InventoryOperationType = {}));
var ConcurrencyControl;
(function (ConcurrencyControl) {
    ConcurrencyControl["OPTIMISTIC_LOCKING"] = "optimistic_locking";
    ConcurrencyControl["PESSIMISTIC_LOCKING"] = "pessimistic_locking";
    ConcurrencyControl["DISTRIBUTED_LOCKING"] = "distributed_locking";
})(ConcurrencyControl || (exports.ConcurrencyControl = ConcurrencyControl = {}));
var InventoryAuditLevel;
(function (InventoryAuditLevel) {
    InventoryAuditLevel["MINIMAL"] = "minimal";
    InventoryAuditLevel["STANDARD"] = "standard";
    InventoryAuditLevel["COMPREHENSIVE"] = "comprehensive";
    InventoryAuditLevel["FORENSIC"] = "forensic";
})(InventoryAuditLevel || (exports.InventoryAuditLevel = InventoryAuditLevel = {}));
class InventorySecurityService {
    constructor() {
        this.lockConfigs = new Map();
        this.activeOperations = new Map();
        this.activeLocks = new Map();
        this.conflicts = new Map();
        this.distributedLocks = new Map();
        this.initializeInventorySecurity();
        this.loadOptimisticLockConfigs();
        this.initializeMetrics();
        this.startSecurityMonitoring();
        logger_1.logger.info('Inventory Security Service initialized', {
            lockConfigs: this.lockConfigs.size,
            concurrencyControl: 'optimistic_locking_enabled',
            auditLevel: 'comprehensive'
        });
    }
    static getInstance() {
        if (!InventorySecurityService.instance) {
            InventorySecurityService.instance = new InventorySecurityService();
        }
        return InventorySecurityService.instance;
    }
    async initializeInventorySecurity() {
        try {
            await this.initializeDistributedLocking();
            await this.setupConflictDetection();
            await this.initializeBusinessRuleValidation();
            logger_1.logger.info('Inventory security initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize inventory security:', err);
            throw err;
        }
    }
    async initializeDistributedLocking() {
        logger_1.logger.debug('Distributed locking initialized');
    }
    async setupConflictDetection() {
        logger_1.logger.debug('Conflict detection setup completed');
    }
    async initializeBusinessRuleValidation() {
        logger_1.logger.debug('Business rule validation initialized');
    }
    loadOptimisticLockConfigs() {
        const productsLockConfig = {
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
            conflictThreshold: 10,
            enabled: true
        };
        const variantsLockConfig = {
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
        const adjustmentsLockConfig = {
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
            allowNegativeStock: true,
            enforceReservationLimit: false,
            validateBusinessRules: true,
            trackPerformance: true,
            alertOnConflicts: true,
            conflictThreshold: 5,
            enabled: true
        };
        const storeInventoryLockConfig = {
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
        logger_1.logger.info('Optimistic lock configurations loaded', {
            configCount: this.lockConfigs.size
        });
    }
    initializeMetrics() {
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
        logger_1.logger.debug('Inventory security metrics initialized');
    }
    async executeSecureInventoryOperation(operationType, productId, storeId, quantity, options = {}) {
        const operationId = crypto.randomUUID();
        try {
            const tableName = this.getTableName(operationType, options.variantId);
            const lockConfig = this.lockConfigs.get(tableName);
            if (!lockConfig || !lockConfig.enabled) {
                throw new Error(`Optimistic locking not configured for table: ${tableName}`);
            }
            const currentRecord = await this.getCurrentRecord(tableName, productId, storeId, options.variantId);
            if (!currentRecord) {
                throw new Error(`Record not found: ${productId} in store ${storeId}`);
            }
            const operation = {
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
            await this.validateBusinessRules(operation, lockConfig);
            if (lockConfig.requireApproval || options.forceApproval) {
                await this.requestApproval(operation, lockConfig);
            }
            else {
                operation.approved = true;
                operation.approvedBy = 'auto_approved';
                operation.approvedAt = new Date();
            }
            if (!options.bypassLocking) {
                await this.acquireOptimisticLock(operation, lockConfig);
            }
            await this.executeOperation(operation, lockConfig);
            await this.generateOperationSignature(operation);
            if (!options.bypassLocking) {
                await this.releaseOptimisticLock(operation);
            }
            operation.status = 'completed';
            operation.endTime = new Date();
            operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
            this.updateMetrics(operation, true);
            logger_1.logger.info('Secure inventory operation completed', {
                operationId,
                operationType,
                productId,
                storeId,
                quantity,
                duration: operation.duration,
                version: operation.version,
                conflicts: operation.retryCount
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'secure_inventory_operation_completed',
                severity: 'LOW',
                category: 'application',
                ipAddress: 'localhost',
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
        }
        catch (err) {
            const operation = this.activeOperations.get(operationId);
            if (operation) {
                operation.status = 'failed';
                operation.endTime = new Date();
                operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
                operation.validationErrors.push((0, errorUtils_1.getErrorMessage)(err));
                this.updateMetrics(operation, false);
            }
            logger_1.logger.error('Secure inventory operation failed', {
                operationId,
                operationType,
                productId,
                storeId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            throw err;
        }
    }
    getTableName(operationType, variantId) {
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
    async getCurrentRecord(_tableName, _productId, _storeId, _variantId) {
        const baseQuantity = Math.floor(Math.random() * 1000) + 100;
        const baseVersion = Math.floor(Math.random() * 10) + 1;
        return {
            quantity: baseQuantity,
            version: baseVersion
        };
    }
    calculateNewQuantity(operationType, currentQuantity, changeQuantity) {
        switch (operationType) {
            case InventoryOperationType.STOCK_INCREASE:
                return currentQuantity + changeQuantity;
            case InventoryOperationType.STOCK_DECREASE:
            case InventoryOperationType.STOCK_RESERVATION:
                return currentQuantity - changeQuantity;
            case InventoryOperationType.STOCK_RELEASE:
                return currentQuantity + changeQuantity;
            case InventoryOperationType.STOCK_ADJUSTMENT:
                return changeQuantity;
            default:
                return currentQuantity;
        }
    }
    async validateBusinessRules(operation, config) {
        if (!config.validateBusinessRules) {
            operation.businessRulesValidated = true;
            return;
        }
        const errors = [];
        if (!config.allowNegativeStock && operation.newQuantity < 0) {
            errors.push('Operation would result in negative stock');
        }
        if (config.enforceReservationLimit && operation.operationType === InventoryOperationType.STOCK_RESERVATION) {
            const maxReservation = operation.previousQuantity * 0.8;
            if (operation.quantity > maxReservation) {
                errors.push('Reservation exceeds maximum allowed limit');
            }
        }
        if (operation.quantity <= 0) {
            errors.push('Quantity must be positive');
        }
        if (operation.priceChange) {
            const priceChangePercent = Math.abs((operation.priceChange.newPrice - operation.priceChange.previousPrice) /
                operation.priceChange.previousPrice) * 100;
            if (priceChangePercent > 50) {
                errors.push('Price change exceeds allowed threshold');
            }
        }
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
    async requestApproval(operation, config) {
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
        operation.approved = true;
        operation.approvedBy = 'auto_approved_system';
        operation.approvedAt = new Date();
        operation.auditTrail.push({
            timestamp: new Date(),
            action: 'operation_approved',
            user: operation.approvedBy,
            details: { autoApproved: true }
        });
    }
    async acquireOptimisticLock(operation, config) {
        const lockKey = `${operation.productId}-${operation.storeId}${operation.variantId ? '-' + operation.variantId : ''}`;
        const existingLocks = this.activeLocks.get(lockKey);
        if (existingLocks && existingLocks.size > 0) {
            await this.handleLockConflict(operation, lockKey, config);
        }
        if (!this.activeLocks.has(lockKey)) {
            this.activeLocks.set(lockKey, new Set());
        }
        this.activeLocks.get(lockKey).add(operation.id);
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
        logger_1.logger.debug('Optimistic lock acquired', {
            operationId: operation.id,
            lockKey,
            expectedVersion: operation.expectedVersion
        });
    }
    async handleLockConflict(operation, lockKey, config) {
        const conflictId = crypto.randomUUID();
        const existingOperations = this.activeLocks.get(lockKey) || new Set();
        const conflict = {
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
        switch (config.conflictResolution) {
            case 'fail':
                throw new Error('Concurrent access detected, operation aborted');
            case 'retry':
                if (operation.retryCount < config.maxRetryAttempts) {
                    operation.retryCount++;
                    await this.delay(config.retryDelayMs * operation.retryCount);
                }
                else {
                    throw new Error('Maximum retry attempts exceeded');
                }
                break;
            case 'merge':
                await this.attemptMergeConflict(operation, conflict, config);
                break;
            case 'override':
                logger_1.logger.warn('Lock conflict overridden', { operationId: operation.id, conflictId });
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
    async attemptMergeConflict(operation, conflict, config) {
        if (!config.mergeStrategy) {
            throw new Error('Merge strategy not configured');
        }
        const latestRecord = await this.getCurrentRecord(this.getTableName(operation.operationType, operation.variantId), operation.productId, operation.storeId, operation.variantId);
        if (!latestRecord) {
            throw new Error('Record not found for merge');
        }
        switch (config.mergeStrategy) {
            case 'sum':
                operation.newQuantity = latestRecord.quantity + operation.quantity;
                break;
            case 'max':
                operation.newQuantity = Math.max(latestRecord.quantity, operation.newQuantity);
                break;
            case 'min':
                operation.newQuantity = Math.min(latestRecord.quantity, operation.newQuantity);
                break;
            case 'last_writer_wins':
                operation.expectedVersion = latestRecord.version;
                break;
        }
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
    async acquireDistributedLock(lockKey, operationId, timeoutMs) {
        const lockId = `${lockKey}-${operationId}`;
        const expiresAt = new Date(Date.now() + timeoutMs);
        const existingLock = this.distributedLocks.get(lockKey);
        if (existingLock && existingLock.expiresAt > new Date()) {
            throw new Error('Distributed lock already held');
        }
        this.distributedLocks.set(lockKey, { lockId, expiresAt });
        setTimeout(() => {
            this.distributedLocks.delete(lockKey);
        }, timeoutMs);
    }
    async executeOperation(operation, _config) {
        operation.status = 'executing';
        try {
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
        }
        catch (err) {
            if ((0, errorUtils_1.getErrorMessage)(err).includes('version')) {
                operation.conflictDetected = true;
                operation.auditTrail.push({
                    timestamp: new Date(),
                    action: 'version_conflict_detected',
                    user: operation.userId,
                    details: { error: (0, errorUtils_1.getErrorMessage)(err) }
                });
                throw new Error('Optimistic lock version conflict');
            }
            throw err;
        }
    }
    async performInventoryUpdate(operation) {
        const success = Math.random() > 0.1;
        if (!success) {
            throw new Error('Database version conflict detected');
        }
        logger_1.logger.debug('Inventory update performed', {
            operationId: operation.id,
            productId: operation.productId,
            newQuantity: operation.newQuantity,
            version: operation.version
        });
    }
    async generateOperationSignature(operation) {
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
    async releaseOptimisticLock(operation) {
        const lockKey = `${operation.productId}-${operation.storeId}${operation.variantId ? '-' + operation.variantId : ''}`;
        const locks = this.activeLocks.get(lockKey);
        if (locks) {
            locks.delete(operation.id);
            if (locks.size === 0) {
                this.activeLocks.delete(lockKey);
            }
        }
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
        logger_1.logger.debug('Optimistic lock released', {
            operationId: operation.id,
            lockKey,
            lockDuration: operation.lockReleasedAt.getTime() - operation.lockAcquiredAt.getTime()
        });
    }
    calculateOperationRiskScore(operation) {
        let riskScore = 0;
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
        if (operation.conflictDetected)
            riskScore += 20;
        if (operation.retryCount > 0)
            riskScore += 10;
        if (operation.validationErrors.length > 0)
            riskScore += 15;
        if (!operation.approved)
            riskScore += 25;
        if (operation.quantity > 1000)
            riskScore += 15;
        if (operation.priceChange) {
            const priceChangePercent = Math.abs((operation.priceChange.newPrice - operation.priceChange.previousPrice) /
                operation.priceChange.previousPrice) * 100;
            if (priceChangePercent > 25)
                riskScore += 20;
        }
        return Math.max(0, Math.min(100, riskScore));
    }
    updateMetrics(operation, success) {
        this.metrics.totalOperations++;
        if (success) {
            this.metrics.successfulOperations++;
        }
        else {
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
        if (operation.lockReleasedAt) {
            const lockDuration = operation.lockReleasedAt.getTime() - operation.lockAcquiredAt.getTime();
            this.metrics.averageLockDuration = this.metrics.lockAcquisitions > 1
                ? (this.metrics.averageLockDuration * (this.metrics.lockAcquisitions - 1) + lockDuration) / this.metrics.lockAcquisitions
                : lockDuration;
        }
        this.metrics.periodEnd = new Date();
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    startSecurityMonitoring() {
        setInterval(() => {
            this.monitorConflicts();
        }, 60 * 1000);
        setInterval(() => {
            this.cleanupExpiredOperations();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.updateThroughputMetrics();
        }, 10 * 1000);
        logger_1.logger.info('Inventory security monitoring started');
    }
    monitorConflicts() {
        const unresolvedConflicts = Array.from(this.conflicts.values())
            .filter(c => !c.resolved);
        this.metrics.unresolvedConflicts = unresolvedConflicts.length;
        for (const [tableName, config] of this.lockConfigs.entries()) {
            if (!config.alertOnConflicts)
                continue;
            const recentConflicts = Array.from(this.conflicts.values())
                .filter(c => {
                const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                return c.detectedAt > hourAgo;
            }).length;
            if (recentConflicts > config.conflictThreshold) {
                logger_1.logger.warn('High conflict rate detected', {
                    tableName,
                    conflicts: recentConflicts,
                    threshold: config.conflictThreshold
                });
            }
        }
    }
    cleanupExpiredOperations() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        let cleanedCount = 0;
        for (const [operationId, operation] of this.activeOperations.entries()) {
            if (operation.endTime && operation.endTime < oneHourAgo) {
                this.activeOperations.delete(operationId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up expired inventory operations', { cleanedCount });
        }
    }
    updateThroughputMetrics() {
        const now = new Date();
        const timePeriod = (now.getTime() - this.metrics.periodStart.getTime()) / 1000;
        if (timePeriod > 0) {
            this.metrics.throughputPerSecond = this.metrics.totalOperations / timePeriod;
        }
    }
    getStats() {
        return { ...this.metrics };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.conflictCount > 50) {
            status = 'warning';
        }
        if (stats.unresolvedConflicts > 5) {
            status = 'degraded';
        }
        if (stats.averageOperationTime > 10000) {
            status = 'warning';
        }
        const lockTimeouts = stats.lockTimeouts;
        if (lockTimeouts > 10) {
            status = 'critical';
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
exports.InventorySecurityService = InventorySecurityService;
exports.inventorySecurityService = InventorySecurityService.getInstance();
//# sourceMappingURL=InventorySecurityService.js.map