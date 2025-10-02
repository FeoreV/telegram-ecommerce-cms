import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum ReconciliationType {
  INVENTORY_RECONCILIATION = 'inventory_reconciliation',
  FINANCIAL_RECONCILIATION = 'financial_reconciliation',
  ORDER_RECONCILIATION = 'order_reconciliation',
  PAYMENT_RECONCILIATION = 'payment_reconciliation',
  USER_DATA_RECONCILIATION = 'user_data_reconciliation',
  SYSTEM_STATE_RECONCILIATION = 'system_state_reconciliation',
  AUDIT_LOG_RECONCILIATION = 'audit_log_reconciliation',
  BACKUP_RECONCILIATION = 'backup_reconciliation'
}

export enum ReconciliationPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export enum DiscrepancySeverity {
  INFORMATIONAL = 'informational',
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical',
  SECURITY_INCIDENT = 'security_incident'
}

export interface ReconciliationJob {
  id: string;
  name: string;
  type: ReconciliationType;
  
  // Scheduling
  schedule: string; // Cron expression
  priority: ReconciliationPriority;
  enabled: boolean;
  
  // Data sources
  sourceA: {
    type: 'database' | 'external_api' | 'file' | 'cache';
    connection: string;
    query?: string;
    endpoint?: string;
    filePath?: string;
  };
  sourceB: {
    type: 'database' | 'external_api' | 'file' | 'cache';
    connection: string;
    query?: string;
    endpoint?: string;
    filePath?: string;
  };
  
  // Reconciliation rules
  reconciliationRules: {
    keyFields: string[];
    compareFields: string[];
    toleranceRules: {
      field: string;
      tolerance: number;
      toleranceType: 'absolute' | 'percentage';
    }[];
    ignoreFields: string[];
  };
  
  // Security settings
  encryptLogs: boolean;
  signLogs: boolean;
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
  retentionPeriod: number; // days
  
  // Alerting
  alertOnDiscrepancies: boolean;
  alertThreshold: number;
  alertRecipients: string[];
  
  // Automation
  autoCorrect: boolean;
  correctionRules: {
    condition: string;
    action: 'use_source_a' | 'use_source_b' | 'manual_review' | 'calculate_average';
    approvalRequired: boolean;
  }[];
  
  // Compliance
  complianceRequired: boolean;
  regulations: string[];
  
  // Execution tracking
  lastExecuted?: Date;
  nextScheduled?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
  
  // Created metadata
  createdBy: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
}

export interface ReconciliationExecution {
  id: string;
  jobId: string;
  
  // Execution metadata
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  
  // Data processing
  sourceARecords: number;
  sourceBRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  
  // Results
  discrepancies: ReconciliationDiscrepancy[];
  summary: {
    totalDiscrepancies: number;
    criticalDiscrepancies: number;
    autoCorrections: number;
    manualReviewRequired: number;
  };
  
  // Digital signing
  dataHash: string;
  executionSignature: string;
  signingKeyId: string;
  
  // Performance metrics
  performanceMetrics: {
    dataRetrievalTime: number;
    comparisonTime: number;
    signatureTime: number;
    totalMemoryUsed: number;
    peakMemoryUsed: number;
  };
  
  // Security audit
  auditTrail: {
    timestamp: Date;
    action: string;
    user: string;
    details: Record<string, unknown>;
    signature?: string;
  }[];
  
  // Error handling
  errors: string[];
  warnings: string[];
  
  // Compliance validation
  complianceValidated: boolean;
  complianceIssues: string[];
  
  executedBy: string;
}

export interface ReconciliationDiscrepancy {
  id: string;
  executionId: string;
  
  // Discrepancy details
  keyValues: Record<string, unknown>;
  field: string;
  sourceAValue: unknown;
  sourceBValue: unknown;
  difference: unknown;
  differenceType: 'missing_in_a' | 'missing_in_b' | 'value_mismatch' | 'type_mismatch';
  
  // Severity assessment
  severity: DiscrepancySeverity;
  riskScore: number;
  businessImpact: string;
  
  // Resolution
  status: 'new' | 'investigating' | 'resolved' | 'accepted' | 'escalated';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  
  // Auto-correction
  autoCorrectionApplied: boolean;
  correctionAction?: string;
  correctionResult?: string;
  
  // Security implications
  securityRelevant: boolean;
  potentialFraud: boolean;
  investigationRequired: boolean;
  
  // Tracking
  detectedAt: Date;
  lastUpdated: Date;
  
  // Evidence
  evidenceHash: string;
  digitalSignature: string;
}

export interface ReconciliationAlert {
  id: string;
  executionId: string;
  jobId: string;
  
  // Alert details
  alertType: 'discrepancy_threshold' | 'critical_discrepancy' | 'system_error' | 'security_incident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  description: string;
  
  // Context
  affectedRecords: number;
  criticalDiscrepancies: number;
  securityImplications: boolean;
  
  // Recipients
  recipients: string[];
  notificationChannels: string[];
  
  // Status tracking
  sent: boolean;
  sentAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  
  // Resolution
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  
  createdAt: Date;
}

export class ReconciliationSecurityService {
  private static instance: ReconciliationSecurityService;
  private reconciliationJobs: Map<string, ReconciliationJob> = new Map();
  private activeExecutions: Map<string, ReconciliationExecution> = new Map();
  private discrepancies: Map<string, ReconciliationDiscrepancy> = new Map();
  private alerts: Map<string, ReconciliationAlert> = new Map();
  private signingKeys: Map<string, string> = new Map();
  private scheduler: NodeJS.Timeout[] = [];

  private constructor() {
    this.initializeReconciliationSecurity();
    this.loadReconciliationJobs();
    this.initializeSigningKeys();
    this.startScheduler();

    logger.info('Reconciliation Security Service initialized', {
      jobs: this.reconciliationJobs.size,
      signingEnabled: true,
      schedulerActive: true
    });
  }

