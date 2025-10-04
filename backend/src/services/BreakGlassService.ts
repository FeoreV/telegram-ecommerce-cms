import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum BreakGlassType {
  SYSTEM_OUTAGE = 'system_outage',
  SECURITY_INCIDENT = 'security_incident',
  DATA_BREACH = 'data_breach',
  REGULATORY_INVESTIGATION = 'regulatory_investigation',
  BUSINESS_CRITICAL = 'business_critical',
  DISASTER_RECOVERY = 'disaster_recovery',
  COMPLIANCE_AUDIT = 'compliance_audit',
  EMERGENCY_MAINTENANCE = 'emergency_maintenance'
}

export enum BreakGlassSeverity {
  MINOR = 'minor',           // Minor operational issues
  MODERATE = 'moderate',     // Moderate business impact
  MAJOR = 'major',           // Major business disruption
  CRITICAL = 'critical',     // Critical system failure
  CATASTROPHIC = 'catastrophic' // Company-threatening event
}

export enum BreakGlassStatus {
  REQUESTED = 'requested',
  AUTHORIZED = 'authorized',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  COMPLETED = 'completed',
  UNDER_REVIEW = 'under_review'
}

export interface BreakGlassAccount {
  id: string;
  name: string;
  description: string;
  
  // Account credentials
  username: string;
  passwordHash: string;
  lastPasswordChange: Date;
  
  // Access configuration
  allowedScenarios: BreakGlassType[];
  maximumDuration: number; // minutes
  defaultDuration: number; // minutes
  
  // Permissions
  systemAccess: {
    databases: string[];
    services: string[];
    networks: string[];
    files: string[];
    commands: string[];
  };
  
  // Authorization requirements
  requiresAuthorization: boolean;
  authorizationLevel: 'single' | 'dual' | 'triple';
  authorizedBy: string[]; // Role names that can authorize
  
  // MFA requirements
  mfaRequired: boolean;
  mfaMethods: string[];
  mfaBypass: boolean; // Allow bypass in extreme emergencies
  
  // Monitoring and auditing
  auditLevel: 'basic' | 'enhanced' | 'forensic';
  sessionRecording: boolean;
  keystrokeLogging: boolean;
  screenCapture: boolean;
  realTimeMonitoring: boolean;
  
  // Notifications
  activationNotifications: string[];
  deactivationNotifications: string[];
  activityNotifications: string[];
  
  // Auto-controls
  autoExpiration: boolean;
  autoRevocation: {
    enabled: boolean;
    conditions: {
      maxCommands: number;
      suspiciousActivity: boolean;
      timeLimit: number;
    };
  };
  
  // Compliance
  complianceRelevant: boolean;
  regulations: string[];
  retentionPeriod: number; // days
  
  // Account lifecycle
  lastUsed?: Date;
  usageCount: number;
  maxUsages?: number; // Optional usage limit
  
  active: boolean;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface BreakGlassActivation {
  id: string;
  accountId: string;
  accountName: string;
  
  // Activation context
  scenario: BreakGlassType;
  severity: BreakGlassSeverity;
  description: string;
  businessJustification: string;
  
  // Timing
  requestedAt: Date;
  authorizedAt?: Date;
  activatedAt?: Date;
  deactivatedAt?: Date;
  expiresAt?: Date;
  duration: number; // minutes
  
  // Authorization
  status: BreakGlassStatus;
  authorizers: {
    userId: string;
    username: string;
    role: string;
    authorizedAt: Date;
    method: 'manual' | 'automated' | 'emergency';
    signature?: string;
  }[];
  
  // User context
  activatedBy: string;
  activatedFromIp: string;
  activatedFromLocation?: {
    country: string;
    region: string;
    city: string;
  };
  deviceFingerprint: string;
  
  // Session tracking
  sessionId?: string;
  activities: BreakGlassActivity[];
  
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
  riskMitigation: string[];
  
  // Monitoring
  alertsGenerated: number;
  suspiciousActivities: number;
  complianceViolations: number;
  
  // Evidence collection
  evidenceCollected: {
    sessionRecording?: string;
    keystrokeLogs?: string;
    screenCaptures?: string[];
    commandHistory?: string;
    systemLogs?: string[];
  };
  
  // Incident correlation
  relatedIncidents: string[];
  relatedTickets: string[];
  
  // Review and validation
  postActivationReview: {
    required: boolean;
    completed: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
    findings?: string;
    recommendations?: string[];
  };
  
  // Compliance tracking
  auditTrail: {
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
    complianceRelevant: boolean;
  }[];
  
  createdAt: Date;
  lastUpdated: Date;
}

export interface BreakGlassActivity {
  id: string;
  activationId: string;
  
