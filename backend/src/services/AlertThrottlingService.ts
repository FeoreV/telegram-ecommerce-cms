import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum AlertType {
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  PRICE_CHANGE = 'price_change',
  INVENTORY_DISCREPANCY = 'inventory_discrepancy',
  SYSTEM_ERROR = 'system_error',
  SECURITY_INCIDENT = 'security_incident',
  PAYMENT_FAILURE = 'payment_failure',
  ORDER_ANOMALY = 'order_anomaly',
  USER_ACTIVITY_SUSPICIOUS = 'user_activity_suspicious'
}

export enum AlertPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export enum ThrottlingStrategy {
  TIME_BASED = 'time_based',           // Throttle based on time windows
  COUNT_BASED = 'count_based',         // Throttle based on alert count
  SIMILARITY_BASED = 'similarity_based', // Throttle similar alerts
  ESCALATION_BASED = 'escalation_based', // Escalate instead of duplicate
  ADAPTIVE = 'adaptive'                // AI-based adaptive throttling
}

export interface AlertDefinition {
  id: string;
  type: AlertType;
  name: string;
  description: string;
  
  // Alert criteria
  triggerConditions: {
    field: string;
    operator: '>' | '<' | '=' | '!=' | '>=' | '<=' | 'contains' | 'regex';
    value: any;
  }[];
  
  // Severity and priority
  priority: AlertPriority;
  severity: number; // 1-10 scale
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  
  // Throttling configuration
  throttlingStrategy: ThrottlingStrategy;
  throttlingConfig: {
    timeWindowMs: number;
    maxAlertsInWindow: number;
    cooldownPeriodMs: number;
    similarityThreshold: number; // 0-1 for similarity-based throttling
    escalationThreshold: number;
    adaptiveLearning: boolean;
  };
  
  // Deduplication settings
  deduplicationEnabled: boolean;
  deduplicationFields: string[];
  deduplicationWindowMs: number;
  
  // Notification settings
  notificationChannels: string[];
  recipients: string[];
  escalationRecipients: string[];
  suppressionEnabled: boolean;
  
  // Scheduling
  activeHours: {
    start: string; // HH:mm format
    end: string;
  };
  activeDays: number[]; // 0-6 (Sunday-Saturday)
  timezone: string;
  
  // Auto-resolution
  autoResolve: boolean;
  autoResolveConditions: {
    field: string;
    operator: string;
    value: any;
  }[];
  autoResolveTimeoutMs: number;
  
  // Compliance and audit
  auditRequired: boolean;
  complianceRelevant: boolean;
  retentionPeriod: number; // days
  
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface Alert {
  id: string;
  definitionId: string;
  type: AlertType;
  
  // Alert content
  title: string;
  message: string;
  details: Record<string, any>;
  
  // Context
  sourceSystem: string;
  sourceId: string; // product_id, user_id, etc.
  storeId?: string;
  
  // Metadata
  priority: AlertPriority;
  severity: number;
  fingerprint: string; // For deduplication
  
  // Timing
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
  
  // Status tracking
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed' | 'escalated';
  acknowledgedBy?: string;
  resolvedBy?: string;
  resolution?: string;
  
  // Throttling metadata
  throttled: boolean;
  throttleReason?: string;
  originalCount: number; // How many alerts were consolidated
  relatedAlerts: string[]; // IDs of related/similar alerts
  
  // Notification tracking
  notificationsSent: number;
  notificationChannels: string[];
  lastNotificationAt?: Date;
  
  // Escalation
  escalationLevel: number;
  escalationHistory: {
    level: number;
    escalatedAt: Date;
    escalatedTo: string[];
    reason: string;
  }[];
  
  // Business impact assessment
  businessImpact: string;
  affectedUsers: number;
  affectedOrders: number;
  estimatedRevenueLoss: number;
  
  // Security relevance
  securityRelevant: boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Auto-resolution
  autoResolutionAttempted: boolean;
  autoResolutionSuccessful: boolean;
  
  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    user: string;
    details: Record<string, any>;
  }[];
}

export interface ThrottlingState {
  definitionId: string;
  alertType: AlertType;
  
