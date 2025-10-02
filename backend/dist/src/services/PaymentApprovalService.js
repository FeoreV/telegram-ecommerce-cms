"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentApprovalService = exports.PaymentApprovalService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const database_1 = require("../lib/database");
const TenantCacheService_1 = require("./TenantCacheService");
const tenantCacheService = TenantCacheService_1.TenantCacheService.getInstance();
class PaymentApprovalService {
    constructor() {
        this.approvalRules = new Map();
        this.pendingApprovals = new Map();
        this.config = {
            enableFourEyesApproval: process.env.ENABLE_FOUR_EYES_APPROVAL !== 'false',
            requiredApprovers: parseInt(process.env.REQUIRED_APPROVERS || '2'),
            maxApprovalTime: parseInt(process.env.MAX_APPROVAL_TIME || '86400'),
            enableSeparationOfDuties: process.env.ENABLE_SEPARATION_OF_DUTIES !== 'false',
            enableApprovalHierarchy: process.env.ENABLE_APPROVAL_HIERARCHY !== 'false',
            criticalAmountThreshold: parseInt(process.env.CRITICAL_AMOUNT_THRESHOLD || '10000'),
            enableNotifications: process.env.ENABLE_APPROVAL_NOTIFICATIONS !== 'false',
            enableApprovalAudit: process.env.ENABLE_APPROVAL_AUDIT !== 'false'
        };
        this.initializeDefaultRules();
        this.startExpirationTimer();
        logger_1.logger.info('Payment approval service initialized', {
            fourEyesEnabled: this.config.enableFourEyesApproval,
            requiredApprovers: this.config.requiredApprovers,
            separationOfDuties: this.config.enableSeparationOfDuties
        });
    }
    static getInstance() {
        if (!PaymentApprovalService.instance) {
            PaymentApprovalService.instance = new PaymentApprovalService();
        }
        return PaymentApprovalService.instance;
    }
    initializeDefaultRules() {
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
            maxApprovalTime: this.config.maxApprovalTime / 2,
            priority: 2,
            isActive: true
        });
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
    async requestApproval(type, resourceId, resourceType, requestedBy, storeId, currentState, proposedState, reason, justification, amount, currency, metadata = {}) {
        try {
            if (!this.config.enableFourEyesApproval) {
                throw new Error('Four-eyes approval is disabled');
            }
            const applicableRules = this.getApplicableRules(type, amount, metadata);
            if (applicableRules.length === 0) {
                throw new Error('No approval rules match this request');
            }
            const primaryRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];
            await this.validateRequesterPermissions(requestedBy, storeId, type);
            const riskAssessment = await this.assessRisk(type, resourceId, currentState, proposedState, amount, metadata);
            const approvalRequest = {
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
                requiredApprovers: Math.max(primaryRule.requiredApprovers, riskAssessment.requiresAdditionalApproval ? primaryRule.requiredApprovers + 1 : 0),
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
            await this.storeApprovalRequest(approvalRequest);
            if (this.config.enableNotifications) {
                await this.sendApprovalNotifications(approvalRequest);
            }
            if (this.config.enableApprovalAudit) {
                await this.auditApprovalEvent('approval_requested', approvalRequest, {
                    requestedBy,
                    riskScore: riskAssessment.riskScore,
                    requiredApprovers: approvalRequest.requiredApprovers
                });
            }
            logger_1.logger.info('Approval request created', {
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
        }
        catch (err) {
            logger_1.logger.error('Failed to create approval request:', err);
            throw err;
        }
    }
    async submitApproval(approvalId, approverId, action, reason, ipAddress, userAgent, mfaToken) {
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
            await this.validateApproverPermissions(approverId, approvalRequest);
            if (this.config.enableSeparationOfDuties) {
                if (approvalRequest.requestedBy === approverId) {
                    throw new Error('Approver cannot approve their own request (separation of duties)');
                }
                const existingActions = [...approvalRequest.approvals, ...approvalRequest.rejections];
                if (existingActions.some(a => a.approverId === approverId)) {
                    throw new Error('Approver has already acted on this request');
                }
            }
            if (approvalRequest.riskAssessment.riskScore > 70 && !mfaToken) {
                throw new Error('MFA verification required for high-risk approval');
            }
            const approvalAction = {
                id: crypto_1.default.randomBytes(16).toString('hex'),
                approverId,
                approverRole: await this.getApproverRole(approverId, approvalRequest.storeId),
                action,
                timestamp: new Date(),
                reason,
                ipAddress,
                userAgent,
                mfaVerified: !!mfaToken
            };
            approvalAction.signature = await this.generateApprovalSignature(approvalAction, approvalRequest);
            if (action === 'approve') {
                approvalRequest.approvals.push(approvalAction);
            }
            else {
                approvalRequest.rejections.push(approvalAction);
            }
            let completed = false;
            let approved = false;
            if (action === 'reject') {
                approvalRequest.status = 'rejected';
                completed = true;
                approved = false;
            }
            else {
                if (approvalRequest.approvals.length >= approvalRequest.requiredApprovers) {
                    approvalRequest.status = 'approved';
                    completed = true;
                    approved = true;
                }
            }
            await this.storeApprovalRequest(approvalRequest);
            if (completed && approved) {
                await this.executeApprovedAction(approvalRequest);
            }
            if (this.config.enableNotifications) {
                await this.sendApprovalUpdateNotifications(approvalRequest, approvalAction, completed);
            }
            if (this.config.enableApprovalAudit) {
                await this.auditApprovalEvent('approval_action', approvalRequest, {
                    approverId,
                    action,
                    completed,
                    approved,
                    signature: approvalAction.signature
                });
            }
            logger_1.logger.info('Approval action submitted', {
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
        }
        catch (err) {
            logger_1.logger.error('Failed to submit approval:', err);
            throw err;
        }
    }
    getApplicableRules(type, amount, metadata = {}) {
        const applicableRules = [];
        for (const rule of this.approvalRules.values()) {
            if (!rule.isActive)
                continue;
            let matches = true;
            for (const condition of rule.conditions) {
                let value;
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
                const conditionMatches = this.evaluateCondition(value, condition);
                if (condition.logicalOperator === 'OR') {
                    if (conditionMatches) {
                        matches = true;
                        break;
                    }
                }
                else {
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
    evaluateCondition(value, condition) {
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
                return typeof value === 'string' && value.includes(condition.value);
            default:
                return false;
        }
    }
    async assessRisk(type, resourceId, currentState, proposedState, amount, metadata = {}) {
        let riskScore = 0;
        const riskFactors = [];
        if (amount) {
            if (amount >= this.config.criticalAmountThreshold) {
                riskScore += 40;
                riskFactors.push('high_amount');
            }
            else if (amount >= this.config.criticalAmountThreshold / 2) {
                riskScore += 20;
                riskFactors.push('medium_amount');
            }
        }
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
        if (currentState && proposedState) {
            const significantChanges = this.analyzeStateChanges(currentState, proposedState);
            if (significantChanges.length > 0) {
                riskScore += significantChanges.length * 10;
                riskFactors.push(...significantChanges.map(c => `state_change_${c}`));
            }
        }
        if (metadata.orderCreatedAt) {
            const orderAge = Date.now() - new Date(metadata.orderCreatedAt).getTime();
            const daysSinceOrder = orderAge / (1000 * 60 * 60 * 24);
            if (daysSinceOrder > 30) {
                riskScore += 20;
                riskFactors.push('old_order_modification');
            }
            else if (daysSinceOrder > 7) {
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
    analyzeStateChanges(currentState, proposedState) {
        const changes = [];
        const keyFields = ['status', 'amount', 'currency', 'paymentMethod'];
        for (const field of keyFields) {
            if (currentState[field] !== proposedState[field]) {
                changes.push(field);
            }
        }
        return changes;
    }
    determinePriority(riskAssessment, amount) {
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
    async validateRequesterPermissions(userId, storeId, type) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const userRole = await prisma.$queryRaw `
        SELECT role FROM users 
        WHERE id = ${userId}::UUID 
        AND (store_id = ${storeId}::UUID OR role IN ('OWNER', 'ADMIN'))
      `;
            if (userRole.length === 0) {
                throw new Error('User not found or insufficient permissions');
            }
            const role = userRole[0].role;
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
        }
        catch (err) {
            logger_1.logger.error('Requester permission validation failed:', err);
            throw err;
        }
    }
    async validateApproverPermissions(approverId, approvalRequest) {
        try {
            const approverRole = await this.getApproverRole(approverId, approvalRequest.storeId);
            const applicableRules = this.getApplicableRules(approvalRequest.type, approvalRequest.amount, approvalRequest.metadata);
            const primaryRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];
            if (!primaryRule.allowedApproverRoles.includes(approverRole)) {
                throw new Error(`Role ${approverRole} is not authorized to approve this request`);
            }
            if (primaryRule.excludedApproverRoles.includes(approverRole)) {
                throw new Error(`Role ${approverRole} is excluded from approving this request`);
            }
        }
        catch (err) {
            logger_1.logger.error('Approver permission validation failed:', err);
            throw err;
        }
    }
    async getApproverRole(approverId, storeId) {
        try {
            const prisma = database_1.databaseService.getPrisma();
            const userRole = await prisma.$queryRaw `
        SELECT role FROM users 
        WHERE id = ${approverId}::UUID 
        AND (store_id = ${storeId}::UUID OR role IN ('OWNER', 'ADMIN'))
      `;
            if (userRole.length === 0) {
                throw new Error('Approver not found or insufficient permissions');
            }
            return userRole[0].role;
        }
        catch (err) {
            logger_1.logger.error('Failed to get approver role:', err);
            throw err;
        }
    }
    async generateApprovalSignature(action, request) {
        const signatureData = {
            approvalId: request.id,
            approverId: action.approverId,
            action: action.action,
            timestamp: action.timestamp.toISOString(),
            resourceId: request.resourceId,
            amount: request.amount,
            reason: action.reason
        };
        return crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(signatureData) + process.env.APPROVAL_SIGNATURE_SECRET)
            .digest('hex');
    }
    async executeApprovedAction(approvalRequest) {
        try {
            logger_1.logger.info('Executing approved action', {
                approvalId: approvalRequest.id,
                type: approvalRequest.type,
                resourceId: approvalRequest.resourceId
            });
            if (this.config.enableApprovalAudit) {
                await this.auditApprovalEvent('action_executed', approvalRequest, {
                    executedAt: new Date().toISOString(),
                    proposedState: approvalRequest.proposedState
                });
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to execute approved action:', err);
            approvalRequest.status = 'rejected';
            approvalRequest.metadata.executionError = (0, errorUtils_1.getErrorMessage)(err);
            await this.storeApprovalRequest(approvalRequest);
            throw err;
        }
    }
    async storeApprovalRequest(request) {
        try {
            await tenantCacheService.set('system', `approval_${request.id}`, request, {
                ttl: Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
                namespace: 'approvals'
            });
            const prisma = database_1.databaseService.getPrisma();
            await prisma.$executeRaw `
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
        }
        catch (err) {
            logger_1.logger.error('Failed to store approval request:', err);
            throw err;
        }
    }
    async getApprovalRequest(id) {
        try {
            const cached = await tenantCacheService.get('system', `approval_${id}`, { namespace: 'approvals' });
            if (cached) {
                return cached;
            }
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM approval_requests WHERE id = ${id}
      `;
            if (result.length === 0) {
                return null;
            }
            const row = result[0];
            const request = {
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
            await tenantCacheService.set('system', `approval_${id}`, request, {
                ttl: Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
                namespace: 'approvals'
            });
            return request;
        }
        catch (err) {
            logger_1.logger.error('Failed to get approval request:', err);
            return null;
        }
    }
    generateApprovalId() {
        return 'apr_' + crypto_1.default.randomBytes(16).toString('hex');
    }
    async sendApprovalNotifications(request) {
        logger_1.logger.info('Sending approval notifications', {
            approvalId: request.id,
            type: request.type,
            priority: request.priority,
            requiredApprovers: request.requiredApprovers
        });
    }
    async sendApprovalUpdateNotifications(request, action, completed) {
        logger_1.logger.info('Sending approval update notifications', {
            approvalId: request.id,
            action: action.action,
            completed,
            approverId: action.approverId
        });
    }
    async auditApprovalEvent(eventType, request, additionalData = {}) {
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
            logger_1.logger.audit('Approval audit event', auditEvent);
        }
        catch (err) {
            logger_1.logger.error('Failed to audit approval event:', err);
        }
    }
    startExpirationTimer() {
        setInterval(async () => {
            try {
                await this.expirePendingApprovals();
            }
            catch (err) {
                logger_1.logger.error('Approval expiration timer error:', err);
            }
        }, 5 * 60 * 1000);
    }
    async expirePendingApprovals() {
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
            logger_1.logger.info('Expired pending approvals', {
                expiredCount,
                remainingPending: this.pendingApprovals.size - expiredCount
            });
        }
    }
    getStats() {
        return {
            config: this.config,
            pendingApprovals: this.pendingApprovals.size,
            approvalRules: this.approvalRules.size
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            return {
                status: 'healthy',
                stats
            };
        }
        catch (err) {
            logger_1.logger.error('Payment approval service health check failed:', err);
            return {
                status: 'error',
                stats: null
            };
        }
    }
}
exports.PaymentApprovalService = PaymentApprovalService;
exports.paymentApprovalService = PaymentApprovalService.getInstance();
//# sourceMappingURL=PaymentApprovalService.js.map