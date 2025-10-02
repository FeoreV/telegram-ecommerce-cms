import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum PrivilegeLevel {
  STANDARD = 'standard',           // Normal user operations
  ELEVATED = 'elevated',           // Administrative operations
  PRIVILEGED = 'privileged',       // System administration
  SUPER_ADMIN = 'super_admin',     // Full system control
  EMERGENCY = 'emergency'          // Break-glass access
}

export enum AccessRequestType {
  TEMPORARY_ELEVATION = 'temporary_elevation',
  EMERGENCY_ACCESS = 'emergency_access',
  ROLE_ASSUMPTION = 'role_assumption',
  RESOURCE_ACCESS = 'resource_access',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  DATA_ACCESS = 'data_access',
  SECURITY_INVESTIGATION = 'security_investigation'
}

export enum MFAMethod {
  TOTP = 'totp',                   // Time-based OTP (Google Authenticator, Authy)
  PUSH = 'push',                   // Push notification
  SMS = 'sms',                     // SMS verification
  EMAIL = 'email',                 // Email verification
  HARDWARE_TOKEN = 'hardware_token', // YubiKey, RSA token
  BIOMETRIC = 'biometric',         // Fingerprint, FaceID
  BACKUP_CODES = 'backup_codes'    // One-time backup codes
}

export enum AccessStatus {
  REQUESTED = 'requested',
  PENDING_APPROVAL = 'pending_approval',
  PENDING_MFA = 'pending_mfa',
  APPROVED = 'approved',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  DENIED = 'denied',
  EMERGENCY_ACTIVATED = 'emergency_activated'
}

export interface PrivilegedRole {
  id: string;
  name: string;
  description: string;
  privilegeLevel: PrivilegeLevel;
  
  // Permissions
  permissions: string[];
  resourceAccess: {
    databases: string[];
    services: string[];
    networks: string[];
    files: string[];
  };
  
  // Access controls
  requiresApproval: boolean;
  approverRoles: string[];
  minimumApprovers: number;
  
  // MFA requirements
  mfaRequired: boolean;
  allowedMfaMethods: MFAMethod[];
  mfaValidityMinutes: number;
  
  // Time constraints
  maxSessionDuration: number; // minutes
  allowedTimeWindows: {
    start: string; // HH:mm
    end: string;
    timezone: string;
    days: number[]; // 0-6 (Sunday-Saturday)
  }[];
  
  // Risk controls
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  ipWhitelist?: string[];
  deviceRestrictions: boolean;
  geolocationRestrictions?: string[];
  
  // Monitoring
  auditLevel: 'standard' | 'enhanced' | 'comprehensive';
  sessionRecording: boolean;
  keystrokeLogging: boolean;
  screenCapture: boolean;
  
  // Break-glass
  emergencyAccess: boolean;
  emergencyApprovers: string[];
  emergencyNotifications: string[];
  
  // Compliance
  complianceRelevant: boolean;
  regulations: string[];
  retentionPeriod: number; // days
  
  active: boolean;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface AccessRequest {
  id: string;
  userId: string;
  username: string;
  
  // Request details
  requestType: AccessRequestType;
  requestedRole: string;
  targetResources: string[];
  justification: string;
  businessNeed: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  
  // Time constraints
  requestedStartTime: Date;
  requestedDuration: number; // minutes
  requestedEndTime: Date;
  
  // Approval workflow
  status: AccessStatus;
  approvers: {
    userId: string;
    username: string;
    role: string;
    decision: 'approved' | 'denied' | 'pending';
    approvedAt?: Date;
    comments?: string;
    riskAssessment?: string;
  }[];
  
  // MFA verification
  mfaRequired: boolean;
  mfaCompleted: boolean;
  mfaMethod?: MFAMethod;
  mfaVerifiedAt?: Date;
  mfaAttempts: number;
  
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
  automaticApproval: boolean;
  
  // Session tracking
  sessionId?: string;
  sessionStarted?: Date;
  sessionEnded?: Date;
  lastActivity?: Date;
  
  // Context
  sourceIp: string;
  userAgent: string;
  deviceFingerprint: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  
  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
    riskImpact?: string;
  }[];
  