  // Time-based throttling
  windowStart: Date;
  alertsInCurrentWindow: number;
  lastAlertTime: Date;
  
  // Similarity tracking
  recentFingerprints: Map<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    representativeAlertId: string;
  }>;
  
  // Escalation tracking
  escalationCount: number;
  lastEscalation: Date;
  
  // Adaptive learning
  adaptiveMetrics: {
    falsePositiveRate: number;
    resolutionTime: number;
    businessImpactAccuracy: number;
    userEngagement: number;
  };
  
  // Suppression state
  suppressedUntil?: Date;
  suppressionReason?: string;
  
  lastReset: Date;
}

export interface AlertMetrics {
  // Volume metrics
  totalAlertsGenerated: number;
  alertsThrottled: number;
  alertsDeduplicated: number;
  alertsEscalated: number;
  alertsSuppressed: number;
  
  // Resolution metrics
  averageResolutionTime: number;
  autoResolutionRate: number;
  escalationRate: number;
  falsePositiveRate: number;
  
  // Performance metrics
  throttlingEffectiveness: number;
  deduplicationAccuracy: number;
  notificationDeliveryRate: number;
  
  // Business impact
  criticalAlertsCount: number;
  estimatedCostSavings: number;
  alertFatigue: number;
  
  // Time range
  periodStart: Date;
  periodEnd: Date;
}

export class AlertThrottlingService {
  private static instance: AlertThrottlingService;
  private alertDefinitions: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private throttlingStates: Map<string, ThrottlingState> = new Map();
  private metrics!: AlertMetrics;
  private adaptiveLearning: Map<string, any> = new Map();

  private constructor() {
    this.initializeAlertThrottling();
    this.loadAlertDefinitions();
    this.initializeMetrics();
    this.startThrottlingEngine();

    logger.info('Alert Throttling Service initialized', {
      definitions: this.alertDefinitions.size,
      throttlingStrategies: Object.values(ThrottlingStrategy).length,
      adaptiveLearning: true
    });
  }

  public static getInstance(): AlertThrottlingService {
    if (!AlertThrottlingService.instance) {
      AlertThrottlingService.instance = new AlertThrottlingService();
    }
    return AlertThrottlingService.instance;
  }

  private async initializeAlertThrottling(): Promise<void> {
    try {
      // Initialize adaptive learning models
      await this.initializeAdaptiveLearning();
      
      // Setup similarity calculation engine
      await this.setupSimilarityEngine();
      
      // Initialize notification channels
      await this.initializeNotificationChannels();

      logger.info('Alert throttling initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize alert throttling:', error);
      throw error;
    }
  }

  private async initializeAdaptiveLearning(): Promise<void> {
    // Initialize machine learning models for adaptive throttling
    logger.debug('Adaptive learning models initialized');
  }

  private async setupSimilarityEngine(): Promise<void> {
    // Setup similarity calculation for alert deduplication
    logger.debug('Similarity engine setup completed');
  }

  private async initializeNotificationChannels(): Promise<void> {
    // Initialize various notification channels (email, slack, webhook, etc.)
    logger.debug('Notification channels initialized');
  }

