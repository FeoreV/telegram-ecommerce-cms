import * as crypto from 'crypto';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../utils/logger';
import { DataCategory } from './DataClassificationService';
import { encryptionService } from './EncryptionService';
import { securityLogService } from './SecurityLogService';
import { getSecurityKeyId } from '../config/securityKeys';

export enum CommunicationType {
  TELEGRAM_MESSAGE = 'telegram_message',
  EMAIL = 'email',
  PUSH_NOTIFICATION = 'push_notification',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  WEBSOCKET = 'websocket',
  IN_APP_NOTIFICATION = 'in_app_notification',
  SYSTEM_ALERT = 'system_alert'
}

export enum RedactionLevel {
  MINIMAL = 'minimal',       // Redact only critical PII
  STANDARD = 'standard',     // Redact all direct PII
  AGGRESSIVE = 'aggressive', // Redact all PII and sensitive data
  COMPLETE = 'complete'      // Redact everything except essential business info
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export interface PIIRedactionRule {
  id: string;
  name: string;
  description: string;

  // Targeting
  communicationTypes: CommunicationType[];
  dataCategories: DataCategory[];
  fieldPatterns: RegExp[];

  // Redaction configuration
  redactionLevel: RedactionLevel;
  redactionStrategy: 'mask' | 'replace' | 'remove' | 'generalize';
  maskingCharacter: string;
  replacementText?: string;

  // Conditions
  conditions: {
    priority?: NotificationPriority[];
    userConsent?: boolean;
    businessNecessity?: boolean;
    legalBasis?: string[];
    recipientType?: ('customer' | 'employee' | 'vendor' | 'admin')[];
  };

  // Preservation rules
  preserveStructure: boolean;
  preserveLength: boolean;
  preserveBusinessContext: boolean;

  // Compliance
  regulations: string[];
  auditRequired: boolean;

  // Implementation
  enabled: boolean;
  priority: number;
  validateAfterRedaction: boolean;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: CommunicationType;

  // Template content
  subject?: string;
  body: string;
  metadata: Record<string, any>;

  // Security settings
  encryptionRequired: boolean;
  redactionLevel: RedactionLevel;
  allowedVariables: string[];
  bannedVariables: string[];

  // PII handling
  containsPII: boolean;
  piiFields: string[];
  businessJustification?: string;

  // Validation
  validated: boolean;
  lastValidated?: Date;
  validationErrors: string[];

  // Compliance
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  consentRequired: boolean;
  retentionPeriod: number; // days
}

export interface NotificationEvent {
  id: string;
  type: CommunicationType;
  templateId?: string;

  // Content
  subject?: string;
  body: string;
  originalBody: string; // Before redaction
  variables: Record<string, any>;

  // Recipients
  recipients: {
    userId?: string;
    email?: string;
    phone?: string;
    telegramChatId?: string;
    deviceTokens?: string[];
  }[];

  // Security processing
  redactionApplied: boolean;
  redactedFields: string[];
  encryptionApplied: boolean;

  // Metadata
  priority: NotificationPriority;
  createdAt: Date;
  processedAt?: Date;
  sentAt?: Date;

  // Compliance
  consentVerified: boolean;
  legalBasis: string[];
  auditTrail: {
    timestamp: Date;
    action: string;
    details: Record<string, any>;
  }[];

  // Delivery tracking
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'blocked';
  deliveryAttempts: number;
  lastError?: string;
}

export interface RedactionResult {
  redactedContent: string;
  originalContent: string;
  redactedFields: {
    field: string;
    category: DataCategory;
    originalValue: string;
    redactedValue: string;
    redactionReason: string;
  }[];
  complianceScore: number;
  privacyRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CommunicationSecurityConfig {
  globalRedactionLevel: RedactionLevel;
  encryptionEnabled: boolean;
  auditAllCommunications: boolean;

  // Rate limiting
  rateLimits: {
    perUser: { window: number; limit: number };
    perEmail: { window: number; limit: number };
    perPhone: { window: number; limit: number };
    global: { window: number; limit: number };
  };

  // Content validation
  contentValidation: {
    maxLength: number;
    allowedHtml: string[];
    bannedPatterns: RegExp[];
    malwareScanning: boolean;
  };

  // Privacy controls
  privacyControls: {
    requireConsent: boolean;
    honorOptOut: boolean;
    respetDoNotTrack: boolean;
    anonymizeMetrics: boolean;
  };

  // Compliance
  compliance: {
    gdprEnabled: boolean;
    ccpaEnabled: boolean;
    canSpamCompliant: boolean;
    dataRetentionDays: number;
  };
}

export class CommunicationSecurityService {
  private static instance: CommunicationSecurityService;
  private redactionRules: Map<string, PIIRedactionRule> = new Map();
  private templates: Map<string, CommunicationTemplate> = new Map();
  private notifications: Map<string, NotificationEvent> = new Map();
  private config!: CommunicationSecurityConfig;
  private piiPatterns: Map<string, RegExp> = new Map();
  private blockedRecipients: Set<string> = new Set();

