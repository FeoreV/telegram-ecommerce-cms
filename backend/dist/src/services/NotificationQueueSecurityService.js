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
exports.notificationQueueSecurityService = exports.NotificationQueueSecurityService = exports.QueueSecurity = exports.QueueType = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
const EncryptionService_1 = require("./EncryptionService");
const VaultService_1 = require("./VaultService");
const vaultService = (0, VaultService_1.getVaultService)();
var QueueType;
(function (QueueType) {
    QueueType["EMAIL_QUEUE"] = "email_queue";
    QueueType["PUSH_NOTIFICATION_QUEUE"] = "push_notification_queue";
    QueueType["SMS_QUEUE"] = "sms_queue";
    QueueType["TELEGRAM_QUEUE"] = "telegram_queue";
    QueueType["WEBHOOK_QUEUE"] = "webhook_queue";
    QueueType["SYSTEM_ALERT_QUEUE"] = "system_alert_queue";
    QueueType["BATCH_NOTIFICATION_QUEUE"] = "batch_notification_queue";
    QueueType["PRIORITY_QUEUE"] = "priority_queue";
})(QueueType || (exports.QueueType = QueueType = {}));
var QueueSecurity;
(function (QueueSecurity) {
    QueueSecurity["BASIC"] = "basic";
    QueueSecurity["ENHANCED"] = "enhanced";
    QueueSecurity["MAXIMUM"] = "maximum";
})(QueueSecurity || (exports.QueueSecurity = QueueSecurity = {}));
class NotificationQueueSecurityService {
    constructor() {
        this.queueConfigurations = new Map();
        this.queueMetrics = new Map();
        this.templateConfigs = new Map();
        this.activeMessages = new Map();
        this.encryptionKeys = new Map();
        this.compressionEnabled = true;
        this.initializeQueueSecurity();
        this.loadQueueConfigurations();
        this.loadTemplateConfigurations();
        this.startSecurityMonitoring();
        logger_1.logger.info('Notification Queue Security Service initialized', {
            queues: this.queueConfigurations.size,
            templates: this.templateConfigs.size,
            encryptionKeys: this.encryptionKeys.size
        });
    }
    static getInstance() {
        if (!NotificationQueueSecurityService.instance) {
            NotificationQueueSecurityService.instance = new NotificationQueueSecurityService();
        }
        return NotificationQueueSecurityService.instance;
    }
    async initializeQueueSecurity() {
        try {
            await this.initializeQueueEncryptionKeys();
            await this.setupQueueMonitoring();
            await this.initializeMetricsCollection();
            logger_1.logger.info('Queue security initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize queue security:', err);
            throw err;
        }
    }
    async initializeQueueEncryptionKeys() {
        const queueTypes = Object.values(QueueType);
        for (const queueType of queueTypes) {
            const keyId = `notification-queue-${queueType}`;
            let keyValue = await vaultService.getSecret(`queue-encryption-keys/${keyId}`);
            if (!keyValue) {
                const keyBuffer = crypto.randomBytes(32);
                keyValue = keyBuffer.toString('base64');
                await vaultService.putSecret(`queue-encryption-keys/${keyId}`, { key: keyValue });
                logger_1.logger.info(`Generated new queue encryption key: ${keyId}`);
            }
            this.encryptionKeys.set(keyId, {
                keyId,
                keyValue,
                algorithm: 'AES-256-GCM',
                createdAt: new Date(),
                rotationInterval: 24
            });
        }
        logger_1.logger.info('Queue encryption keys initialized');
    }
    async setupQueueMonitoring() {
        logger_1.logger.debug('Queue monitoring setup completed');
    }
    async initializeMetricsCollection() {
        for (const queueType of Object.values(QueueType)) {
            this.queueMetrics.set(queueType, {
                queueType,
                messagesProduced: 0,
                messagesConsumed: 0,
                messagesInQueue: 0,
                deadLetterMessages: 0,
                averageProcessingTime: 0,
                throughputPerMinute: 0,
                errorRate: 0,
                encryptionRate: 0,
                integrityFailures: 0,
                unauthorizedAccess: 0,
                auditEvents: 0,
                piiMessages: 0,
                retentionViolations: 0,
                complianceScore: 100,
                periodStart: new Date(),
                periodEnd: new Date()
            });
        }
        logger_1.logger.debug('Metrics collection initialized');
    }
    loadQueueConfigurations() {
        const emailQueueConfig = {
            id: 'email-queue-config',
            name: 'Email Notification Queue',
            type: QueueType.EMAIL_QUEUE,
            securityLevel: QueueSecurity.ENHANCED,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-email_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 24,
            maxMessageSize: 1048576,
            messageRetention: 72,
            deadLetterQueue: true,
            allowedProducers: ['email-service', 'notification-service'],
            allowedConsumers: ['email-worker'],
            requireAuthentication: true,
            maxThroughput: 1000,
            burstCapacity: 2000,
            gdprCompliant: true,
            ccpaCompliant: true,
            hipaaCompliant: false,
            auditRetention: 2555
        };
        const pushQueueConfig = {
            id: 'push-notification-queue-config',
            name: 'Push Notification Queue',
            type: QueueType.PUSH_NOTIFICATION_QUEUE,
            securityLevel: QueueSecurity.ENHANCED,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-push_notification_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 24,
            maxMessageSize: 4096,
            messageRetention: 24,
            deadLetterQueue: true,
            allowedProducers: ['push-service', 'notification-service'],
            allowedConsumers: ['push-worker'],
            requireAuthentication: true,
            maxThroughput: 5000,
            burstCapacity: 10000,
            gdprCompliant: true,
            ccpaCompliant: true,
            hipaaCompliant: false,
            auditRetention: 365
        };
        const telegramQueueConfig = {
            id: 'telegram-queue-config',
            name: 'Telegram Notification Queue',
            type: QueueType.TELEGRAM_QUEUE,
            securityLevel: QueueSecurity.MAXIMUM,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-telegram_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 12,
            maxMessageSize: 4096,
            messageRetention: 48,
            deadLetterQueue: true,
            allowedProducers: ['telegram-service', 'bot-service'],
            allowedConsumers: ['telegram-worker'],
            requireAuthentication: true,
            maxThroughput: 2000,
            burstCapacity: 4000,
            gdprCompliant: true,
            ccpaCompliant: true,
            hipaaCompliant: false,
            auditRetention: 2555
        };
        const webhookQueueConfig = {
            id: 'webhook-queue-config',
            name: 'Webhook Notification Queue',
            type: QueueType.WEBHOOK_QUEUE,
            securityLevel: QueueSecurity.MAXIMUM,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-webhook_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 24,
            maxMessageSize: 1048576,
            messageRetention: 168,
            deadLetterQueue: true,
            allowedProducers: ['webhook-service', 'integration-service'],
            allowedConsumers: ['webhook-worker'],
            requireAuthentication: true,
            maxThroughput: 500,
            burstCapacity: 1000,
            gdprCompliant: true,
            ccpaCompliant: true,
            hipaaCompliant: true,
            auditRetention: 2555
        };
        const systemAlertQueueConfig = {
            id: 'system-alert-queue-config',
            name: 'System Alert Queue',
            type: QueueType.SYSTEM_ALERT_QUEUE,
            securityLevel: QueueSecurity.MAXIMUM,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-system_alert_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 6,
            maxMessageSize: 65536,
            messageRetention: 720,
            deadLetterQueue: true,
            allowedProducers: ['monitoring-service', 'security-service'],
            allowedConsumers: ['alert-worker', 'siem-worker'],
            requireAuthentication: true,
            maxThroughput: 10000,
            burstCapacity: 20000,
            gdprCompliant: false,
            ccpaCompliant: false,
            hipaaCompliant: false,
            auditRetention: 2555
        };
        const priorityQueueConfig = {
            id: 'priority-queue-config',
            name: 'Priority Notification Queue',
            type: QueueType.PRIORITY_QUEUE,
            securityLevel: QueueSecurity.MAXIMUM,
            encryptionRequired: true,
            integrityCheckRequired: true,
            auditRequired: true,
            encryptionKeyId: 'notification-queue-priority_queue',
            encryptionAlgorithm: 'AES-256-GCM',
            keyRotationInterval: 12,
            maxMessageSize: 1048576,
            messageRetention: 168,
            deadLetterQueue: true,
            allowedProducers: ['emergency-service', 'security-service'],
            allowedConsumers: ['priority-worker'],
            requireAuthentication: true,
            maxThroughput: 100,
            burstCapacity: 500,
            gdprCompliant: true,
            ccpaCompliant: true,
            hipaaCompliant: true,
            auditRetention: 2555
        };
        this.queueConfigurations.set(QueueType.EMAIL_QUEUE, emailQueueConfig);
        this.queueConfigurations.set(QueueType.PUSH_NOTIFICATION_QUEUE, pushQueueConfig);
        this.queueConfigurations.set(QueueType.TELEGRAM_QUEUE, telegramQueueConfig);
        this.queueConfigurations.set(QueueType.WEBHOOK_QUEUE, webhookQueueConfig);
        this.queueConfigurations.set(QueueType.SYSTEM_ALERT_QUEUE, systemAlertQueueConfig);
        this.queueConfigurations.set(QueueType.PRIORITY_QUEUE, priorityQueueConfig);
        logger_1.logger.info('Queue configurations loaded', {
            queueCount: this.queueConfigurations.size
        });
    }
    loadTemplateConfigurations() {
        const orderConfirmationTemplateConfig = {
            templateId: 'order-confirmation',
            encryptionRequired: true,
            encryptionKeyId: 'template-encryption-key',
            allowedVariables: ['orderId', 'customerName', 'orderTotal', 'itemCount', 'deliveryAddress'],
            bannedPatterns: [
                /<script.*?>.*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi
            ],
            maxSize: 10240,
            containsPII: true,
            piiFields: ['customerName', 'deliveryAddress'],
            redactionRequired: false,
            allowedRoles: ['customer_service', 'order_manager'],
            requireApproval: false,
            version: '1.0',
            lastModified: new Date(),
            modifiedBy: 'system',
            approved: true,
            approvedBy: 'template_admin',
            approvedAt: new Date(),
            gdprCompliant: true,
            ccpaCompliant: true,
            retentionPeriod: 2555
        };
        const securityAlertTemplateConfig = {
            templateId: 'security-alert',
            encryptionRequired: true,
            encryptionKeyId: 'template-encryption-key',
            allowedVariables: ['timestamp', 'location', 'ipAddress', 'deviceInfo', 'alertType'],
            bannedPatterns: [
                /<script.*?>.*?<\/script>/gi,
                /javascript:/gi,
                /vbscript:/gi
            ],
            maxSize: 8192,
            containsPII: true,
            piiFields: ['ipAddress', 'location'],
            redactionRequired: false,
            allowedRoles: ['security_admin', 'incident_responder'],
            requireApproval: true,
            version: '1.0',
            lastModified: new Date(),
            modifiedBy: 'security_team',
            approved: true,
            approvedBy: 'security_admin',
            approvedAt: new Date(),
            gdprCompliant: true,
            ccpaCompliant: true,
            retentionPeriod: 365
        };
        const paymentNotificationTemplateConfig = {
            templateId: 'payment-notification',
            encryptionRequired: true,
            encryptionKeyId: 'template-encryption-key',
            allowedVariables: ['amount', 'orderId', 'paymentMethod', 'timestamp'],
            bannedPatterns: [
                /card_number|cardNumber/gi,
                /cvv|cvc/gi,
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
            ],
            maxSize: 4096,
            containsPII: false,
            piiFields: [],
            redactionRequired: false,
            allowedRoles: ['payment_processor', 'finance_admin'],
            requireApproval: true,
            version: '1.0',
            lastModified: new Date(),
            modifiedBy: 'payment_team',
            approved: true,
            approvedBy: 'finance_admin',
            approvedAt: new Date(),
            gdprCompliant: true,
            ccpaCompliant: true,
            retentionPeriod: 90
        };
        this.templateConfigs.set('order-confirmation', orderConfirmationTemplateConfig);
        this.templateConfigs.set('security-alert', securityAlertTemplateConfig);
        this.templateConfigs.set('payment-notification', paymentNotificationTemplateConfig);
        logger_1.logger.info('Template configurations loaded', {
            templateCount: this.templateConfigs.size
        });
    }
    async enqueueSecureMessage(queueType, payload, options = {}) {
        const messageId = crypto.randomUUID();
        try {
            const config = this.queueConfigurations.get(queueType);
            if (!config) {
                throw new Error(`Queue configuration not found: ${queueType}`);
            }
            const payloadString = JSON.stringify(payload);
            if (payloadString.length > config.maxMessageSize) {
                throw new Error(`Message exceeds maximum size: ${payloadString.length} > ${config.maxMessageSize}`);
            }
            if (config.requireAuthentication && options.producerId) {
                if (!config.allowedProducers.includes(options.producerId)) {
                    throw new Error(`Unauthorized producer: ${options.producerId}`);
                }
            }
            let finalPayload = payloadString;
            let compressedSize;
            if (this.compressionEnabled && payloadString.length > 1024) {
                finalPayload = payloadString;
                compressedSize = finalPayload.length;
            }
            let encryptedPayload = finalPayload;
            let encryptionKeyId = '';
            if (config.encryptionRequired) {
                const keyInfo = this.encryptionKeys.get(config.encryptionKeyId);
                if (!keyInfo) {
                    throw new Error(`Encryption key not found: ${config.encryptionKeyId}`);
                }
                const encrypted = await EncryptionService_1.encryptionService.encryptData(finalPayload, config.encryptionKeyId);
                encryptedPayload = encrypted;
                encryptionKeyId = config.encryptionKeyId;
            }
            const integrityHash = crypto.createHash('sha256')
                .update(encryptedPayload)
                .digest('hex');
            let digitalSignature;
            if (config.securityLevel === QueueSecurity.MAXIMUM) {
                digitalSignature = crypto.createHmac('sha256', encryptionKeyId)
                    .update(encryptedPayload + integrityHash)
                    .digest('hex');
            }
            const secureMessage = {
                id: messageId,
                queueType,
                payload: encryptedPayload,
                originalSize: payloadString.length,
                compressedSize,
                encrypted: config.encryptionRequired,
                encryptionKeyId,
                integrityHash,
                digitalSignature,
                priority: options.priority || 5,
                createdAt: new Date(),
                expiresAt: options.expiresAt,
                retryCount: 0,
                maxRetries: options.maxRetries || 3,
                producerId: options.producerId || 'unknown',
                correlationId: options.correlationId,
                auditTrail: [],
                containsPII: options.containsPII || false,
                dataClassification: options.dataClassification || 'internal',
                retentionPolicy: `${config.messageRetention}h`
            };
            secureMessage.auditTrail.push({
                timestamp: new Date(),
                action: 'message_enqueued',
                actor: options.producerId || 'system',
                details: {
                    queueType,
                    encrypted: secureMessage.encrypted,
                    priority: secureMessage.priority,
                    containsPII: secureMessage.containsPII
                }
            });
            this.activeMessages.set(messageId, secureMessage);
            const metrics = this.queueMetrics.get(queueType);
            if (metrics) {
                metrics.messagesProduced++;
                metrics.messagesInQueue++;
                if (secureMessage.encrypted) {
                    metrics.encryptionRate = (metrics.messagesProduced > 0)
                        ? (metrics.encryptionRate * (metrics.messagesProduced - 1) + 100) / metrics.messagesProduced
                        : 100;
                }
                if (secureMessage.containsPII) {
                    metrics.piiMessages++;
                }
            }
            logger_1.logger.info('Secure message enqueued', {
                messageId,
                queueType,
                encrypted: secureMessage.encrypted,
                priority: secureMessage.priority,
                originalSize: secureMessage.originalSize,
                compressedSize: secureMessage.compressedSize
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'secure_message_enqueued',
                severity: 'LOW',
                category: 'network',
                ipAddress: 'localhost',
                success: true,
                details: {
                    messageId,
                    queueType,
                    encrypted: secureMessage.encrypted,
                    originalSize: secureMessage.originalSize,
                    containsPII: secureMessage.containsPII,
                    producerId: options.producerId
                },
                riskScore: secureMessage.containsPII ? 20 : 5,
                tags: ['queue_security', 'message_encryption', 'notification'],
                compliance: {
                    pii: secureMessage.containsPII,
                    gdpr: config.gdprCompliant,
                    pci: false,
                    hipaa: config.hipaaCompliant
                }
            });
            return messageId;
        }
        catch (err) {
            logger_1.logger.error('Secure message enqueue failed', {
                messageId,
                queueType,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            throw err;
        }
    }
    async dequeueSecureMessage(queueType, consumerId) {
        try {
            const config = this.queueConfigurations.get(queueType);
            if (!config) {
                throw new Error(`Queue configuration not found: ${queueType}`);
            }
            if (config.requireAuthentication) {
                if (!config.allowedConsumers.includes(consumerId)) {
                    throw new Error(`Unauthorized consumer: ${consumerId}`);
                }
            }
            const messages = Array.from(this.activeMessages.values())
                .filter(msg => msg.queueType === queueType)
                .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                return a.createdAt.getTime() - b.createdAt.getTime();
            });
            if (messages.length === 0) {
                return null;
            }
            const message = messages[0];
            if (message.expiresAt && message.expiresAt < new Date()) {
                this.activeMessages.delete(message.id);
                logger_1.logger.debug('Expired message removed from queue', { messageId: message.id });
                return null;
            }
            if (config.integrityCheckRequired) {
                const calculatedHash = crypto.createHash('sha256')
                    .update(message.payload)
                    .digest('hex');
                if (calculatedHash !== message.integrityHash) {
                    await this.moveToDeadLetterQueue(message, 'integrity_check_failed');
                    const metrics = this.queueMetrics.get(queueType);
                    if (metrics) {
                        metrics.integrityFailures++;
                    }
                    throw new Error('Message integrity check failed');
                }
            }
            if (config.securityLevel === QueueSecurity.MAXIMUM && message.digitalSignature) {
                const expectedSignature = crypto.createHmac('sha256', message.encryptionKeyId)
                    .update(message.payload + message.integrityHash)
                    .digest('hex');
                if (expectedSignature !== message.digitalSignature) {
                    await this.moveToDeadLetterQueue(message, 'signature_verification_failed');
                    throw new Error('Message signature verification failed');
                }
            }
            let decryptedPayload = message.payload;
            if (message.encrypted) {
                try {
                    decryptedPayload = await EncryptionService_1.encryptionService.decryptData(message.payload, message.encryptionKeyId);
                }
                catch (err) {
                    await this.moveToDeadLetterQueue(message, 'decryption_failed');
                    throw new Error(`Message decryption failed: ${(0, errorUtils_1.getErrorMessage)(err)}`);
                }
            }
            let finalPayload = decryptedPayload;
            if (message.compressedSize) {
                finalPayload = decryptedPayload;
            }
            let parsedPayload;
            try {
                parsedPayload = JSON.parse(finalPayload);
            }
            catch (error) {
                await this.moveToDeadLetterQueue(message, 'json_parse_failed');
                throw new Error('Failed to parse message payload');
            }
            message.consumerId = consumerId;
            message.auditTrail.push({
                timestamp: new Date(),
                action: 'message_dequeued',
                actor: consumerId,
                details: {
                    queueType,
                    messageAge: Date.now() - message.createdAt.getTime()
                }
            });
            this.activeMessages.delete(message.id);
            const metrics = this.queueMetrics.get(queueType);
            if (metrics) {
                metrics.messagesConsumed++;
                metrics.messagesInQueue--;
                const processingTime = Date.now() - message.createdAt.getTime();
                metrics.averageProcessingTime = metrics.messagesConsumed > 1
                    ? (metrics.averageProcessingTime * (metrics.messagesConsumed - 1) + processingTime) / metrics.messagesConsumed
                    : processingTime;
            }
            logger_1.logger.info('Secure message dequeued', {
                messageId: message.id,
                queueType,
                consumerId,
                processingTime: Date.now() - message.createdAt.getTime()
            });
            return {
                messageId: message.id,
                payload: parsedPayload,
                metadata: {
                    priority: message.priority,
                    createdAt: message.createdAt,
                    correlationId: message.correlationId,
                    containsPII: message.containsPII,
                    dataClassification: message.dataClassification
                }
            };
        }
        catch (err) {
            logger_1.logger.error('Secure message dequeue failed', {
                queueType,
                consumerId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            throw err;
        }
    }
    async moveToDeadLetterQueue(message, reason) {
        message.auditTrail.push({
            timestamp: new Date(),
            action: 'moved_to_dead_letter_queue',
            actor: 'system',
            details: { reason }
        });
        const metrics = this.queueMetrics.get(message.queueType);
        if (metrics) {
            metrics.deadLetterMessages++;
            metrics.messagesInQueue--;
        }
        this.activeMessages.delete(message.id);
        logger_1.logger.warn('Message moved to dead letter queue', {
            messageId: message.id,
            queueType: message.queueType,
            reason
        });
    }
    async encryptTemplate(templateId, templateContent, variables = {}) {
        try {
            const templateConfig = this.templateConfigs.get(templateId);
            if (!templateConfig) {
                throw new Error(`Template configuration not found: ${templateId}`);
            }
            for (const variable of Object.keys(variables)) {
                if (!templateConfig.allowedVariables.includes(variable)) {
                    throw new Error(`Unauthorized template variable: ${variable}`);
                }
            }
            for (const pattern of templateConfig.bannedPatterns) {
                if (pattern.test(templateContent)) {
                    throw new Error('Template content contains banned patterns');
                }
            }
            if (templateContent.length > templateConfig.maxSize) {
                throw new Error(`Template exceeds maximum size: ${templateContent.length} > ${templateConfig.maxSize}`);
            }
            let encryptedContent = templateContent;
            let encryptionKeyId = '';
            if (templateConfig.encryptionRequired) {
                const encrypted = await EncryptionService_1.encryptionService.encryptData(templateContent, templateConfig.encryptionKeyId);
                encryptedContent = encrypted;
                encryptionKeyId = templateConfig.encryptionKeyId;
            }
            const integrityHash = crypto.createHash('sha256')
                .update(encryptedContent)
                .digest('hex');
            const metadata = {
                templateId,
                version: templateConfig.version,
                containsPII: templateConfig.containsPII,
                piiFields: templateConfig.piiFields,
                encryptedAt: new Date(),
                gdprCompliant: templateConfig.gdprCompliant,
                ccpaCompliant: templateConfig.ccpaCompliant
            };
            logger_1.logger.info('Template encrypted', {
                templateId,
                encrypted: templateConfig.encryptionRequired,
                containsPII: templateConfig.containsPII,
                originalSize: templateContent.length
            });
            return {
                encryptedContent,
                encryptionKeyId,
                integrityHash,
                metadata
            };
        }
        catch (err) {
            logger_1.logger.error('Template encryption failed', {
                templateId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            throw err;
        }
    }
    async rotateQueueKeys(queueType) {
        const queuesToRotate = queueType
            ? [queueType]
            : Object.values(QueueType);
        for (const queue of queuesToRotate) {
            try {
                const config = this.queueConfigurations.get(queue);
                if (!config)
                    continue;
                const keyInfo = this.encryptionKeys.get(config.encryptionKeyId);
                if (!keyInfo)
                    continue;
                const hoursElapsed = (Date.now() - keyInfo.createdAt.getTime()) / (1000 * 60 * 60);
                if (hoursElapsed < keyInfo.rotationInterval) {
                    continue;
                }
                const newKeyBuffer = crypto.randomBytes(32);
                const newKeyValue = newKeyBuffer.toString('base64');
                const newKeyId = `${config.encryptionKeyId}-${Date.now()}`;
                await vaultService.putSecret(`queue-encryption-keys/${newKeyId}`, { key: newKeyValue });
                this.encryptionKeys.set(config.encryptionKeyId, {
                    keyId: newKeyId,
                    keyValue: newKeyValue,
                    algorithm: 'AES-256-GCM',
                    createdAt: new Date(),
                    rotationInterval: keyInfo.rotationInterval
                });
                config.encryptionKeyId = newKeyId;
                logger_1.logger.info('Queue encryption key rotated', {
                    queueType: queue,
                    newKeyId,
                    rotationInterval: keyInfo.rotationInterval
                });
                await SecurityLogService_1.securityLogService.logSecurityEvent({
                    eventType: 'queue_encryption_key_rotated',
                    severity: 'LOW',
                    category: 'system',
                    ipAddress: 'localhost',
                    success: true,
                    details: {
                        queueType: queue,
                        newKeyId,
                        rotationInterval: keyInfo.rotationInterval
                    },
                    riskScore: 5,
                    tags: ['key_rotation', 'queue_security', 'encryption'],
                    compliance: {
                        pii: false,
                        gdpr: false,
                        pci: false,
                        hipaa: false
                    }
                });
            }
            catch (err) {
                logger_1.logger.error('Queue key rotation failed', {
                    queueType: queue,
                    error: (0, errorUtils_1.getErrorMessage)(err)
                });
            }
        }
    }
    startSecurityMonitoring() {
        setInterval(() => {
            this.rotateQueueKeys().catch((err) => {
                logger_1.logger.error('Automated key rotation failed:', err);
            });
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.updateMetrics();
        }, 60 * 1000);
        logger_1.logger.info('Queue security monitoring started');
    }
    updateMetrics() {
        const now = new Date();
        for (const metrics of this.queueMetrics.values()) {
            const minutesElapsed = (now.getTime() - metrics.periodStart.getTime()) / (1000 * 60);
            if (minutesElapsed > 0) {
                metrics.throughputPerMinute = metrics.messagesProduced / minutesElapsed;
            }
            const totalMessages = metrics.messagesProduced;
            if (totalMessages > 0) {
                const complianceFactors = [
                    metrics.encryptionRate / 100,
                    1 - (metrics.integrityFailures / totalMessages),
                    1 - (metrics.unauthorizedAccess / totalMessages),
                    1 - (metrics.retentionViolations / totalMessages)
                ];
                metrics.complianceScore = complianceFactors.reduce((sum, factor) => sum + factor, 0) / complianceFactors.length * 100;
            }
            metrics.periodEnd = now;
        }
    }
    getStats() {
        const allMetrics = Array.from(this.queueMetrics.values());
        const totalMessagesProduced = allMetrics.reduce((sum, m) => sum + m.messagesProduced, 0);
        const totalMessagesConsumed = allMetrics.reduce((sum, m) => sum + m.messagesConsumed, 0);
        const averageEncryptionRate = allMetrics.length > 0
            ? allMetrics.reduce((sum, m) => sum + m.encryptionRate, 0) / allMetrics.length
            : 0;
        const averageComplianceScore = allMetrics.length > 0
            ? allMetrics.reduce((sum, m) => sum + m.complianceScore, 0) / allMetrics.length
            : 100;
        return {
            queues: this.queueConfigurations.size,
            templates: this.templateConfigs.size,
            activeMessages: this.activeMessages.size,
            totalMessagesProduced,
            totalMessagesConsumed,
            averageEncryptionRate,
            averageComplianceScore,
            keyRotations: this.encryptionKeys.size
        };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.averageComplianceScore < 95) {
            status = 'warning';
        }
        if (stats.averageEncryptionRate < 99) {
            status = 'warning';
        }
        if (stats.activeMessages > 10000) {
            status = 'degraded';
        }
        const integrityFailures = Array.from(this.queueMetrics.values())
            .reduce((sum, m) => sum + m.integrityFailures, 0);
        if (integrityFailures > 0) {
            status = 'critical';
        }
        return {
            status,
            stats: {
                ...stats,
                integrityFailures
            }
        };
    }
}
exports.NotificationQueueSecurityService = NotificationQueueSecurityService;
exports.notificationQueueSecurityService = NotificationQueueSecurityService.getInstance();
//# sourceMappingURL=NotificationQueueSecurityService.js.map