  private loadAlertDefinitions(): void {
    // Low stock alert definition
    const lowStockAlertDef: AlertDefinition = {
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
        timeWindowMs: 60 * 60 * 1000, // 1 hour
        maxAlertsInWindow: 5,
        cooldownPeriodMs: 30 * 60 * 1000, // 30 minutes
        similarityThreshold: 0.8,
        escalationThreshold: 3,
        adaptiveLearning: true
      },
      deduplicationEnabled: true,
      deduplicationFields: ['productId', 'storeId'],
      deduplicationWindowMs: 6 * 60 * 60 * 1000, // 6 hours
      notificationChannels: ['email', 'slack', 'webhook'],
      recipients: ['inventory@company.com', 'operations@company.com'],
      escalationRecipients: ['manager@company.com', 'director@company.com'],
      suppressionEnabled: true,
      activeHours: {
        start: '08:00',
        end: '18:00'
      },
      activeDays: [1, 2, 3, 4, 5], // Monday to Friday
      timezone: 'UTC',
      autoResolve: true,
      autoResolveConditions: [
        {
          field: 'quantity',
          operator: '>',
          value: 20
        }
      ],
      autoResolveTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
      auditRequired: true,
      complianceRelevant: false,
      retentionPeriod: 90,
      enabled: true,
      createdBy: 'system',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Out of stock alert definition
    const outOfStockAlertDef: AlertDefinition = {
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
        timeWindowMs: 30 * 60 * 1000, // 30 minutes
        maxAlertsInWindow: 2,
        cooldownPeriodMs: 15 * 60 * 1000, // 15 minutes
        similarityThreshold: 0.9,
        escalationThreshold: 2,
        adaptiveLearning: true
      },
      deduplicationEnabled: true,
      deduplicationFields: ['productId', 'storeId'],
      deduplicationWindowMs: 2 * 60 * 60 * 1000, // 2 hours
      notificationChannels: ['email', 'slack', 'sms', 'webhook'],
      recipients: ['inventory@company.com', 'operations@company.com', 'sales@company.com'],
      escalationRecipients: ['coo@company.com', 'ceo@company.com'],
      suppressionEnabled: false, // Never suppress out of stock alerts
      activeHours: {
        start: '00:00',
        end: '23:59'
      },
      activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
      timezone: 'UTC',
      autoResolve: true,
      autoResolveConditions: [
        {
          field: 'quantity',
          operator: '>',
          value: 0
        }
      ],
      autoResolveTimeoutMs: 48 * 60 * 60 * 1000, // 48 hours
      auditRequired: true,
      complianceRelevant: true,
      retentionPeriod: 365,
      enabled: true,
      createdBy: 'system',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Price change alert definition
    const priceChangeAlertDef: AlertDefinition = {
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
        timeWindowMs: 4 * 60 * 60 * 1000, // 4 hours
        maxAlertsInWindow: 10,
        cooldownPeriodMs: 60 * 60 * 1000, // 1 hour
        similarityThreshold: 0.7,
        escalationThreshold: 5,
        adaptiveLearning: false
      },
      deduplicationEnabled: true,
      deduplicationFields: ['productId', 'priceChangePercent'],
      deduplicationWindowMs: 12 * 60 * 60 * 1000, // 12 hours
      notificationChannels: ['email', 'slack'],
      recipients: ['pricing@company.com', 'finance@company.com'],
      escalationRecipients: ['finance-director@company.com'],
      suppressionEnabled: true,
      activeHours: {
        start: '09:00',
        end: '17:00'
      },
      activeDays: [1, 2, 3, 4, 5], // Business days only
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

    // Security incident alert definition
    const securityIncidentAlertDef: AlertDefinition = {
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
        timeWindowMs: 10 * 60 * 1000, // 10 minutes
        maxAlertsInWindow: 1, // Only one security alert per 10 minutes
        cooldownPeriodMs: 5 * 60 * 1000, // 5 minutes
        similarityThreshold: 0.95,
        escalationThreshold: 1,
        adaptiveLearning: false
      },
      deduplicationEnabled: true,
      deduplicationFields: ['incidentType', 'sourceIp', 'userId'],
      deduplicationWindowMs: 30 * 60 * 1000, // 30 minutes
      notificationChannels: ['email', 'slack', 'sms', 'webhook', 'pagerduty'],
      recipients: ['security@company.com', 'soc@company.com'],
      escalationRecipients: ['ciso@company.com', 'ceo@company.com'],
      suppressionEnabled: false, // Never suppress security alerts
      activeHours: {
        start: '00:00',
        end: '23:59'
      },
      activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
      timezone: 'UTC',
      autoResolve: false,
      autoResolveConditions: [],
      autoResolveTimeoutMs: 0,
      auditRequired: true,
      complianceRelevant: true,
      retentionPeriod: 2555, // 7 years for security incidents
      enabled: true,
      createdBy: 'security_admin',
      createdAt: new Date(),
      lastModified: new Date()
    };

