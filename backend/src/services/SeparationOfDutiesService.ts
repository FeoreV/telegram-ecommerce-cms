import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum DutyCategory {
  DEPLOYMENT = 'deployment',
  PAYMENT_PROCESSING = 'payment_processing',
  KEY_MANAGEMENT = 'key_management',
  USER_MANAGEMENT = 'user_management',
  DATA_MANAGEMENT = 'data_management',
  SECURITY_ADMINISTRATION = 'security_administration',
  SYSTEM_ADMINISTRATION = 'system_administration',
  AUDIT_MANAGEMENT = 'audit_management',
  COMPLIANCE_MANAGEMENT = 'compliance_management'
}

export enum OperationType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  REVIEW = 'review',
  AUTHORIZE = 'authorize'
}

export enum ConflictType {
  ROLE_CONFLICT = 'role_conflict',           // Same person in conflicting roles
  DUTY_CONFLICT = 'duty_conflict',           // Same person performing conflicting duties
  TEMPORAL_CONFLICT = 'temporal_conflict',   // Operations too close in time
  HIERARCHY_CONFLICT = 'hierarchy_conflict', // Reporting relationship conflict
  VENDOR_CONFLICT = 'vendor_conflict'        // External vendor involvement
}

export enum SeparationLevel {
  WEAK = 'weak',         // Advisory separation
  STRONG = 'strong',     // Mandatory separation
  ABSOLUTE = 'absolute'  // No exceptions allowed
}

export interface DutyRole {
  id: string;
  name: string;
  description: string;
  category: DutyCategory;
  
  // Permissions and capabilities
  permissions: string[];
  operationTypes: OperationType[];
  resourceAccess: string[];
  
  // Separation requirements
  incompatibleRoles: string[];
  requiredSeparationLevel: SeparationLevel;
  
  // Approval requirements
  requiresApproval: boolean;
  approverRoles: string[];
  multiPersonApproval: boolean;
  
  // Time constraints
  cooldownPeriod: number; // minutes between operations
  timeWindowRestrictions: {
    start: string;
    end: string;
    timezone: string;
    days: number[];
  }[];
  
  // Risk controls
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  maxOperationsPerDay: number;
  requiresSecondPerson: boolean;
  
  // Monitoring and auditing
  auditLevel: 'standard' | 'enhanced' | 'comprehensive';
  realTimeMonitoring: boolean;
  
  // Compliance
  complianceRelevant: boolean;
  regulations: string[];
  
  active: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface SeparationRule {
  id: string;
  name: string;
  description: string;
  
  // Rule definition
  primaryDuty: DutyCategory;
  conflictingDuties: DutyCategory[];
  conflictType: ConflictType;
  separationLevel: SeparationLevel;
  
  // Rule constraints
  temporalSeparation: {
    enabled: boolean;
    minimumHours: number;
    maximumDays: number;
  };
  
  // Exceptions
  allowedExceptions: {
    emergencyOverride: boolean;
    seniorApproval: boolean;
    businessJustification: boolean;
    timeboxed: boolean;
  };
  
  // Enforcement
  enforcementLevel: 'advisory' | 'blocking' | 'fatal';
  automaticEnforcement: boolean;
  
  // Monitoring
  violationAlerts: boolean;
  alertRecipients: string[];
  
  // Compliance mapping
  complianceReasons: string[];
  regulatoryRequirements: string[];
  
  // Rule metadata
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  lastReviewed: Date;
}

export interface DutyAssignment {
  id: string;
  userId: string;
  username: string;
  
  // Assignment details
  roleId: string;
  roleName: string;
  dutyCategory: DutyCategory;
  
  // Assignment period
  assignedAt: Date;
  expiresAt?: Date;
  lastActivity?: Date;
  
  // Assignment context
  assignedBy: string;
  businessJustification: string;
  temporaryAssignment: boolean;
  
  // Approval tracking
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalReason?: string;
  
  // Monitoring
  operationCount: number;
  lastOperation?: Date;
  violationCount: number;
  
  // Status
  status: 'pending' | 'active' | 'suspended' | 'expired' | 'revoked';
  