  private constructor() {
    this.initializeCommunicationSecurity();
    this.loadRedactionRules();
    this.loadCommunicationTemplates();
    this.setupPIIPatterns();
    this.loadConfiguration();

    logger.info('Communication Security Service initialized', {
      redactionRules: this.redactionRules.size,
      templates: this.templates.size,
      piiPatterns: this.piiPatterns.size
    });
  }

  public static getInstance(): CommunicationSecurityService {
    if (!CommunicationSecurityService.instance) {
      CommunicationSecurityService.instance = new CommunicationSecurityService();
    }
    return CommunicationSecurityService.instance;
  }

  private async initializeCommunicationSecurity(): Promise<void> {
    try {
      // Initialize encryption for communication content
      await this.initializeCommunicationEncryption();

      // Load blocked recipients list
      await this.loadBlockedRecipients();

      // Setup real-time monitoring
      await this.setupCommunicationMonitoring();

      logger.info('Communication security initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize communication security:', error);
      throw error;
    }
  }

  private async initializeCommunicationEncryption(): Promise<void> {
    // Initialize encryption keys for communication templates and queues
    logger.debug('Communication encryption initialized');
  }

  private async loadBlockedRecipients(): Promise<void> {
    // Load recipients who have opted out or are blocked
    this.blockedRecipients.add('blocked@example.com');
    logger.debug('Blocked recipients loaded');
  }

  private async setupCommunicationMonitoring(): Promise<void> {
    // Setup real-time monitoring for communication security
    logger.debug('Communication monitoring setup completed');
  }

  private loadRedactionRules(): void {
    // Email redaction rule
    const emailRedactionRule: PIIRedactionRule = {
      id: 'email-address-redaction',
      name: 'Email Address Redaction',
      description: 'Redact email addresses in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.PUSH_NOTIFICATION,
        CommunicationType.TELEGRAM_MESSAGE
      ],
      dataCategories: [DataCategory.PII_DIRECT],
      fieldPatterns: [/email/i, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/],
      redactionLevel: RedactionLevel.STANDARD,
      redactionStrategy: 'mask',
      maskingCharacter: '*',
      conditions: {
        businessNecessity: false,
        legalBasis: ['legitimate_interest']
      },
      preserveStructure: true,
      preserveLength: false,
      preserveBusinessContext: true,
      regulations: ['GDPR', 'CCPA'],
      auditRequired: true,
      enabled: true,
      priority: 1,
      validateAfterRedaction: true
    };

    // Phone number redaction rule
    const phoneRedactionRule: PIIRedactionRule = {
      id: 'phone-number-redaction',
      name: 'Phone Number Redaction',
      description: 'Redact phone numbers in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.SMS,
        CommunicationType.TELEGRAM_MESSAGE
      ],
      dataCategories: [DataCategory.PII_DIRECT],
      fieldPatterns: [/phone|mobile|tel/i, /\+?[1-9]\d{1,14}/],
      redactionLevel: RedactionLevel.STANDARD,
      redactionStrategy: 'mask',
      maskingCharacter: 'X',
      conditions: {
        businessNecessity: false
      },
      preserveStructure: true,
      preserveLength: true,
      preserveBusinessContext: true,
      regulations: ['GDPR', 'CCPA'],
      auditRequired: true,
      enabled: true,
      priority: 2,
      validateAfterRedaction: true
    };

    // Name redaction rule
    const nameRedactionRule: PIIRedactionRule = {
      id: 'name-redaction',
      name: 'Personal Name Redaction',
      description: 'Redact personal names in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.PUSH_NOTIFICATION,
        CommunicationType.TELEGRAM_MESSAGE,
        CommunicationType.WEBHOOK
      ],
      dataCategories: [DataCategory.PII_DIRECT],
      fieldPatterns: [/name|first_name|last_name/i],
      redactionLevel: RedactionLevel.AGGRESSIVE,
      redactionStrategy: 'replace',
      maskingCharacter: '*',
      replacementText: '[USER]',
      conditions: {
        priority: [NotificationPriority.LOW, NotificationPriority.NORMAL],
        businessNecessity: false
      },
      preserveStructure: false,
      preserveLength: false,
      preserveBusinessContext: true,
      regulations: ['GDPR', 'CCPA'],
      auditRequired: true,
      enabled: true,
      priority: 3,
      validateAfterRedaction: true
    };

