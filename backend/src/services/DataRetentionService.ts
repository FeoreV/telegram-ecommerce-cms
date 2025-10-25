import * as crypto from 'crypto';
import { getErrorMessage } from '../utils/errorUtils';
import { sanitizeForLog } from '../utils/inputSanitizer';
import { logger } from '../utils/logger';
import { DataCategory, dataClassificationService, PrivacyRegulation } from './DataClassificationService';
import { securityLogService } from './SecurityLogService';

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  version: string;

  // Targeting criteria
  dataCategory: DataCategory[];
  tableName?: string;
  fieldName?: string;
  conditions: {
    age?: number;           // Days since creation
    lastAccess?: number;    // Days since last access
    userStatus?: 'active' | 'inactive' | 'deleted';
    purpose?: string[];     // Data processing purposes
    legalBasis?: string[];  // Legal basis for processing
  };

  // Retention rules
  retentionPeriod: number; // Days to retain
  gracePeriod: number;     // Additional days before deletion
  hardDelete: boolean;     // Permanent vs soft delete

  // Actions
  preDeleteActions: RetentionAction[];
  postDeleteActions: RetentionAction[];

  // Compliance
  regulations: PrivacyRegulation[];
  legalRequirement: boolean;
  auditRequired: boolean;

  // Execution
  enabled: boolean;
  schedule?: string;       // Cron expression
  priority: number;

  // Validation
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;

  // Monitoring
  lastExecuted?: Date;
  executionCount: number;
  deletionCount: number;
  errorCount: number;
}

export interface RetentionAction {
  type: 'backup' | 'archive' | 'notify' | 'audit' | 'anonymize' | 'export';
  description: string;
  configuration: Record<string, any>;
  required: boolean;
  order: number;
}

export interface RetentionJob {
  id: string;
  policyId: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';

  // Execution details
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // Results
  recordsEvaluated: number;
  recordsDeleted: number;
  recordsArchived: number;
  recordsSkipped: number;
  errors: string[];

  // Data subject notifications
  notificationsSent: number;
  notificationErrors: string[];

  // Audit information
  executedBy: string;
  approvalReference?: string;

  // Compliance validation
  complianceChecked: boolean;
  complianceIssues: string[];
}

export interface DataSubjectDeletionRequest {
  id: string;
  subjectId: string;
  subjectEmail: string;
  requestType: 'full_deletion' | 'partial_deletion' | 'anonymization';

  // Request details
  requestedAt: Date;
  deadline: Date;
  urgency: 'normal' | 'urgent' | 'court_order';
  legalBasis: string;
  regulation: PrivacyRegulation;

  // Scope
  dataCategories: DataCategory[];
  excludedData: string[];
  retainForLegal: boolean;

  // Processing
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  processedBy?: string;
  processedAt?: Date;

  // Verification
  verificationRequired: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;

  // Results
  affectedRecords: number;
  deletionSummary: {
    tables: string[];
    recordCount: number;
    backupsCreated: boolean;
    anonymizationApplied: boolean;
  };

  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    user: string;
    details: Record<string, any>;
  }[];
}

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };

  // Retention compliance
  policiesExecuted: number;
  recordsDeleted: number;
  dataSubjectRequests: number;
  complianceScore: number;

  // Regulatory compliance
  gdprCompliance: {
    rightToErasure: number;
    dataPortability: number;
    retentionCompliance: number;
    breachNotifications: number;
  };

  ccpaCompliance: {
    deletionRequests: number;
    doNotSell: number;
    accessRequests: number;
    dataMinimization: number;
  };

  // Issues and recommendations
  issues: {
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    count: number;
    recommendation: string;
  }[];

  recommendations: string[];

  // Audit information
  auditor: string;
  nextReviewDate: Date;
}

export class DataRetentionService {
  private static instance: DataRetentionService;
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private activeJobs: Map<string, RetentionJob> = new Map();
  private deletionRequests: Map<string, DataSubjectDeletionRequest> = new Map();
  private complianceReports: Map<string, ComplianceReport> = new Map();
  private executionScheduler: NodeJS.Timeout[] = [];

  private constructor() {
    this.initializeDataRetention();
    this.loadRetentionPolicies();
    this.startScheduledExecution();

    logger.info('Data Retention Service initialized', {
      policies: this.retentionPolicies.size,
      scheduledExecution: true,
      complianceMonitoring: true
    });
  }

