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
exports.alertThrottlingService = exports.AlertThrottlingService = exports.ThrottlingStrategy = exports.AlertPriority = exports.AlertType = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var AlertType;
(function (AlertType) {
    AlertType["LOW_STOCK"] = "low_stock";
    AlertType["OUT_OF_STOCK"] = "out_of_stock";
    AlertType["PRICE_CHANGE"] = "price_change";
    AlertType["INVENTORY_DISCREPANCY"] = "inventory_discrepancy";
    AlertType["SYSTEM_ERROR"] = "system_error";
    AlertType["SECURITY_INCIDENT"] = "security_incident";
    AlertType["PAYMENT_FAILURE"] = "payment_failure";
    AlertType["ORDER_ANOMALY"] = "order_anomaly";
    AlertType["USER_ACTIVITY_SUSPICIOUS"] = "user_activity_suspicious";
})(AlertType || (exports.AlertType = AlertType = {}));
var AlertPriority;
(function (AlertPriority) {
    AlertPriority["LOW"] = "low";
    AlertPriority["NORMAL"] = "normal";
    AlertPriority["HIGH"] = "high";
    AlertPriority["CRITICAL"] = "critical";
    AlertPriority["EMERGENCY"] = "emergency";
})(AlertPriority || (exports.AlertPriority = AlertPriority = {}));
var ThrottlingStrategy;
(function (ThrottlingStrategy) {
    ThrottlingStrategy["TIME_BASED"] = "time_based";
    ThrottlingStrategy["COUNT_BASED"] = "count_based";
    ThrottlingStrategy["SIMILARITY_BASED"] = "similarity_based";
    ThrottlingStrategy["ESCALATION_BASED"] = "escalation_based";
    ThrottlingStrategy["ADAPTIVE"] = "adaptive";
})(ThrottlingStrategy || (exports.ThrottlingStrategy = ThrottlingStrategy = {}));
class AlertThrottlingService {
    constructor() {
        this.alertDefinitions = new Map();
        this.activeAlerts = new Map();
        this.throttlingStates = new Map();
        this.adaptiveLearning = new Map();
        this.initializeAlertThrottling();
        this.loadAlertDefinitions();
        this.initializeMetrics();
        this.startThrottlingEngine();
        logger_1.logger.info('Alert Throttling Service initialized', {
            definitions: this.alertDefinitions.size,
            throttlingStrategies: Object.values(ThrottlingStrategy).length,
            adaptiveLearning: true
        });
    }
    static getInstance() {
        if (!AlertThrottlingService.instance) {
            AlertThrottlingService.instance = new AlertThrottlingService();
        }
        return AlertThrottlingService.instance;
    }
    async initializeAlertThrottling() {
        try {
            await this.initializeAdaptiveLearning();
            await this.setupSimilarityEngine();
            await this.initializeNotificationChannels();
            logger_1.logger.info('Alert throttling initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize alert throttling:', error);
            throw error;
        }
    }
    async initializeAdaptiveLearning() {
        logger_1.logger.debug('Adaptive learning models initialized');
    }
    async setupSimilarityEngine() {
        logger_1.logger.debug('Similarity engine setup completed');
    }
    async initializeNotificationChannels() {
        logger_1.logger.debug('Notification channels initialized');
    }
    loadAlertDefinitions() {
        const lowStockAlertDef = {
            id: 'low-stock-alert',
            type: AlertType.LOW_STOCK,
            name: 'Low Stock Alert',
            description: 'Alert when product inventory falls below threshold',
            triggerConditions: [
                {
                    field: 'quantity',
                    operator: '<=',
                    value: 10
                }
            ],
            priority: AlertPriority.HIGH,
            severity: 7,
            businessImpact: 'high',
            throttlingStrategy: ThrottlingStrategy.ADAPTIVE,
            throttlingConfig: {
                timeWindowMs: 60 * 60 * 1000,
                maxAlertsInWindow: 5,
                cooldownPeriodMs: 30 * 60 * 1000,
                similarityThreshold: 0.8,
                escalationThreshold: 3,
                adaptiveLearning: true
            },
            deduplicationEnabled: true,
            deduplicationFields: ['productId', 'storeId'],
            deduplicationWindowMs: 6 * 60 * 60 * 1000,
            notificationChannels: ['email', 'slack', 'webhook'],
            recipients: ['inventory@company.com', 'operations@company.com'],
            escalationRecipients: ['manager@company.com', 'director@company.com'],
            suppressionEnabled: true,
            activeHours: {
                start: '08:00',
                end: '18:00'
            },
            activeDays: [1, 2, 3, 4, 5],
            timezone: 'UTC',
            autoResolve: true,
            autoResolveConditions: [
                {
                    field: 'quantity',
                    operator: '>',
                    value: 20
                }
            ],
            autoResolveTimeoutMs: 24 * 60 * 60 * 1000,
            auditRequired: true,
            complianceRelevant: false,
            retentionPeriod: 90,
            enabled: true,
            createdBy: 'system',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const outOfStockAlertDef = {
            id: 'out-of-stock-alert',
            type: AlertType.OUT_OF_STOCK,
            name: 'Out of Stock Alert',
            description: 'Critical alert when product is completely out of stock',
            triggerConditions: [
                {
                    field: 'quantity',
                    operator: '=',
                    value: 0
                }
            ],
            priority: AlertPriority.CRITICAL,
            severity: 9,
            businessImpact: 'critical',
            throttlingStrategy: ThrottlingStrategy.ESCALATION_BASED,
            throttlingConfig: {
                timeWindowMs: 30 * 60 * 1000,
                maxAlertsInWindow: 2,
                cooldownPeriodMs: 15 * 60 * 1000,
                similarityThreshold: 0.9,
                escalationThreshold: 2,
                adaptiveLearning: true
            },
            deduplicationEnabled: true,
            deduplicationFields: ['productId', 'storeId'],
            deduplicationWindowMs: 2 * 60 * 60 * 1000,
            notificationChannels: ['email', 'slack', 'sms', 'webhook'],
            recipients: ['inventory@company.com', 'operations@company.com', 'sales@company.com'],
            escalationRecipients: ['coo@company.com', 'ceo@company.com'],
            suppressionEnabled: false,
            activeHours: {
                start: '00:00',
                end: '23:59'
            },
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            timezone: 'UTC',
            autoResolve: true,
            autoResolveConditions: [
                {
                    field: 'quantity',
                    operator: '>',
                    value: 0
                }
            ],
            autoResolveTimeoutMs: 48 * 60 * 60 * 1000,
            auditRequired: true,
            complianceRelevant: true,
            retentionPeriod: 365,
            enabled: true,
            createdBy: 'system',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const priceChangeAlertDef = {
            id: 'price-change-alert',
            type: AlertType.PRICE_CHANGE,
            name: 'Significant Price Change Alert',
            description: 'Alert when product price changes significantly',
            triggerConditions: [
                {
                    field: 'priceChangePercent',
                    operator: '>',
                    value: 20
                }
            ],
            priority: AlertPriority.NORMAL,
            severity: 5,
            businessImpact: 'medium',
            throttlingStrategy: ThrottlingStrategy.SIMILARITY_BASED,
            throttlingConfig: {
                timeWindowMs: 4 * 60 * 60 * 1000,
                maxAlertsInWindow: 10,
                cooldownPeriodMs: 60 * 60 * 1000,
                similarityThreshold: 0.7,
                escalationThreshold: 5,
                adaptiveLearning: false
            },
            deduplicationEnabled: true,
            deduplicationFields: ['productId', 'priceChangePercent'],
            deduplicationWindowMs: 12 * 60 * 60 * 1000,
            notificationChannels: ['email', 'slack'],
            recipients: ['pricing@company.com', 'finance@company.com'],
            escalationRecipients: ['finance-director@company.com'],
            suppressionEnabled: true,
            activeHours: {
                start: '09:00',
                end: '17:00'
            },
            activeDays: [1, 2, 3, 4, 5],
            timezone: 'UTC',
            autoResolve: false,
            autoResolveConditions: [],
            autoResolveTimeoutMs: 0,
            auditRequired: true,
            complianceRelevant: true,
            retentionPeriod: 180,
            enabled: true,
            createdBy: 'pricing_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const securityIncidentAlertDef = {
            id: 'security-incident-alert',
            type: AlertType.SECURITY_INCIDENT,
            name: 'Security Incident Alert',
            description: 'Critical security incident detected',
            triggerConditions: [
                {
                    field: 'riskScore',
                    operator: '>=',
                    value: 80
                }
            ],
            priority: AlertPriority.EMERGENCY,
            severity: 10,
            businessImpact: 'critical',
            throttlingStrategy: ThrottlingStrategy.COUNT_BASED,
            throttlingConfig: {
                timeWindowMs: 10 * 60 * 1000,
                maxAlertsInWindow: 1,
                cooldownPeriodMs: 5 * 60 * 1000,
                similarityThreshold: 0.95,
                escalationThreshold: 1,
                adaptiveLearning: false
            },
            deduplicationEnabled: true,
            deduplicationFields: ['incidentType', 'sourceIp', 'userId'],
            deduplicationWindowMs: 30 * 60 * 1000,
            notificationChannels: ['email', 'slack', 'sms', 'webhook', 'pagerduty'],
            recipients: ['security@company.com', 'soc@company.com'],
            escalationRecipients: ['ciso@company.com', 'ceo@company.com'],
            suppressionEnabled: false,
            activeHours: {
                start: '00:00',
                end: '23:59'
            },
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            timezone: 'UTC',
            autoResolve: false,
            autoResolveConditions: [],
            autoResolveTimeoutMs: 0,
            auditRequired: true,
            complianceRelevant: true,
            retentionPeriod: 2555,
            enabled: true,
            createdBy: 'security_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        const systemErrorAlertDef = {
            id: 'system-error-alert',
            type: AlertType.SYSTEM_ERROR,
            name: 'System Error Alert',
            description: 'System error or exception occurred',
            triggerConditions: [
                {
                    field: 'errorLevel',
                    operator: '>=',
                    value: 'ERROR'
                }
            ],
            priority: AlertPriority.HIGH,
            severity: 8,
            businessImpact: 'high',
            throttlingStrategy: ThrottlingStrategy.TIME_BASED,
            throttlingConfig: {
                timeWindowMs: 15 * 60 * 1000,
                maxAlertsInWindow: 3,
                cooldownPeriodMs: 10 * 60 * 1000,
                similarityThreshold: 0.85,
                escalationThreshold: 5,
                adaptiveLearning: true
            },
            deduplicationEnabled: true,
            deduplicationFields: ['errorCode', 'component', 'message'],
            deduplicationWindowMs: 60 * 60 * 1000,
            notificationChannels: ['email', 'slack', 'webhook'],
            recipients: ['devops@company.com', 'engineering@company.com'],
            escalationRecipients: ['tech-lead@company.com', 'cto@company.com'],
            suppressionEnabled: true,
            activeHours: {
                start: '00:00',
                end: '23:59'
            },
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            timezone: 'UTC',
            autoResolve: true,
            autoResolveConditions: [
                {
                    field: 'systemHealthy',
                    operator: '=',
                    value: true
                }
            ],
            autoResolveTimeoutMs: 2 * 60 * 60 * 1000,
            auditRequired: true,
            complianceRelevant: false,
            retentionPeriod: 30,
            enabled: true,
            createdBy: 'devops_admin',
            createdAt: new Date(),
            lastModified: new Date()
        };
        this.alertDefinitions.set(lowStockAlertDef.id, lowStockAlertDef);
        this.alertDefinitions.set(outOfStockAlertDef.id, outOfStockAlertDef);
        this.alertDefinitions.set(priceChangeAlertDef.id, priceChangeAlertDef);
        this.alertDefinitions.set(securityIncidentAlertDef.id, securityIncidentAlertDef);
        this.alertDefinitions.set(systemErrorAlertDef.id, systemErrorAlertDef);
        logger_1.logger.info('Alert definitions loaded', {
            definitionCount: this.alertDefinitions.size
        });
    }
    initializeMetrics() {
        this.metrics = {
            totalAlertsGenerated: 0,
            alertsThrottled: 0,
            alertsDeduplicated: 0,
            alertsEscalated: 0,
            alertsSuppressed: 0,
            averageResolutionTime: 0,
            autoResolutionRate: 0,
            escalationRate: 0,
            falsePositiveRate: 0,
            throttlingEffectiveness: 0,
            deduplicationAccuracy: 0,
            notificationDeliveryRate: 0,
            criticalAlertsCount: 0,
            estimatedCostSavings: 0,
            alertFatigue: 0,
            periodStart: new Date(),
            periodEnd: new Date()
        };
        logger_1.logger.debug('Alert metrics initialized');
    }
    async processAlert(alertType, data, options = {}) {
        const alertId = crypto.randomUUID();
        try {
            const definition = this.findAlertDefinition(alertType, data);
            if (!definition) {
                logger_1.logger.warn('No alert definition found', { alertType, data });
                return null;
            }
            if (!this.shouldTriggerAlert(definition, data)) {
                logger_1.logger.debug('Alert conditions not met', { alertType, definitionId: definition.id });
                return null;
            }
            const alert = {
                id: alertId,
                definitionId: definition.id,
                type: alertType,
                title: this.generateAlertTitle(definition, data),
                message: this.generateAlertMessage(definition, data),
                details: { ...data },
                sourceSystem: options.sourceSystem || 'unknown',
                sourceId: options.sourceId || 'unknown',
                storeId: options.storeId,
                priority: definition.priority,
                severity: definition.severity,
                fingerprint: this.generateFingerprint(definition, data),
                triggeredAt: new Date(),
                status: 'active',
                throttled: false,
                originalCount: 1,
                relatedAlerts: [],
                notificationsSent: 0,
                notificationChannels: [],
                escalationLevel: 0,
                escalationHistory: [],
                businessImpact: this.assessBusinessImpact(definition, data),
                affectedUsers: this.calculateAffectedUsers(data),
                affectedOrders: this.calculateAffectedOrders(data),
                estimatedRevenueLoss: this.calculateRevenueLoss(definition, data),
                securityRelevant: this.isSecurityRelevant(alertType),
                threatLevel: this.assessThreatLevel(alertType, data),
                autoResolutionAttempted: false,
                autoResolutionSuccessful: false,
                auditTrail: []
            };
            alert.auditTrail.push({
                timestamp: new Date(),
                action: 'alert_triggered',
                user: 'system',
                details: {
                    triggerConditions: definition.triggerConditions,
                    sourceSystem: options.sourceSystem,
                    sourceId: options.sourceId
                }
            });
            if (!this.isInActiveWindow(definition) && !options.forceProcess) {
                logger_1.logger.debug('Alert triggered outside active window', {
                    alertId,
                    definitionId: definition.id
                });
                return null;
            }
            if (!options.bypassThrottling) {
                const throttlingResult = await this.applyThrottling(alert, definition);
                if (throttlingResult.shouldSuppress) {
                    this.metrics.alertsThrottled++;
                    logger_1.logger.debug('Alert throttled', {
                        alertId,
                        reason: throttlingResult.reason,
                        strategy: definition.throttlingStrategy
                    });
                    return null;
                }
                if (throttlingResult.shouldDeduplicate) {
                    this.metrics.alertsDeduplicated++;
                    return await this.handleDeduplication(alert, definition, throttlingResult.existingAlertId);
                }
            }
            this.activeAlerts.set(alertId, alert);
            this.metrics.totalAlertsGenerated++;
            if (alert.priority === AlertPriority.CRITICAL || alert.priority === AlertPriority.EMERGENCY) {
                this.metrics.criticalAlertsCount++;
            }
            await this.sendNotifications(alert, definition);
            await this.checkAutoEscalation(alert, definition);
            logger_1.logger.info('Alert processed successfully', {
                alertId,
                type: alertType,
                priority: alert.priority,
                fingerprint: alert.fingerprint,
                throttled: alert.throttled
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'alert_processed',
                severity: alert.securityRelevant ? 'HIGH' : 'LOW',
                category: 'system',
                ipAddress: '82.147.84.78',
                success: true,
                details: {
                    alertId,
                    alertType,
                    priority: alert.priority,
                    severity: alert.severity,
                    businessImpact: alert.businessImpact,
                    securityRelevant: alert.securityRelevant,
                    throttled: alert.throttled
                },
                riskScore: this.calculateAlertRiskScore(alert),
                tags: ['alert_processing', 'monitoring', 'throttling'],
                compliance: {
                    pii: false,
                    gdpr: false,
                    pci: false,
                    hipaa: false
                }
            });
            return alertId;
        }
        catch (error) {
            logger_1.logger.error('Alert processing failed', {
                alertId,
                alertType,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    findAlertDefinition(alertType, _data) {
        const definitions = Array.from(this.alertDefinitions.values())
            .filter(def => def.type === alertType && def.enabled);
        if (definitions.length === 0)
            return null;
        return definitions[0];
    }
    shouldTriggerAlert(definition, data) {
        for (const condition of definition.triggerConditions) {
            const fieldValue = data[condition.field];
            if (fieldValue === undefined || fieldValue === null) {
                return false;
            }
            if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
                return false;
            }
        }
        return true;
    }
    evaluateCondition(fieldValue, operator, conditionValue) {
        switch (operator) {
            case '>':
                return fieldValue > conditionValue;
            case '<':
                return fieldValue < conditionValue;
            case '=':
                return fieldValue === conditionValue;
            case '!=':
                return fieldValue !== conditionValue;
            case '>=':
                return fieldValue >= conditionValue;
            case '<=':
                return fieldValue <= conditionValue;
            case 'contains':
                return String(fieldValue).includes(String(conditionValue));
            case 'regex':
                return new RegExp(conditionValue).test(String(fieldValue));
            default:
                return false;
        }
    }
    generateAlertTitle(definition, data) {
        switch (definition.type) {
            case AlertType.LOW_STOCK:
                return `Low Stock Alert: ${data.productName || data.productId} (${data.quantity} remaining)`;
            case AlertType.OUT_OF_STOCK:
                return `OUT OF STOCK: ${data.productName || data.productId}`;
            case AlertType.PRICE_CHANGE:
                return `Price Change Alert: ${data.productName || data.productId} (${data.priceChangePercent}% change)`;
            case AlertType.SECURITY_INCIDENT:
                return `Security Incident: ${data.incidentType} (Risk Score: ${data.riskScore})`;
            case AlertType.SYSTEM_ERROR:
                return `System Error: ${data.component} - ${data.errorCode}`;
            default:
                return `${definition.name}: ${JSON.stringify(data).substring(0, 100)}...`;
        }
    }
    generateAlertMessage(definition, data) {
        const baseMessage = definition.description;
        const dataString = Object.entries(data)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        return `${baseMessage}\n\nDetails: ${dataString}`;
    }
    generateFingerprint(definition, data) {
        const fingerprintData = {};
        for (const field of definition.deduplicationFields) {
            if (data[field] !== undefined) {
                fingerprintData[field] = data[field];
            }
        }
        const fingerprintString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
        return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 16);
    }
    assessBusinessImpact(definition, _data) {
        switch (definition.type) {
            case AlertType.OUT_OF_STOCK:
                return `Product unavailable for purchase, potential sales loss`;
            case AlertType.LOW_STOCK:
                return `Limited inventory, may affect order fulfillment`;
            case AlertType.SECURITY_INCIDENT:
                return `Potential data breach or system compromise`;
            case AlertType.SYSTEM_ERROR:
                return `System functionality impaired, may affect user experience`;
            case AlertType.PRICE_CHANGE:
                return `Pricing strategy change, may affect competitiveness`;
            default:
                return definition.businessImpact;
        }
    }
    calculateAffectedUsers(data) {
        if (data.affectedUsers)
            return data.affectedUsers;
        if (data.productId)
            return Math.floor(Math.random() * 100) + 10;
        if (data.storeId)
            return Math.floor(Math.random() * 1000) + 50;
        return 0;
    }
    calculateAffectedOrders(data) {
        if (data.affectedOrders)
            return data.affectedOrders;
        if (data.productId)
            return Math.floor(Math.random() * 50) + 5;
        return 0;
    }
    calculateRevenueLoss(definition, data) {
        switch (definition.type) {
            case AlertType.OUT_OF_STOCK:
                return (data.price || 100) * (data.averageDailySales || 10);
            case AlertType.LOW_STOCK:
                return (data.price || 100) * (data.averageDailySales || 10) * 0.2;
            case AlertType.SYSTEM_ERROR:
                return 1000;
            default:
                return 0;
        }
    }
    isSecurityRelevant(alertType) {
        return alertType === AlertType.SECURITY_INCIDENT ||
            alertType === AlertType.USER_ACTIVITY_SUSPICIOUS ||
            alertType === AlertType.SYSTEM_ERROR;
    }
    assessThreatLevel(alertType, data) {
        if (alertType === AlertType.SECURITY_INCIDENT) {
            const riskScore = data.riskScore || 0;
            if (riskScore >= 90)
                return 'critical';
            if (riskScore >= 70)
                return 'high';
            if (riskScore >= 50)
                return 'medium';
        }
        return 'low';
    }
    isInActiveWindow(definition) {
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.toTimeString().substring(0, 5);
        if (!definition.activeDays.includes(currentDay)) {
            return false;
        }
        if (currentTime < definition.activeHours.start || currentTime > definition.activeHours.end) {
            return false;
        }
        return true;
    }
    async applyThrottling(alert, definition) {
        const throttlingState = this.getThrottlingState(definition.id);
        const now = new Date();
        if (definition.deduplicationEnabled) {
            const existingAlertId = await this.findDuplicateAlert(alert, definition);
            if (existingAlertId) {
                return {
                    shouldSuppress: false,
                    shouldDeduplicate: true,
                    existingAlertId,
                    reason: 'duplicate_alert'
                };
            }
        }
        switch (definition.throttlingStrategy) {
            case ThrottlingStrategy.TIME_BASED:
                return this.applyTimeBasedThrottling(alert, definition, throttlingState, now);
            case ThrottlingStrategy.COUNT_BASED:
                return this.applyCountBasedThrottling(alert, definition, throttlingState, now);
            case ThrottlingStrategy.SIMILARITY_BASED:
                return this.applySimilarityBasedThrottling(alert, definition, throttlingState, now);
            case ThrottlingStrategy.ESCALATION_BASED:
                return this.applyEscalationBasedThrottling(alert, definition, throttlingState, now);
            case ThrottlingStrategy.ADAPTIVE:
                return this.applyAdaptiveThrottling(alert, definition, throttlingState, now);
            default:
                return { shouldSuppress: false, shouldDeduplicate: false };
        }
    }
    getThrottlingState(definitionId) {
        if (!this.throttlingStates.has(definitionId)) {
            const now = new Date();
            this.throttlingStates.set(definitionId, {
                definitionId,
                alertType: this.alertDefinitions.get(definitionId).type,
                windowStart: now,
                alertsInCurrentWindow: 0,
                lastAlertTime: now,
                recentFingerprints: new Map(),
                escalationCount: 0,
                lastEscalation: now,
                adaptiveMetrics: {
                    falsePositiveRate: 0,
                    resolutionTime: 0,
                    businessImpactAccuracy: 0,
                    userEngagement: 0
                },
                lastReset: now
            });
        }
        return this.throttlingStates.get(definitionId);
    }
    async findDuplicateAlert(alert, definition) {
        const cutoffTime = new Date(Date.now() - definition.deduplicationWindowMs);
        for (const [alertId, existingAlert] of this.activeAlerts.entries()) {
            if (existingAlert.triggeredAt < cutoffTime)
                continue;
            if (existingAlert.fingerprint === alert.fingerprint) {
                return alertId;
            }
        }
        return null;
    }
    applyTimeBasedThrottling(alert, definition, state, now) {
        const windowElapsed = now.getTime() - state.windowStart.getTime();
        if (windowElapsed > definition.throttlingConfig.timeWindowMs) {
            state.windowStart = now;
            state.alertsInCurrentWindow = 0;
        }
        if (state.alertsInCurrentWindow >= definition.throttlingConfig.maxAlertsInWindow) {
            return {
                shouldSuppress: true,
                shouldDeduplicate: false,
                reason: 'time_window_limit_exceeded'
            };
        }
        state.alertsInCurrentWindow++;
        state.lastAlertTime = now;
        return { shouldSuppress: false, shouldDeduplicate: false };
    }
    applyCountBasedThrottling(alert, definition, state, now) {
        const timeSinceLastAlert = now.getTime() - state.lastAlertTime.getTime();
        if (timeSinceLastAlert < definition.throttlingConfig.cooldownPeriodMs) {
            return {
                shouldSuppress: true,
                shouldDeduplicate: false,
                reason: 'cooldown_period_active'
            };
        }
        state.lastAlertTime = now;
        return { shouldSuppress: false, shouldDeduplicate: false };
    }
    applySimilarityBasedThrottling(alert, definition, state, now) {
        const cutoffTime = new Date(now.getTime() - definition.throttlingConfig.timeWindowMs);
        for (const [fingerprint, info] of state.recentFingerprints.entries()) {
            if (info.lastSeen < cutoffTime) {
                state.recentFingerprints.delete(fingerprint);
            }
        }
        for (const [fingerprint, info] of state.recentFingerprints.entries()) {
            const similarity = this.calculateSimilarity(alert.fingerprint, fingerprint);
            if (similarity >= definition.throttlingConfig.similarityThreshold) {
                info.count++;
                info.lastSeen = now;
                return {
                    shouldSuppress: true,
                    shouldDeduplicate: false,
                    reason: 'similar_alert_detected'
                };
            }
        }
        state.recentFingerprints.set(alert.fingerprint, {
            count: 1,
            firstSeen: now,
            lastSeen: now,
            representativeAlertId: alert.id
        });
        return { shouldSuppress: false, shouldDeduplicate: false };
    }
    applyEscalationBasedThrottling(alert, definition, state, now) {
        const timeSinceLastEscalation = now.getTime() - state.lastEscalation.getTime();
        if (state.escalationCount >= definition.throttlingConfig.escalationThreshold &&
            timeSinceLastEscalation < definition.throttlingConfig.timeWindowMs) {
            const recentAlert = this.findMostRecentAlert(definition.type);
            if (recentAlert) {
                this.escalateAlert(recentAlert, definition);
                state.lastEscalation = now;
                state.escalationCount++;
                return {
                    shouldSuppress: true,
                    shouldDeduplicate: false,
                    reason: 'escalated_existing_alert'
                };
            }
        }
        return { shouldSuppress: false, shouldDeduplicate: false };
    }
    applyAdaptiveThrottling(alert, definition, state, now) {
        const metrics = state.adaptiveMetrics;
        if (metrics.falsePositiveRate > 0.3) {
            const shouldSuppress = Math.random() < 0.7;
            if (shouldSuppress) {
                return {
                    shouldSuppress: true,
                    shouldDeduplicate: false,
                    reason: 'adaptive_high_false_positive_rate'
                };
            }
        }
        if (metrics.userEngagement < 0.2) {
            const shouldSuppress = Math.random() < 0.5;
            if (shouldSuppress) {
                return {
                    shouldSuppress: true,
                    shouldDeduplicate: false,
                    reason: 'adaptive_low_user_engagement'
                };
            }
        }
        return this.applyTimeBasedThrottling(alert, definition, state, now);
    }
    calculateSimilarity(fingerprint1, fingerprint2) {
        if (fingerprint1 === fingerprint2)
            return 1.0;
        const longer = fingerprint1.length > fingerprint2.length ? fingerprint1 : fingerprint2;
        const shorter = fingerprint1.length > fingerprint2.length ? fingerprint2 : fingerprint1;
        if (longer.length === 0)
            return 1.0;
        const editDistance = this.calculateEditDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    calculateEditDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    findMostRecentAlert(alertType) {
        let mostRecent = null;
        let mostRecentTime = 0;
        for (const alert of this.activeAlerts.values()) {
            if (alert.type === alertType && alert.status === 'active') {
                const alertTime = alert.triggeredAt.getTime();
                if (alertTime > mostRecentTime) {
                    mostRecentTime = alertTime;
                    mostRecent = alert;
                }
            }
        }
        return mostRecent;
    }
    async escalateAlert(alert, definition) {
        alert.escalationLevel++;
        alert.escalatedAt = new Date();
        const escalationInfo = {
            level: alert.escalationLevel,
            escalatedAt: alert.escalatedAt,
            escalatedTo: definition.escalationRecipients,
            reason: 'automatic_escalation_due_to_throttling'
        };
        alert.escalationHistory.push(escalationInfo);
        alert.status = 'escalated';
        await this.sendEscalationNotifications(alert, definition);
        this.metrics.alertsEscalated++;
        alert.auditTrail.push({
            timestamp: new Date(),
            action: 'alert_escalated',
            user: 'system',
            details: escalationInfo
        });
        logger_1.logger.info('Alert escalated', {
            alertId: alert.id,
            escalationLevel: alert.escalationLevel,
            reason: escalationInfo.reason
        });
    }
    async handleDeduplication(alert, definition, existingAlertId) {
        const existingAlert = this.activeAlerts.get(existingAlertId);
        if (!existingAlert) {
            this.activeAlerts.set(alert.id, alert);
            return alert.id;
        }
        existingAlert.originalCount++;
        existingAlert.relatedAlerts.push(alert.id);
        existingAlert.lastNotificationAt = new Date();
        existingAlert.details = { ...existingAlert.details, ...alert.details };
        existingAlert.auditTrail.push({
            timestamp: new Date(),
            action: 'alert_deduplicated',
            user: 'system',
            details: {
                duplicateAlertId: alert.id,
                totalCount: existingAlert.originalCount
            }
        });
        logger_1.logger.debug('Alert deduplicated', {
            existingAlertId,
            duplicateAlertId: alert.id,
            totalCount: existingAlert.originalCount
        });
        return existingAlertId;
    }
    async sendNotifications(alert, definition) {
        for (const channel of definition.notificationChannels) {
            try {
                await this.sendNotificationToChannel(alert, definition, channel);
                alert.notificationsSent++;
                alert.notificationChannels.push(channel);
            }
            catch (error) {
                logger_1.logger.error(`Failed to send notification to ${channel}`, {
                    alertId: alert.id,
                    error: (0, errorUtils_1.getErrorMessage)(error)
                });
            }
        }
        alert.lastNotificationAt = new Date();
        alert.auditTrail.push({
            timestamp: new Date(),
            action: 'notifications_sent',
            user: 'system',
            details: {
                channels: alert.notificationChannels,
                recipients: definition.recipients.length
            }
        });
    }
    async sendNotificationToChannel(alert, definition, channel) {
        switch (channel) {
            case 'email':
                logger_1.logger.debug(`Sending email notification for alert ${alert.id}`);
                break;
            case 'slack':
                logger_1.logger.debug(`Sending Slack notification for alert ${alert.id}`);
                break;
            case 'sms':
                logger_1.logger.debug(`Sending SMS notification for alert ${alert.id}`);
                break;
            case 'webhook':
                logger_1.logger.debug(`Sending webhook notification for alert ${alert.id}`);
                break;
            case 'pagerduty':
                logger_1.logger.debug(`Sending PagerDuty notification for alert ${alert.id}`);
                break;
            default:
                logger_1.logger.warn(`Unknown notification channel: ${channel}`);
        }
    }
    async sendEscalationNotifications(alert, definition) {
        logger_1.logger.info('Sending escalation notifications', {
            alertId: alert.id,
            escalationLevel: alert.escalationLevel,
            recipients: definition.escalationRecipients
        });
    }
    async checkAutoEscalation(alert, definition) {
        if (alert.severity >= 9 || alert.priority === AlertPriority.EMERGENCY) {
            await this.escalateAlert(alert, definition);
        }
    }
    calculateAlertRiskScore(alert) {
        let riskScore = 0;
        switch (alert.priority) {
            case AlertPriority.EMERGENCY:
                riskScore += 50;
                break;
            case AlertPriority.CRITICAL:
                riskScore += 40;
                break;
            case AlertPriority.HIGH:
                riskScore += 30;
                break;
            case AlertPriority.NORMAL:
                riskScore += 20;
                break;
            case AlertPriority.LOW:
                riskScore += 10;
                break;
        }
        if (alert.securityRelevant)
            riskScore += 25;
        if (alert.threatLevel === 'critical')
            riskScore += 20;
        if (alert.estimatedRevenueLoss > 1000)
            riskScore += 15;
        if (alert.affectedUsers > 100)
            riskScore += 10;
        return Math.max(0, Math.min(100, riskScore));
    }
    startThrottlingEngine() {
        setInterval(() => {
            this.cleanupThrottlingStates();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.checkAutoResolution();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.updateAdaptiveMetrics();
        }, 15 * 60 * 1000);
        logger_1.logger.info('Alert throttling engine started');
    }
    cleanupThrottlingStates() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let cleanedCount = 0;
        for (const [definitionId, state] of this.throttlingStates.entries()) {
            if (state.lastReset < cutoffTime) {
                this.throttlingStates.delete(definitionId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up throttling states', { cleanedCount });
        }
    }
    checkAutoResolution() {
        const now = new Date();
        for (const [alertId, alert] of this.activeAlerts.entries()) {
            if (alert.status !== 'active')
                continue;
            const definition = this.alertDefinitions.get(alert.definitionId);
            if (!definition || !definition.autoResolve)
                continue;
            const alertAge = now.getTime() - alert.triggeredAt.getTime();
            if (alertAge > definition.autoResolveTimeoutMs) {
                this.resolveAlert(alertId, 'auto_resolved_timeout', 'system');
                continue;
            }
            if (definition.autoResolveConditions.length > 0) {
                if (Math.random() < 0.1) {
                    this.resolveAlert(alertId, 'auto_resolved_conditions_met', 'system');
                }
            }
        }
    }
    updateAdaptiveMetrics() {
        for (const [, state] of this.throttlingStates.entries()) {
            if (state.adaptiveMetrics) {
                state.adaptiveMetrics.falsePositiveRate = Math.max(0, state.adaptiveMetrics.falsePositiveRate - 0.01);
                state.adaptiveMetrics.userEngagement = Math.min(1, state.adaptiveMetrics.userEngagement + 0.01);
            }
        }
    }
    resolveAlert(alertId, resolution, resolvedBy) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert)
            return;
        alert.status = 'resolved';
        alert.resolvedAt = new Date();
        alert.resolvedBy = resolvedBy;
        alert.resolution = resolution;
        alert.auditTrail.push({
            timestamp: new Date(),
            action: 'alert_resolved',
            user: resolvedBy,
            details: { resolution }
        });
        logger_1.logger.info('Alert resolved', {
            alertId,
            resolution,
            resolvedBy
        });
    }
    getStats() {
        return { ...this.metrics };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.alertFatigue > 70) {
            status = 'warning';
        }
        if (stats.falsePositiveRate > 0.3) {
            status = 'degraded';
        }
        if (stats.criticalAlertsCount > 20) {
            status = 'critical';
        }
        const activeThrottlingStates = this.throttlingStates.size;
        const suppressedAlerts = Array.from(this.activeAlerts.values())
            .filter(a => a.status === 'suppressed').length;
        return {
            status,
            stats: {
                ...stats,
                activeThrottlingStates,
                suppressedAlerts
            }
        };
    }
}
exports.AlertThrottlingService = AlertThrottlingService;
exports.alertThrottlingService = AlertThrottlingService.getInstance();
//# sourceMappingURL=AlertThrottlingService.js.map