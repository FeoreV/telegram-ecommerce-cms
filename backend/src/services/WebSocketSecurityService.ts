import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';
import { encryptionService } from './EncryptionService';
import { secretLeakDetectionService } from './SecretLeakDetectionService';
import { getSecurityKeyId } from '../config/securityKeys';

export enum WebSocketEventType {
  ORDER_UPDATE = 'order_update',
  PAYMENT_STATUS = 'payment_status',
  INVENTORY_ALERT = 'inventory_alert',
  SYSTEM_NOTIFICATION = 'system_notification',
  CHAT_MESSAGE = 'chat_message',
  USER_ACTIVITY = 'user_activity',
  STORE_UPDATE = 'store_update',
  ADMIN_ALERT = 'admin_alert'
}

export enum MessageSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

export interface WebSocketMessage {
  id: string;
  type: WebSocketEventType;
  
  // Content
  payload: any;
  originalPayload: any; // Before security processing
  
  // Security metadata
  sensitivity: MessageSensitivity;
  encrypted: boolean;
  redacted: boolean;
  secretsDetected: boolean;
  
  // Targeting
  targetUserId?: string;
  targetStoreId?: string;
  targetRole?: string;
  broadcast: boolean;
  
  // Message metadata
  timestamp: Date;
  expiresAt?: Date;
  priority: number;
  
  // Processing metadata
  processedAt?: Date;
  deliveredAt?: Date;
  acknowledged: boolean;
  
  // Security audit
  auditTrail: {
    timestamp: Date;
    action: string;
    details: Record<string, any>;
  }[];
  
  // Compliance
  containsPII: boolean;
  gdprSubject: boolean;
  businessJustification?: string;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  userRole: string;
  storeId?: string;
  
  // Connection metadata
  ipAddress: string;
  userAgent: string;
  connectionTime: Date;
  lastActivity: Date;
  
  // Security state
  authenticated: boolean;
  authorized: boolean;
  encryptionEnabled: boolean;
  riskScore: number;
  
  // Session tracking
  sessionId: string;
  messagesSent: number;
  messagesReceived: number;
  
  // Rate limiting
  rateLimitWindow: Date;
  rateLimitCount: number;
  
  // Security flags
  suspiciousActivity: boolean;
  blockedUntil?: Date;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  eventTypes: WebSocketEventType[];
  
  // Content filtering
  enableSecretDetection: boolean;
  enablePIIRedaction: boolean;
  enableContentValidation: boolean;
  
  // Access control
  allowedRoles: string[];
  requireStoreAccess: boolean;
  requireExplicitPermission: boolean;
  
  // Rate limiting
  maxMessagesPerMinute: number;
  maxPayloadSize: number;
  
  // Security measures
  encryptionRequired: boolean;
  auditRequired: boolean;
  retentionPeriod: number; // hours
  
  // Conditions
  businessHours: boolean;
  ipWhitelist?: string[];
  
  // Compliance
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  
  enabled: boolean;
  priority: number;
}

export interface SecretDetectionResult {
  detected: boolean;
  secrets: {
    type: string;
    value: string;
    confidence: number;
    position: number;
    redactedValue: string;
  }[];
  riskScore: number;
  actionTaken: 'block' | 'redact' | 'alert' | 'log';
}

export class WebSocketSecurityService {
  private static instance: WebSocketSecurityService;
  private securityPolicies: Map<WebSocketEventType, SecurityPolicy> = new Map();
  private activeConnections: Map<string, WebSocketConnection> = new Map();
  private messageHistory: Map<string, WebSocketMessage> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: RegExp[] = [];

  private constructor() {
    this.initializeWebSocketSecurity();
    this.loadSecurityPolicies();
    this.setupSuspiciousPatterns();
    this.startSecurityMonitoring();

    logger.info('WebSocket Security Service initialized', {
      policies: this.securityPolicies.size,
      suspiciousPatterns: this.suspiciousPatterns.length
    });
  }

  public static getInstance(): WebSocketSecurityService {
    if (!WebSocketSecurityService.instance) {
      WebSocketSecurityService.instance = new WebSocketSecurityService();
    }
    return WebSocketSecurityService.instance;
  }