  auditTrail: {
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
  }[];
  
  createdAt: Date;
  lastModified: Date;
}

export interface DutyOperation {
  id: string;
  userId: string;
  username: string;
  
  // Operation details
  dutyCategory: DutyCategory;
  operationType: OperationType;
  resource: string;
  action: string;
  
  // Context
  timestamp: Date;
  sourceIp: string;
  userAgent?: string;
  sessionId?: string;
  
  // Approval and authorization
  requiresApproval: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Separation checks
  separationChecked: boolean;
  violationsDetected: ViolationResult[];
  proceededWithViolation: boolean;
  overrideReason?: string;
  overrideApprovedBy?: string;
  
  // Results
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'blocked';
  result?: 'success' | 'failure' | 'blocked';
  errorMessage?: string;
  
  // Compliance
  complianceRelevant: boolean;
  auditRequired: boolean;
  
  createdAt: Date;
  completedAt?: Date;
}

export interface ViolationResult {
  violationType: ConflictType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ruleId: string;
  ruleName: string;
  description: string;
  conflictingOperations: string[];
  recommendedAction: 'block' | 'require_approval' | 'warn' | 'allow';
  canOverride: boolean;
  overrideRequirements: string[];
}

export interface SeparationMetrics {
  // Operation metrics
  totalOperations: number;
  approvedOperations: number;
  blockedOperations: number;
  overriddenOperations: number;
  
  // Violation metrics
  totalViolations: number;
  violationsByType: Record<ConflictType, number>;
  violationsBySeverity: Record<string, number>;
  
  // Compliance metrics
  complianceScore: number;
  auditFindings: number;
  regulatoryViolations: number;
  
  // User metrics
  activeAssignments: number;
  temporaryAssignments: number;
  expiredAssignments: number;
  
  // Performance metrics
  averageApprovalTime: number;
  systemAvailability: number;
  
  // Time range
  periodStart: Date;
  periodEnd: Date;
}

export class SeparationOfDutiesService {
  private static instance: SeparationOfDutiesService;
  private dutyRoles: Map<string, DutyRole> = new Map();
  private separationRules: Map<string, SeparationRule> = new Map();
  private dutyAssignments: Map<string, DutyAssignment> = new Map();
  private recentOperations: Map<string, DutyOperation> = new Map();
  private userRoleCache: Map<string, string[]> = new Map();
  private metrics!: SeparationMetrics;

  private constructor() {
    this.initializeSeparationOfDuties();
    this.loadDutyRoles();
    this.loadSeparationRules();
    this.initializeMetrics();
    this.startSeparationMonitoring();

    logger.info('Separation of Duties Service initialized', {
      dutyRoles: this.dutyRoles.size,
      separationRules: this.separationRules.size,
      enforcementEnabled: true,
      complianceTracking: true
    });
  }

  public static getInstance(): SeparationOfDutiesService {
    if (!SeparationOfDutiesService.instance) {
      SeparationOfDutiesService.instance = new SeparationOfDutiesService();
    }
    return SeparationOfDutiesService.instance;
  }

  private async initializeSeparationOfDuties(): Promise<void> {
    try {
      // Initialize role compatibility matrix
      await this.initializeCompatibilityMatrix();
      
      // Setup violation detection engine
      await this.setupViolationDetection();
      
      // Initialize compliance tracking
      await this.initializeComplianceTracking();

      logger.info('Separation of duties initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize separation of duties:', error);
      throw error;
    }
  }

  private async initializeCompatibilityMatrix(): Promise<void> {
    // Initialize role compatibility checking
    logger.debug('Role compatibility matrix initialized');
  }

  private async setupViolationDetection(): Promise<void> {
    // Setup real-time violation detection
    logger.debug('Violation detection engine setup completed');
  }

  private async initializeComplianceTracking(): Promise<void> {
    // Initialize compliance and regulatory tracking
    logger.debug('Compliance tracking initialized');
  }