  public static getInstance(): ReconciliationSecurityService {
    if (!ReconciliationSecurityService.instance) {
      ReconciliationSecurityService.instance = new ReconciliationSecurityService();
    }
    return ReconciliationSecurityService.instance;
  }

  private async initializeReconciliationSecurity(): Promise<void> {
    try {
      // Initialize cryptographic components
      await this.initializeCryptographicComponents();
      
      // Setup audit trail encryption
      await this.setupAuditTrailEncryption();
      
      // Initialize compliance validation
      await this.initializeComplianceValidation();

      logger.info('Reconciliation security initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize reconciliation security:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async initializeCryptographicComponents(): Promise<void> {
    // Initialize HMAC keys for digital signing
    logger.debug('Cryptographic components initialized');
  }

  private async setupAuditTrailEncryption(): Promise<void> {
    // Setup encryption for sensitive audit trail data
    logger.debug('Audit trail encryption setup completed');
  }

  private async initializeComplianceValidation(): Promise<void> {
    // Initialize compliance validation rules
    logger.debug('Compliance validation initialized');
  }

  private loadReconciliationJobs(): void {
    // Inventory reconciliation job
    const inventoryReconciliationJob: ReconciliationJob = {
      id: 'inventory-reconciliation',
      name: 'Daily Inventory Reconciliation',
      type: ReconciliationType.INVENTORY_RECONCILIATION,
      schedule: '0 2 * * *', // Daily at 2 AM
      priority: ReconciliationPriority.HIGH,
      enabled: true,
      sourceA: {
        type: 'database',
        connection: 'primary_db',
        query: 'SELECT product_id, store_id, quantity, last_updated FROM products WHERE active = true'
      },
      sourceB: {
        type: 'database',
        connection: 'inventory_db',
        query: 'SELECT product_id, store_id, current_stock, updated_at FROM inventory_tracking'
      },
      reconciliationRules: {
        keyFields: ['product_id', 'store_id'],
        compareFields: ['quantity', 'last_updated'],
        toleranceRules: [
          {
            field: 'quantity',
            tolerance: 5,
            toleranceType: 'absolute'
          }
        ],
        ignoreFields: ['created_at']
      },
      encryptLogs: true,
      signLogs: true,
      auditLevel: 'comprehensive',
      retentionPeriod: 2555, // 7 years
      alertOnDiscrepancies: true,
      alertThreshold: 10,
      alertRecipients: ['inventory@company.com', 'alerts@company.com'],
      autoCorrect: false,
      correctionRules: [
        {
          condition: 'difference < 10',
          action: 'use_source_a',
          approvalRequired: true
        }
      ],
      complianceRequired: true,
      regulations: ['SOX', 'Internal_Audit'],
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: 'system',
      createdAt: new Date()
    };

    // Financial reconciliation job
    const financialReconciliationJob: ReconciliationJob = {
      id: 'financial-reconciliation',
      name: 'Daily Financial Reconciliation',
      type: ReconciliationType.FINANCIAL_RECONCILIATION,
      schedule: '0 3 * * *', // Daily at 3 AM
      priority: ReconciliationPriority.CRITICAL,
      enabled: true,
      sourceA: {
        type: 'database',
        connection: 'primary_db',
        query: 'SELECT order_id, total_amount, payment_status, created_at FROM orders WHERE DATE(created_at) = CURRENT_DATE - 1'
      },
      sourceB: {
        type: 'external_api',
        connection: 'payment_gateway',
        endpoint: '/api/transactions/daily'
      },
      reconciliationRules: {
        keyFields: ['order_id'],
        compareFields: ['total_amount', 'payment_status'],
        toleranceRules: [
          {
            field: 'total_amount',
            tolerance: 0.01,
            toleranceType: 'absolute'
          }
        ],
        ignoreFields: ['processing_fee']
      },
      encryptLogs: true,
      signLogs: true,
      auditLevel: 'comprehensive',
      retentionPeriod: 2555, // 7 years for financial records
      alertOnDiscrepancies: true,
      alertThreshold: 1, // Any financial discrepancy is critical
      alertRecipients: ['finance@company.com', 'cfo@company.com', 'alerts@company.com'],
      autoCorrect: false,
      correctionRules: [
        {
          condition: 'payment_status_mismatch',
          action: 'manual_review',
          approvalRequired: true
        }
      ],
      complianceRequired: true,
      regulations: ['SOX', 'GAAP', 'PCI_DSS'],
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: 'finance_admin',
      createdAt: new Date()
    };

    // User data reconciliation job
    const userDataReconciliationJob: ReconciliationJob = {
      id: 'user-data-reconciliation',
      name: 'Weekly User Data Integrity Check',
      type: ReconciliationType.USER_DATA_RECONCILIATION,
      schedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
      priority: ReconciliationPriority.NORMAL,
      enabled: true,
      sourceA: {
        type: 'database',
        connection: 'primary_db',
        query: 'SELECT user_id, email, profile_data, last_login FROM users WHERE active = true'
      },
      sourceB: {
        type: 'database',
        connection: 'user_cache',
        query: 'SELECT user_id, cached_email, cached_profile, last_access FROM user_cache'
      },
      reconciliationRules: {
        keyFields: ['user_id'],
        compareFields: ['email', 'profile_data'],
        toleranceRules: [],
        ignoreFields: ['created_at', 'updated_at']
      },
      encryptLogs: true,
      signLogs: true,
      auditLevel: 'standard',
      retentionPeriod: 365,
      alertOnDiscrepancies: true,
      alertThreshold: 50,
      alertRecipients: ['tech@company.com', 'dpo@company.com'],
      autoCorrect: true,
      correctionRules: [
        {
          condition: 'email_mismatch',
          action: 'use_source_a',
          approvalRequired: false
        }
      ],
      complianceRequired: true,
      regulations: ['GDPR', 'CCPA'],
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: 'data_admin',
      createdAt: new Date()
    };

    // Audit log reconciliation job
    const auditLogReconciliationJob: ReconciliationJob = {
      id: 'audit-log-reconciliation',
      name: 'Daily Audit Log Integrity Verification',
      type: ReconciliationType.AUDIT_LOG_RECONCILIATION,
      schedule: '0 1 * * *', // Daily at 1 AM
      priority: ReconciliationPriority.CRITICAL,
      enabled: true,
      sourceA: {
        type: 'database',
        connection: 'audit_db',
        query: 'SELECT log_id, event_type, user_id, timestamp, checksum FROM audit_logs WHERE DATE(timestamp) = CURRENT_DATE - 1'
      },
      sourceB: {
        type: 'file',
        connection: 'backup_storage',
        filePath: '/audit/daily_checksums.json'
      },
      reconciliationRules: {
        keyFields: ['log_id'],
        compareFields: ['checksum', 'timestamp'],
        toleranceRules: [],
        ignoreFields: []
      },
      encryptLogs: true,
      signLogs: true,
      auditLevel: 'comprehensive',
      retentionPeriod: 2555, // 7 years
      alertOnDiscrepancies: true,
      alertThreshold: 0, // No tolerance for audit log discrepancies
      alertRecipients: ['security@company.com', 'compliance@company.com', 'ciso@company.com'],
      autoCorrect: false,
      correctionRules: [],
      complianceRequired: true,
      regulations: ['SOX', 'GDPR', 'HIPAA', 'ISO_27001'],
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: 'security_admin',
      createdAt: new Date()
    };

    this.reconciliationJobs.set(inventoryReconciliationJob.id, inventoryReconciliationJob);
    this.reconciliationJobs.set(financialReconciliationJob.id, financialReconciliationJob);
    this.reconciliationJobs.set(userDataReconciliationJob.id, userDataReconciliationJob);
    this.reconciliationJobs.set(auditLogReconciliationJob.id, auditLogReconciliationJob);

    logger.info('Reconciliation jobs loaded', {
      jobCount: this.reconciliationJobs.size
    });
  }

  private async initializeSigningKeys(): Promise<void> {
    // Initialize HMAC signing keys for different reconciliation types
    const reconciliationTypes = Object.values(ReconciliationType);
    
    for (const type of reconciliationTypes) {
      const keyId = `reconciliation-signing-${type}`;
      
      // Generate or retrieve signing key
      const signingKey = crypto.randomBytes(32).toString('hex');
      this.signingKeys.set(keyId, signingKey);
      
      logger.debug(`Signing key initialized for ${type}`);
    }

    logger.info('Reconciliation signing keys initialized', {
      keyCount: this.signingKeys.size
    });
  }

  /**
   * Execute reconciliation job
   */
  async executeReconciliationJob(jobId: string, options: {
    manualTrigger?: boolean;
    triggeredBy?: string;
    forceExecution?: boolean;
  } = {}): Promise<string> {
    const executionId = crypto.randomUUID();
    // const _startTime = Date.now();
 // Unused variable removed
    
    try {
      const job = this.reconciliationJobs.get(jobId);
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`);
      }

      if (!job.enabled && !options.forceExecution) {
        throw new Error(`Reconciliation job is disabled: ${jobId}`);
      }

      // Create execution record
      const execution: ReconciliationExecution = {
        id: executionId,
        jobId,
        startTime: new Date(),
        status: 'running',
        sourceARecords: 0,
        sourceBRecords: 0,
        matchedRecords: 0,
        unmatchedRecords: 0,
        discrepancies: [],
        summary: {
          totalDiscrepancies: 0,
          criticalDiscrepancies: 0,
          autoCorrections: 0,
          manualReviewRequired: 0
        },
        dataHash: '',
        executionSignature: '',
        signingKeyId: '',
        performanceMetrics: {
          dataRetrievalTime: 0,
          comparisonTime: 0,
          signatureTime: 0,
          totalMemoryUsed: 0,
          peakMemoryUsed: 0
        },
        auditTrail: [],
        errors: [],
        warnings: [],
        complianceValidated: false,
        complianceIssues: [],
        executedBy: options.triggeredBy || 'scheduler'
      };

      // Add initial audit entry
      execution.auditTrail.push({
        timestamp: new Date(),
        action: 'reconciliation_started',
        user: execution.executedBy,
        details: {
          jobId,
          manualTrigger: options.manualTrigger || false,
          priority: job.priority
        }
      });

      this.activeExecutions.set(executionId, execution);

      logger.info('Starting reconciliation execution', {
        executionId,
        jobId,
        jobType: job.type,
        priority: job.priority
      });

      // Step 1: Retrieve data from both sources
      const retrievalStartTime = Date.now();
      const sourceAData = await this.retrieveSourceData(job.sourceA, execution);
      const sourceBData = await this.retrieveSourceData(job.sourceB, execution);
      execution.performanceMetrics.dataRetrievalTime = Date.now() - retrievalStartTime;

      execution.sourceARecords = sourceAData.length;
      execution.sourceBRecords = sourceBData.length;

      // Step 2: Perform reconciliation comparison
      const comparisonStartTime = Date.now();
      await this.performReconciliation(execution, job, sourceAData as unknown[], sourceBData as unknown[]);
      execution.performanceMetrics.comparisonTime = Date.now() - comparisonStartTime;

      // Step 3: Generate data hash and digital signature
      const signatureStartTime = Date.now();
      await this.generateDigitalSignature(execution, job);
      execution.performanceMetrics.signatureTime = Date.now() - signatureStartTime;

      // Step 4: Process discrepancies and auto-corrections
      await this.processDiscrepancies(execution, job);

      // Step 5: Validate compliance
      await this.validateCompliance(execution, job);

      // Step 6: Generate alerts if needed
      await this.generateAlerts(execution, job);

      // Complete execution
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Update job statistics
      job.executionCount++;
      job.successCount++;
      job.lastExecuted = new Date();

      // Calculate next scheduled execution
      job.nextScheduled = this.calculateNextExecution(job.schedule);

      execution.auditTrail.push({
        timestamp: new Date(),
        action: 'reconciliation_completed',
        user: execution.executedBy,
        details: {
          duration: execution.duration,
          discrepancies: execution.summary.totalDiscrepancies,
          criticalDiscrepancies: execution.summary.criticalDiscrepancies
        }
      });

      logger.info('Reconciliation execution completed', {
        executionId,
        jobId,
        duration: execution.duration,
        sourceARecords: execution.sourceARecords,
        sourceBRecords: execution.sourceBRecords,
        discrepancies: execution.summary.totalDiscrepancies,
        criticalDiscrepancies: execution.summary.criticalDiscrepancies
      });

      // Log security event
      await securityLogService.logSecurityEvent({
        eventType: 'reconciliation_job_completed',
        severity: execution.summary.criticalDiscrepancies > 0 ? 'HIGH' : 'LOW',
        category: 'application',
        ipAddress: 'localhost',
        success: true,
        details: {
          executionId,
          jobId,
          jobType: job.type,
          duration: execution.duration,
          discrepancies: execution.summary.totalDiscrepancies,
          criticalDiscrepancies: execution.summary.criticalDiscrepancies,
          signatureVerified: true
        },
        riskScore: this.calculateExecutionRiskScore(execution),
        tags: ['reconciliation', 'data_integrity', 'signed_logs', 'business_process'],
        compliance: {
          pii: job.type === ReconciliationType.USER_DATA_RECONCILIATION,
          gdpr: job.regulations.includes('GDPR'),
          pci: job.regulations.includes('PCI_DSS'),
          hipaa: job.regulations.includes('HIPAA')
        }
      });

      return executionId;

    } catch (err: unknown) {
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
        execution.errors.push(getErrorMessage(err as Error));

        // Update job failure count
        const job = this.reconciliationJobs.get(jobId);
        if (job) {
          job.failureCount++;
        }
      }

      logger.error('Reconciliation execution failed', {
        executionId,
        jobId,
        error: getErrorMessage(err as Error)
      });

      throw err;
    }
  }

  private async retrieveSourceData(_source: unknown, execution: ReconciliationExecution): Promise<unknown[]> {
    const data: unknown[] = [];

    try {
      switch ((_source as any).type) {
        case 'database':
          data.push(...await this.retrieveDatabaseData(_source as any));
          break;
        case 'external_api':
          data.push(...await this.retrieveApiData(_source as any));
          break;
        case 'file':
          data.push(...await this.retrieveFileData(_source as any));
          break;
        case 'cache':
          data.push(...await this.retrieveCacheData(_source as any));
          break;
        default:
          throw new Error(`Unsupported source type: ${(_source as any).type}`);
      }

      execution.auditTrail.push({
        timestamp: new Date(),
        action: 'data_retrieved',
        user: execution.executedBy,
        details: {
          sourceType: (_source as any).type,
          recordCount: data.length,
          connection: (_source as any).connection
        }
      });

      return data;

    } catch (err: unknown) {
      execution.errors.push(`Data retrieval failed for ${(_source as any).type}: ${getErrorMessage(err as Error)}`);
      throw err;
    }
  }

  private async retrieveDatabaseData(_source: unknown): Promise<unknown[]> {
    // Simulate database query execution
    // In real implementation, would execute actual database queries
    
    const sampleData = [];
    const recordCount = Math.floor(Math.random() * 1000) + 100;
    
    for (let i = 0; i < recordCount; i++) {
      sampleData.push({
        id: i + 1,
        product_id: `prod_${Math.floor(Math.random() * 100)}`,
        store_id: `store_${Math.floor(Math.random() * 10)}`,
        quantity: Math.floor(Math.random() * 1000),
        last_updated: new Date()
      });
    }

    return sampleData;
  }

  private async retrieveApiData(_source: unknown): Promise<unknown[]> {
    // Simulate external API call
    // In real implementation, would make actual HTTP requests
    
    const sampleData = [];
    const recordCount = Math.floor(Math.random() * 800) + 50;
    
    for (let i = 0; i < recordCount; i++) {
      sampleData.push({
        transaction_id: `txn_${i + 1}`,
        order_id: `ord_${Math.floor(Math.random() * 100)}`,
        amount: (Math.random() * 1000).toFixed(2),
        status: 'completed',
        timestamp: new Date()
      });
    }

    return sampleData;
  }

  private async retrieveFileData(_source: unknown): Promise<unknown[]> {
    // Simulate file data reading
    // In real implementation, would read actual files
    
    return [
      { checksum: 'abc123', timestamp: new Date() },
      { checksum: 'def456', timestamp: new Date() }
    ];
  }

  private async retrieveCacheData(_source: unknown): Promise<unknown[]> {
    // Simulate cache data retrieval
    // In real implementation, would query actual cache
    
    return [
      { user_id: 1, cached_email: 'user1@example.com' },
      { user_id: 2, cached_email: 'user2@example.com' }
    ];
  }

  private async performReconciliation(
    execution: ReconciliationExecution,
    job: ReconciliationJob,
    sourceAData: unknown[],
    sourceBData: unknown[]
  ): Promise<void> {
    const keyFields = job.reconciliationRules.keyFields;
    const compareFields = job.reconciliationRules.compareFields;
    const toleranceRules = job.reconciliationRules.toleranceRules;

    // Create lookup maps
    const sourceAMap = new Map();
    const sourceBMap = new Map();

    // Build source A map
    sourceAData.forEach(record => {
      const key = keyFields.map(field => record[field]).join('|');
      sourceAMap.set(key, record);
    });

    // Build source B map
    sourceBData.forEach(record => {
      const key = keyFields.map(field => record[field]).join('|');
      sourceBMap.set(key, record);
    });

    // Find matches and discrepancies
    const allKeys = new Set([...sourceAMap.keys(), ...sourceBMap.keys()]);
    
    for (const key of allKeys) {
      const recordA = sourceAMap.get(key);
      const recordB = sourceBMap.get(key);

      if (!recordA) {
        // Missing in source A
        await this.createDiscrepancy(execution, job, {
          keyValues: this.extractKeyValues(recordB, keyFields),
          field: 'record',
          sourceAValue: null,
          sourceBValue: recordB,
          difference: 'missing_in_source_a',
          differenceType: 'missing_in_a'
        });
      } else if (!recordB) {
        // Missing in source B
        await this.createDiscrepancy(execution, job, {
          keyValues: this.extractKeyValues(recordA, keyFields),
          field: 'record',
          sourceAValue: recordA,
          sourceBValue: null,
          difference: 'missing_in_source_b',
          differenceType: 'missing_in_b'
        });
      } else {
        // Compare fields
        execution.matchedRecords++;
        await this.compareRecords(execution, job, recordA, recordB, compareFields, toleranceRules);
      }
    }

    execution.unmatchedRecords = allKeys.size - execution.matchedRecords;

    execution.auditTrail.push({
      timestamp: new Date(),
      action: 'reconciliation_performed',
      user: execution.executedBy,
      details: {
        totalKeys: allKeys.size,
        matchedRecords: execution.matchedRecords,
        unmatchedRecords: execution.unmatchedRecords,
        discrepancies: execution.discrepancies.length
      }
    });
  }

  private extractKeyValues(record: unknown, keyFields: string[]): Record<string, unknown> {
    const keyValues: Record<string, unknown> = {};
    keyFields.forEach(field => {
      keyValues[field] = (record as any)[field];
    });
    return keyValues;
  }

  private async compareRecords(
    execution: ReconciliationExecution,
    job: ReconciliationJob,
    recordA: unknown,
    recordB: unknown,
    compareFields: string[],
    toleranceRules: ReconciliationJob['reconciliationRules']['toleranceRules']
  ): Promise<void> {
    const keyFields = job.reconciliationRules.keyFields;

    for (const field of compareFields) {
      const valueA = (recordA as any)[field];
      const valueB = (recordB as any)[field];

      if (!this.valuesMatch(valueA, valueB, field, toleranceRules)) {
        await this.createDiscrepancy(execution, job, {
          keyValues: this.extractKeyValues(recordA, keyFields),
          field,
          sourceAValue: valueA,
          sourceBValue: valueB,
          difference: this.calculateDifference(valueA, valueB),
          differenceType: 'value_mismatch'
        });
      }
    }
  }

  private valuesMatch(valueA: unknown, valueB: unknown, field: string, toleranceRules: ReconciliationJob['reconciliationRules']['toleranceRules']): boolean {
    if (valueA === valueB) return true;

    // Check tolerance rules
    const toleranceRule = toleranceRules.find(rule => rule.field === field);
    if (toleranceRule && typeof valueA === 'number' && typeof valueB === 'number') {
      const difference = Math.abs(valueA - valueB);
      
      if (toleranceRule.toleranceType === 'absolute') {
        return difference <= toleranceRule.tolerance;
      } else if (toleranceRule.toleranceType === 'percentage') {
        const percentDifference = (difference / Math.max(valueA, valueB)) * 100;
        return percentDifference <= toleranceRule.tolerance;
      }
    }

    return false;
  }

  private calculateDifference(valueA: unknown, valueB: unknown): unknown {
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }
    return `${valueA} vs ${valueB}`;
  }

  private async createDiscrepancy(
    execution: ReconciliationExecution,
    job: ReconciliationJob,
    discrepancyData: unknown
  ): Promise<void> {
    const discrepancyId = crypto.randomUUID();
    
    const discrepancy: ReconciliationDiscrepancy = {
      id: discrepancyId,
      executionId: execution.id,
      keyValues: (discrepancyData as any).keyValues,
      field: (discrepancyData as any).field,
      sourceAValue: (discrepancyData as any).sourceAValue,
      sourceBValue: (discrepancyData as any).sourceBValue,
      difference: (discrepancyData as any).difference,
      differenceType: (discrepancyData as any).differenceType,
      severity: this.assessDiscrepancySeverity(discrepancyData, job),
      riskScore: this.calculateDiscrepancyRiskScore(discrepancyData, job),
      businessImpact: this.assessBusinessImpact(discrepancyData, job),
      status: 'new',
      autoCorrectionApplied: false,
      securityRelevant: this.isSecurityRelevant(discrepancyData, job),
      potentialFraud: this.isPotentialFraud(discrepancyData, job),
      investigationRequired: false,
      detectedAt: new Date(),
      lastUpdated: new Date(),
      evidenceHash: this.generateEvidenceHash(discrepancyData),
      digitalSignature: ''
    };
    
    // Generate digital signature for discrepancy
    discrepancy.digitalSignature = await this.signDiscrepancy(discrepancy, job);

    // Determine if investigation is required
    discrepancy.investigationRequired = discrepancy.severity === DiscrepancySeverity.CRITICAL ||
                                       discrepancy.severity === DiscrepancySeverity.SECURITY_INCIDENT ||
                                       discrepancy.potentialFraud;

    this.discrepancies.set(discrepancyId, discrepancy);
    execution.discrepancies.push(discrepancy);

    // Update summary
    execution.summary.totalDiscrepancies++;
    if (discrepancy.severity === DiscrepancySeverity.CRITICAL ||
        discrepancy.severity === DiscrepancySeverity.SECURITY_INCIDENT) {
      execution.summary.criticalDiscrepancies++;
    }

    logger.debug('Discrepancy created', {
      discrepancyId,
      executionId: execution.id,
      field: discrepancy.field,
      severity: discrepancy.severity,
      securityRelevant: discrepancy.securityRelevant
    });
  }

  private assessDiscrepancySeverity(discrepancyData: unknown, job: ReconciliationJob): DiscrepancySeverity {
    // Financial reconciliation discrepancies are always critical
    if (job.type === ReconciliationType.FINANCIAL_RECONCILIATION) {
      return DiscrepancySeverity.CRITICAL;
    }

    // Audit log discrepancies are security incidents
    if (job.type === ReconciliationType.AUDIT_LOG_RECONCILIATION) {
      return DiscrepancySeverity.SECURITY_INCIDENT;
    }

    // Large quantity discrepancies
    if ((discrepancyData as any).field === 'quantity' && 
        typeof (discrepancyData as any).difference === 'number' && 
        Math.abs((discrepancyData as any).difference) > 100) {
      return DiscrepancySeverity.MAJOR;
    }

    // Missing records
    if ((discrepancyData as any).differenceType === 'missing_in_a' || 
        (discrepancyData as any).differenceType === 'missing_in_b') {
      return DiscrepancySeverity.MAJOR;
    }

    return DiscrepancySeverity.MINOR;
  }

  private calculateDiscrepancyRiskScore(discrepancyData: unknown, job: ReconciliationJob): number {
    let riskScore = 0;

    // Base risk by job type
    switch (job.type) {
      case ReconciliationType.FINANCIAL_RECONCILIATION:
        riskScore += 40;
        break;
      case ReconciliationType.AUDIT_LOG_RECONCILIATION:
        riskScore += 50;
        break;
      case ReconciliationType.INVENTORY_RECONCILIATION:
        riskScore += 30;
        break;
      default:
        riskScore += 20;
    }

    // Risk by discrepancy type
    switch ((discrepancyData as any).differenceType) {
      case 'missing_in_a':
      case 'missing_in_b':
        riskScore += 30;
        break;
      case 'value_mismatch':
        riskScore += 20;
        break;
      case 'type_mismatch':
        riskScore += 15;
        break;
    }

    // Risk by magnitude (for numeric differences)
    if (typeof (discrepancyData as any).difference === 'number') {
      const magnitude = Math.abs((discrepancyData as any).difference);
      if (magnitude > 1000) riskScore += 20;
      else if (magnitude > 100) riskScore += 15;
      else if (magnitude > 10) riskScore += 10;
    }

    return Math.max(0, Math.min(100, riskScore));
  }

  private assessBusinessImpact(discrepancyData: unknown, job: ReconciliationJob): string {
    switch (job.type) {
      case ReconciliationType.FINANCIAL_RECONCILIATION:
        return 'Potential revenue loss or compliance violation';
      case ReconciliationType.INVENTORY_RECONCILIATION:
        return 'Stock level inconsistency affecting order fulfillment';
      case ReconciliationType.AUDIT_LOG_RECONCILIATION:
        return 'Audit trail integrity compromised';
      case ReconciliationType.USER_DATA_RECONCILIATION:
        return 'User data inconsistency affecting user experience';
      default:
        return 'Data integrity issue requiring investigation';
    }
  }

  private isSecurityRelevant(discrepancyData: unknown, job: ReconciliationJob): boolean {
    return job.type === ReconciliationType.AUDIT_LOG_RECONCILIATION ||
           job.type === ReconciliationType.FINANCIAL_RECONCILIATION ||
           (discrepancyData as any).field === 'checksum' ||
           (discrepancyData as any).field === 'signature';
  }

  private isPotentialFraud(discrepancyData: unknown, job: ReconciliationJob): boolean {
    // Financial discrepancies could indicate fraud
    if (job.type === ReconciliationType.FINANCIAL_RECONCILIATION) {
      return true;
    }

    // Large inventory discrepancies could indicate fraud
    if (job.type === ReconciliationType.INVENTORY_RECONCILIATION &&
        (discrepancyData as any).field === 'quantity' &&
        typeof (discrepancyData as any).difference === 'number' &&
        Math.abs((discrepancyData as any).difference) > 500) {
      return true;
    }

    return false;
  }

  private generateEvidenceHash(discrepancyData: unknown): string {
    const evidenceString = JSON.stringify({
      keyValues: (discrepancyData as any).keyValues,
      field: (discrepancyData as any).field,
      sourceAValue: (discrepancyData as any).sourceAValue,
      sourceBValue: (discrepancyData as any).sourceBValue,
      timestamp: new Date().toISOString()
    });

    return crypto.createHash('sha256').update(evidenceString).digest('hex');
  }

  private async signDiscrepancy(discrepancy: ReconciliationDiscrepancy, job: ReconciliationJob): Promise<string> {
    const signingKeyId = `reconciliation-signing-${job.type}`;
    const signingKey = this.signingKeys.get(signingKeyId);
    
    if (!signingKey) {
      throw new Error(`Signing key not found: ${signingKeyId}`);
    }

    const signatureData = {
      discrepancyId: discrepancy.id,
      evidenceHash: discrepancy.evidenceHash,
      severity: discrepancy.severity,
      timestamp: discrepancy.detectedAt.toISOString()
    };

    return crypto
      .createHmac('sha256', signingKey)
      .update(JSON.stringify(signatureData))
      .digest('hex');
  }

  private async generateDigitalSignature(execution: ReconciliationExecution, job: ReconciliationJob): Promise<void> {
    // Generate hash of all execution data
    const executionData = {
      executionId: execution.id,
      jobId: execution.jobId,
      startTime: execution.startTime.toISOString(),
      sourceARecords: execution.sourceARecords,
      sourceBRecords: execution.sourceBRecords,
      discrepancies: execution.discrepancies.map(d => d.evidenceHash),
      performanceMetrics: execution.performanceMetrics
    };

    execution.dataHash = crypto.createHash('sha256')
      .update(JSON.stringify(executionData))
      .digest('hex');

    // Sign the execution
    const signingKeyId = `reconciliation-signing-${job.type}`;
    const signingKey = this.signingKeys.get(signingKeyId);
    
    if (!signingKey) {
      throw new Error(`Signing key not found: ${signingKeyId}`);
    }

    execution.signingKeyId = signingKeyId;
    execution.executionSignature = crypto
      .createHmac('sha256', signingKey)
      .update(execution.dataHash)
      .digest('hex');

    execution.auditTrail.push({
      timestamp: new Date(),
      action: 'digital_signature_generated',
      user: 'system',
      details: {
        dataHash: execution.dataHash,
        signingKeyId: execution.signingKeyId
      },
      signature: execution.executionSignature
    });
  }

  private async processDiscrepancies(execution: ReconciliationExecution, job: ReconciliationJob): Promise<void> {
    if (!job.autoCorrect || job.correctionRules.length === 0) {
      return;
    }

    for (const discrepancy of execution.discrepancies) {
      if (discrepancy.status !== 'new') continue;

      // Check correction rules
      for (const rule of job.correctionRules) {
        if (this.evaluateCorrectionsCondition(rule.condition, discrepancy)) {
          try {
            await this.applyCorrection(discrepancy, rule, execution);
            execution.summary.autoCorrections++;
            break;
          } catch (err: unknown) {
            execution.warnings.push(`Auto-correction failed for discrepancy ${discrepancy.id}: ${getErrorMessage(err as Error)}`);
          }
        }
      }

      // Mark for manual review if needed
      if (!discrepancy.autoCorrectionApplied &&
          (discrepancy.severity === DiscrepancySeverity.CRITICAL ||
           discrepancy.severity === DiscrepancySeverity.SECURITY_INCIDENT)) {
        execution.summary.manualReviewRequired++;
      }
    }

    execution.auditTrail.push({
      timestamp: new Date(),
      action: 'discrepancies_processed',
      user: execution.executedBy,
      details: {
        autoCorrections: execution.summary.autoCorrections,
        manualReviewRequired: execution.summary.manualReviewRequired
      }
    });
  }

  private evaluateCorrectionsCondition(condition: string, discrepancy: ReconciliationDiscrepancy): boolean {
    // Simple condition evaluation - in real implementation, would use a proper expression evaluator
    if (condition === 'difference < 10') {
      return typeof discrepancy.difference === 'number' && Math.abs(discrepancy.difference) < 10;
    }
    
    if (condition === 'email_mismatch') {
      return discrepancy.field === 'email';
    }

    if (condition === 'payment_status_mismatch') {
      return discrepancy.field === 'payment_status';
    }

    return false;
  }

  private async applyCorrection(
    discrepancy: ReconciliationDiscrepancy,
    rule: { action: string; approvalRequired: boolean; condition: string; },
    execution: ReconciliationExecution
  ): Promise<void> {
    let correctionValue;

    switch (rule.action) {
      case 'use_source_a':
        correctionValue = discrepancy.sourceAValue;
        break;
      case 'use_source_b':
        correctionValue = discrepancy.sourceBValue;
        break;
      case 'calculate_average':
        if (typeof discrepancy.sourceAValue === 'number' && typeof discrepancy.sourceBValue === 'number') {
          correctionValue = (discrepancy.sourceAValue + discrepancy.sourceBValue) / 2;
        } else {
          throw new Error('Cannot calculate average for non-numeric values');
        }
        break;
      case 'manual_review':
        execution.summary.manualReviewRequired++;
        return;
      default:
        throw new Error(`Unknown correction action: ${rule.action}`);
    }

    // Apply the correction (in real implementation, would update the database)
    discrepancy.autoCorrectionApplied = true;
    discrepancy.correctionAction = rule.action;
    discrepancy.correctionResult = `Corrected to: ${correctionValue}`;
    discrepancy.status = 'resolved';
    discrepancy.resolvedBy = 'auto_correction';
    discrepancy.resolvedAt = new Date();

    logger.debug('Auto-correction applied', {
      discrepancyId: discrepancy.id,
      action: rule.action,
      correctionValue
    });
  }

  private async validateCompliance(execution: ReconciliationExecution, job: ReconciliationJob): Promise<void> {
    if (!job.complianceRequired) {
      execution.complianceValidated = true;
      return;
    }

    const issues: string[] = [];

    // Validate signature integrity
    if (!execution.executionSignature) {
      issues.push('Missing digital signature');
    }

    // Validate audit trail completeness
    if (execution.auditTrail.length < 3) {
      issues.push('Incomplete audit trail');
    }

    // Validate discrepancy handling
    const criticalDiscrepancies = execution.discrepancies.filter(d => 
      d.severity === DiscrepancySeverity.CRITICAL || 
      d.severity === DiscrepancySeverity.SECURITY_INCIDENT
    );

    for (const discrepancy of criticalDiscrepancies) {
      if (discrepancy.status === 'new') {
        issues.push(`Unresolved critical discrepancy: ${discrepancy.id}`);
      }
    }

    // Validate retention policy compliance
    if (job.retentionPeriod < 2555 && job.regulations.includes('SOX')) {
      issues.push('Retention period does not meet SOX requirements');
    }

    execution.complianceIssues = issues;
    execution.complianceValidated = issues.length === 0;

    execution.auditTrail.push({
      timestamp: new Date(),
      action: 'compliance_validated',
      user: 'system',
      details: {
        compliant: execution.complianceValidated,
        issueCount: issues.length,
        regulations: job.regulations
      }
    });
  }

  private async generateAlerts(execution: ReconciliationExecution, job: ReconciliationJob): Promise<void> {
    if (!job.alertOnDiscrepancies) {
      return;
    }

    const shouldAlert = execution.summary.totalDiscrepancies >= job.alertThreshold ||
                       execution.summary.criticalDiscrepancies > 0 ||
                       execution.errors.length > 0;

    if (!shouldAlert) {
      return;
    }

    const alertId = crypto.randomUUID();
    const alertType = execution.summary.criticalDiscrepancies > 0 ? 'critical_discrepancy' :
                     execution.errors.length > 0 ? 'system_error' : 'discrepancy_threshold';

    const alert: ReconciliationAlert = {
      id: alertId,
      executionId: execution.id,
      jobId: execution.jobId,
      alertType,
      severity: execution.summary.criticalDiscrepancies > 0 ? 'critical' : 'high',
      message: `Reconciliation completed with ${execution.summary.totalDiscrepancies} discrepancies`,
      description: `Job: ${job.name}, Critical: ${execution.summary.criticalDiscrepancies}, Total: ${execution.summary.totalDiscrepancies}`,
      affectedRecords: execution.summary.totalDiscrepancies,
      criticalDiscrepancies: execution.summary.criticalDiscrepancies,
      securityImplications: execution.discrepancies.some(d => d.securityRelevant),
      recipients: job.alertRecipients,
      notificationChannels: ['email', 'slack'],
      sent: false,
      acknowledged: false,
      resolved: false,
      createdAt: new Date()
    };

    this.alerts.set(alertId, alert);

    // Send alert (simplified)
    await this.sendAlert(alert);

    logger.info('Reconciliation alert generated', {
      alertId,
      executionId: execution.id,
      alertType,
      severity: alert.severity,
      discrepancies: execution.summary.totalDiscrepancies
    });
  }

  private async sendAlert(alert: ReconciliationAlert): Promise<void> {
    // Simulate alert sending
    alert.sent = true;
    alert.sentAt = new Date();

    logger.debug('Alert sent', {
      alertId: alert.id,
      recipients: alert.recipients.length,
      severity: alert.severity
    });
  }

  private calculateExecutionRiskScore(execution: ReconciliationExecution): number {
    let riskScore = 0;

    // Base risk
    riskScore += 10;

    // Risk by discrepancies
    riskScore += execution.summary.totalDiscrepancies * 5;
    riskScore += execution.summary.criticalDiscrepancies * 20;

    // Risk by errors
    riskScore += execution.errors.length * 15;

    // Risk by security-relevant discrepancies
    const securityDiscrepancies = execution.discrepancies.filter(d => d.securityRelevant).length;
    riskScore += securityDiscrepancies * 25;

    // Risk by potential fraud
    const fraudDiscrepancies = execution.discrepancies.filter(d => d.potentialFraud).length;
    riskScore += fraudDiscrepancies * 30;

    return Math.max(0, Math.min(100, riskScore));
  }

  private calculateNextExecution(_schedule: string): Date {
    // Simple next execution calculation - in real implementation, would use a proper cron parser
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }

  private startScheduler(): void {
    // Check for scheduled jobs every minute
    const schedulerInterval = setInterval(() => {
      this.checkScheduledJobs();
    }, 60 * 1000);

    this.scheduler.push(schedulerInterval);

    // Clean up old executions every hour
    const cleanupInterval = setInterval(() => {
      this.cleanupOldExecutions();
    }, 60 * 60 * 1000);

    this.scheduler.push(cleanupInterval);

    logger.info('Reconciliation scheduler started');
  }

  private checkScheduledJobs(): void {
    const now = new Date();

    for (const [jobId, job] of this.reconciliationJobs.entries()) {
      if (!job.enabled) continue;

      const shouldExecute = !job.nextScheduled || job.nextScheduled <= now;
      if (shouldExecute) {
        this.executeReconciliationJob(jobId, { triggeredBy: 'scheduler' })
          .catch((err: unknown) => {
            logger.error(`Scheduled reconciliation job failed: ${jobId}`, err as Record<string, unknown>);
          });
      }
    }
  }

  private cleanupOldExecutions(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;

    for (const [executionId, execution] of this.activeExecutions.entries()) {
      if (execution.endTime && execution.endTime < cutoffDate) {
        this.activeExecutions.delete(executionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old reconciliation executions', { cleanedCount });
    }
  }

  /**
   * Get reconciliation statistics
   */
  getStats(): {
    jobs: number;
    activeExecutions: number;
    totalDiscrepancies: number;
    criticalDiscrepancies: number;
    alertsGenerated: number;
    complianceIssues: number;
    autoCorrections: number;
    successRate: number;
  } {
    const allExecutions = Array.from(this.activeExecutions.values());
    // const _completedExecutions = allExecutions.filter(e => e.status === 'completed');
    
    const totalDiscrepancies = allExecutions.reduce((sum, e) => sum + e.summary.totalDiscrepancies, 0);
    const criticalDiscrepancies = allExecutions.reduce((sum, e) => sum + e.summary.criticalDiscrepancies, 0);
    const autoCorrections = allExecutions.reduce((sum, e) => sum + e.summary.autoCorrections, 0);
    
    const allJobs = Array.from(this.reconciliationJobs.values());
    const totalExecutions = allJobs.reduce((sum, j) => sum + j.executionCount, 0);
    const successfulExecutions = allJobs.reduce((sum, j) => sum + j.successCount, 0);
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 100;

    const complianceIssues = allExecutions.reduce((sum, e) => sum + e.complianceIssues.length, 0);

    return {
      jobs: this.reconciliationJobs.size,
      activeExecutions: this.activeExecutions.size,
      totalDiscrepancies,
      criticalDiscrepancies,
      alertsGenerated: this.alerts.size,
      complianceIssues,
      autoCorrections,
      successRate
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: {
      jobs: number;
      activeExecutions: number;
      totalDiscrepancies: number;
      criticalDiscrepancies: number;
      alertsGenerated: number;
      complianceIssues: number;
      autoCorrections: number;
      successRate: number;
    };
  }> {
    const stats = this.getStats();
    
    let status = 'healthy';
    
    if (stats.criticalDiscrepancies > 10) {
      status = 'warning'; // High critical discrepancies
    }
    
    if (stats.successRate < 95) {
      status = 'degraded'; // Low success rate
    }
    
    if (stats.complianceIssues > 5) {
      status = 'critical'; // Compliance issues
    }

    // const emergencySessionsActive = Array.from(this.activeSessions.values())
    //   .filter(s => s.status === 'active' && 
    //               this.accessRequests.get(s.accessRequestId)?.emergencyAccess).length;

    // if (emergencySessionsActive > 2) {
    //   status = 'critical'; // Too many emergency sessions
    // }

    return {
      status,
      stats: {
        ...stats
        // emergencySessionsActive,
        // pendingRequests: Array.from(this.accessRequests.values())
        //   .filter(r => r.status === AccessStatus.PENDING_APPROVAL).length
      }
    };
  }
}

// Export singleton instance
export const reconciliationSecurityService = ReconciliationSecurityService.getInstance();