  public static getInstance(): DataRetentionService {
    if (!DataRetentionService.instance) {
      DataRetentionService.instance = new DataRetentionService();
    }
    return DataRetentionService.instance;
  }

  private async initializeDataRetention(): Promise<void> {
    try {
      // Load existing policies and jobs
      await this.loadExistingJobs();

      // Validate current retention status
      await this.validateRetentionCompliance();

      // Setup monitoring
      await this.setupRetentionMonitoring();

      logger.info('Data retention initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize data retention:', error);
      throw error;
    }
  }

  private loadRetentionPolicies(): void {
    // GDPR Article 5(1)(e) - Storage limitation
    const gdprUserDataPolicy: RetentionPolicy = {
      id: 'gdpr-user-data-retention',
      name: 'GDPR User Data Retention',
      description: 'Retain personal data only as long as necessary for the purposes for which it is processed',
      version: '1.0',
      dataCategory: [DataCategory.PII_DIRECT, DataCategory.PII_INDIRECT],
      conditions: {
        age: 2555,          // 7 years
        userStatus: 'inactive',
        purpose: ['service_provision', 'customer_support']
      },
      retentionPeriod: 2555,  // 7 years
      gracePeriod: 30,        // 30 days grace period
      hardDelete: true,
      preDeleteActions: [
        {
          type: 'backup',
          description: 'Create encrypted backup before deletion',
          configuration: { encryption: true, location: 'compliance_archive' },
          required: true,
          order: 1
        },
        {
          type: 'notify',
          description: 'Notify data subject of pending deletion',
          configuration: { template: 'gdpr_deletion_notice', daysNotice: 30 },
          required: true,
          order: 2
        }
      ],
      postDeleteActions: [
        {
          type: 'audit',
          description: 'Log deletion for compliance audit',
          configuration: { auditLevel: 'detailed' },
          required: true,
          order: 1
        }
      ],
      regulations: [PrivacyRegulation.GDPR],
      legalRequirement: true,
      auditRequired: true,
      enabled: true,
      schedule: '0 2 * * 0', // Weekly at 2 AM Sunday
      priority: 1,
      approvalRequired: false,
      executionCount: 0,
      deletionCount: 0,
      errorCount: 0
    };

    // CCPA Business Records Retention
    const ccpaBusinessPolicy: RetentionPolicy = {
      id: 'ccpa-business-records',
      name: 'CCPA Business Records Retention',
      description: 'Retain business records as required by CCPA and California law',
      version: '1.0',
      dataCategory: [DataCategory.FINANCIAL_TRANSACTION, DataCategory.BUSINESS_OPERATIONAL],
      conditions: {
        age: 2555,          // 7 years for business records
        purpose: ['business_operations', 'tax_compliance']
      },
      retentionPeriod: 2555,
      gracePeriod: 0,
      hardDelete: false,    // Soft delete for business records
      preDeleteActions: [
        {
          type: 'archive',
          description: 'Archive business records to cold storage',
          configuration: { storageClass: 'glacier', encryption: true },
          required: true,
          order: 1
        }
      ],
      postDeleteActions: [
        {
          type: 'audit',
          description: 'Record archive action for business audit',
          configuration: { auditLevel: 'summary' },
          required: true,
          order: 1
        }
      ],
      regulations: [PrivacyRegulation.CCPA],
      legalRequirement: true,
      auditRequired: true,
      enabled: true,
      schedule: '0 3 1 * *', // Monthly at 3 AM on 1st
      priority: 2,
      approvalRequired: true,
      executionCount: 0,
      deletionCount: 0,
      errorCount: 0
    };

    // Financial Records Retention (SOX/Tax)
    const financialRetentionPolicy: RetentionPolicy = {
      id: 'financial-records-retention',
      name: 'Financial Records Retention (SOX)',
      description: 'Retain financial records for SOX compliance and tax purposes',
      version: '1.0',
      dataCategory: [DataCategory.FINANCIAL_ACCOUNT, DataCategory.FINANCIAL_TRANSACTION],
      conditions: {
        age: 2555,          // 7 years
        purpose: ['financial_reporting', 'tax_compliance', 'sox_compliance']
      },
      retentionPeriod: 2555,
      gracePeriod: 0,
      hardDelete: false,
      preDeleteActions: [
        {
          type: 'archive',
          description: 'Archive to immutable storage for regulatory compliance',
          configuration: {
            storageClass: 'glacier_deep_archive',
            encryption: true,
            immutable: true,
            retentionYears: 10
          },
          required: true,
          order: 1
        }
      ],
      postDeleteActions: [
        {
          type: 'audit',
          description: 'Generate SOX compliance audit record',
          configuration: {
            auditLevel: 'detailed',
            complianceFramework: 'sox',
            reportingRequired: true
          },
          required: true,
          order: 1
        }
      ],
      regulations: [], // SOX is not a privacy regulation but financial
      legalRequirement: true,
      auditRequired: true,
      enabled: true,
      schedule: '0 4 1 1 *', // Annually at 4 AM on Jan 1st
      priority: 10,
      approvalRequired: true,
      executionCount: 0,
      deletionCount: 0,
      errorCount: 0
    };

    // System Logs Retention
    const logRetentionPolicy: RetentionPolicy = {
      id: 'system-logs-retention',
      name: 'System Logs Retention',
      description: 'Retain system logs for security monitoring and compliance',
      version: '1.0',
      dataCategory: [DataCategory.SYSTEM_LOGS, DataCategory.SYSTEM_METRICS],
      conditions: {
        age: 1095,          // 3 years
        purpose: ['security_monitoring', 'performance_analysis', 'incident_response']
      },
      retentionPeriod: 1095,
      gracePeriod: 30,
      hardDelete: true,
      preDeleteActions: [
        {
          type: 'archive',
          description: 'Archive logs to cold storage for extended retention',
          configuration: {
            storageClass: 'glacier',
            compression: true,
            encryption: true
          },
          required: false,
          order: 1
        }
      ],
      postDeleteActions: [
        {
          type: 'audit',
          description: 'Log retention cleanup audit',
          configuration: { auditLevel: 'summary' },
          required: true,
          order: 1
        }
      ],
      regulations: [],
      legalRequirement: false,
      auditRequired: true,
      enabled: true,
      schedule: '0 1 1 * *', // Monthly at 1 AM on 1st
      priority: 5,
      approvalRequired: false,
      executionCount: 0,
      deletionCount: 0,
      errorCount: 0
    };

    // Temporary Data Cleanup
    const tempDataPolicy: RetentionPolicy = {
      id: 'temporary-data-cleanup',
      name: 'Temporary Data Cleanup',
      description: 'Clean up temporary and session data',
      version: '1.0',
      dataCategory: [DataCategory.PUBLIC_METADATA],
      tableName: 'sessions',
      conditions: {
        age: 30,            // 30 days
        userStatus: 'inactive'
      },
      retentionPeriod: 30,
      gracePeriod: 0,
      hardDelete: true,
      preDeleteActions: [],
      postDeleteActions: [
        {
          type: 'audit',
          description: 'Log temporary data cleanup',
          configuration: { auditLevel: 'minimal' },
          required: false,
          order: 1
        }
      ],
      regulations: [],
      legalRequirement: false,
      auditRequired: false,
      enabled: true,
      schedule: '0 0 * * *', // Daily at midnight
      priority: 1,
      approvalRequired: false,
      executionCount: 0,
      deletionCount: 0,
      errorCount: 0
    };

    this.retentionPolicies.set(gdprUserDataPolicy.id, gdprUserDataPolicy);
    this.retentionPolicies.set(ccpaBusinessPolicy.id, ccpaBusinessPolicy);
    this.retentionPolicies.set(financialRetentionPolicy.id, financialRetentionPolicy);
    this.retentionPolicies.set(logRetentionPolicy.id, logRetentionPolicy);
    this.retentionPolicies.set(tempDataPolicy.id, tempDataPolicy);

    logger.info('Retention policies loaded', {
      policyCount: this.retentionPolicies.size
    });
  }

