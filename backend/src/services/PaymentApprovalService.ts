import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { databaseService } from '../lib/database';
import { TenantCacheService } from './TenantCacheService';
const tenantCacheService = TenantCacheService.getInstance();

export interface ApprovalConfig {
  enableFourEyesApproval: boolean;
  requiredApprovers: number;
  maxApprovalTime: number; // seconds
  enableSeparationOfDuties: boolean;
  enableApprovalHierarchy: boolean;
  criticalAmountThreshold: number;
  enableNotifications: boolean;
  enableApprovalAudit: boolean;
}

export interface ApprovalRequest {
  id: string;
  type: 'payment_status_change' | 'refund' | 'void' | 'manual_adjustment';
  resourceId: string; // order ID, payment ID, etc.
  resourceType: 'order' | 'payment' | 'refund';
  requestedBy: string; // user ID
  requestedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Request details
  currentState: unknown;
  proposedState: unknown;
  reason: string;
  justification: string;
  riskAssessment: {
    riskScore: number;
    riskFactors: string[];
    requiresAdditionalApproval: boolean;
  };
  
  // Approval tracking
  requiredApprovers: number;
  approvals: ApprovalAction[];
  rejections: ApprovalAction[];
  
  // Metadata
  storeId: string;
  amount?: number;
  currency?: string;
  metadata: Record<string, unknown>;
}

export interface ApprovalAction {
  id: string;
  approverId: string;
  approverRole: string;
  action: 'approve' | 'reject';
  timestamp: Date;
  reason: string;
  ipAddress: string;
  userAgent: string;
  signature?: string; // Digital signature for non-repudiation
  mfaVerified: boolean;
}

export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  conditions: ApprovalCondition[];
  requiredApprovers: number;
  allowedApproverRoles: string[];
  excludedApproverRoles: string[];
  maxApprovalTime: number;
  priority: number;
  isActive: boolean;
}

export interface ApprovalCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export class PaymentApprovalService {
  private static instance: PaymentApprovalService;
  private config: ApprovalConfig;
  private approvalRules: Map<string, ApprovalRule> = new Map();
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();

  private constructor() {
    this.config = {
      enableFourEyesApproval: process.env.ENABLE_FOUR_EYES_APPROVAL !== 'false',
      requiredApprovers: parseInt(process.env.REQUIRED_APPROVERS || '2'),
      maxApprovalTime: parseInt(process.env.MAX_APPROVAL_TIME || '86400'), // 24 hours
      enableSeparationOfDuties: process.env.ENABLE_SEPARATION_OF_DUTIES !== 'false',
      enableApprovalHierarchy: process.env.ENABLE_APPROVAL_HIERARCHY !== 'false',
      criticalAmountThreshold: parseInt(process.env.CRITICAL_AMOUNT_THRESHOLD || '10000'), // $10,000
      enableNotifications: process.env.ENABLE_APPROVAL_NOTIFICATIONS !== 'false',
      enableApprovalAudit: process.env.ENABLE_APPROVAL_AUDIT !== 'false'
    };

    this.initializeDefaultRules();
    this.startExpirationTimer();

    logger.info('Payment approval service initialized', {
      fourEyesEnabled: this.config.enableFourEyesApproval,
      requiredApprovers: this.config.requiredApprovers,
      separationOfDuties: this.config.enableSeparationOfDuties
    });
  }

  public static getInstance(): PaymentApprovalService {
    if (!PaymentApprovalService.instance) {
      PaymentApprovalService.instance = new PaymentApprovalService();
    }
    return PaymentApprovalService.instance;
  }