  private async initializeWebSocketSecurity(): Promise<void> {
    try {
      // Initialize security monitoring
      await this.initializeSecurityMonitoring();
      
      // Load blocked IPs and suspicious patterns
      await this.loadSecurityBlacklists();
      
      // Setup real-time threat detection
      await this.setupThreatDetection();

      logger.info('WebSocket security initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize WebSocket security:', error);
      throw error;
    }
  }

  private async initializeSecurityMonitoring(): Promise<void> {
    // Initialize monitoring for WebSocket security events
    logger.debug('WebSocket security monitoring initialized');
  }

  private async loadSecurityBlacklists(): Promise<void> {
    // Load blocked IPs and known malicious patterns
    this.blockedIPs.add('192.168.1.100'); // Example blocked IP
    logger.debug('Security blacklists loaded');
  }

  private async setupThreatDetection(): Promise<void> {
    // Setup real-time threat detection for WebSocket messages
    logger.debug('WebSocket threat detection setup completed');
  }

  private loadSecurityPolicies(): void {
    // Order update policy
    const orderUpdatePolicy: SecurityPolicy = {
      id: 'order-update-policy',
      name: 'Order Update Security Policy',
      eventTypes: [WebSocketEventType.ORDER_UPDATE],
      enableSecretDetection: true,
      enablePIIRedaction: true,
      enableContentValidation: true,
      allowedRoles: ['customer', 'vendor', 'admin'],
      requireStoreAccess: true,
      requireExplicitPermission: false,
      maxMessagesPerMinute: 60,
      maxPayloadSize: 10240, // 10KB
      encryptionRequired: true,
      auditRequired: true,
      retentionPeriod: 168, // 7 days
      businessHours: false,
      gdprCompliant: true,
      ccpaCompliant: true,
      enabled: true,
      priority: 1
    };

    // Payment status policy
    const paymentStatusPolicy: SecurityPolicy = {
      id: 'payment-status-policy',
      name: 'Payment Status Security Policy',
      eventTypes: [WebSocketEventType.PAYMENT_STATUS],
      enableSecretDetection: true,
      enablePIIRedaction: true,
      enableContentValidation: true,
      allowedRoles: ['customer', 'admin', 'finance'],
      requireStoreAccess: false,
      requireExplicitPermission: true,
      maxMessagesPerMinute: 30,
      maxPayloadSize: 4096, // 4KB
      encryptionRequired: true,
      auditRequired: true,
      retentionPeriod: 2555 * 24, // 7 years in hours
      businessHours: false,
      gdprCompliant: true,
      ccpaCompliant: true,
      enabled: true,
      priority: 10
    };

    // System notification policy
    const systemNotificationPolicy: SecurityPolicy = {
      id: 'system-notification-policy',
      name: 'System Notification Security Policy',
      eventTypes: [WebSocketEventType.SYSTEM_NOTIFICATION],
      enableSecretDetection: true,
      enablePIIRedaction: false,
      enableContentValidation: true,
      allowedRoles: ['admin', 'system'],
      requireStoreAccess: false,
      requireExplicitPermission: false,
      maxMessagesPerMinute: 100,
      maxPayloadSize: 65536, // 64KB
      encryptionRequired: true,
      auditRequired: true,
      retentionPeriod: 720, // 30 days
      businessHours: false,
      gdprCompliant: false,
      ccpaCompliant: false,
      enabled: true,
      priority: 5
    };

    // Chat message policy
    const chatMessagePolicy: SecurityPolicy = {
      id: 'chat-message-policy',
      name: 'Chat Message Security Policy',
      eventTypes: [WebSocketEventType.CHAT_MESSAGE],
      enableSecretDetection: true,
      enablePIIRedaction: true,
      enableContentValidation: true,
      allowedRoles: ['customer', 'vendor', 'admin', 'support'],
      requireStoreAccess: true,
      requireExplicitPermission: false,
      maxMessagesPerMinute: 120,
      maxPayloadSize: 2048, // 2KB
      encryptionRequired: false,
      auditRequired: false,
      retentionPeriod: 168, // 7 days
      businessHours: false,
      gdprCompliant: true,
      ccpaCompliant: true,
      enabled: true,
      priority: 2
    };

    // Admin alert policy
    const adminAlertPolicy: SecurityPolicy = {
      id: 'admin-alert-policy',
      name: 'Admin Alert Security Policy',
      eventTypes: [WebSocketEventType.ADMIN_ALERT],
      enableSecretDetection: true,
      enablePIIRedaction: false,
      enableContentValidation: true,
      allowedRoles: ['admin', 'owner'],
      requireStoreAccess: false,
      requireExplicitPermission: true,
      maxMessagesPerMinute: 200,
      maxPayloadSize: 32768, // 32KB
      encryptionRequired: true,
      auditRequired: true,
      retentionPeriod: 2160, // 90 days
      businessHours: false,
      gdprCompliant: false,
      ccpaCompliant: false,
      enabled: true,
      priority: 15
    };

    // Inventory alert policy
    const inventoryAlertPolicy: SecurityPolicy = {
      id: 'inventory-alert-policy',
      name: 'Inventory Alert Security Policy',
      eventTypes: [WebSocketEventType.INVENTORY_ALERT],
      enableSecretDetection: false,
      enablePIIRedaction: false,
      enableContentValidation: true,
      allowedRoles: ['vendor', 'admin', 'inventory_manager'],
      requireStoreAccess: true,
      requireExplicitPermission: false,
      maxMessagesPerMinute: 300,
      maxPayloadSize: 8192, // 8KB
      encryptionRequired: false,
      auditRequired: false,
      retentionPeriod: 168, // 7 days
      businessHours: false,
      gdprCompliant: false,
      ccpaCompliant: false,
      enabled: true,
      priority: 3
    };

    this.securityPolicies.set(WebSocketEventType.ORDER_UPDATE, orderUpdatePolicy);
    this.securityPolicies.set(WebSocketEventType.PAYMENT_STATUS, paymentStatusPolicy);
    this.securityPolicies.set(WebSocketEventType.SYSTEM_NOTIFICATION, systemNotificationPolicy);
    this.securityPolicies.set(WebSocketEventType.CHAT_MESSAGE, chatMessagePolicy);
    this.securityPolicies.set(WebSocketEventType.ADMIN_ALERT, adminAlertPolicy);
    this.securityPolicies.set(WebSocketEventType.INVENTORY_ALERT, inventoryAlertPolicy);

    logger.info('WebSocket security policies loaded', {
      policyCount: this.securityPolicies.size
    });
  }