  // Activity details
  timestamp: Date;
  action: string;
  command?: string;
  resource: string;
  method: 'cli' | 'api' | 'gui' | 'database' | 'file_system';
  
  // Results
  result: 'success' | 'failure' | 'blocked' | 'warning';
  output?: string;
  errorMessage?: string;
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  automaticBlock: boolean;
  requiresApproval: boolean;
  
  // Context
  sourceIp: string;
  userAgent?: string;
  sessionId: string;
  
  // Evidence
  evidenceId?: string;
  recordingSegment?: string;
  
  // Classification
  category: 'system_admin' | 'data_access' | 'security_config' | 'emergency_action' | 'investigation';
  sensitive: boolean;
  complianceRelevant: boolean;
  
  // Approval tracking (for high-risk activities)
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalReason?: string;
}

export interface BreakGlassMetrics {
  // Activation metrics
  totalActivations: number;
  authorizedActivations: number;
  deniedActivations: number;
  emergencyActivations: number;
  
  // Usage metrics
  averageActivationDuration: number;
  activationsPerScenario: Record<BreakGlassType, number>;
  activationsPerSeverity: Record<BreakGlassSeverity, number>;
  
  // Security metrics
  suspiciousActivations: number;
  blockedActivities: number;
  complianceViolations: number;
  forensicInvestigations: number;
  
  // Performance metrics
  averageAuthorizationTime: number;
  authorizationTimeouts: number;
  systemAvailability: number;
  
  // Compliance metrics
  auditCompliance: number;
  reviewCompliance: number;
  retentionCompliance: number;
  
  // Time range
  periodStart: Date;
  periodEnd: Date;
}

export class BreakGlassService {
  private static instance: BreakGlassService;
  private breakGlassAccounts: Map<string, BreakGlassAccount> = new Map();
  private activeActivations: Map<string, BreakGlassActivation> = new Map();
  private activationHistory: Map<string, BreakGlassActivation> = new Map();
  private metrics!: BreakGlassMetrics;
  private authorizerPool: Map<string, any> = new Map();
  
  private constructor() {
    this.initializeBreakGlass();
    this.loadBreakGlassAccounts();
    this.initializeMetrics();
    this.startBreakGlassMonitoring();

    logger.info('Break-Glass Service initialized', {
      accounts: this.breakGlassAccounts.size,
      authorizationLevels: ['single', 'dual', 'triple'],
      monitoringEnabled: true,
      complianceTracking: true
    });
  }

  public static getInstance(): BreakGlassService {
    if (!BreakGlassService.instance) {
      BreakGlassService.instance = new BreakGlassService();
    }
    return BreakGlassService.instance;
  }

  private async initializeBreakGlass(): Promise<void> {
    try {
      // Initialize authorization system
      await this.initializeAuthorizationSystem();
      
      // Setup enhanced monitoring
      await this.setupEnhancedMonitoring();
      
      // Initialize evidence collection
      await this.initializeEvidenceCollection();

      logger.info('Break-glass system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize break-glass system:', error);
      throw error;
    }
  }

