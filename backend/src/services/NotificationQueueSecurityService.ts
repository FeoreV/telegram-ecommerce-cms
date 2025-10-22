import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';
import { encryptionService } from './EncryptionService';
import { getVaultService } from './VaultService';
const vaultService = getVaultService();

export enum QueueType {
  EMAIL_QUEUE = 'email_queue',
  PUSH_NOTIFICATION_QUEUE = 'push_notification_queue',
  SMS_QUEUE = 'sms_queue',
  TELEGRAM_QUEUE = 'telegram_queue',
  WEBHOOK_QUEUE = 'webhook_queue',
  SYSTEM_ALERT_QUEUE = 'system_alert_queue',
  BATCH_NOTIFICATION_QUEUE = 'batch_notification_queue',
  PRIORITY_QUEUE = 'priority_queue'
}

export enum QueueSecurity {
  BASIC = 'basic',           // Standard encryption
  ENHANCED = 'enhanced',     // Enhanced encryption + integrity
  MAXIMUM = 'maximum'        // Maximum security + audit
}

export interface QueueConfiguration {
  id: string;
  name: string;
  type: QueueType;
  
  // Security settings
  securityLevel: QueueSecurity;
  encryptionRequired: boolean;
  integrityCheckRequired: boolean;
  auditRequired: boolean;
  
  // Encryption configuration
  encryptionKeyId: string;
  encryptionAlgorithm: string;
  keyRotationInterval: number; // hours
  
  // Queue settings
  maxMessageSize: number;
  messageRetention: number; // hours
  deadLetterQueue: boolean;
  
  // Access control
  allowedProducers: string[];
  allowedConsumers: string[];
  requireAuthentication: boolean;
  
  // Rate limiting
  maxThroughput: number; // messages per minute
  burstCapacity: number;
  
  // Compliance
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  hipaaCompliant: boolean;
  auditRetention: number; // days
}

export interface SecureMessage {
  id: string;
  queueType: QueueType;
  
  // Content
  payload: string; // encrypted
  originalSize: number;
  compressedSize?: number;
  
  // Security metadata
  encrypted: boolean;
  encryptionKeyId: string;
  integrityHash: string;
  digitalSignature?: string;
  
  // Message metadata
  priority: number;
  createdAt: Date;
  expiresAt?: Date;
  retryCount: number;
  maxRetries: number;
  
  // Routing
  producerId: string;
  consumerId?: string;
  correlationId?: string;
  
  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
  }[];
  
  // Compliance
  containsPII: boolean;
  dataClassification: string;
  retentionPolicy: string;
}

export interface QueueMetrics {
  queueType: QueueType;
  
  // Volume metrics
  messagesProduced: number;
  messagesConsumed: number;
  messagesInQueue: number;
  deadLetterMessages: number;
  
  // Performance metrics
  averageProcessingTime: number;
  throughputPerMinute: number;
  errorRate: number;
  
  // Security metrics
  encryptionRate: number;
  integrityFailures: number;
  unauthorizedAccess: number;
  auditEvents: number;
  
  // Compliance metrics
  piiMessages: number;
  retentionViolations: number;
  complianceScore: number;
  
  // Time range
  periodStart: Date;
  periodEnd: Date;
}

export interface TemplateSecurityConfig {
  templateId: string;
  encryptionRequired: boolean;
  encryptionKeyId: string;
  
  // Content validation
  allowedVariables: string[];
  bannedPatterns: RegExp[];
  maxSize: number;
  
  // PII handling
  containsPII: boolean;
  piiFields: string[];
  redactionRequired: boolean;
  
  // Access control
  allowedRoles: string[];
  requireApproval: boolean;
  
  // Versioning and audit
  version: string;
  lastModified: Date;
  modifiedBy: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Compliance
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  retentionPeriod: number;
}