  /**
   * Initialize default approval rules
   */
  private initializeDefaultRules(): void {
    // High-value payment changes
    this.approvalRules.set('high-value-payment', {
      id: 'high-value-payment',
      name: 'High Value Payment Changes',
      description: 'Requires approval for payment status changes above threshold',
      conditions: [
        {
          field: 'amount',
          operator: 'gte',
          value: this.config.criticalAmountThreshold
        },
        {
          field: 'type',
          operator: 'eq',
          value: 'payment_status_change',
          logicalOperator: 'AND'
        }
      ],
      requiredApprovers: 2,
      allowedApproverRoles: ['OWNER', 'ADMIN'],
      excludedApproverRoles: ['VENDOR', 'CUSTOMER'],
      maxApprovalTime: this.config.maxApprovalTime,
      priority: 1,
      isActive: true
    });

    // Refund approvals
    this.approvalRules.set('refund-approval', {
      id: 'refund-approval',
      name: 'Refund Approvals',
      description: 'All refunds require approval',
      conditions: [
        {
          field: 'type',
          operator: 'eq',
          value: 'refund'
        }
      ],
      requiredApprovers: 1,
      allowedApproverRoles: ['OWNER', 'ADMIN'],
      excludedApproverRoles: ['VENDOR', 'CUSTOMER'],
      maxApprovalTime: this.config.maxApprovalTime / 2, // 12 hours for refunds
      priority: 2,
      isActive: true
    });

    // Manual adjustments
    this.approvalRules.set('manual-adjustment', {
      id: 'manual-adjustment',
      name: 'Manual Adjustments',
      description: 'Manual payment adjustments require approval',
      conditions: [
        {
          field: 'type',
          operator: 'eq',
          value: 'manual_adjustment'
        }
      ],
      requiredApprovers: 2,
      allowedApproverRoles: ['OWNER'],
      excludedApproverRoles: ['ADMIN', 'VENDOR', 'CUSTOMER'],
      maxApprovalTime: this.config.maxApprovalTime,
      priority: 1,
      isActive: true
    });
  }

