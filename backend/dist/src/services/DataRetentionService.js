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
exports.dataRetentionService = exports.DataRetentionService = void 0;
const crypto = __importStar(require("crypto"));
const errorUtils_1 = require("../utils/errorUtils");
const inputSanitizer_1 = require("../utils/inputSanitizer");
const logger_1 = require("../utils/logger");
const DataClassificationService_1 = require("./DataClassificationService");
const SecurityLogService_1 = require("./SecurityLogService");
class DataRetentionService {
    constructor() {
        this.retentionPolicies = new Map();
        this.activeJobs = new Map();
        this.deletionRequests = new Map();
        this.complianceReports = new Map();
        this.executionScheduler = [];
        this.initializeDataRetention();
        this.loadRetentionPolicies();
        this.startScheduledExecution();
        logger_1.logger.info('Data Retention Service initialized', {
            policies: this.retentionPolicies.size,
            scheduledExecution: true,
            complianceMonitoring: true
        });
    }
    static getInstance() {
        if (!DataRetentionService.instance) {
            DataRetentionService.instance = new DataRetentionService();
        }
        return DataRetentionService.instance;
    }
    async initializeDataRetention() {
        try {
            await this.loadExistingJobs();
            await this.validateRetentionCompliance();
            await this.setupRetentionMonitoring();
            logger_1.logger.info('Data retention initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize data retention:', error);
            throw error;
        }
    }
    loadRetentionPolicies() {
        const gdprUserDataPolicy = {
            id: 'gdpr-user-data-retention',
            name: 'GDPR User Data Retention',
            description: 'Retain personal data only as long as necessary for the purposes for which it is processed',
            version: '1.0',
            dataCategory: [DataClassificationService_1.DataCategory.PII_DIRECT, DataClassificationService_1.DataCategory.PII_INDIRECT],
            conditions: {
                age: 2555,
                userStatus: 'inactive',
                purpose: ['service_provision', 'customer_support']
            },
            retentionPeriod: 2555,
            gracePeriod: 30,
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
            regulations: [DataClassificationService_1.PrivacyRegulation.GDPR],
            legalRequirement: true,
            auditRequired: true,
            enabled: true,
            schedule: '0 2 * * 0',
            priority: 1,
            approvalRequired: false,
            executionCount: 0,
            deletionCount: 0,
            errorCount: 0
        };
        const ccpaBusinessPolicy = {
            id: 'ccpa-business-records',
            name: 'CCPA Business Records Retention',
            description: 'Retain business records as required by CCPA and California law',
            version: '1.0',
            dataCategory: [DataClassificationService_1.DataCategory.FINANCIAL_TRANSACTION, DataClassificationService_1.DataCategory.BUSINESS_OPERATIONAL],
            conditions: {
                age: 2555,
                purpose: ['business_operations', 'tax_compliance']
            },
            retentionPeriod: 2555,
            gracePeriod: 0,
            hardDelete: false,
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
            regulations: [DataClassificationService_1.PrivacyRegulation.CCPA],
            legalRequirement: true,
            auditRequired: true,
            enabled: true,
            schedule: '0 3 1 * *',
            priority: 2,
            approvalRequired: true,
            executionCount: 0,
            deletionCount: 0,
            errorCount: 0
        };
        const financialRetentionPolicy = {
            id: 'financial-records-retention',
            name: 'Financial Records Retention (SOX)',
            description: 'Retain financial records for SOX compliance and tax purposes',
            version: '1.0',
            dataCategory: [DataClassificationService_1.DataCategory.FINANCIAL_ACCOUNT, DataClassificationService_1.DataCategory.FINANCIAL_TRANSACTION],
            conditions: {
                age: 2555,
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
            regulations: [],
            legalRequirement: true,
            auditRequired: true,
            enabled: true,
            schedule: '0 4 1 1 *',
            priority: 10,
            approvalRequired: true,
            executionCount: 0,
            deletionCount: 0,
            errorCount: 0
        };
        const logRetentionPolicy = {
            id: 'system-logs-retention',
            name: 'System Logs Retention',
            description: 'Retain system logs for security monitoring and compliance',
            version: '1.0',
            dataCategory: [DataClassificationService_1.DataCategory.SYSTEM_LOGS, DataClassificationService_1.DataCategory.SYSTEM_METRICS],
            conditions: {
                age: 1095,
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
            schedule: '0 1 1 * *',
            priority: 5,
            approvalRequired: false,
            executionCount: 0,
            deletionCount: 0,
            errorCount: 0
        };
        const tempDataPolicy = {
            id: 'temporary-data-cleanup',
            name: 'Temporary Data Cleanup',
            description: 'Clean up temporary and session data',
            version: '1.0',
            dataCategory: [DataClassificationService_1.DataCategory.PUBLIC_METADATA],
            tableName: 'sessions',
            conditions: {
                age: 30,
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
            schedule: '0 0 * * *',
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
        logger_1.logger.info('Retention policies loaded', {
            policyCount: this.retentionPolicies.size
        });
    }
    async loadExistingJobs() {
        logger_1.logger.debug('Loading existing retention jobs');
    }
    async validateRetentionCompliance() {
        logger_1.logger.debug('Validating retention compliance');
    }
    async setupRetentionMonitoring() {
        logger_1.logger.debug('Setting up retention monitoring');
    }
    async executeRetentionPolicy(policyId, dryRun = false) {
        const policy = this.retentionPolicies.get(policyId);
        if (!policy) {
            throw new Error(`Retention policy not found: ${policyId}`);
        }
        if (!policy.enabled) {
            throw new Error(`Retention policy is disabled: ${policyId}`);
        }
        const jobId = crypto.randomUUID();
        const job = {
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
            logger_1.logger.info('Starting retention policy execution', {
                jobId,
                policyId,
                dryRun
            });
            job.status = 'running';
            await this.performComplianceCheck(job, policy);
            await this.executePreActions(job, policy);
            const candidateRecords = await this.identifyRetentionCandidates(policy);
            job.recordsEvaluated = candidateRecords.length;
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
                        }
                        else {
                            await this.archiveRecord(record, policy);
                            job.recordsArchived++;
                        }
                    }
                    else {
                        job.recordsDeleted++;
                    }
                }
                catch (error) {
                    job.errors.push(`Failed to process record ${record.id}: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
            }
            if (!dryRun) {
                await this.executePostActions(job, policy);
            }
            policy.executionCount++;
            policy.deletionCount += job.recordsDeleted;
            policy.lastExecuted = new Date();
            job.status = 'completed';
            job.endTime = new Date();
            job.duration = job.endTime.getTime() - job.startTime.getTime();
            logger_1.logger.info('Retention policy execution completed', {
                jobId,
                policyId,
                recordsEvaluated: job.recordsEvaluated,
                recordsDeleted: job.recordsDeleted,
                recordsArchived: job.recordsArchived,
                duration: job.duration,
                dryRun
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
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
                    gdpr: policy.regulations.includes(DataClassificationService_1.PrivacyRegulation.GDPR),
                    pci: false,
                    hipaa: policy.regulations.includes(DataClassificationService_1.PrivacyRegulation.HIPAA)
                }
            });
            return jobId;
        }
        catch (error) {
            job.status = 'failed';
            job.endTime = new Date();
            job.duration = job.endTime.getTime() - job.startTime.getTime();
            job.errors.push((0, errorUtils_1.getErrorMessage)(error));
            policy.errorCount++;
            logger_1.logger.error('Retention policy execution failed', {
                jobId,
                policyId,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async performComplianceCheck(job, policy) {
        if (policy.approvalRequired && !policy.approvedBy) {
            job.complianceIssues.push('Policy requires approval but is not approved');
        }
        const conflictingPolicies = Array.from(this.retentionPolicies.values())
            .filter(p => p.id !== policy.id && this.policiesConflict(p, policy));
        if (conflictingPolicies.length > 0) {
            job.complianceIssues.push(`Policy conflicts with ${conflictingPolicies.length} other policies`);
        }
        if (policy.legalRequirement && !policy.regulations.length) {
            job.complianceIssues.push('Legal requirement specified but no regulations identified');
        }
        job.complianceChecked = true;
        if (job.complianceIssues.length > 0) {
            logger_1.logger.warn('Compliance issues detected', {
                jobId: job.id,
                issues: job.complianceIssues
            });
        }
    }
    policiesConflict(policy1, policy2) {
        const sameDataCategory = policy1.dataCategory.some(cat => policy2.dataCategory.includes(cat));
        const sameTable = policy1.tableName === policy2.tableName;
        const differentRetention = policy1.retentionPeriod !== policy2.retentionPeriod;
        return (sameDataCategory || sameTable) && differentRetention;
    }
    async executePreActions(job, policy) {
        for (const action of policy.preDeleteActions.sort((a, b) => a.order - b.order)) {
            try {
                await this.executeAction(action, job, policy);
            }
            catch (error) {
                if (action.required) {
                    throw new Error(`Required pre-action failed: ${action.type} - ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                else {
                    job.errors.push(`Optional pre-action failed: ${action.type} - ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
            }
        }
    }
    async executePostActions(job, policy) {
        for (const action of policy.postDeleteActions.sort((a, b) => a.order - b.order)) {
            try {
                await this.executeAction(action, job, policy);
            }
            catch (error) {
                if (action.required) {
                    throw new Error(`Required post-action failed: ${action.type} - ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                else {
                    job.errors.push(`Optional post-action failed: ${action.type} - ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
            }
        }
    }
    async executeAction(action, job, policy) {
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
        logger_1.logger.debug('Retention action executed', {
            jobId: job.id,
            action: action.type,
            description: action.description
        });
    }
    async createRetentionBackup(config, job, policy) {
        logger_1.logger.debug('Creating retention backup', { jobId: job.id, config });
    }
    async archiveRetentionData(config, job, policy) {
        logger_1.logger.debug('Archiving retention data', { jobId: job.id, config });
    }
    async sendRetentionNotifications(config, job, policy) {
        try {
            job.notificationsSent++;
            logger_1.logger.debug('Retention notification sent', { jobId: job.id, config });
        }
        catch (error) {
            job.notificationErrors.push((0, errorUtils_1.getErrorMessage)(error));
            throw error;
        }
    }
    async createRetentionAudit(config, job, policy) {
        logger_1.logger.debug('Creating retention audit', { jobId: job.id, config });
    }
    async anonymizeRetentionData(config, job, policy) {
        logger_1.logger.debug('Anonymizing retention data', { jobId: job.id, config });
    }
    async exportRetentionData(config, job, policy) {
        logger_1.logger.debug('Exporting retention data', { jobId: job.id, config });
    }
    async identifyRetentionCandidates(policy) {
        const currentDate = new Date();
        const cutoffDate = new Date(currentDate.getTime() - (policy.retentionPeriod * 24 * 60 * 60 * 1000));
        logger_1.logger.warn(`identifyRetentionCandidates called for policy ${policy.id} but not implemented - returning empty array`);
        logger_1.logger.info(`Would query table: ${policy.tableName || 'unknown'}, cutoff date: ${cutoffDate.toISOString()}`);
        return [];
    }
    async shouldRetainRecord(record, policy) {
        if (await this.hasLegalHold(record)) {
            return true;
        }
        if (await this.hasActiveBusinessNeed(record, policy)) {
            return true;
        }
        if (await this.hasPendingDataSubjectRequest(record)) {
            return true;
        }
        return false;
    }
    async hasLegalHold(record) {
        return false;
    }
    async hasActiveBusinessNeed(record, policy) {
        return false;
    }
    async hasPendingDataSubjectRequest(record) {
        const pendingRequests = Array.from(this.deletionRequests.values())
            .filter(req => req.status === 'pending' || req.status === 'processing');
        return pendingRequests.some(req => req.subjectId === record.userId);
    }
    async deleteRecord(record, policy) {
        logger_1.logger.debug('Deleting record', {
            recordId: record.id,
            table: record.table,
            policy: policy.id
        });
    }
    async archiveRecord(record, policy) {
        logger_1.logger.debug('Archiving record', {
            recordId: record.id,
            table: record.table,
            policy: policy.id
        });
    }
    async handleDataSubjectDeletion(request) {
        const requestId = crypto.randomUUID();
        const deletionRequest = {
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
        logger_1.logger.info('Data subject deletion request received', {
            requestId,
            subjectId: request.subjectId,
            requestType: request.requestType,
            urgency: request.urgency,
            regulation: request.regulation
        });
        await SecurityLogService_1.securityLogService.logSecurityEvent({
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
                gdpr: request.regulation === DataClassificationService_1.PrivacyRegulation.GDPR,
                pci: false,
                hipaa: request.regulation === DataClassificationService_1.PrivacyRegulation.HIPAA
            }
        });
        if (request.urgency === 'court_order' || request.requestType === 'anonymization') {
            await this.approveDataSubjectDeletion(requestId, 'system_auto_approval');
        }
        return requestId;
    }
    async approveDataSubjectDeletion(requestId, approver) {
        const request = this.deletionRequests.get(requestId);
        if (!request)
            return;
        request.status = 'approved';
        request.approvedBy = approver;
        request.approvedAt = new Date();
        request.auditTrail.push({
            timestamp: new Date(),
            action: 'deletion_request_approved',
            user: approver,
            details: { approvalReason: 'Compliance requirement' }
        });
        logger_1.logger.info('Data subject deletion request approved', { requestId, approver });
    }
    async generateComplianceReport(startDate, endDate) {
        const reportId = crypto.randomUUID();
        const executedJobs = Array.from(this.activeJobs.values())
            .filter(job => job.startTime >= startDate && job.startTime <= endDate);
        const completedRequests = Array.from(this.deletionRequests.values())
            .filter(req => req.processedAt && req.processedAt >= startDate && req.processedAt <= endDate);
        const report = {
            id: reportId,
            generatedAt: new Date(),
            period: { start: startDate, end: endDate },
            policiesExecuted: executedJobs.length,
            recordsDeleted: executedJobs.reduce((sum, job) => sum + job.recordsDeleted, 0),
            dataSubjectRequests: completedRequests.length,
            complianceScore: this.calculateComplianceScore(executedJobs, completedRequests),
            gdprCompliance: {
                rightToErasure: completedRequests.filter(req => req.regulation === DataClassificationService_1.PrivacyRegulation.GDPR).length,
                dataPortability: 0,
                retentionCompliance: this.calculateRetentionCompliance(DataClassificationService_1.PrivacyRegulation.GDPR),
                breachNotifications: 0
            },
            ccpaCompliance: {
                deletionRequests: completedRequests.filter(req => req.regulation === DataClassificationService_1.PrivacyRegulation.CCPA).length,
                doNotSell: 0,
                accessRequests: 0,
                dataMinimization: this.calculateDataMinimizationScore()
            },
            issues: [],
            recommendations: [],
            auditor: 'system',
            nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        };
        report.issues = await this.identifyComplianceIssues(executedJobs, completedRequests);
        report.recommendations = this.generateComplianceRecommendations(report.issues);
        this.complianceReports.set(reportId, report);
        logger_1.logger.info('Compliance report generated', {
            reportId,
            period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
            complianceScore: report.complianceScore,
            issues: report.issues.length
        });
        return reportId;
    }
    calculateComplianceScore(jobs, requests) {
        const totalJobs = jobs.length;
        const successfulJobs = jobs.filter(job => job.status === 'completed' && job.errors.length === 0).length;
        const totalRequests = requests.length;
        const completedRequests = requests.filter(req => req.status === 'completed').length;
        if (totalJobs === 0 && totalRequests === 0)
            return 100;
        const jobScore = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 100;
        const requestScore = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 100;
        return (jobScore + requestScore) / 2;
    }
    calculateRetentionCompliance(regulation) {
        const relevantPolicies = Array.from(this.retentionPolicies.values())
            .filter(policy => policy.regulations.includes(regulation));
        const enabledPolicies = relevantPolicies.filter(policy => policy.enabled);
        return relevantPolicies.length > 0 ? (enabledPolicies.length / relevantPolicies.length) * 100 : 100;
    }
    calculateDataMinimizationScore() {
        const stats = DataClassificationService_1.dataClassificationService.getStats();
        return stats.complianceScore;
    }
    async identifyComplianceIssues(jobs, requests) {
        const issues = [];
        const failedJobs = jobs.filter(job => job.status === 'failed').length;
        if (failedJobs > 0) {
            issues.push({
                severity: 'HIGH',
                description: 'Failed retention policy executions',
                count: failedJobs,
                recommendation: 'Review and fix failed retention policies'
            });
        }
        const overdueRequests = requests.filter(req => req.status !== 'completed' && req.deadline < new Date()).length;
        if (overdueRequests > 0) {
            issues.push({
                severity: 'CRITICAL',
                description: 'Overdue data subject deletion requests',
                count: overdueRequests,
                recommendation: 'Process overdue requests immediately to avoid regulatory penalties'
            });
        }
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
    generateComplianceRecommendations(issues) {
        const recommendations = [];
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
    startScheduledExecution() {
        for (const [policyId, policy] of this.retentionPolicies.entries()) {
            if (policy.enabled && policy.schedule) {
                const interval = this.parseCronToInterval(policy.schedule);
                const scheduledExecution = setInterval(() => {
                    this.executeRetentionPolicy(policyId, false).catch(error => {
                        logger_1.logger.error(`Scheduled retention policy execution failed for ${(0, inputSanitizer_1.sanitizeForLog)(policyId)}:`, error);
                    });
                }, interval);
                this.executionScheduler.push(scheduledExecution);
                logger_1.logger.debug('Scheduled retention policy execution', {
                    policyId,
                    schedule: policy.schedule,
                    interval
                });
            }
        }
        logger_1.logger.info('Scheduled retention execution started', {
            scheduledPolicies: this.executionScheduler.length
        });
    }
    parseCronToInterval(cronExpression) {
        if (cronExpression === '0 0 * * *')
            return 24 * 60 * 60 * 1000;
        if (cronExpression === '0 2 * * 0')
            return 7 * 24 * 60 * 60 * 1000;
        if (cronExpression === '0 3 1 * *')
            return 30 * 24 * 60 * 60 * 1000;
        return 24 * 60 * 60 * 1000;
    }
    getStats() {
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
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.complianceScore < 95) {
            status = 'warning';
        }
        if (stats.pendingDeletionRequests > 5) {
            status = 'degraded';
        }
        if (stats.complianceScore < 80) {
            status = 'critical';
        }
        const overdueRequests = Array.from(this.deletionRequests.values())
            .filter(req => req.status !== 'completed' && req.deadline < new Date()).length;
        if (overdueRequests > 0) {
            status = 'critical';
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
exports.DataRetentionService = DataRetentionService;
exports.dataRetentionService = DataRetentionService.getInstance();
//# sourceMappingURL=DataRetentionService.js.map