export class NotificationQueueSecurityService {
  private static instance: NotificationQueueSecurityService;
  private queueConfigurations: Map<QueueType, QueueConfiguration> = new Map();
  private queueMetrics: Map<QueueType, QueueMetrics> = new Map();
  private templateConfigs: Map<string, TemplateSecurityConfig> = new Map();
  private activeMessages: Map<string, SecureMessage> = new Map();
  private encryptionKeys: Map<string, unknown> = new Map();
  private compressionEnabled: boolean = true;

  private constructor() {
    this.initializeQueueSecurity();
    this.loadQueueConfigurations();
    this.loadTemplateConfigurations();
    this.startSecurityMonitoring();

    logger.info('Notification Queue Security Service initialized', {
      queues: this.queueConfigurations.size,
      templates: this.templateConfigs.size,
      encryptionKeys: this.encryptionKeys.size
    });
  }

  public static getInstance(): NotificationQueueSecurityService {
    if (!NotificationQueueSecurityService.instance) {
      NotificationQueueSecurityService.instance = new NotificationQueueSecurityService();
    }
    return NotificationQueueSecurityService.instance;
  }

  private async initializeQueueSecurity(): Promise<void> {
    try {
      // Initialize encryption keys for queues
      await this.initializeQueueEncryptionKeys();
      
      // Setup queue monitoring
      await this.setupQueueMonitoring();
      
      // Initialize metrics collection
      await this.initializeMetricsCollection();

      logger.info('Queue security initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize queue security:', err as Record<string, unknown>);
      throw err;
    }
  }

  private async initializeQueueEncryptionKeys(): Promise<void> {
    const queueTypes = Object.values(QueueType);
    
    for (const queueType of queueTypes) {
      const keyId = `notification-queue-${queueType}`;
      
      let keyValue = await vaultService.getSecret(`queue-encryption-keys/${keyId}`);
      
      if (!keyValue) {
        // Generate new encryption key
        const keyBuffer = crypto.randomBytes(32); // 256-bit key
        keyValue = keyBuffer.toString('base64') as any;
        
        await vaultService.putSecret(`queue-encryption-keys/${keyId}`, { key: keyValue });
        
        logger.info(`Generated new queue encryption key: ${keyId}`);
      }

      this.encryptionKeys.set(keyId, {
        keyId,
        keyValue,
        algorithm: 'AES-256-GCM',
        createdAt: new Date(),
        rotationInterval: 24 // hours
      });
    }

    logger.info('Queue encryption keys initialized');
  }

  private async setupQueueMonitoring(): Promise<void> {
    // Setup monitoring for queue security events
    logger.debug('Queue monitoring setup completed');
  }

  private async initializeMetricsCollection(): Promise<void> {
    // Initialize metrics collection for all queue types
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

    logger.debug('Metrics collection initialized');
  }

