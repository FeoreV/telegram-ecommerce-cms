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
exports.webSocketSecurityService = exports.WebSocketSecurityService = exports.MessageSensitivity = exports.WebSocketEventType = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
const EncryptionService_1 = require("./EncryptionService");
const SecretLeakDetectionService_1 = require("./SecretLeakDetectionService");
var WebSocketEventType;
(function (WebSocketEventType) {
    WebSocketEventType["ORDER_UPDATE"] = "order_update";
    WebSocketEventType["PAYMENT_STATUS"] = "payment_status";
    WebSocketEventType["INVENTORY_ALERT"] = "inventory_alert";
    WebSocketEventType["SYSTEM_NOTIFICATION"] = "system_notification";
    WebSocketEventType["CHAT_MESSAGE"] = "chat_message";
    WebSocketEventType["USER_ACTIVITY"] = "user_activity";
    WebSocketEventType["STORE_UPDATE"] = "store_update";
    WebSocketEventType["ADMIN_ALERT"] = "admin_alert";
})(WebSocketEventType || (exports.WebSocketEventType = WebSocketEventType = {}));
var MessageSensitivity;
(function (MessageSensitivity) {
    MessageSensitivity["PUBLIC"] = "public";
    MessageSensitivity["INTERNAL"] = "internal";
    MessageSensitivity["CONFIDENTIAL"] = "confidential";
    MessageSensitivity["RESTRICTED"] = "restricted";
})(MessageSensitivity || (exports.MessageSensitivity = MessageSensitivity = {}));
class WebSocketSecurityService {
    constructor() {
        this.securityPolicies = new Map();
        this.activeConnections = new Map();
        this.messageHistory = new Map();
        this.blockedIPs = new Set();
        this.suspiciousPatterns = [];
        this.initializeWebSocketSecurity();
        this.loadSecurityPolicies();
        this.setupSuspiciousPatterns();
        this.startSecurityMonitoring();
        logger_1.logger.info('WebSocket Security Service initialized', {
            policies: this.securityPolicies.size,
            suspiciousPatterns: this.suspiciousPatterns.length
        });
    }
    static getInstance() {
        if (!WebSocketSecurityService.instance) {
            WebSocketSecurityService.instance = new WebSocketSecurityService();
        }
        return WebSocketSecurityService.instance;
    }
    async initializeWebSocketSecurity() {
        try {
            await this.initializeSecurityMonitoring();
            await this.loadSecurityBlacklists();
            await this.setupThreatDetection();
            logger_1.logger.info('WebSocket security initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize WebSocket security:', error);
            throw error;
        }
    }
    async initializeSecurityMonitoring() {
        logger_1.logger.debug('WebSocket security monitoring initialized');
    }
    async loadSecurityBlacklists() {
        this.blockedIPs.add('192.168.1.100');
        logger_1.logger.debug('Security blacklists loaded');
    }
    async setupThreatDetection() {
        logger_1.logger.debug('WebSocket threat detection setup completed');
    }
    loadSecurityPolicies() {
        const orderUpdatePolicy = {
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
            maxPayloadSize: 10240,
            encryptionRequired: true,
            auditRequired: true,
            retentionPeriod: 168,
            businessHours: false,
            gdprCompliant: true,
            ccpaCompliant: true,
            enabled: true,
            priority: 1
        };
        const paymentStatusPolicy = {
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
            maxPayloadSize: 4096,
            encryptionRequired: true,
            auditRequired: true,
            retentionPeriod: 2555 * 24,
            businessHours: false,
            gdprCompliant: true,
            ccpaCompliant: true,
            enabled: true,
            priority: 10
        };
        const systemNotificationPolicy = {
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
            maxPayloadSize: 65536,
            encryptionRequired: true,
            auditRequired: true,
            retentionPeriod: 720,
            businessHours: false,
            gdprCompliant: false,
            ccpaCompliant: false,
            enabled: true,
            priority: 5
        };
        const chatMessagePolicy = {
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
            maxPayloadSize: 2048,
            encryptionRequired: false,
            auditRequired: false,
            retentionPeriod: 168,
            businessHours: false,
            gdprCompliant: true,
            ccpaCompliant: true,
            enabled: true,
            priority: 2
        };
        const adminAlertPolicy = {
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
            maxPayloadSize: 32768,
            encryptionRequired: true,
            auditRequired: true,
            retentionPeriod: 2160,
            businessHours: false,
            gdprCompliant: false,
            ccpaCompliant: false,
            enabled: true,
            priority: 15
        };
        const inventoryAlertPolicy = {
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
            maxPayloadSize: 8192,
            encryptionRequired: false,
            auditRequired: false,
            retentionPeriod: 168,
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
        logger_1.logger.info('WebSocket security policies loaded', {
            policyCount: this.securityPolicies.size
        });
    }
    setupSuspiciousPatterns() {
        this.suspiciousPatterns = [
            /(?:mysql|postgresql|mongodb|redis):\/\/[^\s]+/gi,
            /https?:\/\/[^\s]+[?&](?:token|key|secret|api[_-]?key)=[A-Za-z0-9+/=]+/gi,
            /(AKIA[0-9A-Z]{16}|[0-9a-zA-Z/+]{40})/g,
            /-----BEGIN (RSA|DSA|EC|PGP) PRIVATE KEY-----/gi,
            /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
            /\b\d{3}-\d{2}-\d{4}\b/g,
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
            /(?:prod|production|staging|dev)[-_]?(?:db|database|server|host)/gi,
            /(?:rm\s+-rf|sudo|passwd|ssh|ftp|scp|wget|curl)\s+/gi
        ];
        logger_1.logger.debug('Suspicious patterns setup completed', {
            patternCount: this.suspiciousPatterns.length
        });
    }
    async processOutgoingMessage(connectionId, eventType, payload, options = {}) {
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
            await this.validateConnectionAuthorization(connection, policy, options);
            await this.checkRateLimit(connection, policy);
            const payloadString = JSON.stringify(payload);
            if (payloadString.length > policy.maxPayloadSize) {
                throw new Error(`Payload exceeds maximum size: ${payloadString.length} > ${policy.maxPayloadSize}`);
            }
            const message = {
                id: messageId,
                type: eventType,
                payload,
                originalPayload: JSON.parse(JSON.stringify(payload)),
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
            await this.applySecurityProcessing(message, policy);
            this.messageHistory.set(messageId, message);
            connection.messagesSent++;
            connection.lastActivity = new Date();
            logger_1.logger.info('WebSocket message processed', {
                messageId,
                connectionId,
                eventType,
                encrypted: message.encrypted,
                redacted: message.redacted,
                secretsDetected: message.secretsDetected,
                payloadSize: payloadString.length
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
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
        }
        catch (error) {
            logger_1.logger.error('WebSocket message processing failed', {
                messageId,
                connectionId,
                eventType,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            const connection = this.activeConnections.get(connectionId);
            if (connection) {
                connection.riskScore += 10;
                if (connection.riskScore > 100) {
                    connection.suspiciousActivity = true;
                    connection.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
                }
            }
            return null;
        }
    }
    async validateConnectionAuthorization(connection, policy, options) {
        if (!connection.authenticated) {
            throw new Error('Connection not authenticated');
        }
        if (!connection.authorized) {
            throw new Error('Connection not authorized');
        }
        if (!policy.allowedRoles.includes(connection.userRole)) {
            throw new Error(`Role not authorized for this event type: ${connection.userRole}`);
        }
        if (policy.requireStoreAccess && options.targetStoreId) {
            if (connection.storeId !== options.targetStoreId) {
                throw new Error('Store access not authorized');
            }
        }
        if (policy.ipWhitelist && policy.ipWhitelist.length > 0) {
            if (!policy.ipWhitelist.includes(connection.ipAddress)) {
                throw new Error('IP address not whitelisted');
            }
        }
        if (connection.blockedUntil && connection.blockedUntil > new Date()) {
            throw new Error('Connection is temporarily blocked due to suspicious activity');
        }
        if (this.blockedIPs.has(connection.ipAddress)) {
            throw new Error('IP address is blocked');
        }
    }
    async checkRateLimit(connection, policy) {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 60 * 1000);
        if (connection.rateLimitWindow < windowStart) {
            connection.rateLimitWindow = now;
            connection.rateLimitCount = 0;
        }
        if (connection.rateLimitCount >= policy.maxMessagesPerMinute) {
            connection.suspiciousActivity = true;
            throw new Error('Rate limit exceeded');
        }
        connection.rateLimitCount++;
    }
    determineSensitivity(eventType, _payload) {
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
    async applySecurityProcessing(message, policy) {
        if (policy.enableSecretDetection) {
            const secretDetectionResult = await this.detectSecrets(message);
            if (secretDetectionResult.detected) {
                message.secretsDetected = true;
                if (secretDetectionResult.riskScore > 80) {
                    throw new Error('High-risk secrets detected, message blocked');
                }
                else {
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
        if (policy.enableContentValidation) {
            await this.validateMessageContent(message);
        }
        if (policy.encryptionRequired) {
            await this.encryptMessage(message);
        }
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
    async detectSecrets(message) {
        const payloadString = JSON.stringify(message.payload);
        const secrets = [];
        let maxRiskScore = 0;
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
                pattern.lastIndex = 0;
                break;
            }
        }
        await SecretLeakDetectionService_1.secretLeakDetectionService.scanLogEntry(payloadString, 'websocket_message');
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
    calculateSecretConfidence(value, pattern) {
        let confidence = 0.5;
        if (pattern.source.includes('eyJ')) {
            confidence = 0.95;
        }
        else if (pattern.source.includes('mysql|postgresql')) {
            confidence = 0.9;
        }
        else if (pattern.source.includes('AKIA')) {
            confidence = 0.95;
        }
        else if (pattern.source.includes('\\d{4}[\\s-]?\\d{4}')) {
            confidence = 0.8;
        }
        else {
            confidence = 0.6;
        }
        const entropy = this.calculateEntropy(value);
        if (entropy > 4.0) {
            confidence += 0.2;
        }
        else if (entropy < 2.0) {
            confidence -= 0.3;
        }
        return Math.max(0, Math.min(1, confidence));
    }
    calculateEntropy(str) {
        if (!str || str.length === 0)
            return 0;
        const frequencies = {};
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
    getSecretType(pattern) {
        const source = pattern.source.toLowerCase();
        if (source.includes('eyj'))
            return 'jwt_token';
        if (source.includes('akia'))
            return 'aws_access_key';
        if (source.includes('mysql|postgresql'))
            return 'database_connection';
        if (source.includes('\\d{4}[\\s-]?\\d{4}'))
            return 'credit_card';
        if (source.includes('\\d{3}-\\d{2}-\\d{4}'))
            return 'ssn';
        if (source.includes('private key'))
            return 'private_key';
        if (source.includes('@[a-za-z0-9.-]+'))
            return 'email_address';
        return 'unknown_secret';
    }
    generateRedactedValue(value) {
        if (value.length <= 4) {
            return '*'.repeat(value.length);
        }
        const start = value.substring(0, 2);
        const end = value.substring(value.length - 2);
        const middle = '*'.repeat(value.length - 4);
        return start + middle + end;
    }
    redactSecrets(payload, detectionResult) {
        let payloadString = JSON.stringify(payload);
        const sortedSecrets = detectionResult.secrets.sort((a, b) => b.position - a.position);
        for (const secret of sortedSecrets) {
            payloadString = payloadString.substring(0, secret.position) +
                secret.redactedValue +
                payloadString.substring(secret.position + secret.value.length);
        }
        try {
            return JSON.parse(payloadString);
        }
        catch (error) {
            return { message: '[REDACTED_DUE_TO_SECURITY_POLICY]' };
        }
    }
    async detectAndRedactPII(message) {
        const payloadString = JSON.stringify(message.payload);
        let piiDetected = false;
        let redactedPayload = payloadString;
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        if (emailPattern.test(payloadString)) {
            redactedPayload = redactedPayload.replace(emailPattern, '[EMAIL_REDACTED]');
            piiDetected = true;
        }
        const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        if (phonePattern.test(payloadString)) {
            redactedPayload = redactedPayload.replace(phonePattern, '[PHONE_REDACTED]');
            piiDetected = true;
        }
        const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
        if (ipPattern.test(payloadString)) {
            redactedPayload = redactedPayload.replace(ipPattern, '[IP_REDACTED]');
            piiDetected = true;
        }
        if (piiDetected) {
            try {
                message.payload = JSON.parse(redactedPayload);
            }
            catch (error) {
                message.payload = { message: '[PII_REDACTED]' };
            }
        }
        return piiDetected;
    }
    async validateMessageContent(message) {
        const payloadString = JSON.stringify(message.payload);
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
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
            /(UNION\s+SELECT)/gi,
            /('|"|;|--|\/\*|\*\/)/gi
        ];
        for (const pattern of sqlPatterns) {
            if (pattern.test(payloadString)) {
                logger_1.logger.warn('Potential SQL injection attempt detected', {
                    messageId: message.id,
                    pattern: pattern.source
                });
            }
        }
    }
    async encryptMessage(message) {
        try {
            const payloadString = JSON.stringify(message.payload);
            const encrypted = await EncryptionService_1.encryptionService.encryptData(payloadString, 'websocket-encryption-key');
            message.payload = { encrypted: encrypted };
            message.encrypted = true;
            message.auditTrail.push({
                timestamp: new Date(),
                action: 'message_encrypted',
                details: {
                    algorithm: 'AES-256-GCM',
                    keyId: 'websocket-encryption-key'
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Message encryption failed', {
                messageId: message.id,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    calculateMessageRiskScore(message) {
        let riskScore = 0;
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
        if (message.secretsDetected)
            riskScore += 50;
        if (message.containsPII)
            riskScore += 30;
        if (!message.encrypted && message.sensitivity !== MessageSensitivity.PUBLIC)
            riskScore += 20;
        if (message.broadcast)
            riskScore += 15;
        if (message.encrypted)
            riskScore -= 20;
        if (message.redacted)
            riskScore -= 15;
        return Math.max(0, Math.min(100, riskScore));
    }
    async registerConnection(connectionId, userId, userRole, storeId, ipAddress, userAgent, sessionId) {
        const connection = {
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
        logger_1.logger.info('WebSocket connection registered', {
            connectionId,
            userId,
            userRole,
            storeId,
            ipAddress
        });
        await SecurityLogService_1.securityLogService.logSecurityEvent({
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
    async unregisterConnection(connectionId) {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            this.activeConnections.delete(connectionId);
            const sessionDuration = Date.now() - connection.connectionTime.getTime();
            logger_1.logger.info('WebSocket connection unregistered', {
                connectionId,
                userId: connection.userId,
                sessionDuration,
                messagesSent: connection.messagesSent,
                messagesReceived: connection.messagesReceived
            });
        }
    }
    startSecurityMonitoring() {
        setInterval(() => {
            this.cleanupExpiredMessages();
        }, 60 * 1000);
        setInterval(() => {
            this.monitorSuspiciousActivity();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.updateConnectionRiskScores();
        }, 10 * 60 * 1000);
        logger_1.logger.info('WebSocket security monitoring started');
    }
    cleanupExpiredMessages() {
        const now = new Date();
        let expiredCount = 0;
        for (const [messageId, message] of this.messageHistory.entries()) {
            if (message.expiresAt && message.expiresAt < now) {
                this.messageHistory.delete(messageId);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            logger_1.logger.debug('Cleaned up expired WebSocket messages', { expiredCount });
        }
    }
    monitorSuspiciousActivity() {
        for (const [connectionId, connection] of this.activeConnections.entries()) {
            if (connection.riskScore > 80) {
                connection.suspiciousActivity = true;
                logger_1.logger.warn('Suspicious WebSocket activity detected', {
                    connectionId,
                    userId: connection.userId,
                    riskScore: connection.riskScore
                });
            }
            const idleTime = Date.now() - connection.lastActivity.getTime();
            if (idleTime > 30 * 60 * 1000) {
                logger_1.logger.debug('Idle WebSocket connection detected', {
                    connectionId,
                    idleTime
                });
            }
        }
    }
    updateConnectionRiskScores() {
        for (const [, connection] of this.activeConnections.entries()) {
            connection.riskScore = Math.max(0, connection.riskScore - 5);
            if (connection.riskScore < 30) {
                connection.suspiciousActivity = false;
                connection.blockedUntil = undefined;
            }
        }
    }
    getStats() {
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
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.suspiciousConnections > 5) {
            status = 'warning';
        }
        if (stats.messagesWithSecrets > 10) {
            status = 'warning';
        }
        if (stats.blockedIPs > 50) {
            status = 'degraded';
        }
        const highRiskConnections = Array.from(this.activeConnections.values())
            .filter(c => c.riskScore > 90).length;
        if (highRiskConnections > 0) {
            status = 'critical';
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
exports.WebSocketSecurityService = WebSocketSecurityService;
exports.webSocketSecurityService = WebSocketSecurityService.getInstance();
//# sourceMappingURL=WebSocketSecurityService.js.map