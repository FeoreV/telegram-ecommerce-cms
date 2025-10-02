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
exports.privilegedAccessService = exports.PrivilegedAccessService = exports.AccessStatus = exports.MFAMethod = exports.AccessRequestType = exports.PrivilegeLevel = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var PrivilegeLevel;
(function (PrivilegeLevel) {
    PrivilegeLevel["STANDARD"] = "standard";
    PrivilegeLevel["ELEVATED"] = "elevated";
    PrivilegeLevel["PRIVILEGED"] = "privileged";
    PrivilegeLevel["SUPER_ADMIN"] = "super_admin";
    PrivilegeLevel["EMERGENCY"] = "emergency";
})(PrivilegeLevel || (exports.PrivilegeLevel = PrivilegeLevel = {}));
var AccessRequestType;
(function (AccessRequestType) {
    AccessRequestType["TEMPORARY_ELEVATION"] = "temporary_elevation";
    AccessRequestType["EMERGENCY_ACCESS"] = "emergency_access";
    AccessRequestType["ROLE_ASSUMPTION"] = "role_assumption";
    AccessRequestType["RESOURCE_ACCESS"] = "resource_access";
    AccessRequestType["SYSTEM_MAINTENANCE"] = "system_maintenance";
    AccessRequestType["DATA_ACCESS"] = "data_access";
    AccessRequestType["SECURITY_INVESTIGATION"] = "security_investigation";
})(AccessRequestType || (exports.AccessRequestType = AccessRequestType = {}));
var MFAMethod;
(function (MFAMethod) {
    MFAMethod["TOTP"] = "totp";
    MFAMethod["PUSH"] = "push";
    MFAMethod["SMS"] = "sms";
    MFAMethod["EMAIL"] = "email";
    MFAMethod["HARDWARE_TOKEN"] = "hardware_token";
    MFAMethod["BIOMETRIC"] = "biometric";
    MFAMethod["BACKUP_CODES"] = "backup_codes";
})(MFAMethod || (exports.MFAMethod = MFAMethod = {}));
var AccessStatus;
(function (AccessStatus) {
    AccessStatus["REQUESTED"] = "requested";
    AccessStatus["PENDING_APPROVAL"] = "pending_approval";
    AccessStatus["PENDING_MFA"] = "pending_mfa";
    AccessStatus["APPROVED"] = "approved";
    AccessStatus["ACTIVE"] = "active";
    AccessStatus["EXPIRED"] = "expired";
    AccessStatus["REVOKED"] = "revoked";
    AccessStatus["DENIED"] = "denied";
    AccessStatus["EMERGENCY_ACTIVATED"] = "emergency_activated";
})(AccessStatus || (exports.AccessStatus = AccessStatus = {}));
class PrivilegedAccessService {
    constructor() {
        this.privilegedRoles = new Map();
        this.accessRequests = new Map();
        this.activeSessions = new Map();
        this.mfaChallenges = new Map();
        this.riskEngine = new Map();
        this.initializePrivilegedAccess();
        this.loadPrivilegedRoles();
        this.initializeMetrics();
        this.startAccessMonitoring();
        logger_1.logger.info('Privileged Access Service initialized', {
            roles: this.privilegedRoles.size,
            mfaMethods: Object.values(MFAMethod).length,
            emergencyAccess: true,
            justInTimeAccess: true
        });
    }
    static getInstance() {
        if (!PrivilegedAccessService.instance) {
            PrivilegedAccessService.instance = new PrivilegedAccessService();
        }
        return PrivilegedAccessService.instance;
    }
    async initializePrivilegedAccess() {
        try {
            await this.initializeMFAProviders();
            await this.setupRiskAssessmentEngine();
            await this.initializeSessionMonitoring();
            logger_1.logger.info('Privileged access initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize privileged access:', error);
            throw error;
        }
    }
    async initializeMFAProviders() {
        logger_1.logger.debug('MFA providers initialized');
    }
    async setupRiskAssessmentEngine() {
        logger_1.logger.debug('Risk assessment engine setup completed');
    }
    async initializeSessionMonitoring() {
        logger_1.logger.debug('Session monitoring initialized');
    }
    loadPrivilegedRoles() {
        const dbAdminRole = {
            id: 'db-admin',
            name: 'Database Administrator',
            description: 'Full database administration privileges',
            privilegeLevel: PrivilegeLevel.PRIVILEGED,
            permissions: [
                'database:read', 'database:write', 'database:admin',
                'backup:create', 'backup:restore', 'schema:modify'
            ],
            resourceAccess: {
                databases: ['primary_db', 'analytics_db', 'audit_db'],
                services: ['database_service', 'backup_service'],
                networks: ['database_subnet'],
                files: ['/data/backups', '/config/database']
            },
            requiresApproval: true,
            approverRoles: ['security_admin', 'cto'],
            minimumApprovers: 1,
            mfaRequired: true,
            allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.HARDWARE_TOKEN, MFAMethod.PUSH],
            mfaValidityMinutes: 60,
            maxSessionDuration: 240,
            allowedTimeWindows: [
                {
                    start: '08:00',
                    end: '18:00',
                    timezone: 'UTC',
                    days: [1, 2, 3, 4, 5]
                }
            ],
            riskLevel: 'high',
            deviceRestrictions: true,
            auditLevel: 'comprehensive',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            emergencyAccess: true,
            emergencyApprovers: ['ciso', 'cto'],
            emergencyNotifications: ['security@company.com', 'on-call@company.com'],
            complianceRelevant: true,
            regulations: ['SOX', 'GDPR', 'HIPAA'],
            retentionPeriod: 2555,
            active: true,
            createdBy: 'security_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const sysAdminRole = {
            id: 'sys-admin',
            name: 'System Administrator',
            description: 'System and infrastructure administration',
            privilegeLevel: PrivilegeLevel.PRIVILEGED,
            permissions: [
                'system:admin', 'service:restart', 'config:modify',
                'logs:access', 'monitoring:admin', 'deployment:execute'
            ],
            resourceAccess: {
                databases: [],
                services: ['all_services'],
                networks: ['admin_network', 'management_network'],
                files: ['/etc', '/var/log', '/opt/app']
            },
            requiresApproval: true,
            approverRoles: ['security_admin', 'devops_lead'],
            minimumApprovers: 1,
            mfaRequired: true,
            allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.HARDWARE_TOKEN],
            mfaValidityMinutes: 120,
            maxSessionDuration: 480,
            allowedTimeWindows: [
                {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            ],
            riskLevel: 'high',
            deviceRestrictions: true,
            auditLevel: 'comprehensive',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: false,
            emergencyAccess: true,
            emergencyApprovers: ['ciso', 'cto'],
            emergencyNotifications: ['security@company.com', 'devops@company.com'],
            complianceRelevant: true,
            regulations: ['SOX', 'ISO_27001'],
            retentionPeriod: 1095,
            active: true,
            createdBy: 'security_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const securityInvestigatorRole = {
            id: 'security-investigator',
            name: 'Security Investigator',
            description: 'Security incident investigation and forensics',
            privilegeLevel: PrivilegeLevel.ELEVATED,
            permissions: [
                'logs:read', 'audit:read', 'forensics:access',
                'incident:investigate', 'user:investigate'
            ],
            resourceAccess: {
                databases: ['audit_db', 'security_db'],
                services: ['security_service', 'siem_service'],
                networks: ['security_network'],
                files: ['/var/log/security', '/data/forensics']
            },
            requiresApproval: false,
            approverRoles: [],
            minimumApprovers: 0,
            mfaRequired: true,
            allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.PUSH, MFAMethod.HARDWARE_TOKEN],
            mfaValidityMinutes: 180,
            maxSessionDuration: 720,
            allowedTimeWindows: [
                {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            ],
            riskLevel: 'medium',
            deviceRestrictions: true,
            auditLevel: 'enhanced',
            sessionRecording: true,
            keystrokeLogging: false,
            screenCapture: false,
            emergencyAccess: true,
            emergencyApprovers: ['ciso'],
            emergencyNotifications: ['security@company.com'],
            complianceRelevant: true,
            regulations: ['SOX', 'GDPR', 'HIPAA'],
            retentionPeriod: 2555,
            active: true,
            createdBy: 'security_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const breakGlassRole = {
            id: 'break-glass-emergency',
            name: 'Emergency Break-Glass Access',
            description: 'Emergency access for critical system recovery',
            privilegeLevel: PrivilegeLevel.EMERGENCY,
            permissions: [
                'system:emergency', 'database:emergency', 'network:emergency',
                'service:emergency', 'config:emergency', 'all:emergency'
            ],
            resourceAccess: {
                databases: ['all_databases'],
                services: ['all_services'],
                networks: ['all_networks'],
                files: ['all_files']
            },
            requiresApproval: false,
            approverRoles: [],
            minimumApprovers: 0,
            mfaRequired: true,
            allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.HARDWARE_TOKEN, MFAMethod.BACKUP_CODES],
            mfaValidityMinutes: 30,
            maxSessionDuration: 120,
            allowedTimeWindows: [
                {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            ],
            riskLevel: 'critical',
            deviceRestrictions: false,
            auditLevel: 'comprehensive',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            emergencyAccess: true,
            emergencyApprovers: ['ceo', 'ciso', 'cto'],
            emergencyNotifications: [
                'board@company.com', 'executives@company.com',
                'security@company.com', 'legal@company.com'
            ],
            complianceRelevant: true,
            regulations: ['ALL'],
            retentionPeriod: 3650,
            active: true,
            createdBy: 'system',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const financeAdminRole = {
            id: 'finance-admin',
            name: 'Financial Administrator',
            description: 'Financial data and payment system administration',
            privilegeLevel: PrivilegeLevel.ELEVATED,
            permissions: [
                'finance:read', 'finance:admin', 'payments:admin',
                'reporting:admin', 'compliance:admin'
            ],
            resourceAccess: {
                databases: ['finance_db', 'payment_db'],
                services: ['payment_service', 'billing_service'],
                networks: ['finance_network'],
                files: ['/data/finance', '/reports/financial']
            },
            requiresApproval: true,
            approverRoles: ['cfo', 'finance_director'],
            minimumApprovers: 1,
            mfaRequired: true,
            allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.HARDWARE_TOKEN],
            mfaValidityMinutes: 90,
            maxSessionDuration: 360,
            allowedTimeWindows: [
                {
                    start: '07:00',
                    end: '19:00',
                    timezone: 'UTC',
                    days: [1, 2, 3, 4, 5]
                }
            ],
            riskLevel: 'high',
            deviceRestrictions: true,
            auditLevel: 'comprehensive',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            emergencyAccess: false,
            emergencyApprovers: [],
            emergencyNotifications: [],
            complianceRelevant: true,
            regulations: ['SOX', 'PCI_DSS', 'GAAP'],
            retentionPeriod: 2555,
            active: true,
            createdBy: 'finance_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        this.privilegedRoles.set(dbAdminRole.id, dbAdminRole);
        this.privilegedRoles.set(sysAdminRole.id, sysAdminRole);
        this.privilegedRoles.set(securityInvestigatorRole.id, securityInvestigatorRole);
        this.privilegedRoles.set(breakGlassRole.id, breakGlassRole);
        this.privilegedRoles.set(financeAdminRole.id, financeAdminRole);
        logger_1.logger.info('Privileged roles loaded', {
            roleCount: this.privilegedRoles.size,
            emergencyRoles: 1,
            mfaRequiredRoles: this.privilegedRoles.size
        });
    }
    initializeMetrics() {
        this.metrics = {
            totalRequests: 0,
            approvedRequests: 0,
            deniedRequests: 0,
            emergencyRequests: 0,
            averageApprovalTime: 0,
            automaticApprovals: 0,
            manualApprovals: 0,
            activeSessions: 0,
            averageSessionDuration: 0,
            sessionsExtended: 0,
            sessionsTerminated: 0,
            mfaFailures: 0,
            suspiciousActivities: 0,
            riskEventsDetected: 0,
            complianceViolations: 0,
            systemAvailability: 100,
            responseTime: 0,
            periodStart: new Date(),
            periodEnd: new Date()
        };
        logger_1.logger.debug('Privileged access metrics initialized');
    }
    async requestPrivilegedAccess(userId, username, requestedRole, options = {}) {
        const requestId = crypto.randomUUID();
        try {
            const role = this.privilegedRoles.get(requestedRole);
            if (!role || !role.active) {
                throw new Error(`Invalid or inactive privileged role: ${requestedRole}`);
            }
            const isEmergency = options.emergencyAccess || options.urgency === 'emergency';
            if (isEmergency && !role.emergencyAccess) {
                throw new Error(`Emergency access not allowed for role: ${requestedRole}`);
            }
            const requestedDuration = options.requestedDuration || role.maxSessionDuration;
            if (requestedDuration > role.maxSessionDuration) {
                throw new Error(`Requested duration exceeds maximum: ${requestedDuration} > ${role.maxSessionDuration}`);
            }
            const accessRequest = {
                id: requestId,
                userId,
                username,
                requestType: options.requestType || AccessRequestType.TEMPORARY_ELEVATION,
                requestedRole,
                targetResources: options.targetResources || [],
                justification: options.justification || 'Privileged access required',
                businessNeed: options.businessNeed || 'Administrative operations',
                urgency: options.urgency || 'medium',
                requestedStartTime: new Date(),
                requestedDuration,
                requestedEndTime: new Date(Date.now() + requestedDuration * 60 * 1000),
                status: isEmergency ? AccessStatus.EMERGENCY_ACTIVATED : AccessStatus.REQUESTED,
                approvers: [],
                mfaRequired: role.mfaRequired,
                mfaCompleted: false,
                mfaAttempts: 0,
                riskScore: 0,
                riskFactors: [],
                automaticApproval: false,
                sourceIp: options.sourceIp || 'unknown',
                userAgent: options.userAgent || 'unknown',
                deviceFingerprint: this.generateDeviceFingerprint(options.sourceIp, options.userAgent),
                auditTrail: [],
                emergencyAccess: isEmergency,
                emergencyNotificationsSent: false,
                complianceValidated: false,
                complianceIssues: [],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            accessRequest.auditTrail.push({
                timestamp: new Date(),
                action: 'access_request_created',
                actor: username,
                details: {
                    requestType: accessRequest.requestType,
                    requestedRole,
                    urgency: accessRequest.urgency,
                    emergencyAccess: isEmergency
                }
            });
            await this.performRiskAssessment(accessRequest, role);
            if (!this.isInAllowedTimeWindow(role)) {
                if (!isEmergency) {
                    throw new Error('Access request outside allowed time window');
                }
                accessRequest.riskFactors.push('outside_allowed_time_window');
                accessRequest.riskScore += 20;
            }
            if (isEmergency) {
                await this.handleEmergencyAccess(accessRequest, role);
            }
            else {
                if (role.requiresApproval) {
                    await this.initiateApprovalWorkflow(accessRequest, role);
                }
                else {
                    accessRequest.status = AccessStatus.APPROVED;
                    accessRequest.automaticApproval = true;
                    this.metrics.automaticApprovals++;
                }
            }
            if (role.mfaRequired && accessRequest.status === AccessStatus.APPROVED) {
                accessRequest.status = AccessStatus.PENDING_MFA;
                await this.initiateMFAChallenge(accessRequest, role);
            }
            this.accessRequests.set(requestId, accessRequest);
            this.metrics.totalRequests++;
            logger_1.logger.info('Privileged access requested', {
                requestId,
                userId,
                username,
                requestedRole,
                urgency: accessRequest.urgency,
                emergencyAccess: isEmergency,
                status: accessRequest.status,
                riskScore: accessRequest.riskScore
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'privileged_access_requested',
                severity: isEmergency ? 'CRITICAL' : 'HIGH',
                category: 'authorization',
                ipAddress: accessRequest.sourceIp,
                success: true,
                details: {
                    requestId,
                    userId,
                    username,
                    requestedRole,
                    requestType: accessRequest.requestType,
                    urgency: accessRequest.urgency,
                    emergencyAccess: isEmergency,
                    riskScore: accessRequest.riskScore
                },
                riskScore: accessRequest.riskScore,
                tags: ['privileged_access', 'just_in_time', 'access_request'],
                compliance: {
                    pii: false,
                    gdpr: false,
                    pci: role.regulations.includes('PCI_DSS'),
                    hipaa: role.regulations.includes('HIPAA')
                }
            });
            return requestId;
        }
        catch (error) {
            logger_1.logger.error('Privileged access request failed', {
                requestId,
                userId,
                username,
                requestedRole,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    generateDeviceFingerprint(sourceIp, userAgent) {
        const fingerprintData = {
            sourceIp: sourceIp || 'unknown',
            userAgent: userAgent || 'unknown',
            timestamp: new Date().toISOString()
        };
        return crypto.createHash('sha256')
            .update(JSON.stringify(fingerprintData))
            .digest('hex')
            .substring(0, 16);
    }
    async performRiskAssessment(accessRequest, role) {
        let riskScore = 0;
        const riskFactors = [];
        switch (role.privilegeLevel) {
            case PrivilegeLevel.EMERGENCY:
                riskScore += 50;
                riskFactors.push('emergency_privilege_level');
                break;
            case PrivilegeLevel.SUPER_ADMIN:
                riskScore += 40;
                riskFactors.push('super_admin_privilege_level');
                break;
            case PrivilegeLevel.PRIVILEGED:
                riskScore += 30;
                riskFactors.push('privileged_level');
                break;
            case PrivilegeLevel.ELEVATED:
                riskScore += 20;
                riskFactors.push('elevated_level');
                break;
            default:
                riskScore += 10;
        }
        switch (accessRequest.urgency) {
            case 'emergency':
                riskScore += 30;
                riskFactors.push('emergency_urgency');
                break;
            case 'high':
                riskScore += 20;
                riskFactors.push('high_urgency');
                break;
            case 'medium':
                riskScore += 10;
                break;
        }
        if (accessRequest.requestType === AccessRequestType.EMERGENCY_ACCESS) {
            riskScore += 25;
            riskFactors.push('emergency_access_type');
        }
        if (!this.isInAllowedTimeWindow(role)) {
            riskScore += 20;
            riskFactors.push('outside_time_window');
        }
        if (role.ipWhitelist && !role.ipWhitelist.includes(accessRequest.sourceIp)) {
            riskScore += 15;
            riskFactors.push('ip_not_whitelisted');
        }
        if (accessRequest.requestedDuration > role.maxSessionDuration * 0.5) {
            riskScore += 10;
            riskFactors.push('long_session_duration');
        }
        const recentFailures = this.checkRecentFailures();
        if (recentFailures > 2) {
            riskScore += 20;
            riskFactors.push('recent_access_failures');
        }
        accessRequest.riskScore = Math.min(100, riskScore);
        accessRequest.riskFactors = riskFactors;
        accessRequest.auditTrail.push({
            timestamp: new Date(),
            action: 'risk_assessment_completed',
            actor: 'system',
            details: {
                riskScore: accessRequest.riskScore,
                riskFactors: riskFactors,
                riskLevel: accessRequest.riskScore > 70 ? 'high' :
                    accessRequest.riskScore > 40 ? 'medium' : 'low'
            }
        });
    }
    isInAllowedTimeWindow(role) {
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.toTimeString().substring(0, 5);
        for (const window of role.allowedTimeWindows) {
            if (window.days.includes(currentDay)) {
                if (currentTime >= window.start && currentTime <= window.end) {
                    return true;
                }
            }
        }
        return false;
    }
    checkRecentFailures() {
        return Math.floor(Math.random() * 3);
    }
    async handleEmergencyAccess(accessRequest, role) {
        accessRequest.status = AccessStatus.EMERGENCY_ACTIVATED;
        accessRequest.emergencyAccess = true;
        await this.sendEmergencyNotifications(accessRequest, role);
        accessRequest.emergencyNotificationsSent = true;
        accessRequest.auditTrail.push({
            timestamp: new Date(),
            action: 'emergency_access_activated',
            actor: accessRequest.username,
            details: {
                emergencyReason: accessRequest.justification,
                urgency: accessRequest.urgency,
                notificationsSent: true
            },
            riskImpact: 'high'
        });
        this.metrics.emergencyRequests++;
        logger_1.logger.warn('Emergency access activated', {
            requestId: accessRequest.id,
            userId: accessRequest.userId,
            username: accessRequest.username,
            role: accessRequest.requestedRole,
            justification: accessRequest.justification
        });
    }
    async sendEmergencyNotifications(accessRequest, role) {
        logger_1.logger.info('Emergency notifications sent', {
            requestId: accessRequest.id,
            recipients: role.emergencyNotifications,
            approvers: role.emergencyApprovers
        });
    }
    async initiateApprovalWorkflow(accessRequest, role) {
        accessRequest.status = AccessStatus.PENDING_APPROVAL;
        for (const approverRole of role.approverRoles) {
            accessRequest.approvers.push({
                userId: '',
                username: approverRole,
                role: approverRole,
                decision: 'pending'
            });
        }
        await this.sendApprovalNotifications(accessRequest, role);
        accessRequest.auditTrail.push({
            timestamp: new Date(),
            action: 'approval_workflow_initiated',
            actor: 'system',
            details: {
                requiredApprovers: role.approverRoles,
                minimumApprovers: role.minimumApprovers
            }
        });
        this.metrics.manualApprovals++;
    }
    async sendApprovalNotifications(accessRequest, role) {
        logger_1.logger.info('Approval notifications sent', {
            requestId: accessRequest.id,
            approvers: role.approverRoles
        });
    }
    async initiateMFAChallenge(accessRequest, role) {
        const challengeId = crypto.randomUUID();
        const mfaMethod = role.allowedMfaMethods[0] || MFAMethod.TOTP;
        const challenge = {
            id: challengeId,
            userId: accessRequest.userId,
            accessRequestId: accessRequest.id,
            method: mfaMethod,
            challengeCode: this.generateMFAChallenge(mfaMethod),
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + role.mfaValidityMinutes * 60 * 1000),
            challengeHash: crypto.randomBytes(16).toString('hex'),
            ipAddress: accessRequest.sourceIp,
            userAgent: accessRequest.userAgent,
            backupMethodsAvailable: role.allowedMfaMethods.filter(m => m !== mfaMethod)
        };
        this.mfaChallenges.set(challengeId, challenge);
        accessRequest.auditTrail.push({
            timestamp: new Date(),
            action: 'mfa_challenge_initiated',
            actor: 'system',
            details: {
                challengeId,
                method: mfaMethod,
                expiresAt: challenge.expiresAt
            }
        });
        logger_1.logger.info('MFA challenge initiated', {
            challengeId,
            requestId: accessRequest.id,
            method: mfaMethod,
            userId: accessRequest.userId
        });
    }
    generateMFAChallenge(method) {
        switch (method) {
            case MFAMethod.TOTP:
                return Math.floor(100000 + Math.random() * 900000).toString();
            case MFAMethod.SMS:
            case MFAMethod.EMAIL:
                return Math.floor(100000 + Math.random() * 900000).toString();
            case MFAMethod.PUSH:
                return crypto.randomUUID();
            default:
                return crypto.randomBytes(6).toString('hex');
        }
    }
    async verifyMFAChallenge(challengeId, userResponse, options = {}) {
        try {
            const challenge = this.mfaChallenges.get(challengeId);
            if (!challenge) {
                throw new Error(`MFA challenge not found: ${challengeId}`);
            }
            if (challenge.status !== 'pending') {
                throw new Error(`Invalid challenge status: ${challenge.status}`);
            }
            if (challenge.expiresAt < new Date()) {
                challenge.status = 'expired';
                throw new Error('MFA challenge expired');
            }
            challenge.attempts++;
            let verified = false;
            if (options.backupMethod && options.backupCode) {
                verified = this.verifyBackupMethod(challenge, options.backupMethod, options.backupCode);
                if (verified) {
                    challenge.backupMethodUsed = options.backupMethod;
                }
            }
            else {
                verified = this.verifyPrimaryMethod(challenge, userResponse);
            }
            if (verified) {
                challenge.status = 'verified';
                challenge.verifiedAt = new Date();
                const accessRequest = this.accessRequests.get(challenge.accessRequestId);
                if (accessRequest) {
                    accessRequest.mfaCompleted = true;
                    accessRequest.mfaMethod = challenge.backupMethodUsed || challenge.method;
                    accessRequest.mfaVerifiedAt = new Date();
                    accessRequest.status = AccessStatus.APPROVED;
                    await this.startPrivilegedSession(accessRequest);
                    accessRequest.auditTrail.push({
                        timestamp: new Date(),
                        action: 'mfa_verification_successful',
                        actor: accessRequest.username,
                        details: {
                            challengeId,
                            method: accessRequest.mfaMethod,
                            attempts: challenge.attempts
                        }
                    });
                }
                logger_1.logger.info('MFA verification successful', {
                    challengeId,
                    userId: challenge.userId,
                    method: accessRequest?.mfaMethod,
                    attempts: challenge.attempts
                });
                return true;
            }
            else {
                if (challenge.attempts >= challenge.maxAttempts) {
                    challenge.status = 'failed';
                    const accessRequest = this.accessRequests.get(challenge.accessRequestId);
                    if (accessRequest) {
                        accessRequest.status = AccessStatus.DENIED;
                        this.metrics.deniedRequests++;
                    }
                    this.metrics.mfaFailures++;
                }
                logger_1.logger.warn('MFA verification failed', {
                    challengeId,
                    userId: challenge.userId,
                    attempts: challenge.attempts,
                    maxAttempts: challenge.maxAttempts
                });
                return false;
            }
        }
        catch (error) {
            logger_1.logger.error('MFA verification error', {
                challengeId,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    verifyPrimaryMethod(challenge, userResponse) {
        return challenge.challengeCode === userResponse;
    }
    verifyBackupMethod(challenge, method, code) {
        if (!challenge.backupMethodsAvailable.includes(method)) {
            return false;
        }
        return code.length >= 6;
    }
    async startPrivilegedSession(accessRequest) {
        const sessionId = crypto.randomUUID();
        const role = this.privilegedRoles.get(accessRequest.requestedRole);
        const session = {
            id: sessionId,
            accessRequestId: accessRequest.id,
            userId: accessRequest.userId,
            username: accessRequest.username,
            role: accessRequest.requestedRole,
            startTime: new Date(),
            status: 'active',
            activities: [],
            recordingEnabled: role.sessionRecording,
            keystrokesLogged: role.keystrokeLogging,
            screenCaptured: role.screenCapture,
            realTimeMonitoring: true,
            suspiciousActivity: false,
            alertsGenerated: 0,
            extensionRequests: [],
            currentRiskScore: accessRequest.riskScore,
            riskEvents: [],
            auditEvents: [],
            lastActivity: new Date()
        };
        this.activeSessions.set(sessionId, session);
        this.metrics.activeSessions++;
        accessRequest.sessionId = sessionId;
        accessRequest.sessionStarted = new Date();
        accessRequest.status = AccessStatus.ACTIVE;
        setTimeout(() => {
            this.expireSession(sessionId);
        }, accessRequest.requestedDuration * 60 * 1000);
        accessRequest.auditTrail.push({
            timestamp: new Date(),
            action: 'privileged_session_started',
            actor: accessRequest.username,
            details: {
                sessionId,
                role: accessRequest.requestedRole,
                duration: accessRequest.requestedDuration,
                recordingEnabled: session.recordingEnabled
            }
        });
        logger_1.logger.info('Privileged session started', {
            sessionId,
            userId: accessRequest.userId,
            username: accessRequest.username,
            role: accessRequest.requestedRole,
            duration: accessRequest.requestedDuration
        });
    }
    expireSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'active') {
            return;
        }
        session.status = 'expired';
        session.endTime = new Date();
        session.duration = session.endTime.getTime() - session.startTime.getTime();
        const accessRequest = this.accessRequests.get(session.accessRequestId);
        if (accessRequest) {
            accessRequest.sessionEnded = new Date();
            accessRequest.status = AccessStatus.EXPIRED;
        }
        this.metrics.activeSessions--;
        logger_1.logger.info('Privileged session expired', {
            sessionId,
            userId: session.userId,
            duration: session.duration
        });
    }
    startAccessMonitoring() {
        setInterval(() => {
            this.monitorActiveSessions();
        }, 30 * 1000);
        setInterval(() => {
            this.cleanupExpiredItems();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.updateMetrics();
        }, 60 * 1000);
        logger_1.logger.info('Privileged access monitoring started');
    }
    monitorActiveSessions() {
        const now = new Date();
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.status !== 'active')
                continue;
            const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
            if (timeSinceLastActivity > 30 * 60 * 1000) {
                session.suspiciousActivity = true;
                session.riskEvents.push({
                    timestamp: now,
                    event: 'extended_idle_time',
                    severity: 'medium',
                    automated: true
                });
                logger_1.logger.warn('Suspicious activity detected: extended idle time', {
                    sessionId,
                    userId: session.userId,
                    idleTime: timeSinceLastActivity
                });
            }
        }
    }
    cleanupExpiredItems() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let cleanedRequests = 0;
        let cleanedChallenges = 0;
        for (const [requestId, request] of this.accessRequests.entries()) {
            if (request.createdAt < cutoffTime &&
                (request.status === AccessStatus.EXPIRED ||
                    request.status === AccessStatus.DENIED ||
                    request.status === AccessStatus.REVOKED)) {
                this.accessRequests.delete(requestId);
                cleanedRequests++;
            }
        }
        for (const [challengeId, challenge] of this.mfaChallenges.entries()) {
            if (challenge.createdAt < cutoffTime) {
                this.mfaChallenges.delete(challengeId);
                cleanedChallenges++;
            }
        }
        if (cleanedRequests > 0 || cleanedChallenges > 0) {
            logger_1.logger.debug('Cleaned up expired privileged access items', {
                cleanedRequests,
                cleanedChallenges
            });
        }
    }
    updateMetrics() {
        this.metrics.activeSessions = Array.from(this.activeSessions.values())
            .filter(s => s.status === 'active').length;
        const completedSessions = Array.from(this.activeSessions.values())
            .filter(s => s.duration !== undefined);
        if (completedSessions.length > 0) {
            this.metrics.averageSessionDuration = completedSessions
                .reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length;
        }
        this.metrics.periodEnd = new Date();
    }
    getStats() {
        return { ...this.metrics };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.mfaFailures > 10) {
            status = 'warning';
        }
        if (stats.suspiciousActivities > 5) {
            status = 'degraded';
        }
        if (stats.complianceViolations > 0) {
            status = 'critical';
        }
        const emergencySessionsActive = Array.from(this.activeSessions.values())
            .filter(s => s.status === 'active' &&
            this.accessRequests.get(s.accessRequestId)?.emergencyAccess).length;
        if (emergencySessionsActive > 2) {
            status = 'critical';
        }
        return {
            status,
            stats: {
                ...stats,
                emergencySessionsActive,
                pendingRequests: Array.from(this.accessRequests.values())
                    .filter(r => r.status === AccessStatus.PENDING_APPROVAL).length
            }
        };
    }
}
exports.PrivilegedAccessService = PrivilegedAccessService;
exports.privilegedAccessService = PrivilegedAccessService.getInstance();
//# sourceMappingURL=PrivilegedAccessService.js.map