  private loadDutyRoles(): void {
    // Deployment Role
    const deploymentRole: DutyRole = {
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
      cooldownPeriod: 60, // 1 hour between major deployments
      timeWindowRestrictions: [
        {
          start: '09:00',
          end: '17:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5] // Business days only
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

    // Payment Processing Role
    const paymentProcessorRole: DutyRole = {
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
      cooldownPeriod: 30, // 30 minutes between large transactions
      timeWindowRestrictions: [
        {
          start: '08:00',
          end: '18:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5] // Business days only
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

    // Key Management Role
    const keyManagerRole: DutyRole = {
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
      cooldownPeriod: 120, // 2 hours between key operations
      timeWindowRestrictions: [
        {
          start: '10:00',
          end: '16:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5] // Business days only
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

    // Security Auditor Role
    const securityAuditorRole: DutyRole = {
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
          days: [0, 1, 2, 3, 4, 5, 6] // All days
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

    // System Administrator Role
    const systemAdminRole: DutyRole = {
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
          days: [0, 1, 2, 3, 4, 5, 6] // All days
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

    logger.info('Duty roles loaded', {
      roleCount: this.dutyRoles.size,
      absoluteSeparationRoles: Array.from(this.dutyRoles.values())
        .filter(r => r.requiredSeparationLevel === SeparationLevel.ABSOLUTE).length
    });
  }

  private loadSeparationRules(): void {
    // Rule 1: Deployment and Payment Separation
    const deploymentPaymentRule: SeparationRule = {
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

    // Rule 2: Payment and Key Management Separation
    const paymentKeyRule: SeparationRule = {
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

    // Rule 3: Audit Independence
    const auditIndependenceRule: SeparationRule = {
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
        minimumHours: 168, // 7 days
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

    // Rule 4: Deployment and System Administration Temporal Separation
    const deploymentSystemRule: SeparationRule = {
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

    // Rule 5: Key Management and Deployment Separation
    const keyDeploymentRule: SeparationRule = {
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

    logger.info('Separation rules loaded', {
      ruleCount: this.separationRules.size,
      absoluteRules: Array.from(this.separationRules.values())
        .filter(r => r.separationLevel === SeparationLevel.ABSOLUTE).length,
      automaticEnforcement: Array.from(this.separationRules.values())
        .filter(r => r.automaticEnforcement).length
    });
  }

  private initializeMetrics(): void {
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

    logger.debug('Separation of duties metrics initialized');
  }

  /**
   * Check separation of duties before operation
   */
  async checkSeparationOfDuties(
    userId: string,
    username: string,
    dutyCategory: DutyCategory,
    operationType: OperationType,
    resource: string,
    action: string,
    options: {
      sourceIp?: string;
      sessionId?: string;
      userAgent?: string;
      emergencyOverride?: boolean;
      businessJustification?: string;
    } = {}
  ): Promise<{
    allowed: boolean;
    violations: ViolationResult[];
    requiresApproval: boolean;
    approverRoles: string[];
    operationId: string;
  }> {
    const operationId = crypto.randomUUID();
    
    try {
      // Create operation record
      const operation: DutyOperation = {
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

      // Get user's current role assignments
      const userRoles = await this.getUserRoleAssignments(userId);
      
      // Check separation violations
      const violations = await this.detectSeparationViolations(
        userId, 
        dutyCategory, 
        operationType, 
        userRoles,
        operation
      );

      operation.violationsDetected = violations;
      operation.separationChecked = true;

      // Determine if operation is allowed
      let allowed = true;
      let requiresApproval = false;
      let approverRoles: string[] = [];

      // Check if any violations are fatal
      const fatalViolations = violations.filter(v => v.severity === 'critical');
      if (fatalViolations.length > 0 && !options.emergencyOverride) {
        allowed = false;
        operation.status = 'blocked';
        this.metrics.blockedOperations++;
      }

      // Check if operation requires approval
      const dutyRole = this.findDutyRole(dutyCategory);
      if (dutyRole && dutyRole.requiresApproval) {
        requiresApproval = true;
        approverRoles = dutyRole.approverRoles;
        operation.requiresApproval = true;
      }

      // Check for violations that require approval
      const approvalViolations = violations.filter(v => v.recommendedAction === 'require_approval');
      if (approvalViolations.length > 0) {
        requiresApproval = true;
        approverRoles = [...new Set([...approverRoles, ...this.getApproversForViolations(approvalViolations)])];
      }

      // Handle emergency override
      if (options.emergencyOverride && fatalViolations.length > 0) {
        allowed = true;
        operation.proceededWithViolation = true;
        operation.overrideReason = options.businessJustification || 'Emergency override';
        this.metrics.overriddenOperations++;
        
        // Send immediate alerts for emergency overrides
        await this.sendViolationAlerts(violations, operation, true);
      }

      // Update metrics
      this.metrics.totalOperations++;
      if (violations.length > 0) {
        this.metrics.totalViolations += violations.length;
        violations.forEach(v => {
          this.metrics.violationsBySeverity[v.severity]++;
        });
      }

      // Send alerts for violations
      if (violations.length > 0 && !options.emergencyOverride) {
        await this.sendViolationAlerts(violations, operation, false);
      }

      logger.info('Separation of duties check completed', {
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

      // Log security event
      await securityLogService.logSecurityEvent({
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

    } catch (error) {
      logger.error('Separation of duties check failed', {
        operationId,
        userId,
        dutyCategory,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private async getUserRoleAssignments(userId: string): Promise<DutyAssignment[]> {
    // Get current role assignments for user
    const assignments = Array.from(this.dutyAssignments.values())
      .filter(assignment => 
        assignment.userId === userId && 
        assignment.status === 'active' &&
        (!assignment.expiresAt || assignment.expiresAt > new Date())
      );

    return assignments;
  }

  private async detectSeparationViolations(
    userId: string,
    dutyCategory: DutyCategory,
    operationType: OperationType,
    userRoles: DutyAssignment[],
    operation: DutyOperation
  ): Promise<ViolationResult[]> {
    const violations: ViolationResult[] = [];

    // Check each separation rule
    for (const rule of this.separationRules.values()) {
      if (!rule.enabled) continue;

      const violation = await this.checkRule(rule, userId, dutyCategory, operationType, userRoles, operation);
      if (violation) {
        violations.push(violation);
        
        // Update violation metrics by type
        this.metrics.violationsByType[violation.violationType]++;
      }
    }

    return violations;
  }

  private async checkRule(
    rule: SeparationRule,
    userId: string,
    dutyCategory: DutyCategory,
    operationType: OperationType,
    userRoles: DutyAssignment[],
    _operation: DutyOperation
  ): Promise<ViolationResult | null> {
    // Check if rule applies to this duty category
    if (rule.primaryDuty !== dutyCategory && !rule.conflictingDuties.includes(dutyCategory)) {
      return null;
    }

    let violationType: ConflictType;
    let conflictingOperations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check role conflicts
    const conflictingRoles = userRoles.filter(role => {
      const dutyRole = this.dutyRoles.get(role.roleId);
      return dutyRole && rule.conflictingDuties.includes(dutyRole.category);
    });

    if (conflictingRoles.length > 0) {
      violationType = ConflictType.ROLE_CONFLICT;
      conflictingOperations = conflictingRoles.map(r => r.roleName);
      severity = rule.separationLevel === SeparationLevel.ABSOLUTE ? 'critical' : 'high';
    } else if (rule.temporalSeparation.enabled) {
      // Check temporal conflicts
      const temporalConflict = await this.checkTemporalConflicts(
        userId, 
        rule.conflictingDuties, 
        rule.temporalSeparation.minimumHours
      );
      
      if (temporalConflict) {
        violationType = ConflictType.TEMPORAL_CONFLICT;
        conflictingOperations = temporalConflict.operations;
        severity = 'medium';
      } else {
        return null; // No violation
      }
    } else {
      return null; // No violation
    }

    // Determine recommended action
    let recommendedAction: 'block' | 'require_approval' | 'warn' | 'allow';
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

    // Check if override is possible
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

  private async checkTemporalConflicts(
    userId: string,
    conflictingDuties: DutyCategory[],
    minimumHours: number
  ): Promise<{ operations: string[] } | null> {
    const cutoffTime = new Date(Date.now() - minimumHours * 60 * 60 * 1000);
    
    const recentConflictingOperations = Array.from(this.recentOperations.values())
      .filter(op => 
        op.userId === userId &&
        conflictingDuties.includes(op.dutyCategory) &&
        op.timestamp > cutoffTime &&
        op.status === 'executed'
      );

    if (recentConflictingOperations.length > 0) {
      return {
        operations: recentConflictingOperations.map(op => 
          `${op.dutyCategory}:${op.operationType}:${op.resource}`
        )
      };
    }

    return null;
  }

  private getOverrideRequirements(rule: SeparationRule): string[] {
    const requirements: string[] = [];
    
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

  private findDutyRole(dutyCategory: DutyCategory): DutyRole | null {
    for (const role of this.dutyRoles.values()) {
      if (role.category === dutyCategory) {
        return role;
      }
    }
    return null;
  }

  private getApproversForViolations(violations: ViolationResult[]): string[] {
    const approvers: string[] = [];
    
    // Add rule-specific approvers
    for (const violation of violations) {
      const rule = this.separationRules.get(violation.ruleId);
      if (rule && rule.alertRecipients) {
        approvers.push(...rule.alertRecipients);
      }
    }

    return [...new Set(approvers)];
  }

  private calculateOperationRiskScore(operation: DutyOperation, violations: ViolationResult[]): number {
    let riskScore = 0;

    // Base risk by duty category
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

    // Risk from violations
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

    // Risk from proceeding with violations
    if (operation.proceededWithViolation) {
      riskScore += 25;
    }

    return Math.max(0, Math.min(100, riskScore));
  }

  private async sendViolationAlerts(
    violations: ViolationResult[],
    operation: DutyOperation,
    emergencyOverride: boolean
  ): Promise<void> {
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

    // In real implementation, would send actual alerts
    logger.error('SEPARATION OF DUTIES VIOLATION ALERT', {
      alertContent,
      criticalViolations: violations.filter(v => v.severity === 'critical').length
    });
  }

  private startSeparationMonitoring(): void {
    // Monitor role assignments and violations
    setInterval(() => {
      this.monitorRoleAssignments();
    }, 60 * 1000); // Every minute

    // Clean up old operations
    setInterval(() => {
      this.cleanupOldOperations();
    }, 60 * 60 * 1000); // Every hour

    // Generate compliance reports
    setInterval(() => {
      this.generateComplianceReport();
    }, 24 * 60 * 60 * 1000); // Daily

    logger.info('Separation of duties monitoring started');
  }

  private monitorRoleAssignments(): void {
    const now = new Date();
    let expiredAssignments = 0;

    for (const [assignmentId, assignment] of this.dutyAssignments.entries()) {
      if (assignment.status === 'active' && assignment.expiresAt && assignment.expiresAt < now) {
        assignment.status = 'expired';
        expiredAssignments++;
        
        logger.info('Duty assignment expired', {
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

  private cleanupOldOperations(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;

    for (const [operationId, operation] of this.recentOperations.entries()) {
      if (operation.createdAt < cutoffTime) {
        this.recentOperations.delete(operationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old separation operations', { cleanedCount });
    }
  }

  private generateComplianceReport(): void {
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

    logger.info('Separation of duties compliance report generated', report);
  }

  /**
   * Get separation of duties statistics
   */
  getStats(): SeparationMetrics {
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
    
    if (stats.complianceScore < 95) {
      status = 'warning'; // Low compliance score
    }
    
    if (stats.violationsBySeverity.critical > 0) {
      status = 'critical'; // Critical violations detected
    }
    
    if (stats.overriddenOperations > 5) {
      status = 'warning'; // Too many overrides
    }

    const recentViolations = Array.from(this.recentOperations.values())
      .filter(op => op.violationsDetected.length > 0 && 
                   op.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;

    if (recentViolations > 10) {
      status = 'degraded'; // High recent violation rate
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

// Export singleton instance
export const separationOfDutiesService = SeparationOfDutiesService.getInstance();