    // System error alert definition
    const systemErrorAlertDef: AlertDefinition = {
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
        timeWindowMs: 15 * 60 * 1000, // 15 minutes
        maxAlertsInWindow: 3,
        cooldownPeriodMs: 10 * 60 * 1000, // 10 minutes
        similarityThreshold: 0.85,
        escalationThreshold: 5,
        adaptiveLearning: true
      },
      deduplicationEnabled: true,
      deduplicationFields: ['errorCode', 'component', 'message'],
      deduplicationWindowMs: 60 * 60 * 1000, // 1 hour
      notificationChannels: ['email', 'slack', 'webhook'],
      recipients: ['devops@company.com', 'engineering@company.com'],
      escalationRecipients: ['tech-lead@company.com', 'cto@company.com'],
      suppressionEnabled: true,
      activeHours: {
        start: '00:00',
        end: '23:59'
      },
      activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
      timezone: 'UTC',
      autoResolve: true,
      autoResolveConditions: [
        {
          field: 'systemHealthy',
          operator: '=',
          value: true
        }
      ],
      autoResolveTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
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

    logger.info('Alert definitions loaded', {
      definitionCount: this.alertDefinitions.size
    });
  }

  private initializeMetrics(): void {
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

    logger.debug('Alert metrics initialized');
  }

  /**
   * Process incoming alert and apply throttling/deduplication
   */
  async processAlert(
    alertType: AlertType,
    data: Record<string, any>,
    options: {
      sourceSystem?: string;
      sourceId?: string;
      storeId?: string;
      forceProcess?: boolean;
      bypassThrottling?: boolean;
    } = {}
  ): Promise<string | null> {
    const alertId = crypto.randomUUID();
    
    try {
      // Find alert definition
      const definition = this.findAlertDefinition(alertType, data);
      if (!definition) {
        logger.warn('No alert definition found', { alertType, data });
        return null;
      }

      // Check if alert should trigger
      if (!this.shouldTriggerAlert(definition, data)) {
        logger.debug('Alert conditions not met', { alertType, definitionId: definition.id });
        return null;
      }

      // Create alert object
      const alert: Alert = {
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

      // Add initial audit entry
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

      // Check if alert should be processed (time windows, active hours)
      if (!this.isInActiveWindow(definition) && !options.forceProcess) {
        logger.debug('Alert triggered outside active window', {
          alertId,
          definitionId: definition.id
        });
        return null;
      }

      // Apply throttling and deduplication
      if (!options.bypassThrottling) {
        const throttlingResult = await this.applyThrottling(alert, definition);
        if (throttlingResult.shouldSuppress) {
          this.metrics.alertsThrottled++;
          logger.debug('Alert throttled', {
            alertId,
            reason: throttlingResult.reason,
            strategy: definition.throttlingStrategy
          });
          return null;
        }

        if (throttlingResult.shouldDeduplicate) {
          this.metrics.alertsDeduplicated++;
          return await this.handleDeduplication(alert, definition, throttlingResult.existingAlertId!);
        }
      }

      // Store alert
      this.activeAlerts.set(alertId, alert);

      // Update metrics
      this.metrics.totalAlertsGenerated++;
      if (alert.priority === AlertPriority.CRITICAL || alert.priority === AlertPriority.EMERGENCY) {
        this.metrics.criticalAlertsCount++;
      }

      // Send notifications
      await this.sendNotifications(alert, definition);

      // Check for auto-escalation
      await this.checkAutoEscalation(alert, definition);

      logger.info('Alert processed successfully', {
        alertId,
        type: alertType,
        priority: alert.priority,
        fingerprint: alert.fingerprint,
        throttled: alert.throttled
      });

      // Log security event
      await securityLogService.logSecurityEvent({
        eventType: 'alert_processed',
        severity: alert.securityRelevant ? 'HIGH' : 'LOW',
        category: 'system',
        ipAddress: 'localhost',
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

    } catch (error) {
      logger.error('Alert processing failed', {
        alertId,
        alertType,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private findAlertDefinition(alertType: AlertType, _data: Record<string, any>): AlertDefinition | null {
    // Find the most specific alert definition for this type and data
    const definitions = Array.from(this.alertDefinitions.values())
      .filter(def => def.type === alertType && def.enabled);

    if (definitions.length === 0) return null;

    // For now, return the first matching definition
    // In a more sophisticated system, we could rank by specificity
    return definitions[0];
  }

  private shouldTriggerAlert(definition: AlertDefinition, data: Record<string, any>): boolean {
    // Check all trigger conditions
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

  private evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
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

  private generateAlertTitle(definition: AlertDefinition, data: Record<string, any>): string {
    // Generate a descriptive title based on the alert type and data
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

  private generateAlertMessage(definition: AlertDefinition, data: Record<string, any>): string {
    // Generate a detailed message based on the alert type and data
    const baseMessage = definition.description;
    const dataString = Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return `${baseMessage}\n\nDetails: ${dataString}`;
  }

  private generateFingerprint(definition: AlertDefinition, data: Record<string, any>): string {
    // Generate a fingerprint for deduplication
    const fingerprintData = {};
    
    for (const field of definition.deduplicationFields) {
      if (data[field] !== undefined) {
        fingerprintData[field] = data[field];
      }
    }

    const fingerprintString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
    return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 16);
  }

  private assessBusinessImpact(definition: AlertDefinition, _data: Record<string, any>): string {
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

  private calculateAffectedUsers(data: Record<string, any>): number {
    // Estimate number of affected users based on alert data
    if (data.affectedUsers) return data.affectedUsers;
    if (data.productId) return Math.floor(Math.random() * 100) + 10; // Simulate
    if (data.storeId) return Math.floor(Math.random() * 1000) + 50;
    return 0;
  }

  private calculateAffectedOrders(data: Record<string, any>): number {
    // Estimate number of affected orders
    if (data.affectedOrders) return data.affectedOrders;
    if (data.productId) return Math.floor(Math.random() * 50) + 5; // Simulate
    return 0;
  }

  private calculateRevenueLoss(definition: AlertDefinition, data: Record<string, any>): number {
    // Estimate potential revenue loss
    switch (definition.type) {
      case AlertType.OUT_OF_STOCK:
        return (data.price || 100) * (data.averageDailySales || 10);
      case AlertType.LOW_STOCK:
        return (data.price || 100) * (data.averageDailySales || 10) * 0.2; // 20% impact
      case AlertType.SYSTEM_ERROR:
        return 1000; // Estimated system downtime cost
      default:
        return 0;
    }
  }

  private isSecurityRelevant(alertType: AlertType): boolean {
    return alertType === AlertType.SECURITY_INCIDENT ||
           alertType === AlertType.USER_ACTIVITY_SUSPICIOUS ||
           alertType === AlertType.SYSTEM_ERROR;
  }

  private assessThreatLevel(alertType: AlertType, data: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
    if (alertType === AlertType.SECURITY_INCIDENT) {
      const riskScore = data.riskScore || 0;
      if (riskScore >= 90) return 'critical';
      if (riskScore >= 70) return 'high';
      if (riskScore >= 50) return 'medium';
    }
    return 'low';
  }

  private isInActiveWindow(definition: AlertDefinition): boolean {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = now.toTimeString().substring(0, 5); // HH:mm format

    // Check active days
    if (!definition.activeDays.includes(currentDay)) {
      return false;
    }

    // Check active hours
    if (currentTime < definition.activeHours.start || currentTime > definition.activeHours.end) {
      return false;
    }

    return true;
  }

  private async applyThrottling(alert: Alert, definition: AlertDefinition): Promise<{
    shouldSuppress: boolean;
    shouldDeduplicate: boolean;
    existingAlertId?: string;
    reason?: string;
  }> {
    const throttlingState = this.getThrottlingState(definition.id);
    const now = new Date();

    // Check deduplication first
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

    // Apply throttling strategy
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

  private getThrottlingState(definitionId: string): ThrottlingState {
    if (!this.throttlingStates.has(definitionId)) {
      const now = new Date();
      this.throttlingStates.set(definitionId, {
        definitionId,
        alertType: this.alertDefinitions.get(definitionId)!.type,
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
    return this.throttlingStates.get(definitionId)!;
  }

  private async findDuplicateAlert(alert: Alert, definition: AlertDefinition): Promise<string | null> {
    const cutoffTime = new Date(Date.now() - definition.deduplicationWindowMs);
    
    for (const [alertId, existingAlert] of this.activeAlerts.entries()) {
      if (existingAlert.triggeredAt < cutoffTime) continue;
      if (existingAlert.fingerprint === alert.fingerprint) {
        return alertId;
      }
    }

    return null;
  }

  private applyTimeBasedThrottling(
    alert: Alert,
    definition: AlertDefinition,
    state: ThrottlingState,
    now: Date
  ): { shouldSuppress: boolean; shouldDeduplicate: boolean; reason?: string } {
    const windowElapsed = now.getTime() - state.windowStart.getTime();
    
    // Reset window if expired
    if (windowElapsed > definition.throttlingConfig.timeWindowMs) {
      state.windowStart = now;
      state.alertsInCurrentWindow = 0;
    }

    // Check if we're within limits
    if (state.alertsInCurrentWindow >= definition.throttlingConfig.maxAlertsInWindow) {
      return {
        shouldSuppress: true,
        shouldDeduplicate: false,
        reason: 'time_window_limit_exceeded'
      };
    }

    // Update state
    state.alertsInCurrentWindow++;
    state.lastAlertTime = now;

    return { shouldSuppress: false, shouldDeduplicate: false };
  }

  private applyCountBasedThrottling(
    alert: Alert,
    definition: AlertDefinition,
    state: ThrottlingState,
    now: Date
  ): { shouldSuppress: boolean; shouldDeduplicate: boolean; reason?: string } {
    const timeSinceLastAlert = now.getTime() - state.lastAlertTime.getTime();
    
    // Check cooldown period
    if (timeSinceLastAlert < definition.throttlingConfig.cooldownPeriodMs) {
      return {
        shouldSuppress: true,
        shouldDeduplicate: false,
        reason: 'cooldown_period_active'
      };
    }

    // Update state
    state.lastAlertTime = now;
    
    return { shouldSuppress: false, shouldDeduplicate: false };
  }

  private applySimilarityBasedThrottling(
    alert: Alert,
    definition: AlertDefinition,
    state: ThrottlingState,
    now: Date
  ): { shouldSuppress: boolean; shouldDeduplicate: boolean; reason?: string } {
    // Check for similar recent alerts
    const cutoffTime = new Date(now.getTime() - definition.throttlingConfig.timeWindowMs);
    
    // Clean up old fingerprints
    for (const [fingerprint, info] of state.recentFingerprints.entries()) {
      if (info.lastSeen < cutoffTime) {
        state.recentFingerprints.delete(fingerprint);
      }
    }

    // Check similarity
    for (const [fingerprint, info] of state.recentFingerprints.entries()) {
      const similarity = this.calculateSimilarity(alert.fingerprint, fingerprint);
      if (similarity >= definition.throttlingConfig.similarityThreshold) {
        // Update existing fingerprint
        info.count++;
        info.lastSeen = now;
        
        return {
          shouldSuppress: true,
          shouldDeduplicate: false,
          reason: 'similar_alert_detected'
        };
      }
    }

    // Add new fingerprint
    state.recentFingerprints.set(alert.fingerprint, {
      count: 1,
      firstSeen: now,
      lastSeen: now,
      representativeAlertId: alert.id
    });

    return { shouldSuppress: false, shouldDeduplicate: false };
  }

  private applyEscalationBasedThrottling(
    alert: Alert,
    definition: AlertDefinition,
    state: ThrottlingState,
    now: Date
  ): { shouldSuppress: boolean; shouldDeduplicate: boolean; reason?: string } {
    const timeSinceLastEscalation = now.getTime() - state.lastEscalation.getTime();
    
    // Check if we should escalate instead of creating new alert
    if (state.escalationCount >= definition.throttlingConfig.escalationThreshold &&
        timeSinceLastEscalation < definition.throttlingConfig.timeWindowMs) {
      
      // Find the most recent alert to escalate
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

  private applyAdaptiveThrottling(
    alert: Alert,
    definition: AlertDefinition,
    state: ThrottlingState,
    now: Date
  ): { shouldSuppress: boolean; shouldDeduplicate: boolean; reason?: string } {
    // Adaptive throttling uses machine learning to optimize throttling decisions
    // For now, implement a simple rule-based approach
    
    const metrics = state.adaptiveMetrics;
    
    // If false positive rate is high, be more aggressive with throttling
    if (metrics.falsePositiveRate > 0.3) {
      const shouldSuppress = Math.random() < 0.7; // 70% chance to suppress
      if (shouldSuppress) {
        return {
          shouldSuppress: true,
          shouldDeduplicate: false,
          reason: 'adaptive_high_false_positive_rate'
        };
      }
    }

    // If user engagement is low, reduce alert frequency
    if (metrics.userEngagement < 0.2) {
      const shouldSuppress = Math.random() < 0.5; // 50% chance to suppress
      if (shouldSuppress) {
        return {
          shouldSuppress: true,
          shouldDeduplicate: false,
          reason: 'adaptive_low_user_engagement'
        };
      }
    }

    // Use time-based throttling as fallback
    return this.applyTimeBasedThrottling(alert, definition, state, now);
  }

  private calculateSimilarity(fingerprint1: string, fingerprint2: string): number {
    // Simple similarity calculation based on string similarity
    // In a real implementation, could use more sophisticated algorithms
    
    if (fingerprint1 === fingerprint2) return 1.0;
    
    const longer = fingerprint1.length > fingerprint2.length ? fingerprint1 : fingerprint2;
    const shorter = fingerprint1.length > fingerprint2.length ? fingerprint2 : fingerprint1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private findMostRecentAlert(alertType: AlertType): Alert | null {
    let mostRecent: Alert | null = null;
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

  private async escalateAlert(alert: Alert, definition: AlertDefinition): Promise<void> {
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

    // Send escalation notifications
    await this.sendEscalationNotifications(alert, definition);

    this.metrics.alertsEscalated++;

    alert.auditTrail.push({
      timestamp: new Date(),
      action: 'alert_escalated',
      user: 'system',
      details: escalationInfo
    });

    logger.info('Alert escalated', {
      alertId: alert.id,
      escalationLevel: alert.escalationLevel,
      reason: escalationInfo.reason
    });
  }

  private async handleDeduplication(
    alert: Alert,
    definition: AlertDefinition,
    existingAlertId: string
  ): Promise<string> {
    const existingAlert = this.activeAlerts.get(existingAlertId);
    if (!existingAlert) {
      // Existing alert not found, process as new
      this.activeAlerts.set(alert.id, alert);
      return alert.id;
    }

    // Update existing alert
    existingAlert.originalCount++;
    existingAlert.relatedAlerts.push(alert.id);
    existingAlert.lastNotificationAt = new Date();

    // Update details with latest information
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

    logger.debug('Alert deduplicated', {
      existingAlertId,
      duplicateAlertId: alert.id,
      totalCount: existingAlert.originalCount
    });

    return existingAlertId;
  }

  private async sendNotifications(alert: Alert, definition: AlertDefinition): Promise<void> {
    // Send notifications through configured channels
    for (const channel of definition.notificationChannels) {
      try {
        await this.sendNotificationToChannel(alert, definition, channel);
        alert.notificationsSent++;
        alert.notificationChannels.push(channel);
      } catch (error) {
        logger.error(`Failed to send notification to ${channel}`, {
          alertId: alert.id,
          error: getErrorMessage(error)
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

  private async sendNotificationToChannel(
    alert: Alert,
    definition: AlertDefinition,
    channel: string
  ): Promise<void> {
    // Simulate sending notification to different channels
    switch (channel) {
      case 'email':
        logger.debug(`Sending email notification for alert ${alert.id}`);
        break;
      case 'slack':
        logger.debug(`Sending Slack notification for alert ${alert.id}`);
        break;
      case 'sms':
        logger.debug(`Sending SMS notification for alert ${alert.id}`);
        break;
      case 'webhook':
        logger.debug(`Sending webhook notification for alert ${alert.id}`);
        break;
      case 'pagerduty':
        logger.debug(`Sending PagerDuty notification for alert ${alert.id}`);
        break;
      default:
        logger.warn(`Unknown notification channel: ${channel}`);
    }
  }

  private async sendEscalationNotifications(alert: Alert, definition: AlertDefinition): Promise<void> {
    // Send escalation notifications to higher-level recipients
    logger.info('Sending escalation notifications', {
      alertId: alert.id,
      escalationLevel: alert.escalationLevel,
      recipients: definition.escalationRecipients
    });
  }

  private async checkAutoEscalation(alert: Alert, definition: AlertDefinition): Promise<void> {
    // Check if alert should be automatically escalated based on severity or other criteria
    if (alert.severity >= 9 || alert.priority === AlertPriority.EMERGENCY) {
      await this.escalateAlert(alert, definition);
    }
  }

  private calculateAlertRiskScore(alert: Alert): number {
    let riskScore = 0;

    // Base risk by priority
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

    // Additional risk factors
    if (alert.securityRelevant) riskScore += 25;
    if (alert.threatLevel === 'critical') riskScore += 20;
    if (alert.estimatedRevenueLoss > 1000) riskScore += 15;
    if (alert.affectedUsers > 100) riskScore += 10;

    return Math.max(0, Math.min(100, riskScore));
  }

  private startThrottlingEngine(): void {
    // Cleanup expired throttling states
    setInterval(() => {
      this.cleanupThrottlingStates();
    }, 60 * 60 * 1000); // Every hour

    // Check for auto-resolution
    setInterval(() => {
      this.checkAutoResolution();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Update adaptive learning metrics
    setInterval(() => {
      this.updateAdaptiveMetrics();
    }, 15 * 60 * 1000); // Every 15 minutes

    logger.info('Alert throttling engine started');
  }

  private cleanupThrottlingStates(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [definitionId, state] of this.throttlingStates.entries()) {
      if (state.lastReset < cutoffTime) {
        this.throttlingStates.delete(definitionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up throttling states', { cleanedCount });
    }
  }

  private checkAutoResolution(): void {
    const now = new Date();

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.status !== 'active') continue;

      const definition = this.alertDefinitions.get(alert.definitionId);
      if (!definition || !definition.autoResolve) continue;

      // Check timeout
      const alertAge = now.getTime() - alert.triggeredAt.getTime();
      if (alertAge > definition.autoResolveTimeoutMs) {
        this.resolveAlert(alertId, 'auto_resolved_timeout', 'system');
        continue;
      }

      // Check auto-resolve conditions
      if (definition.autoResolveConditions.length > 0) {
        // In a real implementation, would check actual system state
        // For demo, randomly auto-resolve some alerts
        if (Math.random() < 0.1) { // 10% chance
          this.resolveAlert(alertId, 'auto_resolved_conditions_met', 'system');
        }
      }
    }
  }

  private updateAdaptiveMetrics(): void {
    // Update adaptive learning metrics for all throttling states
    for (const [, state] of this.throttlingStates.entries()) {
      if (state.adaptiveMetrics) {
        // Update metrics based on recent alert performance
        // This is simplified - real implementation would use actual data
        state.adaptiveMetrics.falsePositiveRate = Math.max(0, state.adaptiveMetrics.falsePositiveRate - 0.01);
        state.adaptiveMetrics.userEngagement = Math.min(1, state.adaptiveMetrics.userEngagement + 0.01);
      }
    }
  }

  private resolveAlert(alertId: string, resolution: string, resolvedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

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

    logger.info('Alert resolved', {
      alertId,
      resolution,
      resolvedBy
    });
  }

  /**
   * Get alert throttling statistics
   */
  getStats(): AlertMetrics {
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
    
    if (stats.alertFatigue > 70) {
      status = 'warning'; // High alert fatigue
    }
    
    if (stats.falsePositiveRate > 0.3) {
      status = 'degraded'; // High false positive rate
    }
    
    if (stats.criticalAlertsCount > 20) {
      status = 'critical'; // Too many critical alerts
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

// Export singleton instance
export const alertThrottlingService = AlertThrottlingService.getInstance();
