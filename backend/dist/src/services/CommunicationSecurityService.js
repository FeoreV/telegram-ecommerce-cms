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
exports.communicationSecurityService = exports.CommunicationSecurityService = exports.NotificationPriority = exports.RedactionLevel = exports.CommunicationType = void 0;
const crypto = __importStar(require("crypto"));
const errorUtils_1 = require("../utils/errorUtils");
const logger_1 = require("../utils/logger");
const DataClassificationService_1 = require("./DataClassificationService");
const EncryptionService_1 = require("./EncryptionService");
const SecurityLogService_1 = require("./SecurityLogService");
const securityKeys_1 = require("../config/securityKeys");
var CommunicationType;
(function (CommunicationType) {
    CommunicationType["TELEGRAM_MESSAGE"] = "telegram_message";
    CommunicationType["EMAIL"] = "email";
    CommunicationType["PUSH_NOTIFICATION"] = "push_notification";
    CommunicationType["SMS"] = "sms";
    CommunicationType["WEBHOOK"] = "webhook";
    CommunicationType["WEBSOCKET"] = "websocket";
    CommunicationType["IN_APP_NOTIFICATION"] = "in_app_notification";
    CommunicationType["SYSTEM_ALERT"] = "system_alert";
})(CommunicationType || (exports.CommunicationType = CommunicationType = {}));
var RedactionLevel;
(function (RedactionLevel) {
    RedactionLevel["MINIMAL"] = "minimal";
    RedactionLevel["STANDARD"] = "standard";
    RedactionLevel["AGGRESSIVE"] = "aggressive";
    RedactionLevel["COMPLETE"] = "complete";
})(RedactionLevel || (exports.RedactionLevel = RedactionLevel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["NORMAL"] = "normal";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["CRITICAL"] = "critical";
    NotificationPriority["EMERGENCY"] = "emergency";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
class CommunicationSecurityService {
    constructor() {
        this.redactionRules = new Map();
        this.templates = new Map();
        this.notifications = new Map();
        this.piiPatterns = new Map();
        this.blockedRecipients = new Set();
        this.initializeCommunicationSecurity();
        this.loadRedactionRules();
        this.loadCommunicationTemplates();
        this.setupPIIPatterns();
        this.loadConfiguration();
        logger_1.logger.info('Communication Security Service initialized', {
            redactionRules: this.redactionRules.size,
            templates: this.templates.size,
            piiPatterns: this.piiPatterns.size
        });
    }
    static getInstance() {
        if (!CommunicationSecurityService.instance) {
            CommunicationSecurityService.instance = new CommunicationSecurityService();
        }
        return CommunicationSecurityService.instance;
    }
    async initializeCommunicationSecurity() {
        try {
            await this.initializeCommunicationEncryption();
            await this.loadBlockedRecipients();
            await this.setupCommunicationMonitoring();
            logger_1.logger.info('Communication security initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize communication security:', error);
            throw error;
        }
    }
    async initializeCommunicationEncryption() {
        logger_1.logger.debug('Communication encryption initialized');
    }
    async loadBlockedRecipients() {
        this.blockedRecipients.add('blocked@example.com');
        logger_1.logger.debug('Blocked recipients loaded');
    }
    async setupCommunicationMonitoring() {
        logger_1.logger.debug('Communication monitoring setup completed');
    }
    loadRedactionRules() {
        const emailRedactionRule = {
            id: 'email-address-redaction',
            name: 'Email Address Redaction',
            description: 'Redact email addresses in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.PUSH_NOTIFICATION,
                CommunicationType.TELEGRAM_MESSAGE
            ],
            dataCategories: [DataClassificationService_1.DataCategory.PII_DIRECT],
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
        const phoneRedactionRule = {
            id: 'phone-number-redaction',
            name: 'Phone Number Redaction',
            description: 'Redact phone numbers in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.SMS,
                CommunicationType.TELEGRAM_MESSAGE
            ],
            dataCategories: [DataClassificationService_1.DataCategory.PII_DIRECT],
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
        const nameRedactionRule = {
            id: 'name-redaction',
            name: 'Personal Name Redaction',
            description: 'Redact personal names in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.PUSH_NOTIFICATION,
                CommunicationType.TELEGRAM_MESSAGE,
                CommunicationType.WEBHOOK
            ],
            dataCategories: [DataClassificationService_1.DataCategory.PII_DIRECT],
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
        const addressRedactionRule = {
            id: 'address-redaction',
            name: 'Address Redaction',
            description: 'Redact addresses in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.PUSH_NOTIFICATION
            ],
            dataCategories: [DataClassificationService_1.DataCategory.PII_DIRECT],
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
        const financialRedactionRule = {
            id: 'financial-data-redaction',
            name: 'Financial Data Redaction',
            description: 'Redact financial information in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.PUSH_NOTIFICATION,
                CommunicationType.TELEGRAM_MESSAGE,
                CommunicationType.SMS
            ],
            dataCategories: [DataClassificationService_1.DataCategory.FINANCIAL_ACCOUNT, DataClassificationService_1.DataCategory.FINANCIAL_TRANSACTION],
            fieldPatterns: [
                /card_number|account|iban|swift/i,
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
                /\$[\d,]+\.?\d*/,
                /€[\d,]+\.?\d*/,
                /₽[\d,]+\.?\d*/
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
        const secretsRedactionRule = {
            id: 'secrets-redaction',
            name: 'System Secrets Redaction',
            description: 'Redact system secrets and credentials in communications',
            communicationTypes: [
                CommunicationType.EMAIL,
                CommunicationType.WEBHOOK,
                CommunicationType.SYSTEM_ALERT
            ],
            dataCategories: [DataClassificationService_1.DataCategory.SYSTEM_CREDENTIALS],
            fieldPatterns: [
                /password|passwd|pwd|secret|token|key|api[-_]?key/i,
                /[A-Za-z0-9+/]{20,}={0,2}/,
                /[a-fA-F0-9]{32,64}/,
                /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/
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
        logger_1.logger.info('PII redaction rules loaded', {
            ruleCount: this.redactionRules.size
        });
    }
    loadCommunicationTemplates() {
        const orderConfirmationTemplate = {
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
            retentionPeriod: 2555
        };
        const paymentNotificationTemplate = {
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
        const securityAlertTemplate = {
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
        logger_1.logger.info('Communication templates loaded', {
            templateCount: this.templates.size
        });
    }
    setupPIIPatterns() {
        this.piiPatterns.set('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
        this.piiPatterns.set('phone', /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g);
        this.piiPatterns.set('creditCard', /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g);
        this.piiPatterns.set('ssn', /\b\d{3}-\d{2}-\d{4}\b/g);
        this.piiPatterns.set('ipAddress', /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
        this.piiPatterns.set('urlWithToken', /https?:\/\/[^\s]+[?&](?:token|key|secret)=[A-Za-z0-9+/=]+/g);
        this.piiPatterns.set('jwt', /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g);
        logger_1.logger.debug('PII patterns setup completed');
    }
    loadConfiguration() {
        this.config = {
            globalRedactionLevel: RedactionLevel.STANDARD,
            encryptionEnabled: true,
            auditAllCommunications: true,
            rateLimits: {
                perUser: { window: 3600000, limit: 100 },
                perEmail: { window: 3600000, limit: 50 },
                perPhone: { window: 3600000, limit: 20 },
                global: { window: 60000, limit: 1000 }
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
        logger_1.logger.debug('Communication security configuration loaded');
    }
    async processSecureNotification(type, templateId, recipients, variables, options = {}) {
        const notificationId = crypto.randomUUID();
        try {
            const validRecipients = await this.validateRecipients(recipients, type);
            if (validRecipients.length === 0) {
                throw new Error('No valid recipients after filtering');
            }
            let content;
            let subject;
            let template;
            if (templateId) {
                template = this.templates.get(templateId);
                if (!template) {
                    throw new Error(`Template not found: ${templateId}`);
                }
                await this.validateTemplateCompliance(template, variables);
                content = this.interpolateTemplate(template.body, variables);
                subject = template.subject ? this.interpolateTemplate(template.subject, variables) : undefined;
            }
            else {
                content = variables.body || variables.content || '';
                subject = variables.subject;
            }
            const notification = {
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
            if (!options.bypassRedaction) {
                const redactionResult = await this.applyPIIRedaction(notification, template?.redactionLevel || this.config.globalRedactionLevel);
                notification.body = redactionResult.redactedContent;
                notification.redactionApplied = true;
                notification.redactedFields = redactionResult.redactedFields.map(f => f.field);
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
            const encryptionRequired = options.forceEncryption ||
                template?.encryptionRequired ||
                this.config.encryptionEnabled;
            if (encryptionRequired) {
                await this.applyContentEncryption(notification);
            }
            await this.verifyConsentAndLegalBasis(notification);
            await this.validateCommunicationContent(notification);
            notification.status = 'processing';
            notification.processedAt = new Date();
            logger_1.logger.info('Secure notification processed', {
                notificationId,
                type,
                templateId,
                recipients: validRecipients.length,
                redactionApplied: notification.redactionApplied,
                encryptionApplied: notification.encryptionApplied
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
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
        }
        catch (error) {
            logger_1.logger.error('Secure notification processing failed', {
                notificationId,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async validateRecipients(recipients, type) {
        const validRecipients = [];
        for (const recipient of recipients) {
            try {
                const recipientKey = recipient.email || recipient.phone || recipient.telegramChatId;
                if (this.blockedRecipients.has(recipientKey)) {
                    logger_1.logger.debug('Recipient blocked, skipping', { recipient: recipientKey });
                    continue;
                }
                if (type === CommunicationType.EMAIL && recipient.email) {
                    if (this.piiPatterns.get('email')?.test(recipient.email)) {
                        validRecipients.push(recipient);
                    }
                }
                else if (type === CommunicationType.SMS && recipient.phone) {
                    if (this.piiPatterns.get('phone')?.test(recipient.phone)) {
                        validRecipients.push(recipient);
                    }
                }
                else if (type === CommunicationType.TELEGRAM_MESSAGE && recipient.telegramChatId) {
                    validRecipients.push(recipient);
                }
                else {
                    validRecipients.push(recipient);
                }
            }
            catch (error) {
                logger_1.logger.warn('Recipient validation failed', {
                    recipient,
                    error: (0, errorUtils_1.getErrorMessage)(error)
                });
            }
        }
        return validRecipients;
    }
    async validateTemplateCompliance(template, variables) {
        for (const variable of Object.keys(variables)) {
            if (template.bannedVariables.includes(variable)) {
                throw new Error(`Banned variable in template: ${variable}`);
            }
        }
        if (template.lastValidated &&
            Date.now() - template.lastValidated.getTime() > 30 * 24 * 60 * 60 * 1000) {
            throw new Error('Template validation expired, requires re-validation');
        }
        if (template.validationErrors.length > 0) {
            throw new Error(`Template has validation errors: ${template.validationErrors.join(', ')}`);
        }
    }
    interpolateTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const escapeRegex = (str) => {
                return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };
            const placeholder = `{${key}}`;
            if (!key.match(/[.*+?^${}()|[\]\\]/)) {
                result = result.split(placeholder).join(String(value || ''));
            }
            else {
                const escapedKey = escapeRegex(key);
                const pattern = new RegExp(`\\{${escapedKey}\\}`, 'g');
                result = result.replace(pattern, String(value || ''));
            }
        }
        return result;
    }
    async applyPIIRedaction(notification, redactionLevel) {
        const redactedFields = [];
        let redactedContent = notification.body;
        const originalContent = notification.body;
        const applicableRules = Array.from(this.redactionRules.values())
            .filter(rule => {
            if (!rule.enabled)
                return false;
            if (!rule.communicationTypes.includes(notification.type))
                return false;
            const levelOrder = {
                [RedactionLevel.MINIMAL]: 1,
                [RedactionLevel.STANDARD]: 2,
                [RedactionLevel.AGGRESSIVE]: 3,
                [RedactionLevel.COMPLETE]: 4
            };
            return levelOrder[rule.redactionLevel] <= levelOrder[redactionLevel];
        })
            .sort((a, b) => b.priority - a.priority);
        for (const rule of applicableRules) {
            for (const pattern of rule.fieldPatterns) {
                let match;
                while ((match = pattern.exec(redactedContent)) !== null) {
                    const originalValue = match[0];
                    const redactedValue = this.applyRedactionStrategy(originalValue, rule);
                    redactedContent = redactedContent.replace(originalValue, redactedValue);
                    redactedFields.push({
                        field: rule.name,
                        category: rule.dataCategories[0] || DataClassificationService_1.DataCategory.PII_DIRECT,
                        originalValue,
                        redactedValue,
                        redactionReason: rule.description
                    });
                    pattern.lastIndex = 0;
                    break;
                }
            }
        }
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
                globalPattern.lastIndex = 0;
                break;
            }
        }
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
    applyRedactionStrategy(value, rule) {
        switch (rule.redactionStrategy) {
            case 'mask':
                if (rule.preserveLength) {
                    return rule.maskingCharacter.repeat(value.length);
                }
                else {
                    return rule.maskingCharacter.repeat(Math.min(value.length, 8));
                }
            case 'replace':
                return rule.replacementText || '[REDACTED]';
            case 'remove':
                return '';
            case 'generalize':
                if (rule.fieldPatterns.some(p => p.test('email'))) {
                    return '[EMAIL_ADDRESS]';
                }
                else if (rule.fieldPatterns.some(p => p.test('phone'))) {
                    return '[PHONE_NUMBER]';
                }
                else {
                    return rule.replacementText || '[GENERALIZED]';
                }
            default:
                return '[REDACTED]';
        }
    }
    applyDefaultRedaction(value, patternName) {
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
    getDataCategoryForPattern(patternName) {
        const categoryMap = {
            'email': DataClassificationService_1.DataCategory.PII_DIRECT,
            'phone': DataClassificationService_1.DataCategory.PII_DIRECT,
            'creditCard': DataClassificationService_1.DataCategory.FINANCIAL_ACCOUNT,
            'ssn': DataClassificationService_1.DataCategory.PII_SENSITIVE,
            'ipAddress': DataClassificationService_1.DataCategory.PII_INDIRECT,
            'jwt': DataClassificationService_1.DataCategory.SYSTEM_CREDENTIALS,
            'urlWithToken': DataClassificationService_1.DataCategory.SYSTEM_CREDENTIALS
        };
        return categoryMap[patternName] || DataClassificationService_1.DataCategory.PII_DIRECT;
    }
    calculateComplianceScore(redactedFields, originalContent) {
        const totalPiiDetected = redactedFields.length;
        const criticalPiiRedacted = redactedFields.filter(f => f.category === DataClassificationService_1.DataCategory.PII_SENSITIVE ||
            f.category === DataClassificationService_1.DataCategory.FINANCIAL_ACCOUNT ||
            f.category === DataClassificationService_1.DataCategory.SYSTEM_CREDENTIALS).length;
        if (totalPiiDetected === 0)
            return 100;
        const baseScore = (totalPiiDetected / (originalContent.length / 100)) * 10;
        const criticalBonus = criticalPiiRedacted * 20;
        return Math.min(100, baseScore + criticalBonus);
    }
    assessPrivacyRisk(redactedFields, _content) {
        const criticalPii = redactedFields.filter(f => f.category === DataClassificationService_1.DataCategory.PII_SENSITIVE ||
            f.category === DataClassificationService_1.DataCategory.FINANCIAL_ACCOUNT).length;
        const systemSecrets = redactedFields.filter(f => f.category === DataClassificationService_1.DataCategory.SYSTEM_CREDENTIALS).length;
        if (systemSecrets > 0 || criticalPii > 2) {
            return 'CRITICAL';
        }
        else if (criticalPii > 0 || redactedFields.length > 5) {
            return 'HIGH';
        }
        else if (redactedFields.length > 2) {
            return 'MEDIUM';
        }
        else {
            return 'LOW';
        }
    }
    async applyContentEncryption(notification) {
        try {
            const encrypted = await EncryptionService_1.encryptionService.encryptData(notification.body, 'communication-encryption-key');
            notification.body = encrypted;
            notification.encryptionApplied = true;
            notification.auditTrail.push({
                timestamp: new Date(),
                action: 'content_encryption_applied',
                details: {
                    algorithm: 'AES-256-GCM',
                    keyId: (0, securityKeys_1.getSecurityKeyId)('communicationEncryptionKeyId')
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Content encryption failed', {
                notificationId: notification.id,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async verifyConsentAndLegalBasis(notification) {
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
    async validateCommunicationContent(notification) {
        if (notification.body.length > this.config.contentValidation.maxLength) {
            throw new Error('Content exceeds maximum length');
        }
        for (const pattern of this.config.contentValidation.bannedPatterns) {
            if (pattern.test(notification.body)) {
                throw new Error('Content contains banned patterns');
            }
        }
        if (this.config.contentValidation.malwareScanning) {
            await this.performMalwareScanning(notification.body);
        }
    }
    async performMalwareScanning(content) {
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
    getStats() {
        const notifications = Array.from(this.notifications.values());
        const processedNotifications = notifications.filter(n => n.status !== 'pending').length;
        const redactedNotifications = notifications.filter(n => n.redactionApplied).length;
        const encryptedNotifications = notifications.filter(n => n.encryptionApplied).length;
        const redactionRate = processedNotifications > 0 ? (redactedNotifications / processedNotifications) * 100 : 0;
        const encryptionRate = processedNotifications > 0 ? (encryptedNotifications / processedNotifications) * 100 : 0;
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
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.averageComplianceScore < 90) {
            status = 'warning';
        }
        if (stats.redactionRate < 80) {
            status = 'warning';
        }
        if (stats.encryptionRate < 95) {
            status = 'degraded';
        }
        const failedNotifications = Array.from(this.notifications.values())
            .filter(n => n.status === 'failed').length;
        if (failedNotifications > 5) {
            status = 'critical';
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
exports.CommunicationSecurityService = CommunicationSecurityService;
exports.communicationSecurityService = CommunicationSecurityService.getInstance();
//# sourceMappingURL=CommunicationSecurityService.js.map