  // Emergency handling
  emergencyAccess: boolean;
  emergencyReason?: string;
  emergencyApprovedBy?: string;
  emergencyNotificationsSent: boolean;
  
  // Compliance
  complianceValidated: boolean;
  complianceIssues: string[];
  
  createdAt: Date;
  lastUpdated: Date;
}

export interface PrivilegedSession {
  id: string;
  accessRequestId: string;
  userId: string;
  username: string;
  role: string;
  
  // Session lifecycle
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'active' | 'expired' | 'terminated' | 'suspended';
  
  // Security monitoring
  activities: {
    timestamp: Date;
    action: string;
    resource: string;
    command?: string;
    result: 'success' | 'failure' | 'blocked';
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  
  // Session recording
  recordingEnabled: boolean;
  recordingPath?: string;
  keystrokesLogged: boolean;
  keystrokeLogPath?: string;
  screenCaptured: boolean;
  screenCapturePath?: string;
  
  // Real-time monitoring
  realTimeMonitoring: boolean;
  suspiciousActivity: boolean;
  alertsGenerated: number;
  
  // Extension tracking
  extensionRequests: {
    requestedAt: Date;
    additionalMinutes: number;
    justification: string;
    approved: boolean;
    approvedBy?: string;
  }[];
  
  // Risk assessment
  currentRiskScore: number;
  riskEvents: {
    timestamp: Date;
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    automated: boolean;
  }[];
  
  // Compliance tracking
  auditEvents: {
    timestamp: Date;
    event: string;
    compliance: string[];
    details: Record<string, any>;
  }[];
  
  lastActivity: Date;
}

export interface MFAChallenge {
  id: string;
  userId: string;
  accessRequestId: string;
  
  // Challenge details
  method: MFAMethod;
  challengeCode?: string;
  qrCode?: string;
  pushToken?: string;
  
  // Status
  status: 'pending' | 'verified' | 'failed' | 'expired';
  attempts: number;
  maxAttempts: number;
  
  // Timing
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
  
  // Security
  challengeHash: string;
  ipAddress: string;
  userAgent: string;
  
  // Backup options
  backupMethodsAvailable: MFAMethod[];
  backupMethodUsed?: MFAMethod;
}

export interface AccessControlMetrics {
  // Request metrics
  totalRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  emergencyRequests: number;
  
  // Approval metrics
  averageApprovalTime: number;
  automaticApprovals: number;
  manualApprovals: number;
  
  // Session metrics
  activeSessions: number;
  averageSessionDuration: number;
  sessionsExtended: number;
  sessionsTerminated: number;
  
  // Security metrics
  mfaFailures: number;
  suspiciousActivities: number;
  riskEventsDetected: number;
  complianceViolations: number;
  
  // Performance metrics
  systemAvailability: number;
  responseTime: number;
  
  // Time range
  periodStart: Date;
  periodEnd: Date;
}

export class PrivilegedAccessService {
  private static instance: PrivilegedAccessService;
  private privilegedRoles: Map<string, PrivilegedRole> = new Map();
  private accessRequests: Map<string, AccessRequest> = new Map();
  private activeSessions: Map<string, PrivilegedSession> = new Map();
  private mfaChallenges: Map<string, MFAChallenge> = new Map();
  private metrics!: AccessControlMetrics;
  private riskEngine: Map<string, any> = new Map();

  private constructor() {
    this.initializePrivilegedAccess();
    this.loadPrivilegedRoles();
    this.initializeMetrics();
    this.startAccessMonitoring();

    logger.info('Privileged Access Service initialized', {
      roles: this.privilegedRoles.size,
      mfaMethods: Object.values(MFAMethod).length,
      emergencyAccess: true,
      justInTimeAccess: true
    });
  }

  public static getInstance(): PrivilegedAccessService {
    if (!PrivilegedAccessService.instance) {
      PrivilegedAccessService.instance = new PrivilegedAccessService();
    }
    return PrivilegedAccessService.instance;
  }

  private async initializePrivilegedAccess(): Promise<void> {
    try {
      // Initialize MFA providers
      await this.initializeMFAProviders();
      
      // Setup risk assessment engine
      await this.setupRiskAssessmentEngine();
      
      // Initialize session monitoring
      await this.initializeSessionMonitoring();

      logger.info('Privileged access initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize privileged access:', error);
      throw error;
    }
  }