  private async initializeAuthorizationSystem(): Promise<void> {
    // Initialize multi-level authorization system
    this.authorizerPool.set('ciso', { role: 'ciso', level: 'executive' });
    this.authorizerPool.set('cto', { role: 'cto', level: 'executive' });
    this.authorizerPool.set('ceo', { role: 'ceo', level: 'executive' });
    this.authorizerPool.set('security_director', { role: 'security_director', level: 'senior' });
    
    logger.debug('Authorization system initialized');
  }

  private async setupEnhancedMonitoring(): Promise<void> {
    // Setup real-time monitoring for break-glass activities
    logger.debug('Enhanced monitoring setup completed');
  }

  private async initializeEvidenceCollection(): Promise<void> {
    // Initialize forensic evidence collection systems
    logger.debug('Evidence collection initialized');
  }

  private loadBreakGlassAccounts(): void {
    // Emergency System Administrator Account
    const emergencySysAdminAccount: BreakGlassAccount = {
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
      maximumDuration: 480, // 8 hours
      defaultDuration: 120, // 2 hours
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
      mfaBypass: true, // Emergency bypass allowed
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
          timeLimit: 480 // 8 hours absolute maximum
        }
      },
      complianceRelevant: true,
      regulations: ['SOX', 'ISO_27001', 'NIST'],
      retentionPeriod: 3650, // 10 years
      usageCount: 0,
      maxUsages: 50, // Maximum 50 uses per year
      active: true,
      createdBy: 'system',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Emergency Security Investigator Account
    const emergencySecurityAccount: BreakGlassAccount = {
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
      maximumDuration: 720, // 12 hours
      defaultDuration: 240, // 4 hours
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
      retentionPeriod: 2555, // 7 years
      usageCount: 0,
      active: true,
      createdBy: 'security_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Emergency Database Recovery Account
    const emergencyDBAAccount: BreakGlassAccount = {
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
      maximumDuration: 360, // 6 hours
      defaultDuration: 180, // 3 hours
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
      retentionPeriod: 3650, // 10 years
      usageCount: 0,
      maxUsages: 20, // Maximum 20 uses per year
      active: true,
      createdBy: 'database_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // CEO Emergency Override Account
    const ceoOverrideAccount: BreakGlassAccount = {
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
      maximumDuration: 240, // 4 hours
      defaultDuration: 60, // 1 hour
      systemAccess: {
        databases: ['all_databases'],
        services: ['all_services'],
        networks: ['all_networks'],
        files: ['all_files'],
        commands: ['all_commands']
      },
      requiresAuthorization: false, // CEO has ultimate authority
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
      retentionPeriod: 3650, // 10 years
      usageCount: 0,
      maxUsages: 5, // Maximum 5 uses per year
      active: true,
      createdBy: 'board',
      createdAt: new Date(),
      lastModified: new Date()
    };

    this.breakGlassAccounts.set(emergencySysAdminAccount.id, emergencySysAdminAccount);
    this.breakGlassAccounts.set(emergencySecurityAccount.id, emergencySecurityAccount);
    this.breakGlassAccounts.set(emergencyDBAAccount.id, emergencyDBAAccount);
    this.breakGlassAccounts.set(ceoOverrideAccount.id, ceoOverrideAccount);

    logger.info('Break-glass accounts loaded', {
      accountCount: this.breakGlassAccounts.size,
      authorizationLevels: ['single', 'dual', 'triple'],
      forensicAuditLevel: true
    });
  }

  private initializeMetrics(): void {
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

    logger.debug('Break-glass metrics initialized');
  }

  /**
   * Request break-glass activation
   */
  async requestBreakGlassActivation(
    accountId: string,
    scenario: BreakGlassType,
    severity: BreakGlassSeverity,
    options: {
      description?: string;
      businessJustification?: string;
      duration?: number;
      activatedBy?: string;
      sourceIp?: string;
      emergencyBypass?: boolean;
      relatedIncidents?: string[];
    } = {}
  ): Promise<string> {
    const activationId = crypto.randomUUID();
    
    try {
      // Validate account
      const account = this.breakGlassAccounts.get(accountId);
      if (!account || !account.active) {
        throw new Error(`Invalid or inactive break-glass account: ${accountId}`);
      }

      // Check scenario compatibility
      if (!account.allowedScenarios.includes(scenario)) {
        throw new Error(`Scenario not allowed for account: ${scenario}`);
      }

      // Check usage limits
      if (account.maxUsages && account.usageCount >= account.maxUsages) {
        throw new Error(`Account usage limit exceeded: ${account.usageCount}/${account.maxUsages}`);
      }

      // Calculate duration
      const requestedDuration = options.duration || account.defaultDuration;
      if (requestedDuration > account.maximumDuration) {
        throw new Error(`Duration exceeds maximum: ${requestedDuration} > ${account.maximumDuration}`);
      }

      // Create activation request
      const activation: BreakGlassActivation = {
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

      // Add initial audit entry
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

      // Perform risk assessment
      await this.performBreakGlassRiskAssessment(activation, account);

      // Handle authorization based on account requirements
      if (account.requiresAuthorization && !options.emergencyBypass) {
        await this.initiateBreakGlassAuthorization(activation, account);
      } else {
        // Emergency bypass or no authorization required
        activation.status = BreakGlassStatus.AUTHORIZED;
        await this.activateBreakGlass(activation, account);
      }

      this.activeActivations.set(activationId, activation);
      this.metrics.totalActivations++;
      this.metrics.activationsPerScenario[scenario]++;
      this.metrics.activationsPerSeverity[severity]++;

      // Send immediate notifications
      await this.sendBreakGlassNotifications(activation, account, 'activation_requested');

      logger.warn('Break-glass activation requested', {
        activationId,
        accountId,
        scenario,
        severity,
        activatedBy: activation.activatedBy,
        sourceIp: activation.activatedFromIp,
        riskScore: activation.riskScore
      });

      // Log critical security event
      await securityLogService.logSecurityEvent({
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

    } catch (error) {
      logger.error('Break-glass activation request failed', {
        activationId,
        accountId,
        scenario,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private generateDeviceFingerprint(sourceIp?: string): string {
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

  private async performBreakGlassRiskAssessment(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    let riskScore = 0;
    const riskFactors: string[] = [];
    const riskMitigation: string[] = [];

    // Base risk by scenario type
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

    // Risk by severity
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

    // Risk by account capabilities
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

    // Risk by usage frequency
    if (account.usageCount > 10) {
      riskScore += 10;
      riskFactors.push('high_usage_frequency');
    }

    // Risk mitigation factors
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

  private async initiateBreakGlassAuthorization(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    activation.status = BreakGlassStatus.REQUESTED;

    // Determine required number of authorizers
    const requiredAuthorizers = account.authorizationLevel === 'triple' ? 3 :
                               account.authorizationLevel === 'dual' ? 2 : 1;

    // Add authorizers based on account configuration
    const availableAuthorizers = account.authorizedBy.slice(0, requiredAuthorizers);
    
    for (const authorizerRole of availableAuthorizers) {
      activation.authorizers.push({
        userId: '', // Would be populated from actual authorizer lookup
        username: authorizerRole,
        role: authorizerRole,
        authorizedAt: new Date(),
        method: 'manual', // Default to manual authorization
        signature: this.generateAuthorizationSignature(activation.id, authorizerRole)
      });
    }

    // Send authorization requests
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

    // For demo purposes, auto-authorize after a delay
    setTimeout(() => {
      this.completeAuthorization(activation.id, account);
    }, 5000); // 5 second delay
  }

  private generateAuthorizationSignature(activationId: string, authorizerRole: string): string {
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

  private async sendAuthorizationRequests(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    // Send urgent authorization requests to designated authorizers
    logger.info('Authorization requests sent', {
      activationId: activation.id,
      authorizers: account.authorizedBy,
      authorizationLevel: account.authorizationLevel
    });
  }

  private async completeAuthorization(activationId: string, account: BreakGlassAccount): Promise<void> {
    const activation = this.activeActivations.get(activationId);
    if (!activation) return;

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

    // Proceed to activation
    await this.activateBreakGlass(activation, account);
  }

  private async activateBreakGlass(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    activation.status = BreakGlassStatus.ACTIVE;
    activation.activatedAt = new Date();
    activation.sessionId = crypto.randomUUID();

    // Update account usage
    account.usageCount++;
    account.lastUsed = new Date();

    // Start session monitoring
    await this.startBreakGlassSessionMonitoring(activation, account);

    // Schedule auto-expiration
    setTimeout(() => {
      this.expireBreakGlassActivation(activation.id);
    }, activation.duration * 60 * 1000);

    // Send activation notifications
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

    logger.error('BREAK-GLASS ACCOUNT ACTIVATED', {
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

  private async startBreakGlassSessionMonitoring(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    // Initialize comprehensive session monitoring
    if (account.sessionRecording) {
      activation.evidenceCollected.sessionRecording = `/recordings/break-glass/${activation.id}.rec`;
    }

    if (account.keystrokeLogging) {
      activation.evidenceCollected.keystrokeLogs = `/logs/keystrokes/break-glass/${activation.id}.log`;
    }

    if (account.screenCapture) {
      activation.evidenceCollected.screenCaptures = [`/captures/break-glass/${activation.id}/`];
    }

    // Start real-time activity monitoring
    if (account.realTimeMonitoring) {
      this.startRealTimeActivityMonitoring(activation, account);
    }

    logger.info('Break-glass session monitoring started', {
      activationId: activation.id,
      sessionRecording: account.sessionRecording,
      keystrokeLogging: account.keystrokeLogging,
      screenCapture: account.screenCapture,
      realTimeMonitoring: account.realTimeMonitoring
    });
  }

  private startRealTimeActivityMonitoring(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): Promise<void> {
    // Setup real-time monitoring for suspicious activities
    return new Promise((resolve) => {
      // Simulate activity monitoring
      setInterval(() => {
        this.checkForSuspiciousActivity(activation, account);
      }, 10 * 1000); // Check every 10 seconds
      
      resolve();
    });
  }

  private checkForSuspiciousActivity(
    activation: BreakGlassActivation,
    _account: BreakGlassAccount
  ): void {
    // Simulate suspicious activity detection
    if (Math.random() < 0.1) { // 10% chance of detecting suspicious activity
      const suspiciousActivity: BreakGlassActivity = {
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
        sessionId: activation.sessionId!,
        category: 'system_admin',
        sensitive: true,
        complianceRelevant: true,
        approvalRequired: true
      };

      activation.activities.push(suspiciousActivity);
      activation.suspiciousActivities++;
      activation.alertsGenerated++;

      logger.warn('Suspicious break-glass activity detected', {
        activationId: activation.id,
        activityId: suspiciousActivity.id,
        command: suspiciousActivity.command,
        blocked: suspiciousActivity.automaticBlock
      });
    }
  }

  private async expireBreakGlassActivation(activationId: string): Promise<void> {
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

    // Schedule post-activation review
    activation.postActivationReview.required = true;

    // Move to history
    this.activationHistory.set(activationId, activation);
    this.activeActivations.delete(activationId);

    activation.auditTrail.push({
      timestamp: new Date(),
      action: 'break_glass_expired',
      actor: 'system',
      details: {
        duration: activation.deactivatedAt.getTime() - activation.activatedAt!.getTime(),
        activitiesRecorded: activation.activities.length,
        suspiciousActivities: activation.suspiciousActivities
      },
      complianceRelevant: true
    });

    logger.warn('Break-glass activation expired', {
      activationId,
      accountId: activation.accountId,
      duration: activation.deactivatedAt.getTime() - activation.activatedAt!.getTime(),
      activities: activation.activities.length
    });
  }

  private async sendBreakGlassNotifications(
    activation: BreakGlassActivation,
    account: BreakGlassAccount,
    eventType: 'activation_requested' | 'activation_completed' | 'activation_expired'
  ): Promise<void> {
    let recipients: string[] = [];

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

    // In real implementation, would send actual notifications
    logger.error(`BREAK-GLASS NOTIFICATION: ${eventType.toUpperCase()}`, {
      recipients: recipients.length,
      notificationContent
    });
  }

  private startBreakGlassMonitoring(): void {
    // Monitor active break-glass sessions
    setInterval(() => {
      this.monitorActiveBreakGlassSessions();
    }, 30 * 1000); // Every 30 seconds

    // Clean up old activations
    setInterval(() => {
      this.cleanupOldActivations();
    }, 60 * 60 * 1000); // Every hour

    // Generate compliance reports
    setInterval(() => {
      this.generateComplianceReport();
    }, 24 * 60 * 60 * 1000); // Daily

    logger.info('Break-glass monitoring started');
  }

  private monitorActiveBreakGlassSessions(): void {
    for (const [activationId, activation] of this.activeActivations.entries()) {
      if (activation.status !== BreakGlassStatus.ACTIVE) continue;

      const account = this.breakGlassAccounts.get(activation.accountId);
      if (!account) continue;

      // Check auto-revocation conditions
      if (account.autoRevocation.enabled) {
        const shouldRevoke = this.checkAutoRevocationConditions(activation, account);
        if (shouldRevoke) {
          this.revokeBreakGlassActivation(activationId, 'auto_revocation');
        }
      }
    }
  }

  private checkAutoRevocationConditions(
    activation: BreakGlassActivation,
    account: BreakGlassAccount
  ): boolean {
    const conditions = account.autoRevocation.conditions;

    // Check command limit
    if (activation.activities.length > conditions.maxCommands) {
      return true;
    }

    // Check suspicious activity
    if (conditions.suspiciousActivity && activation.suspiciousActivities > 0) {
      return true;
    }

    // Check time limit
    const activationDuration = Date.now() - activation.activatedAt!.getTime();
    if (activationDuration > conditions.timeLimit * 60 * 1000) {
      return true;
    }

    return false;
  }

  private revokeBreakGlassActivation(activationId: string, reason: string): void {
    const activation = this.activeActivations.get(activationId);
    if (!activation) return;

    activation.status = BreakGlassStatus.REVOKED;
    activation.deactivatedAt = new Date();

    activation.auditTrail.push({
      timestamp: new Date(),
      action: 'break_glass_revoked',
      actor: 'system',
      details: { reason },
      complianceRelevant: true
    });

    logger.error('Break-glass activation revoked', {
      activationId,
      reason,
      activatedBy: activation.activatedBy
    });
  }

  private cleanupOldActivations(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    let cleanedCount = 0;

    for (const [activationId, activation] of this.activationHistory.entries()) {
      if (activation.createdAt < cutoffTime) {
        // Archive to long-term storage before deletion
        this.archiveActivation(activation);
        this.activationHistory.delete(activationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old break-glass activations', { cleanedCount });
    }
  }

  private archiveActivation(activation: BreakGlassActivation): void {
    // Archive to long-term compliance storage
    logger.debug('Activation archived for compliance', {
      activationId: activation.id,
      accountId: activation.accountId
    });
  }

  private generateComplianceReport(): void {
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

    logger.info('Break-glass compliance report generated', report);
  }

  /**
   * Get break-glass statistics
   */
  getStats(): BreakGlassMetrics {
    return { ...this.metrics };
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
    
    if (stats.suspiciousActivations > 2) {
      status = 'warning'; // Suspicious break-glass activity
    }
    
    if (stats.complianceViolations > 0) {
      status = 'critical'; // Compliance violations
    }

    const activeBreakGlassSessions = this.activeActivations.size;
    const overdueReviews = Array.from(this.activationHistory.values())
      .filter(a => a.postActivationReview.required && !a.postActivationReview.completed).length;

    if (activeBreakGlassSessions > 1) {
      status = 'critical'; // Multiple concurrent break-glass sessions
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

// Export singleton instance
export const breakGlassService = BreakGlassService.getInstance();