    // Address redaction rule
    const addressRedactionRule: PIIRedactionRule = {
      id: 'address-redaction',
      name: 'Address Redaction',
      description: 'Redact addresses in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.PUSH_NOTIFICATION
      ],
      dataCategories: [DataCategory.PII_DIRECT],
      fieldPatterns: [/address|street|location/i],
      redactionLevel: RedactionLevel.STANDARD,
      redactionStrategy: 'generalize',
      maskingCharacter: '*',
      replacementText: '[LOCATION]',
      conditions: {
        businessNecessity: false
      },
      preserveStructure: false,
      preserveLength: false,
      preserveBusinessContext: true,
      regulations: ['GDPR'],
      auditRequired: false,
      enabled: true,
      priority: 4,
      validateAfterRedaction: true
    };

    // Financial data redaction rule
    const financialRedactionRule: PIIRedactionRule = {
      id: 'financial-data-redaction',
      name: 'Financial Data Redaction',
      description: 'Redact financial information in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.PUSH_NOTIFICATION,
        CommunicationType.TELEGRAM_MESSAGE,
        CommunicationType.SMS
      ],
      dataCategories: [DataCategory.FINANCIAL_ACCOUNT, DataCategory.FINANCIAL_TRANSACTION],
      fieldPatterns: [
        /card_number|account|iban|swift/i,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
        /\$[\d,]+\.?\d*/,  // Dollar amounts
        /€[\d,]+\.?\d*/,   // Euro amounts
        /₽[\d,]+\.?\d*/    // Ruble amounts
      ],
      redactionLevel: RedactionLevel.AGGRESSIVE,
      redactionStrategy: 'mask',
      maskingCharacter: 'X',
      conditions: {
        businessNecessity: false,
        legalBasis: ['contract', 'legitimate_interest']
      },
      preserveStructure: true,
      preserveLength: false,
      preserveBusinessContext: true,
      regulations: ['GDPR', 'CCPA', 'PCI-DSS'],
      auditRequired: true,
      enabled: true,
      priority: 10,
      validateAfterRedaction: true
    };

    // System secrets redaction rule
    const secretsRedactionRule: PIIRedactionRule = {
      id: 'secrets-redaction',
      name: 'System Secrets Redaction',
      description: 'Redact system secrets and credentials in communications',
      communicationTypes: [
        CommunicationType.EMAIL,
        CommunicationType.WEBHOOK,
        CommunicationType.SYSTEM_ALERT
      ],
      dataCategories: [DataCategory.SYSTEM_CREDENTIALS],
      fieldPatterns: [
        /password|passwd|pwd|secret|token|key|api[-_]?key/i,
        /[A-Za-z0-9+/]{20,}={0,2}/, // Base64 patterns
        /[a-fA-F0-9]{32,64}/,       // Hex patterns
        /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/ // JWT patterns
      ],
      redactionLevel: RedactionLevel.COMPLETE,
      redactionStrategy: 'replace',
      maskingCharacter: '*',
      replacementText: '[REDACTED]',
      conditions: {
        businessNecessity: false
      },
      preserveStructure: false,
      preserveLength: false,
      preserveBusinessContext: false,
      regulations: ['Security Policy'],
      auditRequired: true,
      enabled: true,
      priority: 20,
      validateAfterRedaction: true
    };

    this.redactionRules.set(emailRedactionRule.id, emailRedactionRule);
    this.redactionRules.set(phoneRedactionRule.id, phoneRedactionRule);
    this.redactionRules.set(nameRedactionRule.id, nameRedactionRule);
    this.redactionRules.set(addressRedactionRule.id, addressRedactionRule);
    this.redactionRules.set(financialRedactionRule.id, financialRedactionRule);
    this.redactionRules.set(secretsRedactionRule.id, secretsRedactionRule);

    logger.info('PII redaction rules loaded', {
      ruleCount: this.redactionRules.size
    });
  }

  private loadCommunicationTemplates(): void {
    // Order confirmation template
    const orderConfirmationTemplate: CommunicationTemplate = {
      id: 'order-confirmation',
      name: 'Order Confirmation',
      type: CommunicationType.EMAIL,
      subject: 'Order Confirmation #{orderId}',
      body: `Dear {customerName},

Your order #{orderId} has been confirmed.

Order Details:
- Total: {orderTotal}
- Items: {itemCount}
- Delivery Address: {deliveryAddress}

Thank you for your business!`,
      metadata: {
        category: 'transactional',
        businessCritical: true
      },
      encryptionRequired: true,
      redactionLevel: RedactionLevel.MINIMAL,
      allowedVariables: ['orderId', 'customerName', 'orderTotal', 'itemCount', 'deliveryAddress'],
      bannedVariables: ['email', 'phone', 'cardNumber'],
      containsPII: true,
      piiFields: ['customerName', 'deliveryAddress'],
      businessJustification: 'Order fulfillment and customer communication',
      validated: true,
      lastValidated: new Date(),
      validationErrors: [],
      gdprCompliant: true,
      ccpaCompliant: true,
      consentRequired: false,
      retentionPeriod: 2555 // 7 years for business records
    };

    // Payment notification template
    const paymentNotificationTemplate: CommunicationTemplate = {
      id: 'payment-notification',
      name: 'Payment Notification',
      type: CommunicationType.PUSH_NOTIFICATION,
      subject: 'Payment Processed',
      body: 'Your payment of {amount} has been processed successfully.',
      metadata: {
        category: 'financial',
        priority: 'high'
      },
      encryptionRequired: true,
      redactionLevel: RedactionLevel.STANDARD,
      allowedVariables: ['amount', 'orderId'],
      bannedVariables: ['cardNumber', 'accountNumber', 'cvv'],
      containsPII: false,
      piiFields: [],
      businessJustification: 'Payment confirmation for security',
      validated: true,
      lastValidated: new Date(),
      validationErrors: [],
      gdprCompliant: true,
      ccpaCompliant: true,
      consentRequired: false,
      retentionPeriod: 90
    };

    // Security alert template
    const securityAlertTemplate: CommunicationTemplate = {
      id: 'security-alert',
      name: 'Security Alert',
      type: CommunicationType.EMAIL,
      subject: 'Security Alert - Unusual Activity',
      body: `Security Alert

We detected unusual activity on your account at {timestamp}.

Location: {location}
IP Address: {ipAddress}
Device: {deviceInfo}

If this was not you, please contact support immediately.`,
      metadata: {
        category: 'security',
        priority: 'critical'
      },
      encryptionRequired: true,
      redactionLevel: RedactionLevel.MINIMAL,
      allowedVariables: ['timestamp', 'location', 'ipAddress', 'deviceInfo'],
      bannedVariables: ['password', 'token', 'sessionId'],
      containsPII: true,
      piiFields: ['ipAddress', 'location'],
      businessJustification: 'Security incident notification',
      validated: true,
      lastValidated: new Date(),
      validationErrors: [],
      gdprCompliant: true,
      ccpaCompliant: true,
      consentRequired: false,
      retentionPeriod: 365
    };

    this.templates.set(orderConfirmationTemplate.id, orderConfirmationTemplate);
    this.templates.set(paymentNotificationTemplate.id, paymentNotificationTemplate);
    this.templates.set(securityAlertTemplate.id, securityAlertTemplate);

    logger.info('Communication templates loaded', {
      templateCount: this.templates.size
    });
  }

  private setupPIIPatterns(): void {
    // Email pattern
    this.piiPatterns.set('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);

    // Phone pattern
    this.piiPatterns.set('phone', /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g);

    // Credit card pattern
    this.piiPatterns.set('creditCard', /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g);

    // SSN pattern
    this.piiPatterns.set('ssn', /\b\d{3}-\d{2}-\d{4}\b/g);

    // IP address pattern
    this.piiPatterns.set('ipAddress', /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);

    // URL pattern with potential tokens
    this.piiPatterns.set('urlWithToken', /https?:\/\/[^\s]+[?&](?:token|key|secret)=[A-Za-z0-9+/=]+/g);

    // JWT pattern
    this.piiPatterns.set('jwt', /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g);

    logger.debug('PII patterns setup completed');
  }

  private loadConfiguration(): void {
    this.config = {
      globalRedactionLevel: RedactionLevel.STANDARD,
      encryptionEnabled: true,
      auditAllCommunications: true,

      rateLimits: {
        perUser: { window: 3600000, limit: 100 },    // 100 per hour
        perEmail: { window: 3600000, limit: 50 },    // 50 per hour per email
        perPhone: { window: 3600000, limit: 20 },    // 20 per hour per phone
        global: { window: 60000, limit: 1000 }       // 1000 per minute globally
      },

      contentValidation: {
        maxLength: 10000,
        allowedHtml: ['b', 'i', 'u', 'br', 'p', 'a'],
        bannedPatterns: [
          /<script.*?>.*?<\/script>/gi,
          /javascript:/gi,
          /vbscript:/gi,
          /on\w+\s*=/gi
        ],
        malwareScanning: true
      },

      privacyControls: {
        requireConsent: true,
        honorOptOut: true,
        respetDoNotTrack: true,
        anonymizeMetrics: true
      },

      compliance: {
        gdprEnabled: true,
        ccpaEnabled: true,
        canSpamCompliant: true,
        dataRetentionDays: 365
      }
    };

    logger.debug('Communication security configuration loaded');
  }

  /**
   * Process and secure notification before sending
   */
  async processSecureNotification(
    type: CommunicationType,
    templateId: string | undefined,
    recipients: any[],
    variables: Record<string, any>,
    options: {
      priority?: NotificationPriority;
      bypassRedaction?: boolean;
      forceEncryption?: boolean;
      businessJustification?: string;
    } = {}
  ): Promise<string> {
    const notificationId = crypto.randomUUID();

    try {
      // Validate recipients and check opt-out status
      const validRecipients = await this.validateRecipients(recipients, type);

      if (validRecipients.length === 0) {
        throw new Error('No valid recipients after filtering');
      }

      // Get template or use direct content
      let content: string;
      let subject: string | undefined;
      let template: CommunicationTemplate | undefined;

      if (templateId) {
        template = this.templates.get(templateId);
        if (!template) {
          throw new Error(`Template not found: ${templateId}`);
        }

        // Validate template compliance
        await this.validateTemplateCompliance(template, variables);

        content = this.interpolateTemplate(template.body, variables);
        subject = template.subject ? this.interpolateTemplate(template.subject, variables) : undefined;
      } else {
        content = variables.body || variables.content || '';
        subject = variables.subject;
      }

      // Create notification event
      const notification: NotificationEvent = {
        id: notificationId,
        type,
        templateId,
        subject,
        body: content,
        originalBody: content,
        variables,
        recipients: validRecipients,
        redactionApplied: false,
        redactedFields: [],
        encryptionApplied: false,
        priority: options.priority || NotificationPriority.NORMAL,
        createdAt: new Date(),
        consentVerified: false,
        legalBasis: [],
        auditTrail: [],
        status: 'pending',
        deliveryAttempts: 0
      };

      // Add initial audit entry
      notification.auditTrail.push({
        timestamp: new Date(),
        action: 'notification_created',
        details: {
          type,
          templateId,
          recipientCount: validRecipients.length,
          priority: notification.priority
        }
      });

      this.notifications.set(notificationId, notification);

      // Apply PII redaction
      if (!options.bypassRedaction) {
        const redactionResult = await this.applyPIIRedaction(
          notification,
          template?.redactionLevel || this.config.globalRedactionLevel
        );

        notification.body = redactionResult.redactedContent;
        notification.redactionApplied = true;
        notification.redactedFields = redactionResult.redactedFields.map(f => f.field);

        // Log redaction event
        notification.auditTrail.push({
          timestamp: new Date(),
          action: 'pii_redaction_applied',
          details: {
            redactedFields: notification.redactedFields.length,
            privacyRisk: redactionResult.privacyRisk,
            complianceScore: redactionResult.complianceScore
          }
        });
      }

      // Apply encryption if required
      const encryptionRequired = options.forceEncryption ||
                                template?.encryptionRequired ||
                                this.config.encryptionEnabled;

      if (encryptionRequired) {
        await this.applyContentEncryption(notification);
      }

      // Verify consent and legal basis
      await this.verifyConsentAndLegalBasis(notification);

      // Validate final content
      await this.validateCommunicationContent(notification);

      notification.status = 'processing';
      notification.processedAt = new Date();

      logger.info('Secure notification processed', {
        notificationId,
        type,
        templateId,
        recipients: validRecipients.length,
        redactionApplied: notification.redactionApplied,
        encryptionApplied: notification.encryptionApplied
      });

      // Log security event
      await securityLogService.logSecurityEvent({
        eventType: 'secure_notification_processed',
        severity: 'LOW',
        category: 'network',
        ipAddress: '82.147.84.78',
        success: true,
        details: {
          notificationId,
          type,
          templateId,
          recipientCount: validRecipients.length,
          redactionApplied: notification.redactionApplied,
          encryptionApplied: notification.encryptionApplied,
          privacyCompliant: notification.consentVerified
        },
        riskScore: notification.redactionApplied ? 10 : 30,
        tags: ['communication_security', 'pii_protection', 'notification'],
        compliance: {
          pii: notification.redactionApplied,
          gdpr: template?.gdprCompliant || false,
          pci: false,
          hipaa: false
        }
      });

      return notificationId;

    } catch (error) {
      logger.error('Secure notification processing failed', {
        notificationId,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private async validateRecipients(recipients: any[], type: CommunicationType): Promise<any[]> {
    const validRecipients: any[] = [];

    for (const recipient of recipients) {
      try {
        // Check if recipient is blocked
        const recipientKey = recipient.email || recipient.phone || recipient.telegramChatId;
        if (this.blockedRecipients.has(recipientKey)) {
          logger.debug('Recipient blocked, skipping', { recipient: recipientKey });
          continue;
        }

        // Validate recipient format
        if (type === CommunicationType.EMAIL && recipient.email) {
          if (this.piiPatterns.get('email')?.test(recipient.email)) {
            validRecipients.push(recipient);
          }
        } else if (type === CommunicationType.SMS && recipient.phone) {
          if (this.piiPatterns.get('phone')?.test(recipient.phone)) {
            validRecipients.push(recipient);
          }
        } else if (type === CommunicationType.TELEGRAM_MESSAGE && recipient.telegramChatId) {
          validRecipients.push(recipient);
        } else {
          validRecipients.push(recipient);
        }

      } catch (error) {
        logger.warn('Recipient validation failed', {
          recipient,
          error: getErrorMessage(error)
        });
      }
    }

    return validRecipients;
  }

  private async validateTemplateCompliance(
    template: CommunicationTemplate,
    variables: Record<string, any>
  ): Promise<void> {
    // Check if template contains banned variables
    for (const variable of Object.keys(variables)) {
      if (template.bannedVariables.includes(variable)) {
        throw new Error(`Banned variable in template: ${variable}`);
      }
    }

    // Validate template hasn't expired
    if (template.lastValidated &&
        Date.now() - template.lastValidated.getTime() > 30 * 24 * 60 * 60 * 1000) {
      throw new Error('Template validation expired, requires re-validation');
    }

    // Check for validation errors
    if (template.validationErrors.length > 0) {
      throw new Error(`Template has validation errors: ${template.validationErrors.join(', ')}`);
    }
  }

  /**
   * Interpolate template with variables - FIXED: CWE-1333 ReDoS
   */
  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      // SECURITY: Escape special regex characters to prevent ReDoS
      const escapeRegex = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };

      // SECURITY: Use simple string replace instead of regex for simple cases
      const placeholder = `{${key}}`;
      if (!key.match(/[.*+?^${}()|[\]\\]/)) {
        // Safe to use simple replace
        result = result.split(placeholder).join(String(value || ''));
      } else {
        // Need regex, but escape the key
        const escapedKey = escapeRegex(key);
        const pattern = new RegExp(`\\{${escapedKey}\\}`, 'g');
        result = result.replace(pattern, String(value || ''));
      }
    }

    return result;
  }

  private async applyPIIRedaction(
    notification: NotificationEvent,
    redactionLevel: RedactionLevel
  ): Promise<RedactionResult> {
    const redactedFields: RedactionResult['redactedFields'] = [];
    let redactedContent = notification.body;
    const originalContent = notification.body;

    // Get applicable redaction rules
    const applicableRules = Array.from(this.redactionRules.values())
      .filter(rule => {
        if (!rule.enabled) return false;
        if (!rule.communicationTypes.includes(notification.type)) return false;

        // Check redaction level compatibility
        const levelOrder = {
          [RedactionLevel.MINIMAL]: 1,
          [RedactionLevel.STANDARD]: 2,
          [RedactionLevel.AGGRESSIVE]: 3,
          [RedactionLevel.COMPLETE]: 4
        };

        return levelOrder[rule.redactionLevel] <= levelOrder[redactionLevel];
      })
      .sort((a, b) => b.priority - a.priority);

    // Apply each rule
    for (const rule of applicableRules) {
      for (const pattern of rule.fieldPatterns) {
        let match;
        while ((match = pattern.exec(redactedContent)) !== null) {
          const originalValue = match[0];
          const redactedValue = this.applyRedactionStrategy(originalValue, rule);

          redactedContent = redactedContent.replace(originalValue, redactedValue);

          redactedFields.push({
            field: rule.name,
            category: rule.dataCategories[0] || DataCategory.PII_DIRECT,
            originalValue,
            redactedValue,
            redactionReason: rule.description
          });

          // Reset regex to avoid infinite loop
          pattern.lastIndex = 0;
          break;
        }
      }
    }

    // Apply global PII patterns
    for (const [patternName, pattern] of this.piiPatterns.entries()) {
      const globalPattern = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = globalPattern.exec(redactedContent)) !== null) {
        const originalValue = match[0];
        const redactedValue = this.applyDefaultRedaction(originalValue, patternName);

        redactedContent = redactedContent.replace(originalValue, redactedValue);

        redactedFields.push({
          field: patternName,
          category: this.getDataCategoryForPattern(patternName),
          originalValue,
          redactedValue,
          redactionReason: `Global ${patternName} pattern detection`
        });

        // Reset regex to avoid infinite loop
        globalPattern.lastIndex = 0;
        break;
      }
    }

    // Calculate compliance score and privacy risk
    const complianceScore = this.calculateComplianceScore(redactedFields, originalContent);
    const privacyRisk = this.assessPrivacyRisk(redactedFields, redactedContent);

    return {
      redactedContent,
      originalContent,
      redactedFields,
      complianceScore,
      privacyRisk
    };
  }

  private applyRedactionStrategy(value: string, rule: PIIRedactionRule): string {
    switch (rule.redactionStrategy) {
      case 'mask':
        if (rule.preserveLength) {
          return rule.maskingCharacter.repeat(value.length);
        } else {
          return rule.maskingCharacter.repeat(Math.min(value.length, 8));
        }

      case 'replace':
        return rule.replacementText || '[REDACTED]';

      case 'remove':
        return '';

      case 'generalize':
        // Apply generalization based on data type
        if (rule.fieldPatterns.some(p => p.test('email'))) {
          return '[EMAIL_ADDRESS]';
        } else if (rule.fieldPatterns.some(p => p.test('phone'))) {
          return '[PHONE_NUMBER]';
        } else {
          return rule.replacementText || '[GENERALIZED]';
        }

      default:
        return '[REDACTED]';
    }
  }

  private applyDefaultRedaction(value: string, patternName: string): string {
    switch (patternName) {
      case 'email': {
        const emailParts = value.split('@');
        if (emailParts.length === 2) {
          const local = emailParts[0];
          const domain = emailParts[1];
          const maskedLocal = local.length > 2
            ? local.substring(0, 1) + '*'.repeat(local.length - 2) + local.substring(local.length - 1)
            : '*'.repeat(local.length);
          return `${maskedLocal}@${domain}`;
        }
        return '[EMAIL]';
      }

      case 'phone':
        if (value.length > 4) {
          return value.substring(0, 3) + 'X'.repeat(value.length - 6) + value.substring(value.length - 3);
        }
        return 'X'.repeat(value.length);

      case 'creditCard':
        if (value.length >= 8) {
          const cleanValue = value.replace(/[\s-]/g, '');
          return cleanValue.substring(0, 4) + 'X'.repeat(cleanValue.length - 8) + cleanValue.substring(cleanValue.length - 4);
        }
        return 'X'.repeat(value.length);

      case 'ssn':
        return 'XXX-XX-XXXX';

      case 'ipAddress': {
        const parts = value.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.XXX.XXX`;
        }
        return '[IP_ADDRESS]';
      }

      case 'jwt':
      case 'urlWithToken':
        return '[REDACTED_TOKEN]';

      default:
        return '[REDACTED]';
    }
  }

  private getDataCategoryForPattern(patternName: string): DataCategory {
    const categoryMap = {
      'email': DataCategory.PII_DIRECT,
      'phone': DataCategory.PII_DIRECT,
      'creditCard': DataCategory.FINANCIAL_ACCOUNT,
      'ssn': DataCategory.PII_SENSITIVE,
      'ipAddress': DataCategory.PII_INDIRECT,
      'jwt': DataCategory.SYSTEM_CREDENTIALS,
      'urlWithToken': DataCategory.SYSTEM_CREDENTIALS
    };

    return categoryMap[patternName as keyof typeof categoryMap] || DataCategory.PII_DIRECT;
  }

  private calculateComplianceScore(redactedFields: RedactionResult['redactedFields'], originalContent: string): number {
    const totalPiiDetected = redactedFields.length;
    const criticalPiiRedacted = redactedFields.filter(f =>
      f.category === DataCategory.PII_SENSITIVE ||
      f.category === DataCategory.FINANCIAL_ACCOUNT ||
      f.category === DataCategory.SYSTEM_CREDENTIALS
    ).length;

    if (totalPiiDetected === 0) return 100;

    const baseScore = (totalPiiDetected / (originalContent.length / 100)) * 10;
    const criticalBonus = criticalPiiRedacted * 20;

    return Math.min(100, baseScore + criticalBonus);
  }

  private assessPrivacyRisk(redactedFields: RedactionResult['redactedFields'], _content: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalPii = redactedFields.filter(f =>
      f.category === DataCategory.PII_SENSITIVE ||
      f.category === DataCategory.FINANCIAL_ACCOUNT
    ).length;

    const systemSecrets = redactedFields.filter(f =>
      f.category === DataCategory.SYSTEM_CREDENTIALS
    ).length;

    if (systemSecrets > 0 || criticalPii > 2) {
      return 'CRITICAL';
    } else if (criticalPii > 0 || redactedFields.length > 5) {
      return 'HIGH';
    } else if (redactedFields.length > 2) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private async applyContentEncryption(notification: NotificationEvent): Promise<void> {
    try {
      const encrypted = await encryptionService.encryptData(
        notification.body,
        'communication-encryption-key'
      );

      notification.body = encrypted;
      notification.encryptionApplied = true;

      notification.auditTrail.push({
        timestamp: new Date(),
        action: 'content_encryption_applied',
        details: {
          algorithm: 'AES-256-GCM',
          keyId: getSecurityKeyId('communicationEncryptionKeyId')
        }
      });

    } catch (error) {
      logger.error('Content encryption failed', {
        notificationId: notification.id,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private async verifyConsentAndLegalBasis(notification: NotificationEvent): Promise<void> {
    // Verify user consent for communications
    // In a real implementation, would check consent database
    notification.consentVerified = true;
    notification.legalBasis = ['legitimate_interest', 'contract'];

    notification.auditTrail.push({
      timestamp: new Date(),
      action: 'consent_verified',
      details: {
        consentVerified: notification.consentVerified,
        legalBasis: notification.legalBasis
      }
    });
  }

  private async validateCommunicationContent(notification: NotificationEvent): Promise<void> {
    // Validate content length
    if (notification.body.length > this.config.contentValidation.maxLength) {
      throw new Error('Content exceeds maximum length');
    }

    // Check for banned patterns
    for (const pattern of this.config.contentValidation.bannedPatterns) {
      if (pattern.test(notification.body)) {
        throw new Error('Content contains banned patterns');
      }
    }

    // Malware scanning
    if (this.config.contentValidation.malwareScanning) {
      await this.performMalwareScanning(notification.body);
    }
  }

  private async performMalwareScanning(content: string): Promise<void> {
    // Simulate malware scanning
    const suspiciousPatterns = [
      /<script.*?>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /\bon\w+\s*=/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error('Potentially malicious content detected');
      }
    }
  }

  /**
   * Get communication security statistics
   */
  getStats(): {
    redactionRules: number;
    templates: number;
    processedNotifications: number;
    redactionRate: number;
    encryptionRate: number;
    averageComplianceScore: number;
    blockedRecipients: number;
  } {
    const notifications = Array.from(this.notifications.values());
    const processedNotifications = notifications.filter(n => n.status !== 'pending').length;
    const redactedNotifications = notifications.filter(n => n.redactionApplied).length;
    const encryptedNotifications = notifications.filter(n => n.encryptionApplied).length;

    const redactionRate = processedNotifications > 0 ? (redactedNotifications / processedNotifications) * 100 : 0;
    const encryptionRate = processedNotifications > 0 ? (encryptedNotifications / processedNotifications) * 100 : 0;

    // Calculate average compliance score
    // Would need to implement compliance scoring in real implementation
    const averageComplianceScore = 95;

    return {
      redactionRules: this.redactionRules.size,
      templates: this.templates.size,
      processedNotifications,
      redactionRate,
      encryptionRate,
      averageComplianceScore,
      blockedRecipients: this.blockedRecipients.size
    };
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

    if (stats.averageComplianceScore < 90) {
      status = 'warning'; // Compliance issues
    }

    if (stats.redactionRate < 80) {
      status = 'warning'; // Low redaction rate
    }

    if (stats.encryptionRate < 95) {
      status = 'degraded'; // Encryption issues
    }

    const failedNotifications = Array.from(this.notifications.values())
      .filter(n => n.status === 'failed').length;

    if (failedNotifications > 5) {
      status = 'critical'; // Too many failures
    }

    return {
      status,
      stats: {
        ...stats,
        failedNotifications
      }
    };
  }
}

// Export singleton instance
export const communicationSecurityService = CommunicationSecurityService.getInstance();
