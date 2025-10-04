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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityLogService = exports.SecurityLogService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const TenantCacheService_1 = require("./TenantCacheService");
const EncryptionService_1 = require("./EncryptionService");
const securityKeys_1 = require("../config/securityKeys");
class SecurityLogService {
    constructor() {
        this.logBuffer = new Map();
        this.encryptionKeys = new Map();
        this.alertRules = new Map();
        this.bufferFlushInterval = 30000;
        this.maxBufferSize = 1000;
        this.isInitialized = false;
        this.config = {
            enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
            enableEncryption: process.env.ENABLE_LOG_ENCRYPTION !== 'false',
            enableCompression: process.env.ENABLE_LOG_COMPRESSION !== 'false',
            enableWriteOnceStorage: process.env.ENABLE_WRITE_ONCE_STORAGE !== 'false',
            logLevel: process.env.SECURITY_LOG_LEVEL || 'INFO',
            securityEventLevel: process.env.SECURITY_EVENT_LEVEL || 'MEDIUM',
            storageType: process.env.LOG_STORAGE_TYPE || 'file',
            retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '2555'),
            maxLogSize: parseInt(process.env.MAX_LOG_SIZE || '104857600'),
            rotationInterval: parseInt(process.env.LOG_ROTATION_INTERVAL || '24'),
            encryptionAlgorithm: process.env.LOG_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
            keyRotationInterval: parseInt(process.env.LOG_KEY_ROTATION_DAYS || '90'),
            enableIntegrityChecks: process.env.ENABLE_LOG_INTEGRITY_CHECKS !== 'false',
            enableSIEMIntegration: process.env.ENABLE_SIEM_INTEGRATION === 'true',
            siemEndpoint: process.env.SIEM_ENDPOINT,
            siemApiKey: process.env.SIEM_API_KEY,
            siemFormat: process.env.SIEM_FORMAT || 'JSON',
            alertThresholds: {
                failedLogins: parseInt(process.env.ALERT_FAILED_LOGINS || '5'),
                suspiciousActivity: parseInt(process.env.ALERT_SUSPICIOUS_ACTIVITY || '3'),
                dataAccess: parseInt(process.env.ALERT_DATA_ACCESS || '10'),
                privilegedAccess: parseInt(process.env.ALERT_PRIVILEGED_ACCESS || '1')
            }
        };
        this.initializeSecurityLogging()
            .then(() => {
            this.isInitialized = true;
            this.startBackgroundTasks();
            logger_1.logger.info('Security Log Service initialized successfully', {
                encryptionEnabled: this.config.enableEncryption,
                siemEnabled: this.config.enableSIEMIntegration,
                storageType: this.config.storageType,
                retentionDays: this.config.retentionDays
            });
        })
            .catch((error) => {
            logger_1.logger.error('Failed to initialize Security Log Service:', (0, logger_1.toLogMetadata)(error));
            this.isInitialized = false;
        });
    }
    static getInstance() {
        if (!SecurityLogService.instance) {
            SecurityLogService.instance = new SecurityLogService();
        }
        return SecurityLogService.instance;
    }
    async waitForInitialization(timeoutMs = 30000) {
        if (this.isInitialized) {
            return;
        }
        const startTime = Date.now();
        while (!this.isInitialized && (Date.now() - startTime) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!this.isInitialized) {
            throw new Error(`SecurityLogService initialization timeout after ${timeoutMs}ms`);
        }
    }
    async initializeSecurityLogging() {
        try {
            await this.initializeEncryptionKeys();
            this.initializeAlertRules();
            await this.initializeStorage();
            if (this.config.enableSIEMIntegration) {
                await this.testSIEMConnection();
            }
            logger_1.logger.info('Security logging initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize security logging:', (0, logger_1.toLogMetadata)(error));
            throw error;
        }
    }
    async initializeEncryptionKeys() {
        if (!this.config.enableEncryption) {
            return;
        }
        try {
            const keyId = (0, securityKeys_1.getSecurityKeyId)('securityLogsEncryptionKeyId');
            let encryptionKey = await EncryptionService_1.encryptionService.getDataKey(keyId);
            if (!encryptionKey) {
                encryptionKey = await EncryptionService_1.encryptionService.generateDataKey(keyId, 32);
                logger_1.logger.info('Generated new encryption key for security logs');
            }
            this.encryptionKeys.set(keyId, Buffer.from(encryptionKey, 'hex'));
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize encryption keys:', (0, logger_1.toLogMetadata)(error));
            throw error;
        }
    }
    initializeAlertRules() {
        this.alertRules.set('failed_login_threshold', {
            type: 'threshold',
            field: 'eventType',
            value: 'authentication_failed',
            threshold: this.config.alertThresholds.failedLogins,
            timeWindow: 300000,
            severity: 'HIGH'
        });
        this.alertRules.set('privileged_access', {
            type: 'match',
            field: 'tags',
            value: 'privileged_access',
            threshold: this.config.alertThresholds.privilegedAccess,
            timeWindow: 60000,
            severity: 'CRITICAL'
        });
        this.alertRules.set('data_access_anomaly', {
            type: 'threshold',
            field: 'category',
            value: 'data_access',
            threshold: this.config.alertThresholds.dataAccess,
            timeWindow: 600000,
            severity: 'MEDIUM'
        });
        this.alertRules.set('suspicious_activity', {
            type: 'pattern',
            conditions: [
                { field: 'riskScore', operator: 'gte', value: 70 },
                { field: 'success', operator: 'eq', value: false }
            ],
            threshold: this.config.alertThresholds.suspiciousActivity,
            timeWindow: 900000,
            severity: 'HIGH'
        });
    }
    async initializeStorage() {
        switch (this.config.storageType) {
            case 'file':
                await this.initializeFileStorage();
                break;
            case 'elasticsearch':
                await this.initializeElasticsearchStorage();
                break;
            case 's3':
                await this.initializeS3Storage();
                break;
            case 'splunk':
                await this.initializeSplunkStorage();
                break;
            default:
                throw new Error(`Unsupported storage type: ${this.config.storageType}`);
        }
    }
    async initializeFileStorage() {
        const logDir = path.join(process.cwd(), 'logs', 'security');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        if (this.config.enableWriteOnceStorage) {
            try {
                fs.chmodSync(logDir, 0o755);
            }
            catch (error) {
                logger_1.logger.warn('Could not set write-once permissions:', (0, logger_1.toLogMetadata)(error));
            }
        }
    }
    async initializeElasticsearchStorage() {
        logger_1.logger.info('Elasticsearch storage initialized');
    }
    async initializeS3Storage() {
        logger_1.logger.info('S3 storage initialized');
    }
    async initializeSplunkStorage() {
        logger_1.logger.info('Splunk storage initialized');
    }
    async testSIEMConnection() {
        if (!this.config.siemEndpoint) {
            logger_1.logger.warn('SIEM endpoint not configured');
            return;
        }
        try {
            const testEvent = this.createTestEvent();
            await this.sendToSIEM([testEvent]);
            logger_1.logger.info('SIEM connection test successful');
        }
        catch (error) {
            logger_1.logger.error('SIEM connection test failed:', (0, logger_1.toLogMetadata)(error));
        }
    }
    createTestEvent() {
        return {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            eventType: 'siem_connection_test',
            severity: 'LOW',
            category: 'system',
            ipAddress: '127.0.0.1',
            success: true,
            details: {
                message: 'SIEM connection test',
                service: 'SecurityLogService'
            },
            riskScore: 0,
            tags: ['test', 'siem'],
            compliance: {
                pii: false,
                gdpr: false,
                pci: false,
                hipaa: false
            }
        };
    }
    async logSecurityEvent(event) {
        if (!this.config.enableSecurityLogging) {
            return;
        }
        try {
            const securityEvent = {
                id: event.id || crypto_1.default.randomUUID(),
                timestamp: event.timestamp || new Date(),
                eventType: event.eventType || 'unknown',
                severity: event.severity || 'LOW',
                category: event.category || 'application',
                ipAddress: event.ipAddress || 'unknown',
                success: event.success ?? true,
                details: event.details || {},
                riskScore: event.riskScore || 0,
                tags: event.tags || [],
                compliance: event.compliance || {
                    pii: false,
                    gdpr: false,
                    pci: false,
                    hipaa: false
                },
                ...event
            };
            const bufferKey = `${securityEvent.category}_${securityEvent.severity}`;
            if (!this.logBuffer.has(bufferKey)) {
                this.logBuffer.set(bufferKey, []);
            }
            const currentBuffer = this.logBuffer.get(bufferKey);
            if (currentBuffer) {
                currentBuffer.push(securityEvent);
                if (securityEvent.severity === 'CRITICAL' || currentBuffer.length >= this.maxBufferSize) {
                    await this.flushBuffer(bufferKey);
                }
            }
            await this.checkAlertRules(securityEvent);
            if (this.config.enableSIEMIntegration) {
                await this.sendToSIEM([securityEvent]);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to log security event:', (0, logger_1.toLogMetadata)(error));
        }
    }
    async logAuthenticationEvent(userId, action, success, ipAddress, userAgent, details = {}) {
        await this.logSecurityEvent({
            eventType: `authentication_${action}`,
            category: 'authentication',
            severity: success ? 'LOW' : 'MEDIUM',
            userId,
            ipAddress,
            userAgent,
            success,
            details: {
                action,
                ...details
            },
            riskScore: success ? 10 : 40,
            tags: ['authentication', action],
            compliance: {
                pii: true,
                gdpr: true,
                pci: false,
                hipaa: false
            }
        });
    }
    async logDataAccessEvent(userId, resource, action, success, ipAddress, details = {}) {
        await this.logSecurityEvent({
            eventType: `data_access_${action}`,
            category: 'data_access',
            severity: success ? 'LOW' : 'HIGH',
            userId,
            resource,
            action,
            ipAddress,
            success,
            details: {
                resource,
                action,
                ...details
            },
            riskScore: success ? 5 : 60,
            tags: ['data_access', action],
            compliance: {
                pii: true,
                gdpr: true,
                pci: true,
                hipaa: true
            }
        });
    }
    async logPrivilegedAccessEvent(userId, action, resource, ipAddress, success, details = {}) {
        await this.logSecurityEvent({
            eventType: `privileged_access_${action}`,
            category: 'authorization',
            severity: 'HIGH',
            userId,
            resource,
            action,
            ipAddress,
            success,
            details: {
                privilegedAction: action,
                targetResource: resource,
                ...details
            },
            riskScore: 70,
            tags: ['privileged_access', action],
            compliance: {
                pii: false,
                gdpr: true,
                pci: true,
                hipaa: true
            }
        });
    }
    async logNetworkSecurityEvent(eventType, severity, ipAddress, details = {}) {
        await this.logSecurityEvent({
            eventType,
            category: 'network',
            severity,
            ipAddress,
            success: severity === 'LOW',
            details,
            riskScore: this.calculateNetworkRiskScore(severity),
            tags: ['network', eventType],
            compliance: {
                pii: false,
                gdpr: false,
                pci: false,
                hipaa: false
            }
        });
    }
    async logApplicationSecurityEvent(eventType, severity, ipAddress, userAgent, details = {}) {
        await this.logSecurityEvent({
            eventType,
            category: 'application',
            severity,
            ipAddress,
            userAgent,
            success: severity === 'LOW',
            details,
            riskScore: this.calculateApplicationRiskScore(severity, eventType),
            tags: ['application', eventType],
            compliance: {
                pii: false,
                gdpr: false,
                pci: false,
                hipaa: false
            }
        });
    }
    calculateNetworkRiskScore(severity) {
        switch (severity) {
            case 'CRITICAL': return 90;
            case 'HIGH': return 70;
            case 'MEDIUM': return 40;
            case 'LOW': return 10;
            default: return 0;
        }
    }
    calculateApplicationRiskScore(severity, eventType) {
        let baseScore = this.calculateNetworkRiskScore(severity);
        if (eventType.includes('injection')) {
            baseScore += 20;
        }
        else if (eventType.includes('xss')) {
            baseScore += 15;
        }
        else if (eventType.includes('csrf')) {
            baseScore += 10;
        }
        return Math.min(100, baseScore);
    }
    async checkAlertRules(event) {
        for (const [ruleName, rule] of this.alertRules.entries()) {
            try {
                if (await this.evaluateAlertRule(rule, event)) {
                    await this.triggerAlert(ruleName, rule, event);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to evaluate alert rule ${ruleName}:`, (0, logger_1.toLogMetadata)(error));
            }
        }
    }
    async evaluateAlertRule(rule, event) {
        switch (rule.type) {
            case 'threshold':
                return await this.evaluateThresholdRule(rule, event);
            case 'match':
                return this.evaluateMatchRule(rule, event);
            case 'pattern':
                return this.evaluatePatternRule(rule, event);
            default:
                return false;
        }
    }
    async evaluateThresholdRule(rule, event) {
        if (event[rule.field] !== rule.value) {
            return false;
        }
        const cacheKey = `alert_count:${rule.field}:${rule.value}`;
        const currentCount = await TenantCacheService_1.tenantCacheService.get('system', cacheKey) || 0;
        const newCount = currentCount + 1;
        await TenantCacheService_1.tenantCacheService.set('system', cacheKey, newCount, { ttl: Math.floor(rule.timeWindow / 1000) });
        return newCount >= rule.threshold;
    }
    evaluateMatchRule(rule, event) {
        const fieldValue = event[rule.field];
        if (Array.isArray(fieldValue)) {
            return fieldValue.includes(rule.value);
        }
        return fieldValue === rule.value;
    }
    evaluatePatternRule(rule, event) {
        return rule.conditions.every((condition) => {
            const fieldValue = event[condition.field];
            switch (condition.operator) {
                case 'eq': return fieldValue === condition.value;
                case 'ne': return fieldValue !== condition.value;
                case 'gt': return fieldValue > condition.value;
                case 'gte': return fieldValue >= condition.value;
                case 'lt': return fieldValue < condition.value;
                case 'lte': return fieldValue <= condition.value;
                case 'contains': return fieldValue.includes(condition.value);
                default: return false;
            }
        });
    }
    async triggerAlert(ruleName, rule, event) {
        const alert = {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            severity: rule.severity,
            title: `Security Alert: ${ruleName}`,
            description: `Alert triggered by rule: ${ruleName}`,
            events: [event],
            indicators: this.extractIndicators(event),
            recommendations: this.generateRecommendations(ruleName, event),
            status: 'open'
        };
        logger_1.logger.warn('Security alert triggered', {
            alertId: alert.id,
            ruleName,
            severity: alert.severity,
            eventId: event.id
        });
        if (this.config.enableSIEMIntegration) {
            await this.sendAlertToSIEM(alert);
        }
        await this.storeAlert(alert);
    }
    extractIndicators(event) {
        const indicators = [];
        if (event.ipAddress && event.ipAddress !== 'unknown') {
            indicators.push(`ip:${event.ipAddress}`);
        }
        if (event.userId) {
            indicators.push(`user:${event.userId}`);
        }
        if (event.userAgent) {
            indicators.push(`user_agent:${event.userAgent}`);
        }
        return indicators;
    }
    generateRecommendations(ruleName, _event) {
        const recommendations = [];
        switch (ruleName) {
            case 'failed_login_threshold':
                recommendations.push('Consider implementing account lockout policy');
                recommendations.push('Review IP address for potential blocking');
                recommendations.push('Enable MFA for affected account');
                break;
            case 'privileged_access':
                recommendations.push('Verify privileged access was authorized');
                recommendations.push('Review user permissions and roles');
                recommendations.push('Enable additional monitoring for this user');
                break;
            case 'data_access_anomaly':
                recommendations.push('Review data access patterns for anomalies');
                recommendations.push('Verify business justification for access');
                recommendations.push('Consider implementing data access controls');
                break;
            default:
                recommendations.push('Investigate event details thoroughly');
                recommendations.push('Review related events in timeframe');
                recommendations.push('Update security controls if necessary');
        }
        return recommendations;
    }
    async flushBuffer(bufferKey) {
        const keysToFlush = bufferKey ? [bufferKey] : Array.from(this.logBuffer.keys());
        for (const key of keysToFlush) {
            const events = this.logBuffer.get(key);
            if (!events || events.length === 0)
                continue;
            try {
                await this.writeEventsToStorage(events);
                this.logBuffer.set(key, []);
            }
            catch (error) {
                logger_1.logger.error(`Failed to flush buffer ${key}:`, (0, logger_1.toLogMetadata)(error));
            }
        }
    }
    async writeEventsToStorage(events) {
        switch (this.config.storageType) {
            case 'file':
                await this.writeToFileStorage(events);
                break;
            case 'elasticsearch':
                await this.writeToElasticsearch(events);
                break;
            case 's3':
                await this.writeToS3Storage(events);
                break;
            case 'splunk':
                await this.writeToSplunk(events);
                break;
        }
    }
    async writeToFileStorage(events) {
        const logDir = path.join(process.cwd(), 'logs', 'security');
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `security-${timestamp}.log`;
        const filepath = path.join(logDir, filename);
        let wasReadOnly = false;
        if (fs.existsSync(filepath)) {
            try {
                const stats = fs.statSync(filepath);
                wasReadOnly = !(stats.mode & 0o200);
                if (wasReadOnly) {
                    fs.chmodSync(filepath, 0o644);
                }
            }
            catch (error) {
                logger_1.logger.warn('Could not check/modify file permissions:', (0, logger_1.toLogMetadata)(error));
            }
        }
        for (const event of events) {
            const logEntry = await this.createLogEntry(event);
            const logLine = JSON.stringify(logEntry) + '\n';
            const dataToWrite = this.config.enableEncryption
                ? await this.encryptLogData(logLine)
                : logLine;
            fs.appendFileSync(filepath, dataToWrite);
        }
        if (this.config.enableWriteOnceStorage && !wasReadOnly) {
            try {
                fs.chmodSync(filepath, 0o444);
            }
            catch (error) {
                logger_1.logger.warn('Could not set file immutable:', (0, logger_1.toLogMetadata)(error));
            }
        }
    }
    async writeToElasticsearch(events) {
        logger_1.logger.debug(`Writing ${events.length} events to Elasticsearch`);
    }
    async writeToS3Storage(events) {
        logger_1.logger.debug(`Writing ${events.length} events to S3`);
    }
    async writeToSplunk(events) {
        logger_1.logger.debug(`Writing ${events.length} events to Splunk`);
    }
    async createLogEntry(_event) {
        const logData = JSON.stringify(_event);
        const checksum = crypto_1.default.createHash('sha256').update(logData).digest('hex');
        return {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            level: 'SECURITY',
            message: _event.eventType,
            metadata: _event,
            source: 'SecurityLogService',
            encrypted: this.config.enableEncryption,
            checksum
        };
    }
    async encryptLogData(data) {
        if (!this.isInitialized) {
            logger_1.logger.info('Waiting for SecurityLogService initialization to complete...');
            let attempts = 0;
            while (!this.isInitialized && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 5000)));
                attempts++;
            }
            if (!this.isInitialized) {
                logger_1.logger.error('SecurityLogService initialization timeout - falling back to unencrypted logs');
                return data;
            }
        }
        if (!this.config.enableEncryption) {
            return data;
        }
        try {
            const keyId = (0, securityKeys_1.getSecurityKeyId)('securityLogsEncryptionKeyId');
            const encryptionKey = this.encryptionKeys.get(keyId);
            if (!encryptionKey) {
                logger_1.logger.warn('Encryption key not found, attempting to reinitialize...');
                await this.initializeEncryptionKeys();
                const retryKey = this.encryptionKeys.get(keyId);
                if (!retryKey) {
                    throw new Error('Encryption key not found after reinitialization');
                }
                if (retryKey.length !== 32) {
                    throw new Error(`Invalid key length: expected 32 bytes, got ${retryKey.length} bytes`);
                }
                const iv = crypto_1.default.randomBytes(16);
                const cipher = crypto_1.default.createCipheriv(this.config.encryptionAlgorithm, retryKey, iv);
                let encrypted = cipher.update(data, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                const result = {
                    encrypted: true,
                    algorithm: this.config.encryptionAlgorithm,
                    iv: iv.toString('hex'),
                    data: encrypted
                };
                if (this.config.encryptionAlgorithm.includes('gcm')) {
                    result.authTag = cipher.getAuthTag().toString('hex');
                }
                return JSON.stringify(result);
            }
            if (encryptionKey.length !== 32) {
                throw new Error(`Invalid key length: expected 32 bytes, got ${encryptionKey.length} bytes`);
            }
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv(this.config.encryptionAlgorithm, encryptionKey, iv);
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const result = {
                encrypted: true,
                algorithm: this.config.encryptionAlgorithm,
                iv: iv.toString('hex'),
                data: encrypted
            };
            if (this.config.encryptionAlgorithm.includes('gcm')) {
                result.authTag = cipher.getAuthTag().toString('hex');
            }
            return JSON.stringify(result);
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt log data:', (0, logger_1.toLogMetadata)(error));
            return data;
        }
    }
    async sendToSIEM(events) {
        if (!this.config.enableSIEMIntegration || !this.config.siemEndpoint) {
            return;
        }
        try {
            const formattedEvents = this.formatEventsForSIEM(events);
            const response = await fetch(this.config.siemEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.siemApiKey}`,
                    'User-Agent': 'BotRT-SecurityLogService/1.0'
                },
                body: JSON.stringify(formattedEvents)
            });
            if (!response.ok) {
                throw new Error(`SIEM request failed: ${response.status} ${response.statusText}`);
            }
            logger_1.logger.debug(`Sent ${events.length} events to SIEM successfully`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send events to SIEM:', (0, logger_1.toLogMetadata)(error));
        }
    }
    formatEventsForSIEM(events) {
        return events.map(event => {
            switch (this.config.siemFormat) {
                case 'CEF':
                    return this.formatAsCEF(event);
                case 'LEEF':
                    return this.formatAsLEEF(event);
                case 'SYSLOG':
                    return this.formatAsSyslog(event);
                case 'JSON':
                default:
                    return this.formatAsJSON(event);
            }
        });
    }
    formatAsCEF(event) {
        return `CEF:0|BotRT|SecurityLogService|1.0|${event.eventType}|${event.eventType}|${this.mapSeverityToCEF(event.severity)}|src=${event.ipAddress} suser=${event.userId || ''} act=${event.action || ''} outcome=${event.success ? 'success' : 'failure'}`;
    }
    formatAsLEEF(event) {
        return `LEEF:2.0|BotRT|SecurityLogService|1.0|${event.eventType}|src=${event.ipAddress}|suser=${event.userId || ''}|act=${event.action || ''}|outcome=${event.success ? 'success' : 'failure'}`;
    }
    formatAsSyslog(event) {
        const priority = this.mapSeverityToSyslog(event.severity);
        const timestamp = event.timestamp.toISOString();
        return `<${priority}>${timestamp} botrt-security: ${JSON.stringify(event)}`;
    }
    formatAsJSON(event) {
        return {
            ...event,
            resource: event.resource || 'BotRT',
            product: 'SecurityLogService',
            version: '1.0'
        };
    }
    mapSeverityToCEF(severity) {
        switch (severity) {
            case 'CRITICAL': return 10;
            case 'HIGH': return 8;
            case 'MEDIUM': return 5;
            case 'LOW': return 2;
            default: return 1;
        }
    }
    mapSeverityToSyslog(severity) {
        switch (severity) {
            case 'CRITICAL': return 130;
            case 'HIGH': return 131;
            case 'MEDIUM': return 132;
            case 'LOW': return 134;
            default: return 135;
        }
    }
    async sendAlertToSIEM(alert) {
        if (!this.config.enableSIEMIntegration) {
            return;
        }
        try {
            const alertData = {
                type: 'security_alert',
                alert,
                timestamp: new Date().toISOString(),
                resource: 'BotRT-SecurityLogService'
            };
            await this.sendToSIEM([alertData]);
        }
        catch (error) {
            logger_1.logger.error('Failed to send alert to SIEM:', (0, logger_1.toLogMetadata)(error));
        }
    }
    async storeAlert(alert) {
        try {
            await TenantCacheService_1.tenantCacheService.set('system', `security_alert_${alert.id}`, alert, { ttl: 86400, namespace: 'security_alerts' });
            logger_1.logger.info('Security alert stored', {
                alertId: alert.id,
                severity: alert.severity
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to store alert:', (0, logger_1.toLogMetadata)(error));
        }
    }
    startBackgroundTasks() {
        setInterval(() => {
            this.flushBuffer().catch((error) => {
                logger_1.logger.error('Background buffer flush failed:', (0, logger_1.toLogMetadata)(error));
            });
        }, this.bufferFlushInterval);
        setInterval(() => {
            this.rotateLogsIfNeeded().catch((error) => {
                logger_1.logger.error('Log rotation failed:', (0, logger_1.toLogMetadata)(error));
            });
        }, this.config.rotationInterval * 3600000);
        setInterval(() => {
            this.rotateEncryptionKeysIfNeeded().catch((error) => {
                logger_1.logger.error('Key rotation failed:', (0, logger_1.toLogMetadata)(error));
            });
        }, 24 * 3600000);
    }
    async rotateLogsIfNeeded() {
        if (this.config.storageType !== 'file') {
            return;
        }
        logger_1.logger.debug('Checking if log rotation is needed');
    }
    async rotateEncryptionKeysIfNeeded() {
        if (!this.config.enableEncryption) {
            return;
        }
        logger_1.logger.debug('Checking if encryption key rotation is needed');
    }
    getStats() {
        const bufferSizes = {};
        for (const [key, buffer] of this.logBuffer.entries()) {
            bufferSizes[key] = buffer.length;
        }
        return {
            config: this.config,
            bufferSizes,
            encryptionEnabled: this.config.enableEncryption,
            siemConnected: this.config.enableSIEMIntegration
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            if (this.config.enableEncryption) {
                await this.encryptLogData('health_check_test');
            }
            if (this.config.enableSIEMIntegration) {
            }
            return {
                status: 'healthy',
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('Security log service health check failed:', (0, logger_1.toLogMetadata)(error));
            return {
                status: 'error',
                stats: {
                    config: this.config,
                    bufferSizes: Object.fromEntries(Array.from(this.logBuffer.entries()).map(([k, v]) => [k, v.length])),
                    encryptionEnabled: this.config.enableEncryption,
                    siemConnected: this.config.enableSIEMIntegration
                },
            };
        }
    }
}
exports.SecurityLogService = SecurityLogService;
exports.securityLogService = SecurityLogService.getInstance();
//# sourceMappingURL=SecurityLogService.js.map