  private async loadExistingJobs(): Promise<void> {
    // Load existing retention jobs from storage
    logger.debug('Loading existing retention jobs');
  }

  private async validateRetentionCompliance(): Promise<void> {
    // Validate current retention compliance
    logger.debug('Validating retention compliance');
  }

  private async setupRetentionMonitoring(): Promise<void> {
    // Setup monitoring for retention compliance
    logger.debug('Setting up retention monitoring');
  }

  /**
   * Execute retention policy
   */
  async executeRetentionPolicy(policyId: string, dryRun: boolean = false): Promise<string> {
    const policy = this.retentionPolicies.get(policyId);
    if (!policy) {
      throw new Error(`Retention policy not found: ${policyId}`);
    }

    if (!policy.enabled) {
      throw new Error(`Retention policy is disabled: ${policyId}`);
    }

    const jobId = crypto.randomUUID();
    const job: RetentionJob = {
      id: jobId,
      policyId,
      status: 'scheduled',
      startTime: new Date(),
      recordsEvaluated: 0,
      recordsDeleted: 0,
      recordsArchived: 0,
      recordsSkipped: 0,
      errors: [],
      notificationsSent: 0,
      notificationErrors: [],
      executedBy: 'system',
      complianceChecked: false,
      complianceIssues: []
    };

    this.activeJobs.set(jobId, job);

    try {
      logger.info('Starting retention policy execution', {
        jobId,
        policyId,
        dryRun
      });

      job.status = 'running';

      // Pre-execution compliance check
      await this.performComplianceCheck(job, policy);

      // Execute pre-deletion actions
      // NOTE: Internal method with predefined policy actions, not dynamic code execution (CWE-94 false positive)
      await this.executePreActions(job, policy);

      // Identify records for deletion
      const candidateRecords = await this.identifyRetentionCandidates(policy);
      job.recordsEvaluated = candidateRecords.length;

      // Process records
      for (const record of candidateRecords) {
        try {
          if (await this.shouldRetainRecord(record, policy)) {
            job.recordsSkipped++;
            continue;
          }

          if (!dryRun) {
            if (policy.hardDelete) {
              await this.deleteRecord(record, policy);
              job.recordsDeleted++;
            } else {
              await this.archiveRecord(record, policy);
              job.recordsArchived++;
            }
          } else {
            job.recordsDeleted++; // Count what would be deleted
          }

        } catch (error) {
          job.errors.push(`Failed to process record ${record.id}: ${getErrorMessage(error)}`);
        }
      }

      // Execute post-deletion actions
      if (!dryRun) {
        // NOTE: Internal method with predefined policy actions, not dynamic code execution (CWE-94 false positive)
        await this.executePostActions(job, policy);
      }

      // Update policy statistics
      policy.executionCount++;
      policy.deletionCount += job.recordsDeleted;
      policy.lastExecuted = new Date();

      job.status = 'completed';
      job.endTime = new Date();
      job.duration = job.endTime.getTime() - job.startTime.getTime();

      logger.info('Retention policy execution completed', {
        jobId,
        policyId,
        recordsEvaluated: job.recordsEvaluated,
        recordsDeleted: job.recordsDeleted,
        recordsArchived: job.recordsArchived,
        duration: job.duration,
        dryRun
      });

      // Log retention event
      await securityLogService.logSecurityEvent({
        eventType: 'data_retention_executed',
        severity: 'LOW',
        category: 'data_access',
        ipAddress: '82.147.84.78',
        success: job.errors.length === 0,
        details: {
          jobId,
          policyId,
          recordsEvaluated: job.recordsEvaluated,
          recordsDeleted: job.recordsDeleted,
          recordsArchived: job.recordsArchived,
          dryRun
        },
        riskScore: 10,
        tags: ['data_retention', 'privacy', 'compliance'],
        compliance: {
          pii: true,
          gdpr: policy.regulations.includes(PrivacyRegulation.GDPR),
          pci: false,
          hipaa: policy.regulations.includes(PrivacyRegulation.HIPAA)
        }
      });

      return jobId;

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.duration = job.endTime!.getTime() - job.startTime.getTime();
      job.errors.push(getErrorMessage(error));

      policy.errorCount++;

      logger.error('Retention policy execution failed', {
        jobId,
        policyId,
        error: getErrorMessage(error)
      });

      throw error;
    }
  }