  private setupSuspiciousPatterns(): void {
    // Patterns that indicate potential security threats or data leaks
    this.suspiciousPatterns = [
      // Database connection strings
      /(?:mysql|postgresql|mongodb|redis):\/\/[^\s]+/gi,
      
      // API endpoints with tokens
      /https?:\/\/[^\s]+[?&](?:token|key|secret|api[_-]?key)=[A-Za-z0-9+/=]+/gi,
      
      // AWS credentials
      /(AKIA[0-9A-Z]{16}|[0-9a-zA-Z/+]{40})/g,
      
      // Private keys
      /-----BEGIN (RSA|DSA|EC|PGP) PRIVATE KEY-----/gi,
      
      // JWT tokens
      /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
      
      // Credit card numbers
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      
      // Social Security Numbers
      /\b\d{3}-\d{2}-\d{4}\b/g,
      
      // Email addresses (in certain contexts)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // Phone numbers (in certain contexts)
      /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      
      // Internal system references
      /(?:prod|production|staging|dev)[-_]?(?:db|database|server|host)/gi,
      
      // Suspicious commands
      /(?:rm\s+-rf|sudo|passwd|ssh|ftp|scp|wget|curl)\s+/gi
    ];

    logger.debug('Suspicious patterns setup completed', {
      patternCount: this.suspiciousPatterns.length
    });
  }

