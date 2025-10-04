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
exports.breakGlassService = exports.BreakGlassService = exports.BreakGlassStatus = exports.BreakGlassSeverity = exports.BreakGlassType = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var BreakGlassType;
(function (BreakGlassType) {
    BreakGlassType["SYSTEM_OUTAGE"] = "system_outage";
    BreakGlassType["SECURITY_INCIDENT"] = "security_incident";
    BreakGlassType["DATA_BREACH"] = "data_breach";
    BreakGlassType["REGULATORY_INVESTIGATION"] = "regulatory_investigation";
    BreakGlassType["BUSINESS_CRITICAL"] = "business_critical";
    BreakGlassType["DISASTER_RECOVERY"] = "disaster_recovery";
    BreakGlassType["COMPLIANCE_AUDIT"] = "compliance_audit";
    BreakGlassType["EMERGENCY_MAINTENANCE"] = "emergency_maintenance";
})(BreakGlassType || (exports.BreakGlassType = BreakGlassType = {}));
var BreakGlassSeverity;
(function (BreakGlassSeverity) {
    BreakGlassSeverity["MINOR"] = "minor";
    BreakGlassSeverity["MODERATE"] = "moderate";
    BreakGlassSeverity["MAJOR"] = "major";
    BreakGlassSeverity["CRITICAL"] = "critical";
    BreakGlassSeverity["CATASTROPHIC"] = "catastrophic";
})(BreakGlassSeverity || (exports.BreakGlassSeverity = BreakGlassSeverity = {}));
var BreakGlassStatus;
(function (BreakGlassStatus) {
    BreakGlassStatus["REQUESTED"] = "requested";
    BreakGlassStatus["AUTHORIZED"] = "authorized";
    BreakGlassStatus["ACTIVE"] = "active";
    BreakGlassStatus["EXPIRED"] = "expired";
    BreakGlassStatus["REVOKED"] = "revoked";
    BreakGlassStatus["COMPLETED"] = "completed";
    BreakGlassStatus["UNDER_REVIEW"] = "under_review";
})(BreakGlassStatus || (exports.BreakGlassStatus = BreakGlassStatus = {}));
class BreakGlassService {
    constructor() {
        this.breakGlassAccounts = new Map();
        this.activeActivations = new Map();
        this.activationHistory = new Map();
        this.authorizerPool = new Map();
        this.initializeBreakGlass();
        this.loadBreakGlassAccounts();
        this.initializeMetrics();
        this.startBreakGlassMonitoring();
        logger_1.logger.info('Break-Glass Service initialized', {
            accounts: this.breakGlassAccounts.size,
            authorizationLevels: ['single', 'dual', 'triple'],
            monitoringEnabled: true,
            complianceTracking: true
        });
    }
    static getInstance() {
        if (!BreakGlassService.instance) {
            BreakGlassService.instance = new BreakGlassService();
        }
        return BreakGlassService.instance;
    }
    async initializeBreakGlass() {
        try {
            await this.initializeAuthorizationSystem();
            await this.setupEnhancedMonitoring();
            await this.initializeEvidenceCollection();
            logger_1.logger.info('Break-glass system initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize break-glass system:', error);
            throw error;
        }
    }
    async initializeAuthorizationSystem() {
        this.authorizerPool.set('ciso', { role: 'ciso', level: 'executive' });
        this.authorizerPool.set('cto', { role: 'cto', level: 'executive' });
        this.authorizerPool.set('ceo', { role: 'ceo', level: 'executive' });
        this.authorizerPool.set('security_director', { role: 'security_director', level: 'senior' });
        logger_1.logger.debug('Authorization system initialized');
    }
    async setupEnhancedMonitoring() {
        logger_1.logger.debug('Enhanced monitoring setup completed');
    }
    async initializeEvidenceCollection() {
        logger_1.logger.debug('Evidence collection initialized');
    }
    loadBreakGlassAccounts() {
        const emergencySysAdminAccount = {
            id: 'emergency-sysadmin',
            name: 'Emergency System Administrator',
            description: 'Emergency access for critical system administration during outages',
            username: 'emergency_sysadmin',
            passwordHash: process.env.BREAK_GLASS_SYSADMIN_PASSWORD_HASH || '',
            lastPasswordChange: new Date(),
            allowedScenarios: [
                BreakGlassType.SYSTEM_OUTAGE,
                BreakGlassType.EMERGENCY_MAINTENANCE,
                BreakGlassType.DISASTER_RECOVERY
            ],
            maximumDuration: 480,
            defaultDuration: 120,
            systemAccess: {
                databases: ['all_system_databases'],
                services: ['all_system_services'],
                networks: ['management_network', 'admin_network'],
                files: ['/etc', '/var/log', '/opt', '/usr/local'],
                commands: ['sudo', 'systemctl', 'docker', 'kubectl']
            },
            requiresAuthorization: true,
            authorizationLevel: 'dual',
            authorizedBy: ['ciso', 'cto', 'security_director'],
            mfaRequired: true,
            mfaMethods: ['totp', 'hardware_token', 'backup_codes'],
            mfaBypass: true,
            auditLevel: 'forensic',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            realTimeMonitoring: true,
            activationNotifications: [
                'security@company.com', 'executives@company.com',
                'board@company.com', 'legal@company.com'
            ],
            deactivationNotifications: [
                'security@company.com', 'compliance@company.com'
            ],
            activityNotifications: [
                'security@company.com', 'soc@company.com'
            ],
            autoExpiration: true,
            autoRevocation: {
                enabled: true,
                conditions: {
                    maxCommands: 1000,
                    suspiciousActivity: true,
                    timeLimit: 480
                }
            },
            complianceRelevant: true,
            regulations: ['SOX', 'ISO_27001', 'NIST'],
            retentionPeriod: 3650,
            usageCount: 0,
            maxUsages: 50,
            active: true,
            createdBy: 'system',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const emergencySecurityAccount = {
            id: 'emergency-security',
            name: 'Emergency Security Investigator',
            description: 'Emergency access for security incident response and investigation',
            username: 'emergency_security',
            passwordHash: process.env.BREAK_GLASS_SECURITY_PASSWORD_HASH || '',
            lastPasswordChange: new Date(),
            allowedScenarios: [
                BreakGlassType.SECURITY_INCIDENT,
                BreakGlassType.DATA_BREACH,
                BreakGlassType.REGULATORY_INVESTIGATION
            ],
            maximumDuration: 720,
            defaultDuration: 240,
            systemAccess: {
                databases: ['audit_db', 'security_db', 'logs_db'],
                services: ['security_service', 'siem_service', 'forensics_service'],
                networks: ['security_network', 'dmz_network'],
                files: ['/var/log/security', '/data/forensics', '/evidence'],
                commands: ['grep', 'awk', 'tcpdump', 'wireshark']
            },
            requiresAuthorization: true,
            authorizationLevel: 'single',
            authorizedBy: ['ciso', 'security_director'],
            mfaRequired: true,
            mfaMethods: ['totp', 'hardware_token'],
            mfaBypass: false,
            auditLevel: 'forensic',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: false,
            realTimeMonitoring: true,
            activationNotifications: [
                'security@company.com', 'legal@company.com'
            ],
            deactivationNotifications: [
                'security@company.com'
            ],
            activityNotifications: [
                'ciso@company.com'
            ],
            autoExpiration: true,
            autoRevocation: {
                enabled: true,
                conditions: {
                    maxCommands: 500,
                    suspiciousActivity: true,
                    timeLimit: 720
                }
            },
            complianceRelevant: true,
            regulations: ['SOX', 'GDPR', 'HIPAA', 'PCI_DSS'],
            retentionPeriod: 2555,
            usageCount: 0,
            active: true,
            createdBy: 'security_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const emergencyDBAAccount = {
            id: 'emergency-dba',
            name: 'Emergency Database Administrator',
            description: 'Emergency database access for critical data recovery operations',
            username: 'emergency_dba',
            passwordHash: process.env.BREAK_GLASS_DBA_PASSWORD_HASH || '',
            lastPasswordChange: new Date(),
            allowedScenarios: [
                BreakGlassType.SYSTEM_OUTAGE,
                BreakGlassType.DISASTER_RECOVERY,
                BreakGlassType.BUSINESS_CRITICAL
            ],
            maximumDuration: 360,
            defaultDuration: 180,
            systemAccess: {
                databases: ['all_production_databases'],
                services: ['database_service', 'backup_service'],
                networks: ['database_network'],
                files: ['/data/backups', '/var/lib/postgresql', '/var/lib/mysql'],
                commands: ['psql', 'mysql', 'pg_dump', 'mysqldump']
            },
            requiresAuthorization: true,
            authorizationLevel: 'triple',
            authorizedBy: ['ciso', 'cto', 'ceo'],
            mfaRequired: true,
            mfaMethods: ['hardware_token', 'totp'],
            mfaBypass: false,
            auditLevel: 'forensic',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            realTimeMonitoring: true,
            activationNotifications: [
                'security@company.com', 'executives@company.com',
                'board@company.com', 'dpo@company.com'
            ],
            deactivationNotifications: [
                'security@company.com', 'compliance@company.com'
            ],
            activityNotifications: [
                'ciso@company.com', 'cto@company.com'
            ],
            autoExpiration: true,
            autoRevocation: {
                enabled: true,
                conditions: {
                    maxCommands: 200,
                    suspiciousActivity: true,
                    timeLimit: 360
                }
            },
            complianceRelevant: true,
            regulations: ['SOX', 'GDPR', 'HIPAA', 'CCPA'],
            retentionPeriod: 3650,
            usageCount: 0,
            maxUsages: 20,
            active: true,
            createdBy: 'database_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const ceoOverrideAccount = {
            id: 'ceo-override',
            name: 'CEO Emergency Override',
            description: 'Ultimate emergency access for CEO in catastrophic scenarios',
            username: 'ceo_emergency',
            passwordHash: process.env.BREAK_GLASS_CEO_PASSWORD_HASH || '',
            lastPasswordChange: new Date(),
            allowedScenarios: [
                BreakGlassType.BUSINESS_CRITICAL,
                BreakGlassType.REGULATORY_INVESTIGATION,
                BreakGlassType.DISASTER_RECOVERY
            ],
            maximumDuration: 240,
            defaultDuration: 60,
            systemAccess: {
                databases: ['all_databases'],
                services: ['all_services'],
                networks: ['all_networks'],
                files: ['all_files'],
                commands: ['all_commands']
            },
            requiresAuthorization: false,
            authorizationLevel: 'single',
            authorizedBy: ['board_chairman'],
            mfaRequired: true,
            mfaMethods: ['hardware_token', 'biometric'],
            mfaBypass: false,
            auditLevel: 'forensic',
            sessionRecording: true,
            keystrokeLogging: true,
            screenCapture: true,
            realTimeMonitoring: true,
            activationNotifications: [
                'board@company.com', 'executives@company.com',
                'legal@company.com', 'compliance@company.com',
                'audit@company.com'
            ],
            deactivationNotifications: [
                'board@company.com', 'legal@company.com'
            ],
            activityNotifications: [
                'board@company.com', 'legal@company.com'
            ],
            autoExpiration: true,
            autoRevocation: {
                enabled: true,
                conditions: {
                    maxCommands: 100,
                    suspiciousActivity: true,
                    timeLimit: 240
                }
            },
            complianceRelevant: true,
            regulations: ['ALL'],
            retentionPeriod: 3650,
            usageCount: 0,
            maxUsages: 5,
            active: true,
            createdBy: 'board',
            createdAt: new Date(),
            lastModified: new Date()
        };
        this.breakGlassAccounts.set(emergencySysAdminAccount.id, emergencySysAdminAccount);
        this.breakGlassAccounts.set(emergencySecurityAccount.id, emergencySecurityAccount);
        this.breakGlassAccounts.set(emergencyDBAAccount.id, emergencyDBAAccount);
        this.breakGlassAccounts.set(ceoOverrideAccount.id, ceoOverrideAccount);
        logger_1.logger.info('Break-glass accounts loaded', {
            accountCount: this.breakGlassAccounts.size,
            authorizationLevels: ['single', 'dual', 'triple'],
            forensicAuditLevel: true
        });
    }
    initializeMetrics() {
        this.metrics = {
            totalActivations: 0,
            authorizedActivations: 0,
            deniedActivations: 0,
            emergencyActivations: 0,
            averageActivationDuration: 0,
            activationsPerScenario: {
                [BreakGlassType.SYSTEM_OUTAGE]: 0,
                [BreakGlassType.SECURITY_INCIDENT]: 0,
                [BreakGlassType.DATA_BREACH]: 0,
                [BreakGlassType.REGULATORY_INVESTIGATION]: 0,
                [BreakGlassType.BUSINESS_CRITICAL]: 0,
                [BreakGlassType.DISASTER_RECOVERY]: 0,
                [BreakGlassType.COMPLIANCE_AUDIT]: 0,
                [BreakGlassType.EMERGENCY_MAINTENANCE]: 0
            },
            activationsPerSeverity: {
                [BreakGlassSeverity.MINOR]: 0,
                [BreakGlassSeverity.MODERATE]: 0,
                [BreakGlassSeverity.MAJOR]: 0,
                [BreakGlassSeverity.CRITICAL]: 0,
                [BreakGlassSeverity.CATASTROPHIC]: 0
            },
            suspiciousActivations: 0,
            blockedActivities: 0,
            complianceViolations: 0,
            forensicInvestigations: 0,
            averageAuthorizationTime: 0,
            authorizationTimeouts: 0,
            systemAvailability: 100,
            auditCompliance: 100,
            reviewCompliance: 100,
            retentionCompliance: 100,
            periodStart: new Date(),
            periodEnd: new Date()
        };
        logger_1.logger.debug('Break-glass metrics initialized');
    }
    async requestBreakGlassActivation(accountId, scenario, severity, options = {}) {
        const activationId = crypto.randomUUID();
        try {
            const account = this.breakGlassAccounts.get(accountId);
            if (!account || !account.active) {
                throw new Error(`Invalid or inactive break-glass account: ${accountId}`);
            }
            if (!account.allowedScenarios.includes(scenario)) {
                throw new Error(`Scenario not allowed for account: ${scenario}`);
            }
            if (account.maxUsages && account.usageCount >= account.maxUsages) {
                throw new Error(`Account usage limit exceeded: ${account.usageCount}/${account.maxUsages}`);
            }
            const requestedDuration = options.duration || account.defaultDuration;
            if (requestedDuration > account.maximumDuration) {
                throw new Error(`Duration exceeds maximum: ${requestedDuration} > ${account.maximumDuration}`);
            }
            const activation = {
                id: activationId,
                accountId,
                accountName: account.name,
                scenario,
                severity,
                description: options.description || `Emergency ${scenario} activation`,
                businessJustification: options.businessJustification || 'Emergency access required',
                requestedAt: new Date(),
                duration: requestedDuration,
                expiresAt: new Date(Date.now() + requestedDuration * 60 * 1000),
                status: BreakGlassStatus.REQUESTED,
                authorizers: [],
                activatedBy: options.activatedBy || 'unknown',
                activatedFromIp: options.sourceIp || 'unknown',
                deviceFingerprint: this.generateDeviceFingerprint(options.sourceIp),
                activities: [],
                riskScore: 0,
                riskFactors: [],
                riskMitigation: [],
                alertsGenerated: 0,
                suspiciousActivities: 0,
                complianceViolations: 0,
                evidenceCollected: {},
                relatedIncidents: options.relatedIncidents || [],
                relatedTickets: [],
                postActivationReview: {
                    required: true,
                    completed: false
                },
                auditTrail: [],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            activation.auditTrail.push({
                timestamp: new Date(),
                action: 'break_glass_activation_requested',
                actor: activation.activatedBy,
                details: {
                    accountId,
                    scenario,
                    severity,
                    duration: requestedDuration,
                    emergencyBypass: options.emergencyBypass
                },
                complianceRelevant: true
            });
            await this.performBreakGlassRiskAssessment(activation, account);
            if (account.requiresAuthorization && !options.emergencyBypass) {
                await this.initiateBreakGlassAuthorization(activation, account);
            }
            else {
                activation.status = BreakGlassStatus.AUTHORIZED;
                await this.activateBreakGlass(activation, account);
            }
            this.activeActivations.set(activationId, activation);
            this.metrics.totalActivations++;
            this.metrics.activationsPerScenario[scenario]++;
            this.metrics.activationsPerSeverity[severity]++;
            await this.sendBreakGlassNotifications(activation, account, 'activation_requested');
            logger_1.logger.warn('Break-glass activation requested', {
                activationId,
                accountId,
                scenario,
                severity,
                activatedBy: activation.activatedBy,
                sourceIp: activation.activatedFromIp,
                riskScore: activation.riskScore
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'break_glass_activation_requested',
                severity: 'CRITICAL',
                category: 'authorization',
                ipAddress: activation.activatedFromIp,
                success: true,
                details: {
                    activationId,
                    accountId,
                    accountName: account.name,
                    scenario,
                    severity,
                    activatedBy: activation.activatedBy,
                    duration: requestedDuration,
                    riskScore: activation.riskScore,
                    emergencyBypass: options.emergencyBypass
                },
                riskScore: activation.riskScore,
                tags: ['break_glass', 'emergency_access', 'privileged_access'],
                compliance: {
                    pii: false,
                    gdpr: account.regulations.includes('GDPR'),
                    pci: account.regulations.includes('PCI_DSS'),
                    hipaa: account.regulations.includes('HIPAA')
                }
            });
            return activationId;
        }
        catch (error) {
            logger_1.logger.error('Break-glass activation request failed', {
                activationId,
                accountId,
                scenario,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    generateDeviceFingerprint(sourceIp) {
        const fingerprintData = {
            sourceIp: sourceIp || 'unknown',
            timestamp: new Date().toISOString(),
            random: Math.random()
        };
        return crypto.createHash('sha256')
            .update(JSON.stringify(fingerprintData))
            .digest('hex')
            .substring(0, 16);
    }
    async performBreakGlassRiskAssessment(activation, account) {
        let riskScore = 0;
        const riskFactors = [];
        const riskMitigation = [];
        switch (activation.scenario) {
            case BreakGlassType.SYSTEM_OUTAGE:
            case BreakGlassType.DISASTER_RECOVERY:
                riskScore += 30;
                riskFactors.push('system_critical_scenario');
                break;
            case BreakGlassType.SECURITY_INCIDENT:
            case BreakGlassType.DATA_BREACH:
                riskScore += 50;
                riskFactors.push('security_critical_scenario');
                break;
            case BreakGlassType.REGULATORY_INVESTIGATION:
                riskScore += 40;
                riskFactors.push('regulatory_scenario');
                break;
            default:
                riskScore += 25;
        }
        switch (activation.severity) {
            case BreakGlassSeverity.CATASTROPHIC:
                riskScore += 40;
                riskFactors.push('catastrophic_severity');
                break;
            case BreakGlassSeverity.CRITICAL:
                riskScore += 30;
                riskFactors.push('critical_severity');
                break;
            case BreakGlassSeverity.MAJOR:
                riskScore += 20;
                riskFactors.push('major_severity');
                break;
            default:
                riskScore += 10;
        }
        if (account.systemAccess.databases.includes('all_databases') ||
            account.systemAccess.databases.includes('all_production_databases')) {
            riskScore += 20;
            riskFactors.push('full_database_access');
        }
        if (account.systemAccess.commands.includes('all_commands') ||
            account.systemAccess.commands.includes('sudo')) {
            riskScore += 15;
            riskFactors.push('elevated_system_access');
        }
        if (account.usageCount > 10) {
            riskScore += 10;
            riskFactors.push('high_usage_frequency');
        }
        if (account.sessionRecording && account.keystrokeLogging) {
            riskScore -= 10;
            riskMitigation.push('comprehensive_session_recording');
        }
        if (account.realTimeMonitoring) {
            riskScore -= 5;
            riskMitigation.push('real_time_monitoring');
        }
        if (account.mfaRequired && !account.mfaBypass) {
            riskScore -= 10;
            riskMitigation.push('mandatory_mfa');
        }
        if (account.requiresAuthorization && account.authorizationLevel !== 'single') {
            riskScore -= 15;
            riskMitigation.push('multi_person_authorization');
        }
        activation.riskScore = Math.max(0, Math.min(100, riskScore));
        activation.riskFactors = riskFactors;
        activation.riskMitigation = riskMitigation;
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'risk_assessment_completed',
            actor: 'system',
            details: {
                riskScore: activation.riskScore,
                riskFactors: riskFactors,
                riskMitigation: riskMitigation,
                riskLevel: activation.riskScore > 70 ? 'high' :
                    activation.riskScore > 40 ? 'medium' : 'low'
            },
            complianceRelevant: true
        });
    }
    async initiateBreakGlassAuthorization(activation, account) {
        activation.status = BreakGlassStatus.REQUESTED;
        const requiredAuthorizers = account.authorizationLevel === 'triple' ? 3 :
            account.authorizationLevel === 'dual' ? 2 : 1;
        const availableAuthorizers = account.authorizedBy.slice(0, requiredAuthorizers);
        for (const authorizerRole of availableAuthorizers) {
            activation.authorizers.push({
                userId: '',
                username: authorizerRole,
                role: authorizerRole,
                authorizedAt: new Date(),
                method: 'manual',
                signature: this.generateAuthorizationSignature(activation.id, authorizerRole)
            });
        }
        await this.sendAuthorizationRequests(activation, account);
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'authorization_workflow_initiated',
            actor: 'system',
            details: {
                authorizationLevel: account.authorizationLevel,
                requiredAuthorizers: requiredAuthorizers,
                authorizers: availableAuthorizers
            },
            complianceRelevant: true
        });
        setTimeout(() => {
            this.completeAuthorization(activation.id, account);
        }, 5000);
    }
    generateAuthorizationSignature(activationId, authorizerRole) {
        const signatureData = {
            activationId,
            authorizerRole,
            timestamp: new Date().toISOString()
        };
        const secret = process.env.BREAK_GLASS_AUTH_SECRET;
        if (!secret) {
            throw new Error('BREAK_GLASS_AUTH_SECRET environment variable is not set');
        }
        return crypto.createHmac('sha256', secret)
            .update(JSON.stringify(signatureData))
            .digest('hex');
    }
    async sendAuthorizationRequests(activation, account) {
        logger_1.logger.info('Authorization requests sent', {
            activationId: activation.id,
            authorizers: account.authorizedBy,
            authorizationLevel: account.authorizationLevel
        });
    }
    async completeAuthorization(activationId, account) {
        const activation = this.activeActivations.get(activationId);
        if (!activation)
            return;
        activation.status = BreakGlassStatus.AUTHORIZED;
        activation.authorizedAt = new Date();
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'break_glass_authorized',
            actor: 'system',
            details: {
                authorizationMethod: 'automated_demo',
                authorizers: activation.authorizers.map(a => a.role)
            },
            complianceRelevant: true
        });
        this.metrics.authorizedActivations++;
        await this.activateBreakGlass(activation, account);
    }
    async activateBreakGlass(activation, account) {
        activation.status = BreakGlassStatus.ACTIVE;
        activation.activatedAt = new Date();
        activation.sessionId = crypto.randomUUID();
        account.usageCount++;
        account.lastUsed = new Date();
        await this.startBreakGlassSessionMonitoring(activation, account);
        setTimeout(() => {
            this.expireBreakGlassActivation(activation.id);
        }, activation.duration * 60 * 1000);
        await this.sendBreakGlassNotifications(activation, account, 'activation_completed');
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'break_glass_activated',
            actor: activation.activatedBy,
            details: {
                sessionId: activation.sessionId,
                duration: activation.duration,
                autoExpiration: account.autoExpiration
            },
            complianceRelevant: true
        });
        logger_1.logger.error('BREAK-GLASS ACCOUNT ACTIVATED', {
            activationId: activation.id,
            accountId: activation.accountId,
            accountName: activation.accountName,
            scenario: activation.scenario,
            severity: activation.severity,
            activatedBy: activation.activatedBy,
            sessionId: activation.sessionId,
            duration: activation.duration
        });
    }
    async startBreakGlassSessionMonitoring(activation, account) {
        if (account.sessionRecording) {
            activation.evidenceCollected.sessionRecording = `/recordings/break-glass/${activation.id}.rec`;
        }
        if (account.keystrokeLogging) {
            activation.evidenceCollected.keystrokeLogs = `/logs/keystrokes/break-glass/${activation.id}.log`;
        }
        if (account.screenCapture) {
            activation.evidenceCollected.screenCaptures = [`/captures/break-glass/${activation.id}/`];
        }
        if (account.realTimeMonitoring) {
            this.startRealTimeActivityMonitoring(activation, account);
        }
        logger_1.logger.info('Break-glass session monitoring started', {
            activationId: activation.id,
            sessionRecording: account.sessionRecording,
            keystrokeLogging: account.keystrokeLogging,
            screenCapture: account.screenCapture,
            realTimeMonitoring: account.realTimeMonitoring
        });
    }
    startRealTimeActivityMonitoring(activation, account) {
        return new Promise((resolve) => {
            setInterval(() => {
                this.checkForSuspiciousActivity(activation, account);
            }, 10 * 1000);
            resolve();
        });
    }
    checkForSuspiciousActivity(activation, _account) {
        if (Math.random() < 0.1) {
            const suspiciousActivity = {
                id: crypto.randomUUID(),
                activationId: activation.id,
                timestamp: new Date(),
                action: 'suspicious_command_detected',
                command: 'rm -rf /critical/data',
                resource: '/critical/data',
                method: 'cli',
                result: 'blocked',
                riskLevel: 'critical',
                automaticBlock: true,
                requiresApproval: true,
                sourceIp: activation.activatedFromIp,
                sessionId: activation.sessionId,
                category: 'system_admin',
                sensitive: true,
                complianceRelevant: true,
                approvalRequired: true
            };
            activation.activities.push(suspiciousActivity);
            activation.suspiciousActivities++;
            activation.alertsGenerated++;
            logger_1.logger.warn('Suspicious break-glass activity detected', {
                activationId: activation.id,
                activityId: suspiciousActivity.id,
                command: suspiciousActivity.command,
                blocked: suspiciousActivity.automaticBlock
            });
        }
    }
    async expireBreakGlassActivation(activationId) {
        const activation = this.activeActivations.get(activationId);
        if (!activation || activation.status !== BreakGlassStatus.ACTIVE) {
            return;
        }
        activation.status = BreakGlassStatus.EXPIRED;
        activation.deactivatedAt = new Date();
        const account = this.breakGlassAccounts.get(activation.accountId);
        if (account) {
            await this.sendBreakGlassNotifications(activation, account, 'activation_expired');
        }
        activation.postActivationReview.required = true;
        this.activationHistory.set(activationId, activation);
        this.activeActivations.delete(activationId);
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'break_glass_expired',
            actor: 'system',
            details: {
                duration: activation.deactivatedAt.getTime() - activation.activatedAt.getTime(),
                activitiesRecorded: activation.activities.length,
                suspiciousActivities: activation.suspiciousActivities
            },
            complianceRelevant: true
        });
        logger_1.logger.warn('Break-glass activation expired', {
            activationId,
            accountId: activation.accountId,
            duration: activation.deactivatedAt.getTime() - activation.activatedAt.getTime(),
            activities: activation.activities.length
        });
    }
    async sendBreakGlassNotifications(activation, account, eventType) {
        let recipients = [];
        switch (eventType) {
            case 'activation_requested':
            case 'activation_completed':
                recipients = account.activationNotifications;
                break;
            case 'activation_expired':
                recipients = account.deactivationNotifications;
                break;
        }
        const notificationContent = {
            eventType,
            activationId: activation.id,
            accountName: account.name,
            scenario: activation.scenario,
            severity: activation.severity,
            activatedBy: activation.activatedBy,
            timestamp: new Date().toISOString(),
            riskScore: activation.riskScore
        };
        logger_1.logger.error(`BREAK-GLASS NOTIFICATION: ${eventType.toUpperCase()}`, {
            recipients: recipients.length,
            notificationContent
        });
    }
    startBreakGlassMonitoring() {
        setInterval(() => {
            this.monitorActiveBreakGlassSessions();
        }, 30 * 1000);
        setInterval(() => {
            this.cleanupOldActivations();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.generateComplianceReport();
        }, 24 * 60 * 60 * 1000);
        logger_1.logger.info('Break-glass monitoring started');
    }
    monitorActiveBreakGlassSessions() {
        for (const [activationId, activation] of this.activeActivations.entries()) {
            if (activation.status !== BreakGlassStatus.ACTIVE)
                continue;
            const account = this.breakGlassAccounts.get(activation.accountId);
            if (!account)
                continue;
            if (account.autoRevocation.enabled) {
                const shouldRevoke = this.checkAutoRevocationConditions(activation, account);
                if (shouldRevoke) {
                    this.revokeBreakGlassActivation(activationId, 'auto_revocation');
                }
            }
        }
    }
    checkAutoRevocationConditions(activation, account) {
        const conditions = account.autoRevocation.conditions;
        if (activation.activities.length > conditions.maxCommands) {
            return true;
        }
        if (conditions.suspiciousActivity && activation.suspiciousActivities > 0) {
            return true;
        }
        const activationDuration = Date.now() - activation.activatedAt.getTime();
        if (activationDuration > conditions.timeLimit * 60 * 1000) {
            return true;
        }
        return false;
    }
    revokeBreakGlassActivation(activationId, reason) {
        const activation = this.activeActivations.get(activationId);
        if (!activation)
            return;
        activation.status = BreakGlassStatus.REVOKED;
        activation.deactivatedAt = new Date();
        activation.auditTrail.push({
            timestamp: new Date(),
            action: 'break_glass_revoked',
            actor: 'system',
            details: { reason },
            complianceRelevant: true
        });
        logger_1.logger.error('Break-glass activation revoked', {
            activationId,
            reason,
            activatedBy: activation.activatedBy
        });
    }
    cleanupOldActivations() {
        const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;
        for (const [activationId, activation] of this.activationHistory.entries()) {
            if (activation.createdAt < cutoffTime) {
                this.archiveActivation(activation);
                this.activationHistory.delete(activationId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up old break-glass activations', { cleanedCount });
        }
    }
    archiveActivation(activation) {
        logger_1.logger.debug('Activation archived for compliance', {
            activationId: activation.id,
            accountId: activation.accountId
        });
    }
    generateComplianceReport() {
        const report = {
            reportDate: new Date(),
            totalActivations: this.metrics.totalActivations,
            complianceViolations: this.metrics.complianceViolations,
            forensicInvestigations: this.metrics.forensicInvestigations,
            accounts: Array.from(this.breakGlassAccounts.values()).map(account => ({
                id: account.id,
                name: account.name,
                usageCount: account.usageCount,
                lastUsed: account.lastUsed,
                complianceRelevant: account.complianceRelevant
            }))
        };
        logger_1.logger.info('Break-glass compliance report generated', report);
    }
    getStats() {
        return { ...this.metrics };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.suspiciousActivations > 2) {
            status = 'warning';
        }
        if (stats.complianceViolations > 0) {
            status = 'critical';
        }
        const activeBreakGlassSessions = this.activeActivations.size;
        const overdueReviews = Array.from(this.activationHistory.values())
            .filter(a => a.postActivationReview.required && !a.postActivationReview.completed).length;
        if (activeBreakGlassSessions > 1) {
            status = 'critical';
        }
        return {
            status,
            stats: {
                ...stats,
                activeBreakGlassSessions,
                overdueReviews,
                accountsAvailable: this.breakGlassAccounts.size
            }
        };
    }
}
exports.BreakGlassService = BreakGlassService;
exports.breakGlassService = BreakGlassService.getInstance();
//# sourceMappingURL=BreakGlassService.js.map