  /**
   * Request approval for payment operation
   */
  async requestApproval(
    type: ApprovalRequest['type'],
    resourceId: string,
    resourceType: ApprovalRequest['resourceType'],
    requestedBy: string,
    storeId: string,
    currentState: unknown,
    proposedState: unknown,
    reason: string,
    justification: string,
    amount?: number,
    currency?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<ApprovalRequest> {
    try {
      if (!this.config.enableFourEyesApproval) {
        throw new Error('Four-eyes approval is disabled');
      }

      // Check if approval is required
      const applicableRules = this.getApplicableRules(type, amount, metadata);
      
      if (applicableRules.length === 0) {
        throw new Error('No approval rules match this request');
      }

      // Get the most restrictive rule
      const primaryRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];

      // Validate requester permissions
      await this.validateRequesterPermissions(requestedBy, storeId, type);

      // Perform risk assessment
      const riskAssessment = await this.assessRisk(
        type,
        resourceId,
        currentState,
        proposedState,
        amount,
        metadata
      );

      // Create approval request
      const approvalRequest: ApprovalRequest = {
        id: this.generateApprovalId(),
        type,
        resourceId,
        resourceType,
        requestedBy,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + primaryRule.maxApprovalTime * 1000),
        status: 'pending',
        priority: this.determinePriority(riskAssessment, amount),
        currentState,
        proposedState,
        reason,
        justification,
        riskAssessment,
        requiredApprovers: Math.max(
          primaryRule.requiredApprovers,
          riskAssessment.requiresAdditionalApproval ? primaryRule.requiredApprovers + 1 : 0
        ),
        approvals: [],
        rejections: [],
        storeId,
        amount,
        currency,
        metadata: {
          ...metadata,
          primaryRule: primaryRule.id,
          applicableRules: applicableRules.map(r => r.id),
          createdAt: new Date().toISOString()
        }
      };

      // Store approval request
      await this.storeApprovalRequest(approvalRequest);

      // Send notifications
      if (this.config.enableNotifications) {
        await this.sendApprovalNotifications(approvalRequest);
      }

      // Audit log
      if (this.config.enableApprovalAudit) {
        await this.auditApprovalEvent('approval_requested', approvalRequest, {
          requestedBy,
          riskScore: riskAssessment.riskScore,
          requiredApprovers: approvalRequest.requiredApprovers
        });
      }

      logger.info('Approval request created', {
        approvalId: approvalRequest.id,
        type,
        resourceId,
        requestedBy,
        storeId,
        amount,
        riskScore: riskAssessment.riskScore,
        requiredApprovers: approvalRequest.requiredApprovers
      });

      return approvalRequest;

    } catch (err: unknown) {
      logger.error('Failed to create approval request:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Submit approval or rejection
   */
  async submitApproval(
    approvalId: string,
    approverId: string,
    action: 'approve' | 'reject',
    reason: string,
    ipAddress: string,
    userAgent: string,
    mfaToken?: string
  ): Promise<{
    approved: boolean;
    completed: boolean;
    approvalRequest: ApprovalRequest;
  }> {
    try {
      const approvalRequest = await this.getApprovalRequest(approvalId);
      
      if (!approvalRequest) {
        throw new Error('Approval request not found');
      }

      if (approvalRequest.status !== 'pending') {
        throw new Error(`Cannot approve request with status: ${approvalRequest.status}`);
      }

      if (approvalRequest.expiresAt < new Date()) {
        approvalRequest.status = 'expired';
        await this.storeApprovalRequest(approvalRequest);
        throw new Error('Approval request has expired');
      }

      // Validate approver permissions
      await this.validateApproverPermissions(approverId, approvalRequest);

      // Check separation of duties
      if (this.config.enableSeparationOfDuties) {
        if (approvalRequest.requestedBy === approverId) {
          throw new Error('Approver cannot approve their own request (separation of duties)');
        }

        // Check if approver has already acted on this request
        const existingActions = [...approvalRequest.approvals, ...approvalRequest.rejections];
        if (existingActions.some(a => a.approverId === approverId)) {
          throw new Error('Approver has already acted on this request');
        }
      }

      // Verify MFA if required for high-risk requests
      if (approvalRequest.riskAssessment.riskScore > 70 && !mfaToken) {
        throw new Error('MFA verification required for high-risk approval');
      }

      // Create approval action
      const approvalAction: ApprovalAction = {
        id: crypto.randomBytes(16).toString('hex'),
        approverId,
        approverRole: await this.getApproverRole(approverId, approvalRequest.storeId),
        action,
        timestamp: new Date(),
        reason,
        ipAddress,
        userAgent,
        mfaVerified: !!mfaToken
      };

      // Generate digital signature for non-repudiation
      approvalAction.signature = await this.generateApprovalSignature(approvalAction, approvalRequest);

      // Add action to request
      if (action === 'approve') {
        approvalRequest.approvals.push(approvalAction);
      } else {
        approvalRequest.rejections.push(approvalAction);
      }

      // Check if request is completed
      let completed = false;
      let approved = false;

      if (action === 'reject') {
        // Single rejection completes the request
        approvalRequest.status = 'rejected';
        completed = true;
        approved = false;
      } else {
        // Check if we have enough approvals
        if (approvalRequest.approvals.length >= approvalRequest.requiredApprovers) {
          approvalRequest.status = 'approved';
          completed = true;
          approved = true;
        }
      }

      // Store updated request
      await this.storeApprovalRequest(approvalRequest);

      // Execute approved action if completed and approved
      if (completed && approved) {
        await this.executeApprovedAction(approvalRequest);
      }

      // Send notifications
      if (this.config.enableNotifications) {
        await this.sendApprovalUpdateNotifications(approvalRequest, approvalAction, completed);
      }

      // Audit log
      if (this.config.enableApprovalAudit) {
        await this.auditApprovalEvent('approval_action', approvalRequest, {
          approverId,
          action,
          completed,
          approved,
          signature: approvalAction.signature
        });
      }

      logger.info('Approval action submitted', {
        approvalId,
        approverId,
        action,
        completed,
        approved,
        currentApprovals: approvalRequest.approvals.length,
        requiredApprovals: approvalRequest.requiredApprovers
      });

      return {
        approved,
        completed,
        approvalRequest
      };

    } catch (err: unknown) {
      logger.error('Failed to submit approval:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Get applicable approval rules for request
   */
  private getApplicableRules(
    type: ApprovalRequest['type'],
    amount?: number,
    metadata: Record<string, unknown> = {}
  ): ApprovalRule[] {
    const applicableRules: ApprovalRule[] = [];

    for (const rule of this.approvalRules.values()) {
      if (!rule.isActive) continue;

      let matches = true;
      
      for (const condition of rule.conditions) {
        let value: unknown;
        
        // Get value to check
        switch (condition.field) {
          case 'type':
            value = type;
            break;
          case 'amount':
            value = amount;
            break;
          default:
            value = metadata[condition.field];
        }

        // Evaluate condition
        const conditionMatches = this.evaluateCondition(value, condition);
        
        if (condition.logicalOperator === 'OR') {
          if (conditionMatches) {
            matches = true;
            break;
          }
        } else {
          // Default AND logic
          if (!conditionMatches) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Evaluate approval condition
   */
  private evaluateCondition(value: unknown, condition: ApprovalCondition): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string);
      default:
        return false;
    }
  }

  /**
   * Assess risk for approval request
   */
  private async assessRisk(
    type: ApprovalRequest['type'],
    resourceId: string,
    currentState: unknown,
    proposedState: unknown,
    amount?: number,
    metadata: Record<string, unknown> = {}
  ): Promise<ApprovalRequest['riskAssessment']> {
    let riskScore = 0;
    const riskFactors: string[] = [];

    // Amount-based risk
    if (amount) {
      if (amount >= this.config.criticalAmountThreshold) {
        riskScore += 40;
        riskFactors.push('high_amount');
      } else if (amount >= this.config.criticalAmountThreshold / 2) {
        riskScore += 20;
        riskFactors.push('medium_amount');
      }
    }

    // Type-based risk
    switch (type) {
      case 'manual_adjustment':
        riskScore += 30;
        riskFactors.push('manual_adjustment');
        break;
      case 'refund':
        riskScore += 15;
        riskFactors.push('refund_request');
        break;
      case 'void':
        riskScore += 25;
        riskFactors.push('void_request');
        break;
    }

    // State change analysis
    if (currentState && proposedState) {
      const significantChanges = this.analyzeStateChanges(currentState, proposedState);
      if (significantChanges.length > 0) {
        riskScore += significantChanges.length * 10;
        riskFactors.push(...significantChanges.map(c => `state_change_${c}`));
      }
    }

    // Time-based risk (late changes)
    if (metadata.orderCreatedAt) {
      const orderAge = Date.now() - new Date(metadata.orderCreatedAt as string).getTime();
      const daysSinceOrder = orderAge / (1000 * 60 * 60 * 24);
      
      if (daysSinceOrder > 30) {
        riskScore += 20;
        riskFactors.push('old_order_modification');
      } else if (daysSinceOrder > 7) {
        riskScore += 10;
        riskFactors.push('aged_order_modification');
      }
    }

    return {
      riskScore: Math.min(100, riskScore),
      riskFactors,
      requiresAdditionalApproval: riskScore > 60
    };
  }

  /**
   * Analyze significant state changes
   */
  private analyzeStateChanges(currentState: unknown, proposedState: unknown): string[] {
    const changes: string[] = [];

    // Compare key fields
    const keyFields = ['status', 'amount', 'currency', 'paymentMethod'];
    
    for (const field of keyFields) {
      if (currentState[field] !== proposedState[field]) {
        changes.push(field);
      }
    }

    return changes;
  }

  /**
   * Determine priority based on risk and amount
   */
  private determinePriority(
    riskAssessment: ApprovalRequest['riskAssessment'],
    amount?: number
  ): ApprovalRequest['priority'] {
    if (riskAssessment.riskScore >= 80) {
      return 'critical';
    }
    
    if (riskAssessment.riskScore >= 60 || (amount && amount >= this.config.criticalAmountThreshold)) {
      return 'high';
    }
    
    if (riskAssessment.riskScore >= 30) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Validate requester permissions
   */
  private async validateRequesterPermissions(
    userId: string,
    storeId: string,
    type: ApprovalRequest['type']
  ): Promise<void> {
    try {
      const prisma = databaseService.getPrisma();
      
      const userRole = await prisma.$queryRaw<{ role: string }[]>`
        SELECT role FROM users 
        WHERE id = ${userId}::UUID 
        AND (store_id = ${storeId}::UUID OR role IN ('OWNER', 'ADMIN'))
      `;

      if (userRole.length === 0) {
        throw new Error('User not found or insufficient permissions');
      }

      const role = userRole[0].role;

      // Check role-based permissions for different request types
      const rolePermissions = {
        'payment_status_change': ['OWNER', 'ADMIN', 'VENDOR'],
        'refund': ['OWNER', 'ADMIN'],
        'void': ['OWNER', 'ADMIN'],
        'manual_adjustment': ['OWNER']
      };

      const allowedRoles = rolePermissions[type];
      if (!allowedRoles.includes(role)) {
        throw new Error(`Role ${role} is not authorized to request ${type}`);
      }

    } catch (err: unknown) {
      logger.error('Requester permission validation failed:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Validate approver permissions
   */
  private async validateApproverPermissions(
    approverId: string,
    approvalRequest: ApprovalRequest
  ): Promise<void> {
    try {
      const approverRole = await this.getApproverRole(approverId, approvalRequest.storeId);
      
      // Get applicable rules to check allowed approver roles
      const applicableRules = this.getApplicableRules(
        approvalRequest.type,
        approvalRequest.amount,
        approvalRequest.metadata
      );

      const primaryRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];
      
      if (!primaryRule.allowedApproverRoles.includes(approverRole)) {
        throw new Error(`Role ${approverRole} is not authorized to approve this request`);
      }

      if (primaryRule.excludedApproverRoles.includes(approverRole)) {
        throw new Error(`Role ${approverRole} is excluded from approving this request`);
      }

    } catch (err: unknown) {
      logger.error('Approver permission validation failed:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Get approver role
   */
  private async getApproverRole(approverId: string, storeId: string): Promise<string> {
    try {
      const prisma = databaseService.getPrisma();
      
      const userRole = await prisma.$queryRaw<{ role: string }[]>`
        SELECT role FROM users 
        WHERE id = ${approverId}::UUID 
        AND (store_id = ${storeId}::UUID OR role IN ('OWNER', 'ADMIN'))
      `;

      if (userRole.length === 0) {
        throw new Error('Approver not found or insufficient permissions');
      }

      return userRole[0].role;

    } catch (err: unknown) {
      logger.error('Failed to get approver role:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Generate approval signature for non-repudiation
   */
  private async generateApprovalSignature(
    action: ApprovalAction,
    request: ApprovalRequest
  ): Promise<string> {
    const signatureData = {
      approvalId: request.id,
      approverId: action.approverId,
      action: action.action,
      timestamp: action.timestamp.toISOString(),
      resourceId: request.resourceId,
      amount: request.amount,
      reason: action.reason
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData) + process.env.APPROVAL_SIGNATURE_SECRET)
      .digest('hex');
  }

  /**
   * Execute approved action
   */
  private async executeApprovedAction(approvalRequest: ApprovalRequest): Promise<void> {
    try {
      logger.info('Executing approved action', {
        approvalId: approvalRequest.id,
        type: approvalRequest.type,
        resourceId: approvalRequest.resourceId
      });

      // This would integrate with the actual business logic
      // For now, just log the execution
      
      // Update the resource with the approved state
      // Implementation would depend on the specific resource type and business logic

      if (this.config.enableApprovalAudit) {
        await this.auditApprovalEvent('action_executed', approvalRequest, {
          executedAt: new Date().toISOString(),
          proposedState: approvalRequest.proposedState
        });
      }

    } catch (err: unknown) {
      logger.error('Failed to execute approved action:', err as Record<string, unknown>);
      
      // Mark approval as failed execution
      approvalRequest.status = 'rejected';
      approvalRequest.metadata.executionError = getErrorMessage(err as Error);
      await this.storeApprovalRequest(approvalRequest);
      
      throw err;
    }
  }

  /**
   * Store approval request
   */
  private async storeApprovalRequest(request: ApprovalRequest): Promise<void> {
    try {
      // Store in cache for fast access
      await tenantCacheService.set(
        'system',
        `approval_${request.id}`,
        request,
        {
          ttl: Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
          namespace: 'approvals'
        }
      );

      // Store in database for persistence
      const prisma = databaseService.getPrisma();
      await prisma.$executeRaw`
        INSERT INTO approval_requests (
          id, type, resource_id, resource_type, requested_by, store_id,
          requested_at, expires_at, status, priority,
          current_state, proposed_state, reason, justification,
          risk_assessment, required_approvers, approvals, rejections,
          amount, currency, metadata
        ) VALUES (
          ${request.id},
          ${request.type},
          ${request.resourceId},
          ${request.resourceType},
          ${request.requestedBy}::UUID,
          ${request.storeId}::UUID,
          ${request.requestedAt},
          ${request.expiresAt},
          ${request.status},
          ${request.priority},
          ${JSON.stringify(request.currentState)}::JSONB,
          ${JSON.stringify(request.proposedState)}::JSONB,
          ${request.reason},
          ${request.justification},
          ${JSON.stringify(request.riskAssessment)}::JSONB,
          ${request.requiredApprovers},
          ${JSON.stringify(request.approvals)}::JSONB,
          ${JSON.stringify(request.rejections)}::JSONB,
          ${request.amount},
          ${request.currency},
          ${JSON.stringify(request.metadata)}::JSONB
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          approvals = EXCLUDED.approvals,
          rejections = EXCLUDED.rejections,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;

      this.pendingApprovals.set(request.id, request);

    } catch (err: unknown) {
      logger.error('Failed to store approval request:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Get approval request
   */
  private async getApprovalRequest(id: string): Promise<ApprovalRequest | null> {
    try {
      // Check cache first
      const cached = await tenantCacheService.get<ApprovalRequest>(
        'system',
        `approval_${id}`,
        { namespace: 'approvals' }
      );

      if (cached) {
        return cached;
      }

      // Fallback to database
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM approval_requests WHERE id = ${id}
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      const request: ApprovalRequest = {
        id: row.id,
        type: row.type,
        resourceId: row.resource_id,
        resourceType: row.resource_type,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
        status: row.status,
        priority: row.priority,
        currentState: row.current_state,
        proposedState: row.proposed_state,
        reason: row.reason,
        justification: row.justification,
        riskAssessment: row.risk_assessment,
        requiredApprovers: row.required_approvers,
        approvals: row.approvals || [],
        rejections: row.rejections || [],
        storeId: row.store_id,
        amount: row.amount,
        currency: row.currency,
        metadata: row.metadata || {}
      };

      // Cache for future use
      await tenantCacheService.set(
        'system',
        `approval_${id}`,
        request,
        {
          ttl: Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
          namespace: 'approvals'
        }
      );

      return request;

    } catch (err: unknown) {
      logger.error('Failed to get approval request:', err as Record<string, unknown>);
      return null;
    }
  }

  /**
   * Generate approval ID
   */
  private generateApprovalId(): string {
    return 'apr_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Send approval notifications (placeholder)
   */
  private async sendApprovalNotifications(
    request: ApprovalRequest
  ): Promise<void> {
    // This would integrate with the notification service
    logger.info('Sending approval notifications', {
      approvalId: request.id,
      type: request.type,
      priority: request.priority,
      requiredApprovers: request.requiredApprovers
    });
  }

  /**
   * Send approval update notifications (placeholder)
   */
  private async sendApprovalUpdateNotifications(
    request: ApprovalRequest,
    action: ApprovalAction,
    completed: boolean
  ): Promise<void> {
    // This would integrate with the notification service
    logger.info('Sending approval update notifications', {
      approvalId: request.id,
      action: action.action,
      completed,
      approverId: action.approverId
    });
  }

  /**
   * Audit approval events
   */
  private async auditApprovalEvent(
    eventType: string,
    request: ApprovalRequest,
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const auditEvent = {
        eventType,
        approvalId: request.id,
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        storeId: request.storeId,
        timestamp: new Date().toISOString(),
        ...additionalData
      };

      // This would integrate with the audit logging service
      logger.audit('Approval audit event', auditEvent);

    } catch (err: unknown) {
      logger.error('Failed to audit approval event:', err as Record<string, unknown>);
    }
  }

  /**
   * Start expiration timer for pending approvals
   */
  private startExpirationTimer(): void {
    setInterval(async () => {
      try {
        await this.expirePendingApprovals();
      } catch (err: unknown) {
        logger.error('Approval expiration timer error:', err as Record<string, unknown>);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Expire pending approvals
   */
  private async expirePendingApprovals(): Promise<void> {
    const now = new Date();
    let expiredCount = 0;

    for (const [_id, request] of this.pendingApprovals.entries()) {
      if (request.status === 'pending' && request.expiresAt < now) {
        request.status = 'expired';
        await this.storeApprovalRequest(request);
        
        if (this.config.enableApprovalAudit) {
          await this.auditApprovalEvent('approval_expired', request);
        }

        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info('Expired pending approvals', {
        expiredCount,
        remainingPending: this.pendingApprovals.size - expiredCount
      });
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: ApprovalConfig;
    pendingApprovals: number;
    approvalRules: number;
  } {
    return {
      config: this.config,
      pendingApprovals: this.pendingApprovals.size,
      approvalRules: this.approvalRules.size
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: { config: ApprovalConfig; pendingApprovals: number; approvalRules: number; };
  }> {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        stats
      };

    } catch (err: unknown) {
      logger.error('Payment approval service health check failed:', err as Record<string, unknown>);
      return {
        status: 'error',
        stats: null
      };
    }
  }
}

// Export singleton instance
export const paymentApprovalService = PaymentApprovalService.getInstance();