  /**
   * Process outgoing WebSocket message for security
   */
  async processOutgoingMessage(
    connectionId: string,
    eventType: WebSocketEventType,
    payload: any,
    options: {
      targetUserId?: string;
      targetStoreId?: string;
      broadcast?: boolean;
      priority?: number;
      expiresAt?: Date;
      businessJustification?: string;
    } = {}
  ): Promise<WebSocketMessage | null> {
    const messageId = crypto.randomUUID();
    
    try {
      const connection = this.activeConnections.get(connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${connectionId}`);
      }

      const policy = this.securityPolicies.get(eventType);
      if (!policy || !policy.enabled) {
        throw new Error(`No security policy found for event type: ${eventType}`);
      }

      // Validate connection authorization
      await this.validateConnectionAuthorization(connection, policy, options);

      // Check rate limiting
      await this.checkRateLimit(connection, policy);

      // Validate payload size
      const payloadString = JSON.stringify(payload);
      if (payloadString.length > policy.maxPayloadSize) {
        throw new Error(`Payload exceeds maximum size: ${payloadString.length} > ${policy.maxPayloadSize}`);
      }

      // Create message
      const message: WebSocketMessage = {
        id: messageId,
        type: eventType,
        payload,
        originalPayload: JSON.parse(JSON.stringify(payload)), // Deep copy
        sensitivity: this.determineSensitivity(eventType, payload),
        encrypted: false,
        redacted: false,
        secretsDetected: false,
        targetUserId: options.targetUserId,
        targetStoreId: options.targetStoreId,
        targetRole: connection.userRole,
        broadcast: options.broadcast || false,
        timestamp: new Date(),
        expiresAt: options.expiresAt,
        priority: options.priority || 5,
        acknowledged: false,
        auditTrail: [],
        containsPII: false,
        gdprSubject: false,
        businessJustification: options.businessJustification
      };

      // Add initial audit entry
      message.auditTrail.push({
        timestamp: new Date(),
        action: 'message_created',
        details: {
          connectionId,
          eventType,
          payloadSize: payloadString.length,
          targetUserId: options.targetUserId,
          broadcast: options.broadcast
        }
      });

      // Apply security processing
      await this.applySecurityProcessing(message, policy);

      // Store message
      this.messageHistory.set(messageId, message);

      // Update connection metrics
      connection.messagesSent++;
      connection.lastActivity = new Date();

      logger.info('WebSocket message processed', {
        messageId,
        connectionId,
        eventType,
        encrypted: message.encrypted,
        redacted: message.redacted,
        secretsDetected: message.secretsDetected,
        payloadSize: payloadString.length
      });

      // Log security event
      await securityLogService.logSecurityEvent({
        eventType: 'websocket_message_processed',
        severity: message.secretsDetected ? 'HIGH' : 'LOW',
        category: 'network',
        ipAddress: connection.ipAddress,
        success: true,
        details: {
          messageId,
          connectionId,
          wsEventType: eventType,
          encrypted: message.encrypted,
          redacted: message.redacted,
          secretsDetected: message.secretsDetected,
          containsPII: message.containsPII
        },
        riskScore: this.calculateMessageRiskScore(message),
        tags: ['websocket_security', 'real_time_communication', 'message_filtering'],
        compliance: {
          pii: message.containsPII,
          gdpr: policy.gdprCompliant,
          pci: false,
          hipaa: false
        }
      });

      return message;

    } catch (error) {
      logger.error('WebSocket message processing failed', {
        messageId,
        connectionId,
        eventType,
        error: getErrorMessage(error)
      });

      // Update connection risk score
      const connection = this.activeConnections.get(connectionId);
      if (connection) {
        connection.riskScore += 10;
        if (connection.riskScore > 100) {
          connection.suspiciousActivity = true;
          connection.blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // Block for 1 hour
        }
      }

      return null;
    }
  }

  private async validateConnectionAuthorization(
    connection: WebSocketConnection,
    policy: SecurityPolicy,
    options: any
  ): Promise<void> {
    // Check if connection is authenticated
    if (!connection.authenticated) {
      throw new Error('Connection not authenticated');
    }

    // Check if connection is authorized
    if (!connection.authorized) {
      throw new Error('Connection not authorized');
    }

    // Check role authorization
    if (!policy.allowedRoles.includes(connection.userRole)) {
      throw new Error(`Role not authorized for this event type: ${connection.userRole}`);
    }

    // Check store access requirement
    if (policy.requireStoreAccess && options.targetStoreId) {
      if (connection.storeId !== options.targetStoreId) {
        throw new Error('Store access not authorized');
      }
    }

    // Check IP whitelist if configured
    if (policy.ipWhitelist && policy.ipWhitelist.length > 0) {
      if (!policy.ipWhitelist.includes(connection.ipAddress)) {
        throw new Error('IP address not whitelisted');
      }
    }

    // Check if connection is blocked
    if (connection.blockedUntil && connection.blockedUntil > new Date()) {
      throw new Error('Connection is temporarily blocked due to suspicious activity');
    }

    // Check if IP is globally blocked
    if (this.blockedIPs.has(connection.ipAddress)) {
      throw new Error('IP address is blocked');
    }
  }

  private async checkRateLimit(connection: WebSocketConnection, policy: SecurityPolicy): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 1000); // 1 minute window

    // Reset rate limit if window has passed
    if (connection.rateLimitWindow < windowStart) {
      connection.rateLimitWindow = now;
      connection.rateLimitCount = 0;
    }

    // Check rate limit
    if (connection.rateLimitCount >= policy.maxMessagesPerMinute) {
      connection.suspiciousActivity = true;
      throw new Error('Rate limit exceeded');
    }

    connection.rateLimitCount++;
  }

  private determineSensitivity(eventType: WebSocketEventType, _payload: any): MessageSensitivity {
    switch (eventType) {
      case WebSocketEventType.PAYMENT_STATUS:
      case WebSocketEventType.ADMIN_ALERT:
        return MessageSensitivity.RESTRICTED;
      
      case WebSocketEventType.ORDER_UPDATE:
      case WebSocketEventType.SYSTEM_NOTIFICATION:
        return MessageSensitivity.CONFIDENTIAL;
      
      case WebSocketEventType.CHAT_MESSAGE:
      case WebSocketEventType.USER_ACTIVITY:
        return MessageSensitivity.INTERNAL;
      
      case WebSocketEventType.INVENTORY_ALERT:
      case WebSocketEventType.STORE_UPDATE:
        return MessageSensitivity.INTERNAL;
      
      default:
        return MessageSensitivity.PUBLIC;
    }
  }

  private async applySecurityProcessing(message: WebSocketMessage, policy: SecurityPolicy): Promise<void> {
    // 1. Secret detection
    if (policy.enableSecretDetection) {
      const secretDetectionResult = await this.detectSecrets(message);
      if (secretDetectionResult.detected) {
        message.secretsDetected = true;
        
        // Apply redaction or blocking based on risk
        if (secretDetectionResult.riskScore > 80) {
          throw new Error('High-risk secrets detected, message blocked');
        } else {
          message.payload = this.redactSecrets(message.payload, secretDetectionResult);
          message.redacted = true;
        }

        message.auditTrail.push({
          timestamp: new Date(),
          action: 'secrets_detected_and_processed',
          details: {
            secretCount: secretDetectionResult.secrets.length,
            riskScore: secretDetectionResult.riskScore,
            actionTaken: secretDetectionResult.actionTaken
          }
        });
      }
    }

    // 2. PII redaction
    if (policy.enablePIIRedaction) {
      const piiDetected = await this.detectAndRedactPII(message);
      if (piiDetected) {
        message.containsPII = true;
        message.redacted = true;
        message.gdprSubject = policy.gdprCompliant;
        
        message.auditTrail.push({
          timestamp: new Date(),
          action: 'pii_redacted',
          details: {
            gdprSubject: message.gdprSubject,
            redactionApplied: true
          }
        });
      }
    }

    // 3. Content validation
    if (policy.enableContentValidation) {
      await this.validateMessageContent(message);
    }

    // 4. Encryption
    if (policy.encryptionRequired) {
      await this.encryptMessage(message);
    }

    // 5. Final audit entry
    message.processedAt = new Date();
    message.auditTrail.push({
      timestamp: new Date(),
      action: 'security_processing_completed',
      details: {
        encrypted: message.encrypted,
        redacted: message.redacted,
        secretsDetected: message.secretsDetected,
        containsPII: message.containsPII
      }
    });
  }

  private async detectSecrets(message: WebSocketMessage): Promise<SecretDetectionResult> {
    const payloadString = JSON.stringify(message.payload);
    const secrets: SecretDetectionResult['secrets'] = [];
    let maxRiskScore = 0;

    // Check against suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      let match;
      while ((match = pattern.exec(payloadString)) !== null) {
        const detectedValue = match[0];
        const confidence = this.calculateSecretConfidence(detectedValue, pattern);
        const riskScore = confidence * 100;
        
        if (riskScore > maxRiskScore) {
          maxRiskScore = riskScore;
        }

        secrets.push({
          type: this.getSecretType(pattern),
          value: detectedValue,
          confidence,
          position: match.index,
          redactedValue: this.generateRedactedValue(detectedValue)
        });

        // Reset regex to avoid infinite loop
        pattern.lastIndex = 0;
        break;
      }
    }

    // Use existing secret leak detection service
    await secretLeakDetectionService.scanLogEntry(payloadString, 'websocket_message');

    const actionTaken = maxRiskScore > 80 ? 'block' : 
                       maxRiskScore > 50 ? 'redact' : 
                       maxRiskScore > 20 ? 'alert' : 'log';

    return {
      detected: secrets.length > 0,
      secrets,
      riskScore: maxRiskScore,
      actionTaken
    };
  }

  private calculateSecretConfidence(value: string, pattern: RegExp): number {
    // Base confidence on pattern specificity and value characteristics
    let confidence = 0.5; // Base confidence

    // JWT tokens have high confidence
    if (pattern.source.includes('eyJ')) {
      confidence = 0.95;
    }
    // Database connection strings
    else if (pattern.source.includes('mysql|postgresql')) {
      confidence = 0.9;
    }
    // API keys
    else if (pattern.source.includes('AKIA')) {
      confidence = 0.95;
    }
    // Credit cards
    else if (pattern.source.includes('\\d{4}[\\s-]?\\d{4}')) {
      confidence = 0.8;
    }
    // General patterns
    else {
      confidence = 0.6;
    }

    // Adjust based on entropy
    const entropy = this.calculateEntropy(value);
    if (entropy > 4.0) {
      confidence += 0.2;
    } else if (entropy < 2.0) {
      confidence -= 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    const frequencies: { [key: string]: number } = {};
    for (const char of str) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    const len = str.length;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private getSecretType(pattern: RegExp): string {
    const source = pattern.source.toLowerCase();
    
    if (source.includes('eyj')) return 'jwt_token';
    if (source.includes('akia')) return 'aws_access_key';
    if (source.includes('mysql|postgresql')) return 'database_connection';
    if (source.includes('\\d{4}[\\s-]?\\d{4}')) return 'credit_card';
    if (source.includes('\\d{3}-\\d{2}-\\d{4}')) return 'ssn';
    if (source.includes('private key')) return 'private_key';
    if (source.includes('@[a-za-z0-9.-]+')) return 'email_address';
    
    return 'unknown_secret';
  }

  private generateRedactedValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    const middle = '*'.repeat(value.length - 4);
    
    return start + middle + end;
  }

  private redactSecrets(payload: any, detectionResult: SecretDetectionResult): any {
    let payloadString = JSON.stringify(payload);
    
    // Sort secrets by position (descending) to maintain position integrity
    const sortedSecrets = detectionResult.secrets.sort((a, b) => b.position - a.position);
    
    for (const secret of sortedSecrets) {
      payloadString = payloadString.substring(0, secret.position) + 
                     secret.redactedValue + 
                     payloadString.substring(secret.position + secret.value.length);
    }
    
    try {
      return JSON.parse(payloadString);
    } catch (error) {
      // If JSON parsing fails, return a safe object
      return { message: '[REDACTED_DUE_TO_SECURITY_POLICY]' };
    }
  }

  private async detectAndRedactPII(message: WebSocketMessage): Promise<boolean> {
    const payloadString = JSON.stringify(message.payload);
    let piiDetected = false;
    let redactedPayload = payloadString;

    // Email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    if (emailPattern.test(payloadString)) {
      redactedPayload = redactedPayload.replace(emailPattern, '[EMAIL_REDACTED]');
      piiDetected = true;
    }

    // Phone numbers
    const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    if (phonePattern.test(payloadString)) {
      redactedPayload = redactedPayload.replace(phonePattern, '[PHONE_REDACTED]');
      piiDetected = true;
    }

    // IP addresses (in certain contexts)
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
    if (ipPattern.test(payloadString)) {
      redactedPayload = redactedPayload.replace(ipPattern, '[IP_REDACTED]');
      piiDetected = true;
    }

    if (piiDetected) {
      try {
        message.payload = JSON.parse(redactedPayload);
      } catch (error) {
        message.payload = { message: '[PII_REDACTED]' };
      }
    }

    return piiDetected;
  }

  private async validateMessageContent(message: WebSocketMessage): Promise<void> {
    const payloadString = JSON.stringify(message.payload);

    // Check for malicious patterns
    const maliciousPatterns = [
      /<script.*?>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(payloadString)) {
        throw new Error('Malicious content detected in message');
      }
    }

    // Check for suspicious SQL patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
      /(UNION\s+SELECT)/gi,
      /('|"|;|--|\/\*|\*\/)/gi
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(payloadString)) {
        logger.warn('Potential SQL injection attempt detected', {
          messageId: message.id,
          pattern: pattern.source
        });
        // Don't block, but log for investigation
      }
    }
  }

  private async encryptMessage(message: WebSocketMessage): Promise<void> {
    try {
      const payloadString = JSON.stringify(message.payload);
      const encrypted = await encryptionService.encryptData(
        payloadString,
        'websocket-encryption-key'
      );
      
      message.payload = { encrypted: encrypted };
      message.encrypted = true;
      
      message.auditTrail.push({
        timestamp: new Date(),
        action: 'message_encrypted',
        details: {
          algorithm: 'AES-256-GCM',
          keyId: getSecurityKeyId('websocketEncryptionKeyId')
        }
      });

    } catch (error) {
      logger.error('Message encryption failed', {
        messageId: message.id,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private calculateMessageRiskScore(message: WebSocketMessage): number {
    let riskScore = 0;

    // Base risk by sensitivity
    switch (message.sensitivity) {
      case MessageSensitivity.RESTRICTED:
        riskScore += 40;
        break;
      case MessageSensitivity.CONFIDENTIAL:
        riskScore += 30;
        break;
      case MessageSensitivity.INTERNAL:
        riskScore += 20;
        break;
      case MessageSensitivity.PUBLIC:
        riskScore += 10;
        break;
    }

    // Risk factors
    if (message.secretsDetected) riskScore += 50;
    if (message.containsPII) riskScore += 30;
    if (!message.encrypted && message.sensitivity !== MessageSensitivity.PUBLIC) riskScore += 20;
    if (message.broadcast) riskScore += 15;

    // Risk reduction factors
    if (message.encrypted) riskScore -= 20;
    if (message.redacted) riskScore -= 15;

    return Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Register WebSocket connection
   */
  async registerConnection(
    connectionId: string,
    userId: string,
    userRole: string,
    storeId: string | undefined,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    const connection: WebSocketConnection = {
      id: connectionId,
      userId,
      userRole,
      storeId,
      ipAddress,
      userAgent,
      connectionTime: new Date(),
      lastActivity: new Date(),
      authenticated: true,
      authorized: true,
      encryptionEnabled: true,
      riskScore: 0,
      sessionId,
      messagesSent: 0,
      messagesReceived: 0,
      rateLimitWindow: new Date(),
      rateLimitCount: 0,
      suspiciousActivity: false
    };

    this.activeConnections.set(connectionId, connection);

    logger.info('WebSocket connection registered', {
      connectionId,
      userId,
      userRole,
      storeId,
      ipAddress
    });

    // Log security event
    await securityLogService.logSecurityEvent({
      eventType: 'websocket_connection_registered',
      severity: 'LOW',
      category: 'network',
      ipAddress,
      success: true,
      details: {
        connectionId,
        userId,
        userRole,
        storeId
      },
      riskScore: 10,
      tags: ['websocket_connection', 'user_session'],
      compliance: {
        pii: false,
        gdpr: false,
        pci: false,
        hipaa: false
      }
    });
  }

  /**
   * Unregister WebSocket connection
   */
  async unregisterConnection(connectionId: string): Promise<void> {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      this.activeConnections.delete(connectionId);
      
      const sessionDuration = Date.now() - connection.connectionTime.getTime();
      
      logger.info('WebSocket connection unregistered', {
        connectionId,
        userId: connection.userId,
        sessionDuration,
        messagesSent: connection.messagesSent,
        messagesReceived: connection.messagesReceived
      });
    }
  }

  private startSecurityMonitoring(): void {
    // Clean up expired messages
    setInterval(() => {
      this.cleanupExpiredMessages();
    }, 60 * 1000); // Every minute

    // Monitor suspicious activity
    setInterval(() => {
      this.monitorSuspiciousActivity();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Update connection risk scores
    setInterval(() => {
      this.updateConnectionRiskScores();
    }, 10 * 60 * 1000); // Every 10 minutes

    logger.info('WebSocket security monitoring started');
  }

  private cleanupExpiredMessages(): void {
    const now = new Date();
    let expiredCount = 0;

    for (const [messageId, message] of this.messageHistory.entries()) {
      if (message.expiresAt && message.expiresAt < now) {
        this.messageHistory.delete(messageId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug('Cleaned up expired WebSocket messages', { expiredCount });
    }
  }

  private monitorSuspiciousActivity(): void {
    for (const [connectionId, connection] of this.activeConnections.entries()) {
      // Check for suspicious patterns
      if (connection.riskScore > 80) {
        connection.suspiciousActivity = true;
        logger.warn('Suspicious WebSocket activity detected', {
          connectionId,
          userId: connection.userId,
          riskScore: connection.riskScore
        });
      }

      // Check for idle connections
      const idleTime = Date.now() - connection.lastActivity.getTime();
      if (idleTime > 30 * 60 * 1000) { // 30 minutes
        // Mark as idle but don't disconnect automatically
        logger.debug('Idle WebSocket connection detected', {
          connectionId,
          idleTime
        });
      }
    }
  }

  private updateConnectionRiskScores(): void {
    for (const [, connection] of this.activeConnections.entries()) {
      // Decay risk score over time
      connection.riskScore = Math.max(0, connection.riskScore - 5);
      
      // Reset suspicious activity flag if risk score is low
      if (connection.riskScore < 30) {
        connection.suspiciousActivity = false;
        connection.blockedUntil = undefined;
      }
    }
  }

  /**
   * Get WebSocket security statistics
   */
  getStats(): {
    policies: number;
    activeConnections: number;
    messageHistory: number;
    blockedIPs: number;
    suspiciousConnections: number;
    messagesWithSecrets: number;
    encryptedMessages: number;
    redactedMessages: number;
  } {
    const messages = Array.from(this.messageHistory.values());
    const connections = Array.from(this.activeConnections.values());

    return {
      policies: this.securityPolicies.size,
      activeConnections: this.activeConnections.size,
      messageHistory: this.messageHistory.size,
      blockedIPs: this.blockedIPs.size,
      suspiciousConnections: connections.filter(c => c.suspiciousActivity).length,
      messagesWithSecrets: messages.filter(m => m.secretsDetected).length,
      encryptedMessages: messages.filter(m => m.encrypted).length,
      redactedMessages: messages.filter(m => m.redacted).length
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
    
    if (stats.suspiciousConnections > 5) {
      status = 'warning'; // High suspicious activity
    }
    
    if (stats.messagesWithSecrets > 10) {
      status = 'warning'; // Too many messages with secrets
    }
    
    if (stats.blockedIPs > 50) {
      status = 'degraded'; // High number of blocked IPs
    }

    const highRiskConnections = Array.from(this.activeConnections.values())
      .filter(c => c.riskScore > 90).length;

    if (highRiskConnections > 0) {
      status = 'critical'; // High-risk connections detected
    }

    return {
      status,
      stats: {
        ...stats,
        highRiskConnections
      }
    };
  }
}

// Export singleton instance
export const webSocketSecurityService = WebSocketSecurityService.getInstance();