  private async performComplianceCheck(job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Check if policy meets compliance requirements
    if (policy.approvalRequired && !policy.approvedBy) {
      job.complianceIssues.push('Policy requires approval but is not approved');
    }

    // Check for conflicting retention requirements
    const conflictingPolicies = Array.from(this.retentionPolicies.values())
      .filter(p => p.id !== policy.id && this.policiesConflict(p, policy));

    if (conflictingPolicies.length > 0) {
      job.complianceIssues.push(`Policy conflicts with ${conflictingPolicies.length} other policies`);
    }

    // Validate legal basis
    if (policy.legalRequirement && !policy.regulations.length) {
      job.complianceIssues.push('Legal requirement specified but no regulations identified');
    }

    job.complianceChecked = true;

    if (job.complianceIssues.length > 0) {
      logger.warn('Compliance issues detected', {
        jobId: job.id,
        issues: job.complianceIssues
      });
    }
  }

  private policiesConflict(policy1: RetentionPolicy, policy2: RetentionPolicy): boolean {
    // Check if policies target same data but have different retention periods
    const sameDataCategory = policy1.dataCategory.some(cat => policy2.dataCategory.includes(cat));
    const sameTable = policy1.tableName === policy2.tableName;
    const differentRetention = policy1.retentionPeriod !== policy2.retentionPeriod;

    return (sameDataCategory || sameTable) && differentRetention;
  }