  private loadQueueConfigurations(): void {
    // Email queue configuration
    const emailQueueConfig: QueueConfiguration = {
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
      maxMessageSize: 1048576, // 1MB
      messageRetention: 72, // 3 days
      deadLetterQueue: true,
      allowedProducers: ['email-service', 'notification-service'],
      allowedConsumers: ['email-worker'],
      requireAuthentication: true,
      maxThroughput: 1000, // messages per minute
      burstCapacity: 2000,
      gdprCompliant: true,
      ccpaCompliant: true,
      hipaaCompliant: false,
      auditRetention: 2555 // 7 years
    };

    // Push notification queue configuration
    const pushQueueConfig: QueueConfiguration = {
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
      maxMessageSize: 4096, // 4KB for push notifications
      messageRetention: 24, // 1 day
      deadLetterQueue: true,
      allowedProducers: ['push-service', 'notification-service'],
      allowedConsumers: ['push-worker'],
      requireAuthentication: true,
      maxThroughput: 5000, // messages per minute
      burstCapacity: 10000,
      gdprCompliant: true,
      ccpaCompliant: true,
      hipaaCompliant: false,
      auditRetention: 365
    };

    // Telegram queue configuration
    const telegramQueueConfig: QueueConfiguration = {
      id: 'telegram-queue-config',
      name: 'Telegram Notification Queue',
      type: QueueType.TELEGRAM_QUEUE,
      securityLevel: QueueSecurity.MAXIMUM,
      encryptionRequired: true,
      integrityCheckRequired: true,
      auditRequired: true,
      encryptionKeyId: 'notification-queue-telegram_queue',
      encryptionAlgorithm: 'AES-256-GCM',
      keyRotationInterval: 12, // More frequent rotation for Telegram
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

    // Webhook queue configuration
    const webhookQueueConfig: QueueConfiguration = {
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
      maxMessageSize: 1048576, // 1MB
      messageRetention: 168, // 7 days
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

    // System alert queue configuration
    const systemAlertQueueConfig: QueueConfiguration = {
      id: 'system-alert-queue-config',
      name: 'System Alert Queue',
      type: QueueType.SYSTEM_ALERT_QUEUE,
      securityLevel: QueueSecurity.MAXIMUM,
      encryptionRequired: true,
      integrityCheckRequired: true,
      auditRequired: true,
      encryptionKeyId: 'notification-queue-system_alert_queue',
      encryptionAlgorithm: 'AES-256-GCM',
      keyRotationInterval: 6, // Very frequent rotation for system alerts
      maxMessageSize: 65536, // 64KB
      messageRetention: 720, // 30 days
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

    // Priority queue configuration
    const priorityQueueConfig: QueueConfiguration = {
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

    logger.info('Queue configurations loaded', {
      queueCount: this.queueConfigurations.size
    });
  }

  private loadTemplateConfigurations(): void {
    // Order confirmation template config
    const orderConfirmationTemplateConfig: TemplateSecurityConfig = {
      templateId: 'order-confirmation',
      encryptionRequired: true,
      encryptionKeyId: 'template-encryption-key',
      allowedVariables: ['orderId', 'customerName', 'orderTotal', 'itemCount', 'deliveryAddress'],
      bannedPatterns: [
        /<script.*?>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
      ],
      maxSize: 10240, // 10KB
      containsPII: true,
      piiFields: ['customerName', 'deliveryAddress'],
      redactionRequired: false, // Business necessity
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
      retentionPeriod: 2555 // 7 years
    };

    // Security alert template config
    const securityAlertTemplateConfig: TemplateSecurityConfig = {
      templateId: 'security-alert',
      encryptionRequired: true,
      encryptionKeyId: 'template-encryption-key',
      allowedVariables: ['timestamp', 'location', 'ipAddress', 'deviceInfo', 'alertType'],
      bannedPatterns: [
        /<script.*?>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi
      ],
      maxSize: 8192, // 8KB
      containsPII: true,
      piiFields: ['ipAddress', 'location'],
      redactionRequired: false, // Security necessity
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

    // Payment notification template config
    const paymentNotificationTemplateConfig: TemplateSecurityConfig = {
      templateId: 'payment-notification',
      encryptionRequired: true,
      encryptionKeyId: 'template-encryption-key',
      allowedVariables: ['amount', 'orderId', 'paymentMethod', 'timestamp'],
      bannedPatterns: [
        /card_number|cardNumber/gi,
        /cvv|cvc/gi,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
      ],
      maxSize: 4096, // 4KB
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

    logger.info('Template configurations loaded', {
      templateCount: this.templateConfigs.size
    });
  }

  /**
   * Securely enqueue message
   */
  async enqueueSecureMessage(
    queueType: QueueType,
    payload: any,
    options: {
      priority?: number;
      correlationId?: string;
      expiresAt?: Date;
      maxRetries?: number;
      producerId?: string;
      containsPII?: boolean;
      dataClassification?: string;
    } = {}
  ): Promise<string> {
    const messageId = crypto.randomUUID();
    
    try {
      const config = this.queueConfigurations.get(queueType);
      if (!config) {
        throw new Error(`Queue configuration not found: ${queueType}`);
      }

      // Validate payload size
      const payloadString = JSON.stringify(payload);
      if (payloadString.length > config.maxMessageSize) {
        throw new Error(`Message exceeds maximum size: ${payloadString.length} > ${config.maxMessageSize}`);
      }

      // Validate producer authorization
      if (config.requireAuthentication && options.producerId) {
        if (!config.allowedProducers.includes(options.producerId)) {
          throw new Error(`Unauthorized producer: ${options.producerId}`);
        }
      }

      // Compress payload if enabled
      let finalPayload = payloadString;
      let compressedSize: number | undefined;
      
      if (this.compressionEnabled && payloadString.length > 1024) {
        // Simulate compression (in real implementation, use zlib)
        finalPayload = payloadString; // Would compress here
        compressedSize = finalPayload.length;
      }

      // Encrypt payload
      let encryptedPayload = finalPayload;
      let encryptionKeyId = '';
      
      if (config.encryptionRequired) {
        const keyInfo = this.encryptionKeys.get(config.encryptionKeyId);
        if (!keyInfo) {
          throw new Error(`Encryption key not found: ${config.encryptionKeyId}`);
        }

        const encrypted = await encryptionService.encryptData(finalPayload, config.encryptionKeyId);
        encryptedPayload = encrypted;
        encryptionKeyId = config.encryptionKeyId;
      }

      // Calculate integrity hash
      const integrityHash = crypto.createHash('sha256')
        .update(encryptedPayload)
        .digest('hex');

      // Create digital signature for maximum security
      let digitalSignature: string | undefined;
      if (config.securityLevel === QueueSecurity.MAXIMUM) {
        digitalSignature = crypto.createHmac('sha256', encryptionKeyId)
          .update(encryptedPayload + integrityHash)
          .digest('hex');
      }

      // Create secure message
      const secureMessage: SecureMessage = {
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

      // Add audit entry
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

      // Update metrics
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

      logger.info('Secure message enqueued', {
        messageId,
        queueType,
        encrypted: secureMessage.encrypted,
        priority: secureMessage.priority,
        originalSize: secureMessage.originalSize,
        compressedSize: secureMessage.compressedSize
      });

      // Log security event
      await securityLogService.logSecurityEvent({
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

    } catch (err: unknown) {
      logger.error('Secure message enqueue failed', {
        messageId,
        queueType,
        error: getErrorMessage(err as Error)
      });
      throw err;
    }
  }

  /**
   * Securely dequeue message
   */
  async dequeueSecureMessage(
    queueType: QueueType,
    consumerId: string
  ): Promise<{ messageId: string; payload: any; metadata: any } | null> {
    try {
      const config = this.queueConfigurations.get(queueType);
      if (!config) {
        throw new Error(`Queue configuration not found: ${queueType}`);
      }

      // Validate consumer authorization
      if (config.requireAuthentication) {
        if (!config.allowedConsumers.includes(consumerId)) {
          throw new Error(`Unauthorized consumer: ${consumerId}`);
        }
      }

      // Find next message in queue (simplified simulation)
      const messages = Array.from(this.activeMessages.values())
        .filter(msg => msg.queueType === queueType)
        .sort((a, b) => {
          // Sort by priority (higher first), then by creation time
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      if (messages.length === 0) {
        return null; // No messages available
      }

      const message = messages[0];

      // Check message expiration
      if (message.expiresAt && message.expiresAt < new Date()) {
        this.activeMessages.delete(message.id);
        logger.debug('Expired message removed from queue', { messageId: message.id });
        return null;
      }

      // Verify integrity
      if (config.integrityCheckRequired) {
        const calculatedHash = crypto.createHash('sha256')
          .update(message.payload)
          .digest('hex');
        
        if (calculatedHash !== message.integrityHash) {
          // Integrity failure - move to dead letter queue
          await this.moveToDeadLetterQueue(message, 'integrity_check_failed');
          
          const metrics = this.queueMetrics.get(queueType);
          if (metrics) {
            metrics.integrityFailures++;
          }
          
          throw new Error('Message integrity check failed');
        }
      }

      // Verify digital signature for maximum security
      if (config.securityLevel === QueueSecurity.MAXIMUM && message.digitalSignature) {
        const expectedSignature = crypto.createHmac('sha256', message.encryptionKeyId)
          .update(message.payload + message.integrityHash)
          .digest('hex');
        
        if (expectedSignature !== message.digitalSignature) {
          await this.moveToDeadLetterQueue(message, 'signature_verification_failed');
          throw new Error('Message signature verification failed');
        }
      }

      // Decrypt payload
      let decryptedPayload = message.payload;
      if (message.encrypted) {
        try {
          decryptedPayload = await encryptionService.decryptData(
            message.payload,
            message.encryptionKeyId
          );
        } catch (err: unknown) {
          await this.moveToDeadLetterQueue(message, 'decryption_failed');
          throw new Error(`Message decryption failed: ${getErrorMessage(err as Error)}`);
        }
      }

      // Decompress if compressed
      let finalPayload = decryptedPayload;
      if (message.compressedSize) {
        // Simulate decompression (in real implementation, use zlib)
        finalPayload = decryptedPayload; // Would decompress here
      }

      // Parse JSON payload
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(finalPayload);
      } catch (error) {
        await this.moveToDeadLetterQueue(message, 'json_parse_failed');
        throw new Error('Failed to parse message payload');
      }

      // Update message tracking
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

      // Remove from active messages
      this.activeMessages.delete(message.id);

      // Update metrics
      const metrics = this.queueMetrics.get(queueType);
      if (metrics) {
        metrics.messagesConsumed++;
        metrics.messagesInQueue--;
        
        const processingTime = Date.now() - message.createdAt.getTime();
        metrics.averageProcessingTime = metrics.messagesConsumed > 1
          ? (metrics.averageProcessingTime * (metrics.messagesConsumed - 1) + processingTime) / metrics.messagesConsumed
          : processingTime;
      }

      logger.info('Secure message dequeued', {
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

    } catch (err: unknown) {
      logger.error('Secure message dequeue failed', {
        queueType,
        consumerId,
        error: getErrorMessage(err as Error)
      });
      throw err;
    }
  }

  private async moveToDeadLetterQueue(message: SecureMessage, reason: string): Promise<void> {
    // Move message to dead letter queue
    message.auditTrail.push({
      timestamp: new Date(),
      action: 'moved_to_dead_letter_queue',
      actor: 'system',
      details: { reason }
    });

    // Update metrics
    const metrics = this.queueMetrics.get(message.queueType);
    if (metrics) {
      metrics.deadLetterMessages++;
      metrics.messagesInQueue--;
    }

    // Remove from active messages
    this.activeMessages.delete(message.id);

    logger.warn('Message moved to dead letter queue', {
      messageId: message.id,
      queueType: message.queueType,
      reason
    });
  }

  /**
   * Encrypt notification template
   */
  async encryptTemplate(
    templateId: string,
    templateContent: string,
    variables: Record<string, any> = {}
  ): Promise<{
    encryptedContent: string;
    encryptionKeyId: string;
    integrityHash: string;
    metadata: any;
  }> {
    try {
      const templateConfig = this.templateConfigs.get(templateId);
      if (!templateConfig) {
        throw new Error(`Template configuration not found: ${templateId}`);
      }

      // Validate template variables
      for (const variable of Object.keys(variables)) {
        if (!templateConfig.allowedVariables.includes(variable)) {
          throw new Error(`Unauthorized template variable: ${variable}`);
        }
      }

      // Check for banned patterns
      for (const pattern of templateConfig.bannedPatterns) {
        if (pattern.test(templateContent)) {
          throw new Error('Template content contains banned patterns');
        }
      }

      // Validate size
      if (templateContent.length > templateConfig.maxSize) {
        throw new Error(`Template exceeds maximum size: ${templateContent.length} > ${templateConfig.maxSize}`);
      }

      // Encrypt template content
      let encryptedContent = templateContent;
      let encryptionKeyId = '';
      
      if (templateConfig.encryptionRequired) {
        const encrypted = await encryptionService.encryptData(
          templateContent,
          templateConfig.encryptionKeyId
        );
        encryptedContent = encrypted;
        encryptionKeyId = templateConfig.encryptionKeyId;
      }

      // Calculate integrity hash
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

      logger.info('Template encrypted', {
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

    } catch (err: unknown) {
      logger.error('Template encryption failed', {
        templateId,
        error: getErrorMessage(err as Error)
      });
      throw err;
    }
  }

  /**
   * Rotate queue encryption keys
   */
  async rotateQueueKeys(queueType?: QueueType): Promise<void> {
    const queuesToRotate = queueType 
      ? [queueType] 
      : Object.values(QueueType);

    for (const queue of queuesToRotate) {
      try {
        const config = this.queueConfigurations.get(queue);
        if (!config) continue;

        const keyInfo = this.encryptionKeys.get(config.encryptionKeyId);
        if (!keyInfo) continue;

        // Check if rotation is due
        const hoursElapsed = (Date.now() - (keyInfo as any).createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed < (keyInfo as any).rotationInterval) {
          continue;
        }

        // Generate new key
        const newKeyBuffer = crypto.randomBytes(32);
        const newKeyValue = newKeyBuffer.toString('base64');
        const newKeyId = `${config.encryptionKeyId}-${Date.now()}`;

        await vaultService.putSecret(`queue-encryption-keys/${newKeyId}`, { key: newKeyValue });

        // Update key info
        this.encryptionKeys.set(config.encryptionKeyId, {
          keyId: newKeyId,
          keyValue: newKeyValue,
          algorithm: 'AES-256-GCM',
          createdAt: new Date(),
          rotationInterval: (keyInfo as any).rotationInterval
        });

        // Update configuration
        config.encryptionKeyId = newKeyId;

        logger.info('Queue encryption key rotated', {
          queueType: queue,
          newKeyId,
          rotationInterval: (keyInfo as any).rotationInterval
        });

        // Log security event
        await securityLogService.logSecurityEvent({
          eventType: 'queue_encryption_key_rotated',
          severity: 'LOW',
          category: 'system',
          ipAddress: 'localhost',
          success: true,
          details: {
            queueType: queue,
            newKeyId,
            rotationInterval: (keyInfo as any).rotationInterval
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

      } catch (err: unknown) {
        logger.error('Queue key rotation failed', {
          queueType: queue,
          error: getErrorMessage(err as Error)
        });
      }
    }
  }

  private startSecurityMonitoring(): void {
    // Start automated key rotation
    setInterval(() => {
      this.rotateQueueKeys().catch((err: unknown) => {
        logger.error('Automated key rotation failed:', err as Record<string, unknown>);
      });
    }, 60 * 60 * 1000); // Check every hour

    // Start metrics collection
    setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000); // Update every minute

    logger.info('Queue security monitoring started');
  }

  private updateMetrics(): void {
    const now = new Date();
    
    for (const metrics of this.queueMetrics.values()) {
      // Update throughput
      const minutesElapsed = (now.getTime() - metrics.periodStart.getTime()) / (1000 * 60);
      if (minutesElapsed > 0) {
        metrics.throughputPerMinute = metrics.messagesProduced / minutesElapsed;
      }

      // Update compliance score
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

  /**
   * Get queue security statistics
   */
  getStats(): {
    queues: number;
    templates: number;
    activeMessages: number;
    totalMessagesProduced: number;
    totalMessagesConsumed: number;
    averageEncryptionRate: number;
    averageComplianceScore: number;
    keyRotations: number;
  } {
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

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    const stats = this.getStats();
    
    let status = 'healthy';
    
    if (stats.averageComplianceScore < 95) {
      status = 'warning'; // Compliance issues
    }
    
    if (stats.averageEncryptionRate < 99) {
      status = 'warning'; // Encryption issues
    }
    
    if (stats.activeMessages > 10000) {
      status = 'degraded'; // Queue backlog
    }

    // Check for integrity failures
    const integrityFailures = Array.from(this.queueMetrics.values())
      .reduce((sum, m) => sum + m.integrityFailures, 0);

    if (integrityFailures > 0) {
      status = 'critical'; // Security compromised
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

// Export singleton instance
export const notificationQueueSecurityService = NotificationQueueSecurityService.getInstance();
