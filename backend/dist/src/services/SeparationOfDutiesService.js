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
exports.separationOfDutiesService = exports.SeparationOfDutiesService = exports.SeparationLevel = exports.ConflictType = exports.OperationType = exports.DutyCategory = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var DutyCategory;
(function (DutyCategory) {
    DutyCategory["DEPLOYMENT"] = "deployment";
    DutyCategory["PAYMENT_PROCESSING"] = "payment_processing";
    DutyCategory["KEY_MANAGEMENT"] = "key_management";
    DutyCategory["USER_MANAGEMENT"] = "user_management";
    DutyCategory["DATA_MANAGEMENT"] = "data_management";
    DutyCategory["SECURITY_ADMINISTRATION"] = "security_administration";
    DutyCategory["SYSTEM_ADMINISTRATION"] = "system_administration";
    DutyCategory["AUDIT_MANAGEMENT"] = "audit_management";
    DutyCategory["COMPLIANCE_MANAGEMENT"] = "compliance_management";
})(DutyCategory || (exports.DutyCategory = DutyCategory = {}));
var OperationType;
(function (OperationType) {
    OperationType["CREATE"] = "create";
    OperationType["READ"] = "read";
    OperationType["UPDATE"] = "update";
    OperationType["DELETE"] = "delete";
    OperationType["EXECUTE"] = "execute";
    OperationType["APPROVE"] = "approve";
    OperationType["REVIEW"] = "review";
    OperationType["AUTHORIZE"] = "authorize";
})(OperationType || (exports.OperationType = OperationType = {}));
var ConflictType;
(function (ConflictType) {
    ConflictType["ROLE_CONFLICT"] = "role_conflict";
    ConflictType["DUTY_CONFLICT"] = "duty_conflict";
    ConflictType["TEMPORAL_CONFLICT"] = "temporal_conflict";
    ConflictType["HIERARCHY_CONFLICT"] = "hierarchy_conflict";
    ConflictType["VENDOR_CONFLICT"] = "vendor_conflict";
})(ConflictType || (exports.ConflictType = ConflictType = {}));
var SeparationLevel;
(function (SeparationLevel) {
    SeparationLevel["WEAK"] = "weak";
    SeparationLevel["STRONG"] = "strong";
    SeparationLevel["ABSOLUTE"] = "absolute";
})(SeparationLevel || (exports.SeparationLevel = SeparationLevel = {}));
class SeparationOfDutiesService {
    constructor() {
        this.dutyRoles = new Map();
        this.separationRules = new Map();
        this.dutyAssignments = new Map();
        this.recentOperations = new Map();
        this.userRoleCache = new Map();
        this.initializeSeparationOfDuties();
        this.loadDutyRoles();
        this.loadSeparationRules();
        this.initializeMetrics();
        this.startSeparationMonitoring();
        logger_1.logger.info('Separation of Duties Service initialized', {
            dutyRoles: this.dutyRoles.size,
            separationRules: this.separationRules.size,
            enforcementEnabled: true,
            complianceTracking: true
        });
    }
    static getInstance() {
        if (!SeparationOfDutiesService.instance) {
            SeparationOfDutiesService.instance = new SeparationOfDutiesService();
        }
        return SeparationOfDutiesService.instance;
    }
    async initializeSeparationOfDuties() {
        try {
            await this.initializeCompatibilityMatrix();
            await this.setupViolationDetection();
            await this.initializeComplianceTracking();
            logger_1.logger.info('Separation of duties initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize separation of duties:', error);
            throw error;
        }
    }
    async initializeCompatibilityMatrix() {
        logger_1.logger.debug('Role compatibility matrix initialized');
    }
    async setupViolationDetection() {
        logger_1.logger.debug('Violation detection engine setup completed');
    }
    async initializeComplianceTracking() {
        logger_1.logger.debug('Compliance tracking initialized');
    }
    loadDutyRoles() {
        const deploymentRole = {
            id: 'deployment-engineer',
            name: 'Deployment Engineer',
            description: 'Responsible for application deployments and releases',
            category: DutyCategory.DEPLOYMENT,
            permissions: [
                'deployment:execute', 'release:create', 'environment:access',
                'pipeline:trigger', 'config:deploy'
            ],
            operationTypes: [OperationType.EXECUTE, OperationType.CREATE],
            resourceAccess: ['ci_cd_systems', 'deployment_environments', 'release_artifacts'],
            incompatibleRoles: ['payment-processor', 'key-manager', 'security-auditor'],
            requiredSeparationLevel: SeparationLevel.STRONG,
            requiresApproval: true,
            approverRoles: ['deployment-manager', 'release-manager'],
            multiPersonApproval: false,
            cooldownPeriod: 60,
            timeWindowRestrictions: [
                {
                    start: '09:00',
                    end: '17:00',
                    timezone: 'UTC',
                    days: [1, 2, 3, 4, 5]
                }
            ],
            riskLevel: 'high',
            maxOperationsPerDay: 10,
            requiresSecondPerson: true,
            auditLevel: 'comprehensive',
            realTimeMonitoring: true,
            complianceRelevant: true,
            regulations: ['SOX', 'Change_Management'],
            active: true,
            createdAt: new Date(),
            lastModified: new Date()
        };
        const paymentProcessorRole = {
            id: 'payment-processor',
            name: 'Payment Processor',
            description: 'Handles payment processing and financial transactions',
            category: DutyCategory.PAYMENT_PROCESSING,
            permissions: [
                'payment:process', 'transaction:create', 'refund:execute',
                'financial:read', 'settlement:manage'
            ],
            operationTypes: [OperationType.CREATE, OperationType.UPDATE, OperationType.EXECUTE],
            resourceAccess: ['payment_gateway', 'financial_systems', 'transaction_database'],
            incompatibleRoles: ['deployment-engineer', 'system-admin', 'security-auditor'],
            requiredSeparationLevel: SeparationLevel.ABSOLUTE,
            requiresApproval: true,
            approverRoles: ['finance-manager', 'payment-supervisor'],
            multiPersonApproval: true,
            cooldownPeriod: 30,
            timeWindowRestrictions: [
                {
                    start: '08:00',
                    end: '18:00',
                    timezone: 'UTC',
                    days: [1, 2, 3, 4, 5]
                }
            ],
            riskLevel: 'critical',
            maxOperationsPerDay: 50,
            requiresSecondPerson: true,
            auditLevel: 'comprehensive',
            realTimeMonitoring: true,
            complianceRelevant: true,
            regulations: ['SOX', 'PCI_DSS', 'GAAP'],
            active: true,
            createdAt: new Date(),
            lastModified: new Date()
        };
        const keyManagerRole = {
            id: 'key-manager',
            name: 'Cryptographic Key Manager',
            description: 'Manages cryptographic keys and certificates',
            category: DutyCategory.KEY_MANAGEMENT,
            permissions: [
                'key:create', 'key:rotate', 'key:revoke', 'certificate:manage',
                'vault:admin', 'encryption:configure'
            ],
            operationTypes: [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE],
            resourceAccess: ['key_vault', 'hsm_systems', 'certificate_authority'],
            incompatibleRoles: ['deployment-engineer', 'payment-processor', 'system-admin'],
            requiredSeparationLevel: SeparationLevel.ABSOLUTE,
            requiresApproval: true,
            approverRoles: ['security-director', 'crypto-officer'],
            multiPersonApproval: true,
            cooldownPeriod: 120,
            timeWindowRestrictions: [
                {
                    start: '10:00',
                    end: '16:00',
                    timezone: 'UTC',
                    days: [1, 2, 3, 4, 5]
                }
            ],
            riskLevel: 'critical',
            maxOperationsPerDay: 5,
            requiresSecondPerson: true,
            auditLevel: 'comprehensive',
            realTimeMonitoring: true,
            complianceRelevant: true,
            regulations: ['FIPS_140', 'Common_Criteria', 'SOX'],
            active: true,
            createdAt: new Date(),
            lastModified: new Date()
        };
        const securityAuditorRole = {
            id: 'security-auditor',
            name: 'Security Auditor',
            description: 'Reviews and audits security controls and compliance',
            category: DutyCategory.AUDIT_MANAGEMENT,
            permissions: [
                'audit:read', 'logs:analyze', 'compliance:review',
                'security:assess', 'report:generate'
            ],
            operationTypes: [OperationType.READ, OperationType.REVIEW],
            resourceAccess: ['audit_logs', 'security_reports', 'compliance_systems'],
            incompatibleRoles: ['deployment-engineer', 'payment-processor', 'key-manager'],
            requiredSeparationLevel: SeparationLevel.STRONG,
            requiresApproval: false,
            approverRoles: [],
            multiPersonApproval: false,
            cooldownPeriod: 0,
            timeWindowRestrictions: [
                {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            ],
            riskLevel: 'medium',
            maxOperationsPerDay: 100,
            requiresSecondPerson: false,
            auditLevel: 'enhanced',
            realTimeMonitoring: true,
            complianceRelevant: true,
            regulations: ['SOX', 'ISO_27001', 'NIST'],
            active: true,
            createdAt: new Date(),
            lastModified: new Date()
        };
        const systemAdminRole = {
            id: 'system-admin',
            name: 'System Administrator',
            description: 'Manages system infrastructure and operations',
            category: DutyCategory.SYSTEM_ADMINISTRATION,
            permissions: [
                'system:admin', 'server:manage', 'network:configure',
                'monitoring:admin', 'backup:manage'
            ],
            operationTypes: [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE, OperationType.EXECUTE],
            resourceAccess: ['servers', 'networks', 'monitoring_systems', 'backup_systems'],
            incompatibleRoles: ['payment-processor', 'security-auditor'],
            requiredSeparationLevel: SeparationLevel.STRONG,
            requiresApproval: true,
            approverRoles: ['infrastructure-manager', 'security-director'],
            multiPersonApproval: false,
            cooldownPeriod: 30,
            timeWindowRestrictions: [
                {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            ],
            riskLevel: 'high',
            maxOperationsPerDay: 20,
            requiresSecondPerson: true,
            auditLevel: 'comprehensive',
            realTimeMonitoring: true,
            complianceRelevant: true,
            regulations: ['SOX', 'ISO_27001'],
            active: true,
            createdAt: new Date(),
            lastModified: new Date()
        };
        this.dutyRoles.set(deploymentRole.id, deploymentRole);
        this.dutyRoles.set(paymentProcessorRole.id, paymentProcessorRole);
        this.dutyRoles.set(keyManagerRole.id, keyManagerRole);
        this.dutyRoles.set(securityAuditorRole.id, securityAuditorRole);
        this.dutyRoles.set(systemAdminRole.id, systemAdminRole);
        logger_1.logger.info('Duty roles loaded', {
            roleCount: this.dutyRoles.size,
            absoluteSeparationRoles: Array.from(this.dutyRoles.values())
                .filter(r => r.requiredSeparationLevel === SeparationLevel.ABSOLUTE).length
        });
    }
    loadSeparationRules() {
        const deploymentPaymentRule = {
            id: 'deployment-payment-separation',
            name: 'Deployment and Payment Processing Separation',
            description: 'Users cannot perform both deployment and payment processing duties',
            primaryDuty: DutyCategory.DEPLOYMENT,
            conflictingDuties: [DutyCategory.PAYMENT_PROCESSING],
            conflictType: ConflictType.DUTY_CONFLICT,
            separationLevel: SeparationLevel.ABSOLUTE,
            temporalSeparation: {
                enabled: true,
                minimumHours: 24,
                maximumDays: 30
            },
            allowedExceptions: {
                emergencyOverride: false,
                seniorApproval: false,
                businessJustification: false,
                timeboxed: false
            },
            enforcementLevel: 'fatal',
            automaticEnforcement: true,
            violationAlerts: true,
            alertRecipients: ['security@company.com', 'compliance@company.com'],
            complianceReasons: ['SOX_404', 'Financial_Controls'],
            regulatoryRequirements: ['SOX', 'GAAP'],
            priority: 10,
            enabled: true,
            createdBy: 'compliance_officer',
            createdAt: new Date(),
            lastReviewed: new Date()
        };
        const paymentKeyRule = {
            id: 'payment-key-separation',
            name: 'Payment Processing and Key Management Separation',
            description: 'Payment processors cannot manage cryptographic keys',
            primaryDuty: DutyCategory.PAYMENT_PROCESSING,
            conflictingDuties: [DutyCategory.KEY_MANAGEMENT],
            conflictType: ConflictType.DUTY_CONFLICT,
            separationLevel: SeparationLevel.ABSOLUTE,
            temporalSeparation: {
                enabled: true,
                minimumHours: 48,
                maximumDays: 90
            },
            allowedExceptions: {
                emergencyOverride: false,
                seniorApproval: false,
                businessJustification: false,
                timeboxed: false
            },
            enforcementLevel: 'fatal',
            automaticEnforcement: true,
            violationAlerts: true,
            alertRecipients: ['security@company.com', 'ciso@company.com'],
            complianceReasons: ['Cryptographic_Controls', 'Financial_Security'],
            regulatoryRequirements: ['PCI_DSS', 'FIPS_140'],
            priority: 10,
            enabled: true,
            createdBy: 'security_architect',
            createdAt: new Date(),
            lastReviewed: new Date()
        };
        const auditIndependenceRule = {
            id: 'audit-independence',
            name: 'Audit Independence Rule',
            description: 'Auditors cannot audit systems they operate or manage',
            primaryDuty: DutyCategory.AUDIT_MANAGEMENT,
            conflictingDuties: [
                DutyCategory.DEPLOYMENT,
                DutyCategory.PAYMENT_PROCESSING,
                DutyCategory.KEY_MANAGEMENT,
                DutyCategory.SYSTEM_ADMINISTRATION
            ],
            conflictType: ConflictType.DUTY_CONFLICT,
            separationLevel: SeparationLevel.STRONG,
            temporalSeparation: {
                enabled: true,
                minimumHours: 168,
                maximumDays: 365
            },
            allowedExceptions: {
                emergencyOverride: true,
                seniorApproval: true,
                businessJustification: true,
                timeboxed: true
            },
            enforcementLevel: 'blocking',
            automaticEnforcement: true,
            violationAlerts: true,
            alertRecipients: ['audit@company.com', 'compliance@company.com'],
            complianceReasons: ['Audit_Independence', 'SOX_302'],
            regulatoryRequirements: ['SOX', 'ISO_27001'],
            priority: 9,
            enabled: true,
            createdBy: 'audit_director',
            createdAt: new Date(),
            lastReviewed: new Date()
        };
        const deploymentSystemRule = {
            id: 'deployment-system-temporal',
            name: 'Deployment and System Administration Temporal Separation',
            description: 'Minimum time gap required between deployment and system administration operations',
            primaryDuty: DutyCategory.DEPLOYMENT,
            conflictingDuties: [DutyCategory.SYSTEM_ADMINISTRATION],
            conflictType: ConflictType.TEMPORAL_CONFLICT,
            separationLevel: SeparationLevel.STRONG,
            temporalSeparation: {
                enabled: true,
                minimumHours: 4,
                maximumDays: 7
            },
            allowedExceptions: {
                emergencyOverride: true,
                seniorApproval: true,
                businessJustification: true,
                timeboxed: true
            },
            enforcementLevel: 'blocking',
            automaticEnforcement: true,
            violationAlerts: true,
            alertRecipients: ['security@company.com'],
            complianceReasons: ['Change_Management', 'Operational_Security'],
            regulatoryRequirements: ['SOX', 'ITIL'],
            priority: 7,
            enabled: true,
            createdBy: 'security_architect',
            createdAt: new Date(),
            lastReviewed: new Date()
        };
        const keyDeploymentRule = {
            id: 'key-deployment-separation',
            name: 'Key Management and Deployment Separation',
            description: 'Key managers cannot perform deployments that use those keys',
            primaryDuty: DutyCategory.KEY_MANAGEMENT,
            conflictingDuties: [DutyCategory.DEPLOYMENT],
            conflictType: ConflictType.DUTY_CONFLICT,
            separationLevel: SeparationLevel.STRONG,
            temporalSeparation: {
                enabled: true,
                minimumHours: 12,
                maximumDays: 30
            },
            allowedExceptions: {
                emergencyOverride: true,
                seniorApproval: true,
                businessJustification: true,
                timeboxed: true
            },
            enforcementLevel: 'blocking',
            automaticEnforcement: true,
            violationAlerts: true,
            alertRecipients: ['security@company.com'],
            complianceReasons: ['Key_Security', 'Deployment_Controls'],
            regulatoryRequirements: ['FIPS_140', 'Common_Criteria'],
            priority: 8,
            enabled: true,
            createdBy: 'crypto_officer',
            createdAt: new Date(),
            lastReviewed: new Date()
        };
        this.separationRules.set(deploymentPaymentRule.id, deploymentPaymentRule);
        this.separationRules.set(paymentKeyRule.id, paymentKeyRule);
        this.separationRules.set(auditIndependenceRule.id, auditIndependenceRule);
        this.separationRules.set(deploymentSystemRule.id, deploymentSystemRule);
        this.separationRules.set(keyDeploymentRule.id, keyDeploymentRule);
        logger_1.logger.info('Separation rules loaded', {
            ruleCount: this.separationRules.size,
            absoluteRules: Array.from(this.separationRules.values())
                .filter(r => r.separationLevel === SeparationLevel.ABSOLUTE).length,
            automaticEnforcement: Array.from(this.separationRules.values())
                .filter(r => r.automaticEnforcement).length
        });
    }
    initializeMetrics() {
        this.metrics = {
            totalOperations: 0,
            approvedOperations: 0,
            blockedOperations: 0,
            overriddenOperations: 0,
            totalViolations: 0,
            violationsByType: {
                [ConflictType.ROLE_CONFLICT]: 0,
                [ConflictType.DUTY_CONFLICT]: 0,
                [ConflictType.TEMPORAL_CONFLICT]: 0,
                [ConflictType.HIERARCHY_CONFLICT]: 0,
                [ConflictType.VENDOR_CONFLICT]: 0
            },
            violationsBySeverity: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            },
            complianceScore: 100,
            auditFindings: 0,
            regulatoryViolations: 0,
            activeAssignments: 0,
            temporaryAssignments: 0,
            expiredAssignments: 0,
            averageApprovalTime: 0,
            systemAvailability: 100,
            periodStart: new Date(),
            periodEnd: new Date()
        };
        logger_1.logger.debug('Separation of duties metrics initialized');
    }
    async checkSeparationOfDuties(userId, username, dutyCategory, operationType, resource, action, options = {}) {
        const operationId = crypto.randomUUID();
        try {
            const operation = {
                id: operationId,
                userId,
                username,
                dutyCategory,
                operationType,
                resource,
                action,
                timestamp: new Date(),
                sourceIp: options.sourceIp || 'unknown',
                userAgent: options.userAgent,
                sessionId: options.sessionId,
                requiresApproval: false,
                approved: false,
                separationChecked: false,
                violationsDetected: [],
                proceededWithViolation: false,
                overrideReason: options.businessJustification,
                status: 'pending',
                complianceRelevant: true,
                auditRequired: true,
                createdAt: new Date()
            };
            this.recentOperations.set(operationId, operation);
            const userRoles = await this.getUserRoleAssignments(userId);
            const violations = await this.detectSeparationViolations(userId, dutyCategory, operationType, userRoles, operation);
            operation.violationsDetected = violations;
            operation.separationChecked = true;
            let allowed = true;
            let requiresApproval = false;
            let approverRoles = [];
            const fatalViolations = violations.filter(v => v.severity === 'critical');
            if (fatalViolations.length > 0 && !options.emergencyOverride) {
                allowed = false;
                operation.status = 'blocked';
                this.metrics.blockedOperations++;
            }
            const dutyRole = this.findDutyRole(dutyCategory);
            if (dutyRole && dutyRole.requiresApproval) {
                requiresApproval = true;
                approverRoles = dutyRole.approverRoles;
                operation.requiresApproval = true;
            }
            const approvalViolations = violations.filter(v => v.recommendedAction === 'require_approval');
            if (approvalViolations.length > 0) {
                requiresApproval = true;
                approverRoles = [...new Set([...approverRoles, ...this.getApproversForViolations(approvalViolations)])];
            }
            if (options.emergencyOverride && fatalViolations.length > 0) {
                allowed = true;
                operation.proceededWithViolation = true;
                operation.overrideReason = options.businessJustification || 'Emergency override';
                this.metrics.overriddenOperations++;
                await this.sendViolationAlerts(violations, operation, true);
            }
            this.metrics.totalOperations++;
            if (violations.length > 0) {
                this.metrics.totalViolations += violations.length;
                violations.forEach(v => {
                    this.metrics.violationsBySeverity[v.severity]++;
                });
            }
            if (violations.length > 0 && !options.emergencyOverride) {
                await this.sendViolationAlerts(violations, operation, false);
            }
            logger_1.logger.info('Separation of duties check completed', {
                operationId,
                userId,
                username,
                dutyCategory,
                operationType,
                allowed,
                violationCount: violations.length,
                requiresApproval,
                emergencyOverride: options.emergencyOverride
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'separation_of_duties_check',
                severity: violations.length > 0 ? 'HIGH' : 'LOW',
                category: 'authorization',
                ipAddress: options.sourceIp || 'unknown',
                success: allowed,
                details: {
                    operationId,
                    userId,
                    username,
                    dutyCategory,
                    operationType,
                    resource,
                    action,
                    violationCount: violations.length,
                    fatalViolations: fatalViolations.length,
                    allowed,
                    requiresApproval,
                    emergencyOverride: options.emergencyOverride
                },
                riskScore: this.calculateOperationRiskScore(operation, violations),
                tags: ['separation_of_duties', 'access_control', 'compliance'],
                compliance: {
                    pii: false,
                    gdpr: false,
                    pci: dutyCategory === DutyCategory.PAYMENT_PROCESSING,
                    hipaa: false
                }
            });
            return {
                allowed,
                violations,
                requiresApproval,
                approverRoles,
                operationId
            };
        }
        catch (error) {
            logger_1.logger.error('Separation of duties check failed', {
                operationId,
                userId,
                dutyCategory,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async getUserRoleAssignments(userId) {
        const assignments = Array.from(this.dutyAssignments.values())
            .filter(assignment => assignment.userId === userId &&
            assignment.status === 'active' &&
            (!assignment.expiresAt || assignment.expiresAt > new Date()));
        return assignments;
    }
    async detectSeparationViolations(userId, dutyCategory, operationType, userRoles, operation) {
        const violations = [];
        for (const rule of this.separationRules.values()) {
            if (!rule.enabled)
                continue;
            const violation = await this.checkRule(rule, userId, dutyCategory, operationType, userRoles, operation);
            if (violation) {
                violations.push(violation);
                this.metrics.violationsByType[violation.violationType]++;
            }
        }
        return violations;
    }
    async checkRule(rule, userId, dutyCategory, operationType, userRoles, _operation) {
        if (rule.primaryDuty !== dutyCategory && !rule.conflictingDuties.includes(dutyCategory)) {
            return null;
        }
        let violationType;
        let conflictingOperations = [];
        let severity = 'low';
        const conflictingRoles = userRoles.filter(role => {
            const dutyRole = this.dutyRoles.get(role.roleId);
            return dutyRole && rule.conflictingDuties.includes(dutyRole.category);
        });
        if (conflictingRoles.length > 0) {
            violationType = ConflictType.ROLE_CONFLICT;
            conflictingOperations = conflictingRoles.map(r => r.roleName);
            severity = rule.separationLevel === SeparationLevel.ABSOLUTE ? 'critical' : 'high';
        }
        else if (rule.temporalSeparation.enabled) {
            const temporalConflict = await this.checkTemporalConflicts(userId, rule.conflictingDuties, rule.temporalSeparation.minimumHours);
            if (temporalConflict) {
                violationType = ConflictType.TEMPORAL_CONFLICT;
                conflictingOperations = temporalConflict.operations;
                severity = 'medium';
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
        let recommendedAction;
        switch (rule.enforcementLevel) {
            case 'fatal':
                recommendedAction = 'block';
                break;
            case 'blocking':
                recommendedAction = 'require_approval';
                break;
            case 'advisory':
                recommendedAction = 'warn';
                break;
            default:
                recommendedAction = 'warn';
        }
        const canOverride = rule.allowedExceptions.emergencyOverride ||
            rule.allowedExceptions.seniorApproval ||
            rule.allowedExceptions.businessJustification;
        return {
            violationType,
            severity,
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            conflictingOperations,
            recommendedAction,
            canOverride,
            overrideRequirements: this.getOverrideRequirements(rule)
        };
    }
    async checkTemporalConflicts(userId, conflictingDuties, minimumHours) {
        const cutoffTime = new Date(Date.now() - minimumHours * 60 * 60 * 1000);
        const recentConflictingOperations = Array.from(this.recentOperations.values())
            .filter(op => op.userId === userId &&
            conflictingDuties.includes(op.dutyCategory) &&
            op.timestamp > cutoffTime &&
            op.status === 'executed');
        if (recentConflictingOperations.length > 0) {
            return {
                operations: recentConflictingOperations.map(op => `${op.dutyCategory}:${op.operationType}:${op.resource}`)
            };
        }
        return null;
    }
    getOverrideRequirements(rule) {
        const requirements = [];
        if (rule.allowedExceptions.emergencyOverride) {
            requirements.push('emergency_override');
        }
        if (rule.allowedExceptions.seniorApproval) {
            requirements.push('senior_approval');
        }
        if (rule.allowedExceptions.businessJustification) {
            requirements.push('business_justification');
        }
        if (rule.allowedExceptions.timeboxed) {
            requirements.push('time_limited');
        }
        return requirements;
    }
    findDutyRole(dutyCategory) {
        for (const role of this.dutyRoles.values()) {
            if (role.category === dutyCategory) {
                return role;
            }
        }
        return null;
    }
    getApproversForViolations(violations) {
        const approvers = [];
        for (const violation of violations) {
            const rule = this.separationRules.get(violation.ruleId);
            if (rule && rule.alertRecipients) {
                approvers.push(...rule.alertRecipients);
            }
        }
        return [...new Set(approvers)];
    }
    calculateOperationRiskScore(operation, violations) {
        let riskScore = 0;
        switch (operation.dutyCategory) {
            case DutyCategory.PAYMENT_PROCESSING:
                riskScore += 40;
                break;
            case DutyCategory.KEY_MANAGEMENT:
                riskScore += 35;
                break;
            case DutyCategory.DEPLOYMENT:
                riskScore += 30;
                break;
            case DutyCategory.SYSTEM_ADMINISTRATION:
                riskScore += 25;
                break;
            default:
                riskScore += 15;
        }
        violations.forEach(violation => {
            switch (violation.severity) {
                case 'critical':
                    riskScore += 30;
                    break;
                case 'high':
                    riskScore += 20;
                    break;
                case 'medium':
                    riskScore += 10;
                    break;
                case 'low':
                    riskScore += 5;
                    break;
            }
        });
        if (operation.proceededWithViolation) {
            riskScore += 25;
        }
        return Math.max(0, Math.min(100, riskScore));
    }
    async sendViolationAlerts(violations, operation, emergencyOverride) {
        const alertContent = {
            type: emergencyOverride ? 'separation_violation_override' : 'separation_violation_detected',
            operationId: operation.id,
            userId: operation.userId,
            username: operation.username,
            dutyCategory: operation.dutyCategory,
            operationType: operation.operationType,
            resource: operation.resource,
            violations: violations.map(v => ({
                ruleId: v.ruleId,
                ruleName: v.ruleName,
                severity: v.severity,
                conflictingOperations: v.conflictingOperations
            })),
            timestamp: new Date().toISOString(),
            emergencyOverride
        };
        logger_1.logger.error('SEPARATION OF DUTIES VIOLATION ALERT', {
            alertContent,
            criticalViolations: violations.filter(v => v.severity === 'critical').length
        });
    }
    startSeparationMonitoring() {
        setInterval(() => {
            this.monitorRoleAssignments();
        }, 60 * 1000);
        setInterval(() => {
            this.cleanupOldOperations();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.generateComplianceReport();
        }, 24 * 60 * 60 * 1000);
        logger_1.logger.info('Separation of duties monitoring started');
    }
    monitorRoleAssignments() {
        const now = new Date();
        let expiredAssignments = 0;
        for (const [assignmentId, assignment] of this.dutyAssignments.entries()) {
            if (assignment.status === 'active' && assignment.expiresAt && assignment.expiresAt < now) {
                assignment.status = 'expired';
                expiredAssignments++;
                logger_1.logger.info('Duty assignment expired', {
                    assignmentId,
                    userId: assignment.userId,
                    roleName: assignment.roleName
                });
            }
        }
        if (expiredAssignments > 0) {
            this.metrics.expiredAssignments += expiredAssignments;
        }
    }
    cleanupOldOperations() {
        const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;
        for (const [operationId, operation] of this.recentOperations.entries()) {
            if (operation.createdAt < cutoffTime) {
                this.recentOperations.delete(operationId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up old separation operations', { cleanedCount });
        }
    }
    generateComplianceReport() {
        const violationRate = this.metrics.totalOperations > 0
            ? (this.metrics.totalViolations / this.metrics.totalOperations) * 100
            : 0;
        const complianceScore = Math.max(0, 100 - violationRate);
        this.metrics.complianceScore = complianceScore;
        const report = {
            reportDate: new Date(),
            complianceScore,
            totalOperations: this.metrics.totalOperations,
            totalViolations: this.metrics.totalViolations,
            violationRate,
            criticalViolations: this.metrics.violationsBySeverity.critical,
            blockedOperations: this.metrics.blockedOperations,
            overriddenOperations: this.metrics.overriddenOperations
        };
        logger_1.logger.info('Separation of duties compliance report generated', report);
    }
    getStats() {
        return { ...this.metrics };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.complianceScore < 95) {
            status = 'warning';
        }
        if (stats.violationsBySeverity.critical > 0) {
            status = 'critical';
        }
        if (stats.overriddenOperations > 5) {
            status = 'warning';
        }
        const recentViolations = Array.from(this.recentOperations.values())
            .filter(op => op.violationsDetected.length > 0 &&
            op.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;
        if (recentViolations > 10) {
            status = 'degraded';
        }
        return {
            status,
            stats: {
                ...stats,
                recentViolations,
                activeRules: Array.from(this.separationRules.values()).filter(r => r.enabled).length
            }
        };
    }
}
exports.SeparationOfDutiesService = SeparationOfDutiesService;
exports.separationOfDutiesService = SeparationOfDutiesService.getInstance();
//# sourceMappingURL=SeparationOfDutiesService.js.map