  private async executePreActions(job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    for (const action of policy.preDeleteActions.sort((a, b) => a.order - b.order)) {
      try {
        // NOTE: Internal action dispatcher with validated action types (CWE-94 false positive)
        await this.executeAction(action, job, policy);
      } catch (error) {
        if (action.required) {
          throw new Error(`Required pre-action failed: ${action.type} - ${getErrorMessage(error)}`);
        } else {
          job.errors.push(`Optional pre-action failed: ${action.type} - ${getErrorMessage(error)}`);
        }
      }
    }
  }

  private async executePostActions(job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    for (const action of policy.postDeleteActions.sort((a, b) => a.order - b.order)) {
      try {
        // NOTE: Internal action dispatcher with validated action types (CWE-94 false positive)
        await this.executeAction(action, job, policy);
      } catch (error) {
        if (action.required) {
          throw new Error(`Required post-action failed: ${action.type} - ${getErrorMessage(error)}`);
        } else {
          job.errors.push(`Optional post-action failed: ${action.type} - ${getErrorMessage(error)}`);
        }
      }
    }
  }

  private async executeAction(action: RetentionAction, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    switch (action.type) {
      case 'backup':
        await this.createRetentionBackup(action.configuration, job, policy);
        break;
      case 'archive':
        await this.archiveRetentionData(action.configuration, job, policy);
        break;
      case 'notify':
        await this.sendRetentionNotifications(action.configuration, job, policy);
        break;
      case 'audit':
        await this.createRetentionAudit(action.configuration, job, policy);
        break;
      case 'anonymize':
        await this.anonymizeRetentionData(action.configuration, job, policy);
        break;
      case 'export':
        await this.exportRetentionData(action.configuration, job, policy);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    logger.debug('Retention action executed', {
      jobId: job.id,
      action: action.type,
      description: action.description
    });
  }

  private async createRetentionBackup(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Create backup before deletion
    logger.debug('Creating retention backup', { jobId: job.id, config });
  }

  private async archiveRetentionData(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Archive data to cold storage
    logger.debug('Archiving retention data', { jobId: job.id, config });
  }

  private async sendRetentionNotifications(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Send notifications to data subjects
    try {
      // Implementation would send actual notifications
      job.notificationsSent++;
      logger.debug('Retention notification sent', { jobId: job.id, config });
    } catch (error) {
      job.notificationErrors.push(getErrorMessage(error));
      throw error;
    }
  }

  private async createRetentionAudit(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Create detailed audit record
    logger.debug('Creating retention audit', { jobId: job.id, config });
  }

  private async anonymizeRetentionData(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Anonymize data instead of deletion
    logger.debug('Anonymizing retention data', { jobId: job.id, config });
  }

  private async exportRetentionData(config: any, job: RetentionJob, policy: RetentionPolicy): Promise<void> {
    // Export data for data portability
    logger.debug('Exporting retention data', { jobId: job.id, config });
  }

  private async identifyRetentionCandidates(policy: RetentionPolicy): Promise<any[]> {
    // TODO: Implement actual database queries to find records matching retention criteria
    // This should query the database based on:
    // - policy.tableName: which table to query
    // - policy.retentionPeriod: how old records should be
    // - policy.conditions: additional filtering conditions
    // - policy.dataCategory: type of data to consider
    
    const currentDate = new Date();
    const cutoffDate = new Date(currentDate.getTime() - (policy.retentionPeriod * 24 * 60 * 60 * 1000));
    
    logger.warn(`identifyRetentionCandidates called for policy ${policy.id} but not implemented - returning empty array`);
    logger.info(`Would query table: ${policy.tableName || 'unknown'}, cutoff date: ${cutoffDate.toISOString()}`);
    
    // Return empty array until real implementation is added
    return [];
  }

  private async shouldRetainRecord(record: any, policy: RetentionPolicy): Promise<boolean> {
    // Check if record should be retained despite meeting deletion criteria

    // Check for legal holds
    if (await this.hasLegalHold(record)) {
      return true;
    }

    // Check for active business needs
    if (await this.hasActiveBusinessNeed(record, policy)) {
      return true;
    }

    // Check for pending data subject requests
    if (await this.hasPendingDataSubjectRequest(record)) {
      return true;
    }

    return false;
  }

  private async hasLegalHold(record: any): Promise<boolean> {
    // Check if record is under legal hold
    return false; // Simplified implementation
  }

  private async hasActiveBusinessNeed(record: any, policy: RetentionPolicy): Promise<boolean> {
    // Check if record is still needed for business purposes
    return false; // Simplified implementation
  }

  private async hasPendingDataSubjectRequest(record: any): Promise<boolean> {
    // Check if there are pending data subject requests for this record
    const pendingRequests = Array.from(this.deletionRequests.values())
      .filter(req => req.status === 'pending' || req.status === 'processing');

    return pendingRequests.some(req => req.subjectId === record.userId);
  }

  private async deleteRecord(record: any, policy: RetentionPolicy): Promise<void> {
    // Implement actual record deletion
    logger.debug('Deleting record', {
      recordId: record.id,
      table: record.table,
      policy: policy.id
    });
  }

  private async archiveRecord(record: any, policy: RetentionPolicy): Promise<void> {
    // Implement record archival
    logger.debug('Archiving record', {
      recordId: record.id,
      table: record.table,
      policy: policy.id
    });
  }

  /**
   * Handle data subject deletion request
   */
  async handleDataSubjectDeletion(request: Omit<DataSubjectDeletionRequest, 'id' | 'requestedAt' | 'status' | 'auditTrail'>): Promise<string> {
    const requestId = crypto.randomUUID();

    const deletionRequest: DataSubjectDeletionRequest = {
      id: requestId,
      requestedAt: new Date(),
      status: 'pending',
      auditTrail: [],
      affectedRecords: 0,
      deletionSummary: {
        tables: [],
        recordCount: 0,
        backupsCreated: false,
        anonymizationApplied: false
      },
      ...request
    };

    // Add initial audit entry
    deletionRequest.auditTrail.push({
      timestamp: new Date(),
      action: 'deletion_request_received',
      user: 'system',
      details: {
        requestType: request.requestType,
        urgency: request.urgency,
        regulation: request.regulation
      }
    });

    this.deletionRequests.set(requestId, deletionRequest);

    logger.info('Data subject deletion request received', {
      requestId,
      subjectId: request.subjectId,
      requestType: request.requestType,
      urgency: request.urgency,
      regulation: request.regulation
    });

    // Log privacy event
    await securityLogService.logSecurityEvent({
      eventType: 'data_subject_deletion_request',
      severity: request.urgency === 'court_order' ? 'CRITICAL' : 'HIGH',
      category: 'data_access',
      ipAddress: '82.147.84.78',
      success: true,
      details: {
        requestId,
        subjectId: request.subjectId,
        requestType: request.requestType,
        urgency: request.urgency,
        regulation: request.regulation
      },
      riskScore: request.urgency === 'court_order' ? 90 : 60,
      tags: ['data_subject_deletion', 'privacy', request.requestType],
      compliance: {
        pii: true,
        gdpr: request.regulation === PrivacyRegulation.GDPR,
        pci: false,
        hipaa: request.regulation === PrivacyRegulation.HIPAA
      }
    });

    // Auto-approve certain types of requests
    if (request.urgency === 'court_order' || request.requestType === 'anonymization') {
      await this.approveDataSubjectDeletion(requestId, 'system_auto_approval');
    }

    return requestId;
  }

  private async approveDataSubjectDeletion(requestId: string, approver: string): Promise<void> {
    const request = this.deletionRequests.get(requestId);
    if (!request) return;

    request.status = 'approved';
    request.approvedBy = approver;
    request.approvedAt = new Date();

    request.auditTrail.push({
      timestamp: new Date(),
      action: 'deletion_request_approved',
      user: approver,
      details: { approvalReason: 'Compliance requirement' }
    });

    logger.info('Data subject deletion request approved', { requestId, approver });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<string> {
    const reportId = crypto.randomUUID();

    // Collect retention statistics
    const executedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.startTime >= startDate && job.startTime <= endDate);

    const completedRequests = Array.from(this.deletionRequests.values())
      .filter(req => req.processedAt && req.processedAt >= startDate && req.processedAt <= endDate);

    const report: ComplianceReport = {
      id: reportId,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      policiesExecuted: executedJobs.length,
      recordsDeleted: executedJobs.reduce((sum, job) => sum + job.recordsDeleted, 0),
      dataSubjectRequests: completedRequests.length,
      complianceScore: this.calculateComplianceScore(executedJobs, completedRequests),
      gdprCompliance: {
        rightToErasure: completedRequests.filter(req => req.regulation === PrivacyRegulation.GDPR).length,
        dataPortability: 0, // Would track data portability requests
        retentionCompliance: this.calculateRetentionCompliance(PrivacyRegulation.GDPR),
        breachNotifications: 0 // Would track breach notifications
      },
      ccpaCompliance: {
        deletionRequests: completedRequests.filter(req => req.regulation === PrivacyRegulation.CCPA).length,
        doNotSell: 0, // Would track do-not-sell requests
        accessRequests: 0, // Would track access requests
        dataMinimization: this.calculateDataMinimizationScore()
      },
      issues: [],
      recommendations: [],
      auditor: 'system',
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };

    // Identify issues and recommendations
    report.issues = await this.identifyComplianceIssues(executedJobs, completedRequests);
    report.recommendations = this.generateComplianceRecommendations(report.issues);

    this.complianceReports.set(reportId, report);

    logger.info('Compliance report generated', {
      reportId,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      complianceScore: report.complianceScore,
      issues: report.issues.length
    });

    return reportId;
  }

  private calculateComplianceScore(jobs: RetentionJob[], requests: DataSubjectDeletionRequest[]): number {
    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(job => job.status === 'completed' && job.errors.length === 0).length;

    const totalRequests = requests.length;
    const completedRequests = requests.filter(req => req.status === 'completed').length;

    if (totalJobs === 0 && totalRequests === 0) return 100;

    const jobScore = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 100;
    const requestScore = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 100;

    return (jobScore + requestScore) / 2;
  }

  private calculateRetentionCompliance(regulation: PrivacyRegulation): number {
    const relevantPolicies = Array.from(this.retentionPolicies.values())
      .filter(policy => policy.regulations.includes(regulation));

    const enabledPolicies = relevantPolicies.filter(policy => policy.enabled);

    return relevantPolicies.length > 0 ? (enabledPolicies.length / relevantPolicies.length) * 100 : 100;
  }

  private calculateDataMinimizationScore(): number {
    // Calculate data minimization score based on classification service
    const stats = dataClassificationService.getStats();
    return stats.complianceScore;
  }

  private async identifyComplianceIssues(jobs: RetentionJob[], requests: DataSubjectDeletionRequest[]): Promise<ComplianceReport['issues']> {
    const issues: ComplianceReport['issues'] = [];

    // Check for failed retention jobs
    const failedJobs = jobs.filter(job => job.status === 'failed').length;
    if (failedJobs > 0) {
      issues.push({
        severity: 'HIGH',
        description: 'Failed retention policy executions',
        count: failedJobs,
        recommendation: 'Review and fix failed retention policies'
      });
    }

    // Check for overdue data subject requests
    const overdueRequests = requests.filter(req =>
      req.status !== 'completed' && req.deadline < new Date()
    ).length;
    if (overdueRequests > 0) {
      issues.push({
        severity: 'CRITICAL',
        description: 'Overdue data subject deletion requests',
        count: overdueRequests,
        recommendation: 'Process overdue requests immediately to avoid regulatory penalties'
      });
    }

    // Check for excessive data retention
    const policies = Array.from(this.retentionPolicies.values());
    const excessiveRetention = policies.filter(policy => policy.retentionPeriod > 2555).length;
    if (excessiveRetention > 0) {
      issues.push({
        severity: 'MEDIUM',
        description: 'Policies with excessive retention periods',
        count: excessiveRetention,
        recommendation: 'Review retention periods to ensure compliance with data minimization principles'
      });
    }

    return issues;
  }

  private generateComplianceRecommendations(issues: ComplianceReport['issues']): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.severity === 'CRITICAL')) {
      recommendations.push('Address all critical compliance issues immediately');
    }

    if (issues.some(issue => issue.description.includes('retention'))) {
      recommendations.push('Implement automated retention policy monitoring and alerting');
    }

    if (issues.some(issue => issue.description.includes('data subject'))) {
      recommendations.push('Enhance data subject request tracking and automated processing');
    }

    recommendations.push('Conduct regular compliance audits and staff training');
    recommendations.push('Consider implementing data minimization automation');

    return recommendations;
  }

  private startScheduledExecution(): void {
    // Schedule policy executions based on their schedules
    for (const [policyId, policy] of this.retentionPolicies.entries()) {
      if (policy.enabled && policy.schedule) {
        // In a real implementation, would use a proper cron scheduler
        const interval = this.parseCronToInterval(policy.schedule);

        const scheduledExecution = setInterval(() => {
          this.executeRetentionPolicy(policyId, false).catch(error => {
            logger.error(`Scheduled retention policy execution failed for ${sanitizeForLog(policyId)}:`, error);
          });
        }, interval);

        this.executionScheduler.push(scheduledExecution);

        logger.debug('Scheduled retention policy execution', {
          policyId,
          schedule: policy.schedule,
          interval
        });
      }
    }

    logger.info('Scheduled retention execution started', {
      scheduledPolicies: this.executionScheduler.length
    });
  }

  private parseCronToInterval(cronExpression: string): number {
    // Simplified cron parsing - in production, use a proper cron library
    if (cronExpression === '0 0 * * *') return 24 * 60 * 60 * 1000; // Daily
    if (cronExpression === '0 2 * * 0') return 7 * 24 * 60 * 60 * 1000; // Weekly
    if (cronExpression === '0 3 1 * *') return 30 * 24 * 60 * 60 * 1000; // Monthly

    return 24 * 60 * 60 * 1000; // Default to daily
  }

  /**
   * Get data retention statistics
   */
  getStats(): {
    retentionPolicies: number;
    activeJobs: number;
    pendingDeletionRequests: number;
    complianceReports: number;
    totalRecordsDeleted: number;
    complianceScore: number;
  } {
    const totalRecordsDeleted = Array.from(this.retentionPolicies.values())
      .reduce((sum, policy) => sum + policy.deletionCount, 0);

    const activeJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'running').length;

    const pendingDeletionRequests = Array.from(this.deletionRequests.values())
      .filter(req => req.status === 'pending').length;

    const completedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'completed');
    const failedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'failed');

    const complianceScore = completedJobs.length > 0
      ? (completedJobs.length / (completedJobs.length + failedJobs.length)) * 100
      : 100;

    return {
      retentionPolicies: this.retentionPolicies.size,
      activeJobs,
      pendingDeletionRequests,
      complianceReports: this.complianceReports.size,
      totalRecordsDeleted,
      complianceScore
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    const stats = this.getStats();

    let status = 'healthy';

    if (stats.complianceScore < 95) {
      status = 'warning'; // Compliance issues
    }

    if (stats.pendingDeletionRequests > 5) {
      status = 'degraded'; // Too many pending requests
    }

    if (stats.complianceScore < 80) {
      status = 'critical'; // Critical compliance issues
    }

    const overdueRequests = Array.from(this.deletionRequests.values())
      .filter(req => req.status !== 'completed' && req.deadline < new Date()).length;

    if (overdueRequests > 0) {
      status = 'critical'; // Overdue requests
    }

    return {
      status,
      stats: {
        ...stats,
        overdueRequests
      }
    };
  }
}

// Export singleton instance
export const dataRetentionService = DataRetentionService.getInstance();