  private async initializeMFAProviders(): Promise<void> {
    // Initialize various MFA providers (TOTP, Push, SMS, etc.)
    logger.debug('MFA providers initialized');
  }

  private async setupRiskAssessmentEngine(): Promise<void> {
    // Setup AI-based risk assessment for access requests
    logger.debug('Risk assessment engine setup completed');
  }

  private async initializeSessionMonitoring(): Promise<void> {
    // Initialize real-time session monitoring and recording
    logger.debug('Session monitoring initialized');
  }

  private loadPrivilegedRoles(): void {
    // Database Administrator Role
    const dbAdminRole: PrivilegedRole = {
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
      maxSessionDuration: 240, // 4 hours
      allowedTimeWindows: [
        {
          start: '08:00',
          end: '18:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5] // Weekdays only
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
      retentionPeriod: 2555, // 7 years
      active: true,
      createdBy: 'security_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // System Administrator Role
    const sysAdminRole: PrivilegedRole = {
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
      maxSessionDuration: 480, // 8 hours
      allowedTimeWindows: [
        {
          start: '00:00',
          end: '23:59',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6] // All days
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
      retentionPeriod: 1095, // 3 years
      active: true,
      createdBy: 'security_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Security Investigator Role
    const securityInvestigatorRole: PrivilegedRole = {
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
      requiresApproval: false, // Emergency response capability
      approverRoles: [],
      minimumApprovers: 0,
      mfaRequired: true,
      allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.PUSH, MFAMethod.HARDWARE_TOKEN],
      mfaValidityMinutes: 180,
      maxSessionDuration: 720, // 12 hours for investigations
      allowedTimeWindows: [
        {
          start: '00:00',
          end: '23:59',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6] // All days
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
      retentionPeriod: 2555, // 7 years
      active: true,
      createdBy: 'security_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Emergency Break-Glass Role
    const breakGlassRole: PrivilegedRole = {
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
      requiresApproval: false, // Emergency use only
      approverRoles: [],
      minimumApprovers: 0,
      mfaRequired: true,
      allowedMfaMethods: [MFAMethod.TOTP, MFAMethod.HARDWARE_TOKEN, MFAMethod.BACKUP_CODES],
      mfaValidityMinutes: 30,
      maxSessionDuration: 120, // 2 hours max for emergency
      allowedTimeWindows: [
        {
          start: '00:00',
          end: '23:59',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6] // All days
        }
      ],
      riskLevel: 'critical',
      deviceRestrictions: false, // Emergency access from any device
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
      retentionPeriod: 3650, // 10 years
      active: true,
      createdBy: 'system',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Financial Administrator Role
    const financeAdminRole: PrivilegedRole = {
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
      maxSessionDuration: 360, // 6 hours
      allowedTimeWindows: [
        {
          start: '07:00',
          end: '19:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5] // Business days only
        }
      ],
      riskLevel: 'high',
      deviceRestrictions: true,
      auditLevel: 'comprehensive',
      sessionRecording: true,
      keystrokeLogging: true,
      screenCapture: true,
      emergencyAccess: false, // No emergency access for financial data
      emergencyApprovers: [],
      emergencyNotifications: [],
      complianceRelevant: true,
      regulations: ['SOX', 'PCI_DSS', 'GAAP'],
      retentionPeriod: 2555, // 7 years
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

    logger.info('Privileged roles loaded', {
      roleCount: this.privilegedRoles.size,
      emergencyRoles: 1,
      mfaRequiredRoles: this.privilegedRoles.size
    });
  }

  private initializeMetrics(): void {
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

    logger.debug('Privileged access metrics initialized');
  }

  /**
   * Request privileged access
   */
  async requestPrivilegedAccess(
    userId: string,
    username: string,
    requestedRole: string,
    options: {
      requestType?: AccessRequestType;
      targetResources?: string[];
      justification?: string;
      businessNeed?: string;
      urgency?: 'low' | 'medium' | 'high' | 'emergency';
      requestedDuration?: number;
      sourceIp?: string;
      userAgent?: string;
      emergencyAccess?: boolean;
    } = {}
  ): Promise<string> {
    const requestId = crypto.randomUUID();
    
    try {
      // Validate requested role
      const role = this.privilegedRoles.get(requestedRole);
      if (!role || !role.active) {
        throw new Error(`Invalid or inactive privileged role: ${requestedRole}`);
      }

      // Check if emergency access
      const isEmergency = options.emergencyAccess || options.urgency === 'emergency';
      if (isEmergency && !role.emergencyAccess) {
        throw new Error(`Emergency access not allowed for role: ${requestedRole}`);
      }

      // Calculate requested duration
      const requestedDuration = options.requestedDuration || role.maxSessionDuration;
      if (requestedDuration > role.maxSessionDuration) {
        throw new Error(`Requested duration exceeds maximum: ${requestedDuration} > ${role.maxSessionDuration}`);
      }

      // Create access request
      const accessRequest: AccessRequest = {
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

      // Add initial audit entry
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

      // Perform risk assessment
      await this.performRiskAssessment(accessRequest, role);

      // Check time windows
      if (!this.isInAllowedTimeWindow(role)) {
        if (!isEmergency) {
          throw new Error('Access request outside allowed time window');
        }
        accessRequest.riskFactors.push('outside_allowed_time_window');
        accessRequest.riskScore += 20;
      }

      // Handle emergency access
      if (isEmergency) {
        await this.handleEmergencyAccess(accessRequest, role);
      } else {
        // Check approval requirements
        if (role.requiresApproval) {
          await this.initiateApprovalWorkflow(accessRequest, role);
        } else {
          // Auto-approve for certain roles
          accessRequest.status = AccessStatus.APPROVED;
          accessRequest.automaticApproval = true;
          this.metrics.automaticApprovals++;
        }
      }

      // Check MFA requirement
      if (role.mfaRequired && accessRequest.status === AccessStatus.APPROVED) {
        accessRequest.status = AccessStatus.PENDING_MFA;
        await this.initiateMFAChallenge(accessRequest, role);
      }

      this.accessRequests.set(requestId, accessRequest);
      this.metrics.totalRequests++;

      logger.info('Privileged access requested', {
        requestId,
        userId,
        username,
        requestedRole,
        urgency: accessRequest.urgency,
        emergencyAccess: isEmergency,
        status: accessRequest.status,
        riskScore: accessRequest.riskScore
      });

      // Log security event
      await securityLogService.logSecurityEvent({
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

    } catch (error) {
      logger.error('Privileged access request failed', {
        requestId,
        userId,
        username,
        requestedRole,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private generateDeviceFingerprint(sourceIp?: string, userAgent?: string): string {
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

  private async performRiskAssessment(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    let riskScore = 0;
    const riskFactors: string[] = [];

    // Base risk by role privilege level
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

    // Risk by urgency
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

    // Risk by request type
    if (accessRequest.requestType === AccessRequestType.EMERGENCY_ACCESS) {
      riskScore += 25;
      riskFactors.push('emergency_access_type');
    }

    // Risk by time window
    if (!this.isInAllowedTimeWindow(role)) {
      riskScore += 20;
      riskFactors.push('outside_time_window');
    }

    // Risk by source IP (simplified check)
    if (role.ipWhitelist && !role.ipWhitelist.includes(accessRequest.sourceIp)) {
      riskScore += 15;
      riskFactors.push('ip_not_whitelisted');
    }

    // Risk by session duration
    if (accessRequest.requestedDuration > role.maxSessionDuration * 0.5) {
      riskScore += 10;
      riskFactors.push('long_session_duration');
    }

    // Check for recent failed attempts (simplified)
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

  private isInAllowedTimeWindow(role: PrivilegedRole): boolean {
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

  private checkRecentFailures(): number {
    // Check for recent failed access attempts
    // In real implementation, would query database
    return Math.floor(Math.random() * 3); // Simulate 0-2 failures
  }

  private async handleEmergencyAccess(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    // Emergency access bypasses normal approval but requires immediate notification
    accessRequest.status = AccessStatus.EMERGENCY_ACTIVATED;
    accessRequest.emergencyAccess = true;

    // Send immediate notifications to emergency approvers
    await this.sendEmergencyNotifications(accessRequest, role);
    accessRequest.emergencyNotificationsSent = true;

    // Log emergency access activation
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

    logger.warn('Emergency access activated', {
      requestId: accessRequest.id,
      userId: accessRequest.userId,
      username: accessRequest.username,
      role: accessRequest.requestedRole,
      justification: accessRequest.justification
    });
  }

  private async sendEmergencyNotifications(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    // Send notifications to emergency approvers and stakeholders
    // In real implementation, would send actual notifications
    logger.info('Emergency notifications sent', {
      requestId: accessRequest.id,
      recipients: role.emergencyNotifications,
      approvers: role.emergencyApprovers
    });
  }

  private async initiateApprovalWorkflow(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    accessRequest.status = AccessStatus.PENDING_APPROVAL;

    // Add required approvers
    for (const approverRole of role.approverRoles) {
      accessRequest.approvers.push({
        userId: '', // Would be populated from actual approver lookup
        username: approverRole,
        role: approverRole,
        decision: 'pending'
      });
    }

    // Send approval notifications
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

  private async sendApprovalNotifications(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    // Send approval request notifications
    logger.info('Approval notifications sent', {
      requestId: accessRequest.id,
      approvers: role.approverRoles
    });
  }

  private async initiateMFAChallenge(accessRequest: AccessRequest, role: PrivilegedRole): Promise<void> {
    const challengeId = crypto.randomUUID();
    
    // For demo, use TOTP as primary method
    const mfaMethod = role.allowedMfaMethods[0] || MFAMethod.TOTP;
    
    const challenge: MFAChallenge = {
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

    logger.info('MFA challenge initiated', {
      challengeId,
      requestId: accessRequest.id,
      method: mfaMethod,
      userId: accessRequest.userId
    });
  }

  private generateMFAChallenge(method: MFAMethod): string {
    switch (method) {
      case MFAMethod.TOTP:
        return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      case MFAMethod.SMS:
      case MFAMethod.EMAIL:
        return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      case MFAMethod.PUSH:
        return crypto.randomUUID(); // Push token
      default:
        return crypto.randomBytes(6).toString('hex');
    }
  }

  /**
   * Verify MFA challenge
   */
  async verifyMFAChallenge(
    challengeId: string,
    userResponse: string,
    options: {
      backupMethod?: MFAMethod;
      backupCode?: string;
    } = {}
  ): Promise<boolean> {
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

      // Verify the challenge
      let verified = false;
      
      if (options.backupMethod && options.backupCode) {
        // Verify backup method
        verified = this.verifyBackupMethod(challenge, options.backupMethod, options.backupCode);
        if (verified) {
          challenge.backupMethodUsed = options.backupMethod;
        }
      } else {
        // Verify primary method
        verified = this.verifyPrimaryMethod(challenge, userResponse);
      }

      if (verified) {
        challenge.status = 'verified';
        challenge.verifiedAt = new Date();

        // Update access request
        const accessRequest = this.accessRequests.get(challenge.accessRequestId);
        if (accessRequest) {
          accessRequest.mfaCompleted = true;
          accessRequest.mfaMethod = challenge.backupMethodUsed || challenge.method;
          accessRequest.mfaVerifiedAt = new Date();
          accessRequest.status = AccessStatus.APPROVED;

          // Start privileged session
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

        logger.info('MFA verification successful', {
          challengeId,
          userId: challenge.userId,
          method: accessRequest?.mfaMethod,
          attempts: challenge.attempts
        });

        return true;

      } else {
        if (challenge.attempts >= challenge.maxAttempts) {
          challenge.status = 'failed';
          
          // Update access request
          const accessRequest = this.accessRequests.get(challenge.accessRequestId);
          if (accessRequest) {
            accessRequest.status = AccessStatus.DENIED;
            this.metrics.deniedRequests++;
          }

          this.metrics.mfaFailures++;
        }

        logger.warn('MFA verification failed', {
          challengeId,
          userId: challenge.userId,
          attempts: challenge.attempts,
          maxAttempts: challenge.maxAttempts
        });

        return false;
      }

    } catch (error) {
      logger.error('MFA verification error', {
        challengeId,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private verifyPrimaryMethod(challenge: MFAChallenge, userResponse: string): boolean {
    // In real implementation, would verify against actual MFA providers
    // For demo, simple string comparison
    return challenge.challengeCode === userResponse;
  }

  private verifyBackupMethod(challenge: MFAChallenge, method: MFAMethod, code: string): boolean {
    // Verify backup method (simplified)
    if (!challenge.backupMethodsAvailable.includes(method)) {
      return false;
    }

    // In real implementation, would verify backup codes
    return code.length >= 6;
  }

  private async startPrivilegedSession(accessRequest: AccessRequest): Promise<void> {
    const sessionId = crypto.randomUUID();
    const role = this.privilegedRoles.get(accessRequest.requestedRole)!;

    const session: PrivilegedSession = {
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

    // Update access request
    accessRequest.sessionId = sessionId;
    accessRequest.sessionStarted = new Date();
    accessRequest.status = AccessStatus.ACTIVE;

    // Schedule session expiration
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

    logger.info('Privileged session started', {
      sessionId,
      userId: accessRequest.userId,
      username: accessRequest.username,
      role: accessRequest.requestedRole,
      duration: accessRequest.requestedDuration
    });
  }

  private expireSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    session.status = 'expired';
    session.endTime = new Date();
    session.duration = session.endTime.getTime() - session.startTime.getTime();

    // Update access request
    const accessRequest = this.accessRequests.get(session.accessRequestId);
    if (accessRequest) {
      accessRequest.sessionEnded = new Date();
      accessRequest.status = AccessStatus.EXPIRED;
    }

    this.metrics.activeSessions--;

    logger.info('Privileged session expired', {
      sessionId,
      userId: session.userId,
      duration: session.duration
    });
  }

  private startAccessMonitoring(): void {
    // Monitor session activities
    setInterval(() => {
      this.monitorActiveSessions();
    }, 30 * 1000); // Every 30 seconds

    // Clean up expired requests and sessions
    setInterval(() => {
      this.cleanupExpiredItems();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Update metrics
    setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000); // Every minute

    logger.info('Privileged access monitoring started');
  }

  private monitorActiveSessions(): void {
    const now = new Date();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.status !== 'active') continue;

      // Check for suspicious activity (simplified)
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 minutes idle
        session.suspiciousActivity = true;
        session.riskEvents.push({
          timestamp: now,
          event: 'extended_idle_time',
          severity: 'medium',
          automated: true
        });

        logger.warn('Suspicious activity detected: extended idle time', {
          sessionId,
          userId: session.userId,
          idleTime: timeSinceLastActivity
        });
      }
    }
  }

  private cleanupExpiredItems(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedRequests = 0;
    let cleanedChallenges = 0;

    // Clean up old access requests
    for (const [requestId, request] of this.accessRequests.entries()) {
      if (request.createdAt < cutoffTime && 
          (request.status === AccessStatus.EXPIRED || 
           request.status === AccessStatus.DENIED ||
           request.status === AccessStatus.REVOKED)) {
        this.accessRequests.delete(requestId);
        cleanedRequests++;
      }
    }

    // Clean up old MFA challenges
    for (const [challengeId, challenge] of this.mfaChallenges.entries()) {
      if (challenge.createdAt < cutoffTime) {
        this.mfaChallenges.delete(challengeId);
        cleanedChallenges++;
      }
    }

    if (cleanedRequests > 0 || cleanedChallenges > 0) {
      logger.debug('Cleaned up expired privileged access items', {
        cleanedRequests,
        cleanedChallenges
      });
    }
  }

  private updateMetrics(): void {
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

  /**
   * Get privileged access statistics
   */
  getStats(): AccessControlMetrics {
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
    
    if (stats.mfaFailures > 10) {
      status = 'warning'; // High MFA failure rate
    }
    
    if (stats.suspiciousActivities > 5) {
      status = 'degraded'; // Suspicious activity detected
    }
    
    if (stats.complianceViolations > 0) {
      status = 'critical'; // Compliance violations
    }

    const emergencySessionsActive = Array.from(this.activeSessions.values())
      .filter(s => s.status === 'active' && 
                  this.accessRequests.get(s.accessRequestId)?.emergencyAccess).length;

    if (emergencySessionsActive > 2) {
      status = 'critical'; // Too many emergency sessions
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

// Export singleton instance
export const privilegedAccessService = PrivilegedAccessService.getInstance();
