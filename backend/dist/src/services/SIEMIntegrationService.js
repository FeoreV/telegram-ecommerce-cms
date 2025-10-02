"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.siemIntegrationService = exports.SIEMIntegrationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const TenantCacheService_1 = require("./TenantCacheService");
class SIEMIntegrationService {
    constructor() {
        this.eventBuffer = [];
        this.alertRules = new Map();
        this.activeAlerts = new Map();
        this.rateLimiter = new Map();
        this.healthStatus = 'healthy';
        this.lastHealthCheck = new Date();
        this.config = {
            enableSIEM: process.env.ENABLE_SIEM_INTEGRATION === 'true',
            siemType: process.env.SIEM_TYPE || 'elasticsearch',
            endpoint: process.env.SIEM_ENDPOINT || '',
            apiKey: process.env.SIEM_API_KEY,
            username: process.env.SIEM_USERNAME,
            password: process.env.SIEM_PASSWORD,
            tenantId: process.env.SIEM_TENANT_ID,
            authType: process.env.SIEM_AUTH_TYPE || 'api_key',
            oauth2Config: process.env.SIEM_OAUTH2_CONFIG ? JSON.parse(process.env.SIEM_OAUTH2_CONFIG) : undefined,
            dataFormat: process.env.SIEM_DATA_FORMAT || 'json',
            customFormat: process.env.SIEM_CUSTOM_FORMAT,
            enableBatching: process.env.SIEM_ENABLE_BATCHING !== 'false',
            batchSize: parseInt(process.env.SIEM_BATCH_SIZE || '100'),
            batchTimeoutMs: parseInt(process.env.SIEM_BATCH_TIMEOUT || '30000'),
            maxRetries: parseInt(process.env.SIEM_MAX_RETRIES || '3'),
            retryDelayMs: parseInt(process.env.SIEM_RETRY_DELAY || '1000'),
            enableFiltering: process.env.SIEM_ENABLE_FILTERING !== 'false',
            severityThreshold: process.env.SIEM_SEVERITY_THRESHOLD || 'MEDIUM',
            eventTypeFilter: (process.env.SIEM_EVENT_TYPE_FILTER || '').split(',').filter(Boolean),
            maxRequestsPerSecond: parseInt(process.env.SIEM_MAX_RPS || '10'),
            burstLimit: parseInt(process.env.SIEM_BURST_LIMIT || '50'),
            enableHealthCheck: process.env.SIEM_ENABLE_HEALTH_CHECK !== 'false',
            healthCheckIntervalMs: parseInt(process.env.SIEM_HEALTH_CHECK_INTERVAL || '300000'),
            alertOnFailure: process.env.SIEM_ALERT_ON_FAILURE !== 'false'
        };
        this.initializeSIEM();
        this.startBackgroundTasks();
        logger_1.logger.info('SIEM Integration Service initialized', {
            enabled: this.config.enableSIEM,
            type: this.config.siemType,
            endpoint: this.config.endpoint ? this.config.endpoint.substring(0, 50) + '...' : 'not configured',
            batching: this.config.enableBatching,
            batchSize: this.config.batchSize
        });
    }
    static getInstance() {
        if (!SIEMIntegrationService.instance) {
            SIEMIntegrationService.instance = new SIEMIntegrationService();
        }
        return SIEMIntegrationService.instance;
    }
    async initializeSIEM() {
        if (!this.config.enableSIEM) {
            return;
        }
        try {
            this.initializeAlertRules();
            await this.testConnection();
            await this.loadActiveAlerts();
            logger_1.logger.info('SIEM integration initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize SIEM integration:', err);
            this.healthStatus = 'unhealthy';
        }
    }
    initializeAlertRules() {
        this.alertRules.set('authentication_failures', {
            id: 'auth_fail_001',
            name: 'Multiple Authentication Failures',
            description: 'Detects multiple failed authentication attempts from the same IP',
            enabled: true,
            query: 'eventType:authentication_failed',
            conditions: [
                { field: 'eventType', operator: 'eq', value: 'authentication_failed' }
            ],
            timeWindow: 300000,
            threshold: 5,
            severity: 'HIGH',
            category: 'authentication',
            tags: ['brute_force', 'authentication']
        });
        this.alertRules.set('privileged_access', {
            id: 'priv_access_001',
            name: 'Privileged Access Activity',
            description: 'Monitors privileged user activities',
            enabled: true,
            query: 'category:authorization AND severity:HIGH',
            conditions: [
                { field: 'category', operator: 'eq', value: 'authorization' },
                { field: 'severity', operator: 'eq', value: 'HIGH', logicalOperator: 'AND' }
            ],
            timeWindow: 60000,
            threshold: 1,
            severity: 'CRITICAL',
            category: 'authorization',
            tags: ['privileged_access', 'admin']
        });
        this.alertRules.set('data_access_anomaly', {
            id: 'data_access_001',
            name: 'Unusual Data Access Pattern',
            description: 'Detects unusual patterns in data access',
            enabled: true,
            query: 'category:data_access AND customFields.volumeAnomaly:true',
            conditions: [
                { field: 'category', operator: 'eq', value: 'data_access' },
                { field: 'customFields.volumeAnomaly', operator: 'eq', value: true, logicalOperator: 'AND' }
            ],
            timeWindow: 900000,
            threshold: 3,
            severity: 'MEDIUM',
            category: 'data_access',
            tags: ['anomaly', 'data_access']
        });
        this.alertRules.set('payment_fraud', {
            id: 'payment_fraud_001',
            name: 'Payment Fraud Indicators',
            description: 'Detects potential payment fraud activities',
            enabled: true,
            query: 'eventType:payment_operation AND customFields.riskScore:>=80',
            conditions: [
                { field: 'eventType', operator: 'eq', value: 'payment_operation' },
                { field: 'customFields.riskScore', operator: 'gte', value: 80, logicalOperator: 'AND' }
            ],
            timeWindow: 600000,
            threshold: 1,
            severity: 'CRITICAL',
            category: 'payment',
            tags: ['fraud', 'payment']
        });
        this.alertRules.set('security_bypass', {
            id: 'sec_bypass_001',
            name: 'Security Control Bypass Attempt',
            description: 'Detects attempts to bypass security controls',
            enabled: true,
            query: 'eventType:security_bypass OR eventType:waf_bypass',
            conditions: [
                { field: 'eventType', operator: 'in', value: ['security_bypass', 'waf_bypass'] }
            ],
            timeWindow: 300000,
            threshold: 1,
            severity: 'HIGH',
            category: 'security',
            tags: ['bypass', 'evasion']
        });
    }
    async sendEvent(event) {
        if (!this.config.enableSIEM) {
            return;
        }
        try {
            const siemEvent = this.enrichEvent(event);
            if (!this.shouldSendEvent(siemEvent)) {
                return;
            }
            if (this.config.enableBatching) {
                this.eventBuffer.push(siemEvent);
                if (this.eventBuffer.length >= this.config.batchSize) {
                    await this.flushEventBuffer();
                }
            }
            else {
                await this.sendSingleEvent(siemEvent);
            }
            await this.evaluateAlertRules(siemEvent);
        }
        catch (err) {
            logger_1.logger.error('Failed to send event to SIEM:', err);
        }
    }
    async sendAlert(alert) {
        if (!this.config.enableSIEM) {
            return;
        }
        try {
            const alertEvent = {
                id: crypto_1.default.randomUUID(),
                timestamp: alert.timestamp,
                eventType: 'security_alert',
                severity: alert.severity,
                category: 'alert',
                source: 'BotRT-AlertEngine',
                title: alert.title,
                description: alert.description,
                rawEvent: alert,
                customFields: {
                    alertId: alert.id,
                    ruleId: alert.rule.id,
                    ruleName: alert.rule.name,
                    eventCount: alert.eventCount,
                    confidence: alert.confidence,
                    status: alert.status
                }
            };
            await this.sendEvent(alertEvent);
            this.activeAlerts.set(alert.id, alert);
            logger_1.logger.info('Alert sent to SIEM', {
                alertId: alert.id,
                severity: alert.severity,
                title: alert.title
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to send alert to SIEM:', err);
        }
    }
    enrichEvent(event) {
        const enrichedEvent = {
            id: event.id || crypto_1.default.randomUUID(),
            timestamp: event.timestamp || new Date(),
            eventType: event.eventType || 'unknown',
            severity: event.severity || 'LOW',
            category: event.category || 'system',
            source: event.source || 'BotRT',
            title: event.title || event.eventType || 'Security Event',
            description: event.description || '',
            rawEvent: event.rawEvent || event,
            customFields: event.customFields || {},
            ...event
        };
        enrichedEvent.customFields = {
            ...enrichedEvent.customFields,
            environment: process.env.NODE_ENV || 'unknown',
            application: 'BotRT',
            version: process.env.APP_VERSION || '1.0.0',
            hostname: process.env.HOSTNAME || 'unknown',
            eventSource: 'SecurityLogService'
        };
        if (enrichedEvent.network?.sourceIP) {
            enrichedEvent.threatIntel = this.getThreatIntelligence(enrichedEvent.network.sourceIP);
        }
        enrichedEvent.compliance = this.getComplianceContext(enrichedEvent);
        return enrichedEvent;
    }
    shouldSendEvent(event) {
        const severityLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
        const eventLevel = severityLevels[event.severity];
        const thresholdLevel = severityLevels[this.config.severityThreshold];
        if (eventLevel < thresholdLevel) {
            return false;
        }
        if (this.config.eventTypeFilter.length > 0 &&
            !this.config.eventTypeFilter.includes(event.eventType)) {
            return false;
        }
        if (!this.checkRateLimit()) {
            return false;
        }
        return true;
    }
    checkRateLimit() {
        const now = Date.now();
        const windowStart = Math.floor(now / 1000);
        const currentCount = this.rateLimiter.get(windowStart.toString()) || 0;
        if (currentCount >= this.config.maxRequestsPerSecond) {
            return false;
        }
        this.rateLimiter.set(windowStart.toString(), currentCount + 1);
        for (const [key] of this.rateLimiter.entries()) {
            if (parseInt(key) < windowStart - 60) {
                this.rateLimiter.delete(key);
            }
        }
        return true;
    }
    async sendSingleEvent(event) {
        const formattedEvent = this.formatEvent(event);
        let retries = 0;
        while (retries < this.config.maxRetries) {
            try {
                await this.makeRequest([formattedEvent]);
                return;
            }
            catch (err) {
                retries++;
                if (retries >= this.config.maxRetries) {
                    throw err;
                }
                await this.delay(this.config.retryDelayMs * retries);
            }
        }
    }
    async flushEventBuffer() {
        if (this.eventBuffer.length === 0) {
            return;
        }
        const events = [...this.eventBuffer];
        this.eventBuffer = [];
        try {
            const formattedEvents = events.map(event => this.formatEvent(event));
            await this.makeRequest(formattedEvents);
            logger_1.logger.debug(`Flushed ${events.length} events to SIEM`);
        }
        catch (err) {
            logger_1.logger.error('Failed to flush event buffer to SIEM:', err);
            if (this.eventBuffer.length + events.length <= this.config.batchSize * 2) {
                this.eventBuffer.unshift(...events);
            }
        }
    }
    formatEvent(event) {
        switch (this.config.dataFormat) {
            case 'cef':
                return this.formatAsCEF(event);
            case 'leef':
                return this.formatAsLEEF(event);
            case 'syslog':
                return this.formatAsSyslog(event);
            case 'custom':
                return this.formatAsCustom(event);
            case 'json':
            default:
                return this.formatAsJSON(event);
        }
    }
    formatAsJSON(event) {
        return {
            '@timestamp': event.timestamp.toISOString(),
            event: {
                id: event.id,
                type: event.eventType,
                category: event.category,
                severity: event.severity,
                title: event.title,
                description: event.description
            },
            source: {
                application: event.source,
                ip: event.network?.sourceIP,
                port: event.network?.sourcePort
            },
            destination: {
                ip: event.network?.destinationIP,
                port: event.network?.destinationPort
            },
            user: event.user,
            host: event.assets,
            threat: event.threatIntel,
            compliance: event.compliance,
            custom: event.customFields,
            raw: event.rawEvent
        };
    }
    formatAsCEF(event) {
        const severity = this.mapSeverityToCEF(event.severity);
        const sourceIP = event.network?.sourceIP || '';
        const user = event.user?.username || '';
        return `CEF:0|BotRT|SecurityService|1.0|${event.eventType}|${event.title}|${severity}|src=${sourceIP} suser=${user} act=${event.eventType} outcome=${event.customFields.success ? 'success' : 'failure'}`;
    }
    formatAsLEEF(event) {
        const sourceIP = event.network?.sourceIP || '';
        const user = event.user?.username || '';
        return `LEEF:2.0|BotRT|SecurityService|1.0|${event.eventType}|src=${sourceIP}|suser=${user}|devTime=${event.timestamp.toISOString()}|cat=${event.category}|sev=${event.severity}`;
    }
    formatAsSyslog(event) {
        const priority = this.mapSeverityToSyslog(event.severity);
        const timestamp = event.timestamp.toISOString();
        const hostname = event.assets?.hostName || 'botrt';
        return `<${priority}>${timestamp} ${hostname} BotRT-Security: ${JSON.stringify(this.formatAsJSON(event))}`;
    }
    formatAsCustom(event) {
        if (!this.config.customFormat) {
            return this.formatAsJSON(event);
        }
        return this.formatAsJSON(event);
    }
    async makeRequest(events) {
        const headers = await this.getAuthHeaders();
        const requestConfig = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'BotRT-SIEM-Integration/1.0',
                ...headers
            },
            body: JSON.stringify(this.config.siemType === 'elasticsearch' ?
                this.formatForElasticsearch(events) : events)
        };
        const response = await fetch(this.config.endpoint, requestConfig);
        if (!response.ok) {
            throw new Error(`SIEM request failed: ${response.status} ${response.statusText}`);
        }
        this.healthStatus = 'healthy';
        this.lastHealthCheck = new Date();
    }
    async getAuthHeaders() {
        const headers = {};
        switch (this.config.authType) {
            case 'api_key':
                if (this.config.apiKey) {
                    headers['Authorization'] = `Bearer ${this.config.apiKey}`;
                }
                break;
            case 'basic':
                if (this.config.username && this.config.password) {
                    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
            case 'oauth2':
                if (this.config.oauth2Config) {
                    const token = await this.getOAuth2Token();
                    headers['Authorization'] = `Bearer ${token}`;
                }
                break;
        }
        if (this.config.tenantId) {
            headers['X-Tenant-ID'] = this.config.tenantId;
        }
        return headers;
    }
    async getOAuth2Token() {
        return 'oauth2_token_placeholder';
    }
    formatForElasticsearch(events) {
        return events.map(event => {
            const indexLine = JSON.stringify({ index: { _index: 'botrt-security', _type: '_doc' } });
            const docLine = JSON.stringify(event);
            return `${indexLine}\n${docLine}`;
        }).join('\n') + '\n';
    }
    async evaluateAlertRules(event) {
        for (const _rule of this.alertRules.values()) {
            if (!_rule.enabled)
                continue;
            try {
                const shouldAlert = await this.evaluateRule(_rule, event);
                if (shouldAlert) {
                    await this.triggerAlert(_rule, event);
                }
            }
            catch (err) {
                logger_1.logger.error(`Failed to evaluate alert rule ${_rule.id}:`, err);
            }
        }
    }
    async evaluateRule(rule, event) {
        const matchesConditions = rule.conditions.every(condition => {
            const fieldValue = this.getFieldValue(event, condition.field);
            return this.evaluateCondition(fieldValue, condition);
        });
        if (!matchesConditions) {
            return false;
        }
        const cacheKey = `rule_count:${rule.id}`;
        const currentCount = await TenantCacheService_1.tenantCacheService.get('system', cacheKey) || 0;
        const newCount = currentCount + 1;
        await TenantCacheService_1.tenantCacheService.set('system', cacheKey, newCount, { ttl: Math.floor(rule.timeWindow / 1000) });
        return newCount >= rule.threshold;
    }
    getFieldValue(event, fieldPath) {
        const parts = fieldPath.split('.');
        let value = event;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }
    evaluateCondition(fieldValue, condition) {
        switch (condition.operator) {
            case 'eq': return fieldValue === condition.value;
            case 'ne': return fieldValue !== condition.value;
            case 'gt': return fieldValue > condition.value;
            case 'gte': return fieldValue >= condition.value;
            case 'lt': return fieldValue < condition.value;
            case 'lte': return fieldValue <= condition.value;
            case 'contains': return String(fieldValue).includes(condition.value);
            case 'regex': return new RegExp(condition.value).test(String(fieldValue));
            case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
            case 'exists': return fieldValue !== undefined && fieldValue !== null;
            default: return false;
        }
    }
    async triggerAlert(_rule, triggeringEvent) {
        const alert = {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            severity: _rule.severity,
            status: 'open',
            title: `Alert: ${_rule.name}`,
            description: _rule.description,
            category: _rule.category,
            events: [triggeringEvent],
            eventCount: 1,
            rule: {
                id: _rule.id,
                name: _rule.name,
                description: _rule.description,
                query: _rule.query
            },
            notes: [],
            tags: _rule.tags,
            confidence: 0.8,
            falsePositiveRisk: 0.2,
            firstSeen: new Date(),
            lastSeen: new Date(),
            actions: []
        };
        await this.sendAlert(alert);
        logger_1.logger.warn('SIEM alert triggered', {
            alertId: alert.id,
            ruleName: _rule.name,
            severity: alert.severity,
            eventId: triggeringEvent.id
        });
    }
    getThreatIntelligence(_ip) {
        return {
            indicators: [],
            tactics: [],
            techniques: []
        };
    }
    getComplianceContext(event) {
        const frameworks = [];
        const controls = [];
        const requirements = [];
        if (event.category === 'authentication') {
            frameworks.push('NIST', 'ISO27001');
            controls.push('AC-2', 'AC-7');
        }
        if (event.category === 'data_access') {
            frameworks.push('GDPR', 'PCI-DSS');
            controls.push('AC-6', 'AU-2');
        }
        return { frameworks, controls, requirements };
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
    async testConnection() {
        if (!this.config.endpoint) {
            throw new Error('SIEM endpoint not configured');
        }
        try {
            const testEvent = {
                id: crypto_1.default.randomUUID(),
                timestamp: new Date(),
                eventType: 'connection_test',
                severity: 'LOW',
                category: 'system',
                source: 'BotRT-SIEM-Test',
                title: 'SIEM Connection Test',
                description: 'Test event to verify SIEM connectivity',
                rawEvent: { test: true },
                customFields: { connectionTest: true }
            };
            await this.sendSingleEvent(testEvent);
            logger_1.logger.info('SIEM connection test successful');
        }
        catch (err) {
            logger_1.logger.error('SIEM connection test failed:', err);
            this.healthStatus = 'unhealthy';
            throw err;
        }
    }
    async loadActiveAlerts() {
        logger_1.logger.debug('Loading active alerts');
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    startBackgroundTasks() {
        setInterval(() => {
            if (this.eventBuffer.length > 0) {
                this.flushEventBuffer().catch((err) => {
                    logger_1.logger.error('Background buffer flush failed:', err);
                });
            }
        }, this.config.batchTimeoutMs);
        if (this.config.enableHealthCheck) {
            setInterval(() => {
                this.performHealthCheck().catch((err) => {
                    logger_1.logger.error('SIEM health check failed:', err);
                });
            }, this.config.healthCheckIntervalMs);
        }
        setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            for (const [key] of this.rateLimiter.entries()) {
                if (parseInt(key) < now - 300) {
                    this.rateLimiter.delete(key);
                }
            }
        }, 60000);
    }
    async performHealthCheck() {
        if (!this.config.enableSIEM) {
            return;
        }
        try {
            await this.testConnection();
            if (this.healthStatus !== 'healthy') {
                this.healthStatus = 'healthy';
                logger_1.logger.info('SIEM connection restored');
            }
        }
        catch (err) {
            this.healthStatus = 'unhealthy';
            if (this.config.alertOnFailure) {
                logger_1.logger.error('SIEM health check failed, service degraded:', err);
            }
        }
    }
    getStats() {
        return {
            config: this.config,
            healthStatus: this.healthStatus,
            lastHealthCheck: this.lastHealthCheck,
            bufferSize: this.eventBuffer.length,
            activeAlerts: this.activeAlerts.size,
            rateLimitStatus: Object.fromEntries(this.rateLimiter)
        };
    }
    async healthCheck() {
        const stats = this.getStats();
        return {
            status: this.healthStatus,
            stats
        };
    }
}
exports.SIEMIntegrationService = SIEMIntegrationService;
exports.siemIntegrationService = SIEMIntegrationService.getInstance();
//# sourceMappingURL=SIEMIntegrationService.js.map