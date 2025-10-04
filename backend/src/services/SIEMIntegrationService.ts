import crypto from 'crypto';
import { logger } from '../utils/logger';
import { tenantCacheService } from './TenantCacheService';

export interface SIEMConfig {
  enableSIEM: boolean;
  siemType: 'splunk' | 'elasticsearch' | 'azure_sentinel' | 'aws_security_hub' | 'google_chronicle' | 'custom';

  // Connection settings
  endpoint: string;
  apiKey?: string;
  username?: string;
  password?: string;
  tenantId?: string;

  // Authentication
  authType: 'api_key' | 'oauth2' | 'basic' | 'certificate' | 'custom';
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    tokenEndpoint: string;
    scopes: string[];
  };

  // Data format
  dataFormat: 'json' | 'cef' | 'leef' | 'syslog' | 'custom';
  customFormat?: string;

  // Batch settings
  enableBatching: boolean;
  batchSize: number;
  batchTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;

  // Filtering
  enableFiltering: boolean;
  severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventTypeFilter: string[];

  // Rate limiting
  maxRequestsPerSecond: number;
  burstLimit: number;

  // Health monitoring
  enableHealthCheck: boolean;
  healthCheckIntervalMs: number;
  alertOnFailure: boolean;
}

export interface SIEMEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  source: string;

  // Event details
  title: string;
  description: string;
  rawEvent: any;

  // Context
  user?: {
    id: string;
    username: string;
    role: string;
    email?: string;
  };

  // Network context
  network?: {
    sourceIP: string;
    destinationIP?: string;
    sourcePort?: number;
    destinationPort?: number;
    protocol?: string;
    userAgent?: string;
  };

  // Asset context
  assets?: {
    hostName?: string;
    hostIP?: string;
    operatingSystem?: string;
    application?: string;
    service?: string;
  };

  // Threat intelligence
  threatIntel?: {
    indicators: string[];
    tactics: string[];
    techniques: string[];
    malwareFamily?: string;
    campaigns?: string[];
  };

  // Compliance
  compliance?: {
    frameworks: string[];
    controls: string[];
    requirements: string[];
  };

  // Custom fields
  customFields: Record<string, any>;
}

export interface SIEMAlert {
  id: string;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';

  // Alert details
  title: string;
  description: string;
  category: string;

  // Related events
  events: SIEMEvent[];
  eventCount: number;

  // Detection details
  rule: {
    id: string;
    name: string;
    description: string;
    query: string;
  };

  // Investigation
  assignee?: string;
  notes: string[];
  tags: string[];

  // Metrics
  confidence: number;
  falsePositiveRisk: number;

  // Timeline
  firstSeen: Date;
  lastSeen: Date;

  // Actions taken
  actions: {
    type: string;
    timestamp: Date;
    user: string;
    details: any;
  }[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // Rule definition
  query: string;
  conditions: AlertCondition[];
  timeWindow: number; // milliseconds
  threshold: number;

  // Alert settings
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  tags: string[];

  // Suppression
  suppressionRules?: {
    field: string;
    value: string;
    duration: number;
  }[];

  // Escalation
  escalation?: {
    timeToEscalate: number;
    escalateTo: string;
    autoEscalate: boolean;
  };
}

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex' | 'in' | 'exists';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export class SIEMIntegrationService {
  private static instance: SIEMIntegrationService;
  private config: SIEMConfig;
  private eventBuffer: SIEMEvent[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, SIEMAlert> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  private lastHealthCheck: Date = new Date();

  private constructor() {
    this.config = {
      enableSIEM: process.env.ENABLE_SIEM_INTEGRATION === 'true',
      siemType: (process.env.SIEM_TYPE as any) || 'elasticsearch',

      endpoint: process.env.SIEM_ENDPOINT || '',
      apiKey: process.env.SIEM_API_KEY,
      username: process.env.SIEM_USERNAME,
      password: process.env.SIEM_PASSWORD,
      tenantId: process.env.SIEM_TENANT_ID,

      authType: (process.env.SIEM_AUTH_TYPE as any) || 'api_key',
      oauth2Config: process.env.SIEM_OAUTH2_CONFIG ? JSON.parse(process.env.SIEM_OAUTH2_CONFIG) : undefined,

      dataFormat: (process.env.SIEM_DATA_FORMAT as any) || 'json',
      customFormat: process.env.SIEM_CUSTOM_FORMAT,

      enableBatching: process.env.SIEM_ENABLE_BATCHING !== 'false',
      batchSize: parseInt(process.env.SIEM_BATCH_SIZE || '100'),
      batchTimeoutMs: parseInt(process.env.SIEM_BATCH_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.SIEM_MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.SIEM_RETRY_DELAY || '1000'),

      enableFiltering: process.env.SIEM_ENABLE_FILTERING !== 'false',
      severityThreshold: (process.env.SIEM_SEVERITY_THRESHOLD as any) || 'MEDIUM',
      eventTypeFilter: (process.env.SIEM_EVENT_TYPE_FILTER || '').split(',').filter(Boolean),

      maxRequestsPerSecond: parseInt(process.env.SIEM_MAX_RPS || '10'),
      burstLimit: parseInt(process.env.SIEM_BURST_LIMIT || '50'),

      enableHealthCheck: process.env.SIEM_ENABLE_HEALTH_CHECK !== 'false',
      healthCheckIntervalMs: parseInt(process.env.SIEM_HEALTH_CHECK_INTERVAL || '300000'), // 5 minutes
      alertOnFailure: process.env.SIEM_ALERT_ON_FAILURE !== 'false'
    };

    this.initializeSIEM();
    this.startBackgroundTasks();

    logger.info('SIEM Integration Service initialized', {
      enabled: this.config.enableSIEM,
      type: this.config.siemType,
      endpoint: this.config.endpoint ? this.config.endpoint.substring(0, 50) + '...' : 'not configured',
      batching: this.config.enableBatching,
      batchSize: this.config.batchSize
    });
  }

  public static getInstance(): SIEMIntegrationService {
    if (!SIEMIntegrationService.instance) {
      SIEMIntegrationService.instance = new SIEMIntegrationService();
    }
    return SIEMIntegrationService.instance;
  }

  private async initializeSIEM(): Promise<void> {
    if (!this.config.enableSIEM) {
      return;
    }

    try {
      // Initialize alert rules
      this.initializeAlertRules();

      // Test connection
      await this.testConnection();

      // Load existing alerts
      await this.loadActiveAlerts();

      logger.info('SIEM integration initialized successfully');

    } catch (err: unknown) {
      logger.error('Failed to initialize SIEM integration:', err as Record<string, unknown>);
      this.healthStatus = 'unhealthy';
    }
  }

  private initializeAlertRules(): void {
    // Critical security events
    this.alertRules.set('authentication_failures', {
      id: 'auth_fail_001',
      name: 'Multiple Authentication Failures',
      description: 'Detects multiple failed authentication attempts from the same IP',
      enabled: true,
      query: 'eventType:authentication_failed',
      conditions: [
        { field: 'eventType', operator: 'eq', value: 'authentication_failed' }
      ],
      timeWindow: 300000, // 5 minutes
      threshold: 5,
      severity: 'HIGH',
      category: 'authentication',
      tags: ['brute_force', 'authentication']
    });

    // Privileged access monitoring
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
      timeWindow: 60000, // 1 minute
      threshold: 1,
      severity: 'CRITICAL',
      category: 'authorization',
      tags: ['privileged_access', 'admin']
    });

    // Data access anomalies
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
      timeWindow: 900000, // 15 minutes
      threshold: 3,
      severity: 'MEDIUM',
      category: 'data_access',
      tags: ['anomaly', 'data_access']
    });

    // Payment fraud detection
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
      timeWindow: 600000, // 10 minutes
      threshold: 1,
      severity: 'CRITICAL',
      category: 'payment',
      tags: ['fraud', 'payment']
    });

    // Security tool bypass attempts
    this.alertRules.set('security_bypass', {
      id: 'sec_bypass_001',
      name: 'Security Control Bypass Attempt',
      description: 'Detects attempts to bypass security controls',
      enabled: true,
      query: 'eventType:security_bypass OR eventType:waf_bypass',
      conditions: [
        { field: 'eventType', operator: 'in', value: ['security_bypass', 'waf_bypass'] }
      ],
      timeWindow: 300000, // 5 minutes
      threshold: 1,
      severity: 'HIGH',
      category: 'security',
      tags: ['bypass', 'evasion']
    });
  }

  /**
   * Send event to SIEM
   */
  async sendEvent(event: Partial<SIEMEvent>): Promise<void> {
    if (!this.config.enableSIEM) {
      return;
    }

    try {
      const siemEvent = this.enrichEvent(event);

      // Apply filters
      if (!this.shouldSendEvent(siemEvent)) {
        return;
      }

      // Add to buffer or send immediately
      if (this.config.enableBatching) {
        this.eventBuffer.push(siemEvent);

        if (this.eventBuffer.length >= this.config.batchSize) {
          await this.flushEventBuffer();
        }
      } else {
        await this.sendSingleEvent(siemEvent);
      }

      // Check alert rules
      await this.evaluateAlertRules(siemEvent);

    } catch (err: unknown) {
      logger.error('Failed to send event to SIEM:', err as Record<string, unknown>);
    }
  }

  /**
   * Send alert to SIEM
   */
  async sendAlert(alert: SIEMAlert): Promise<void> {
    if (!this.config.enableSIEM) {
      return;
    }

    try {
      const alertEvent: SIEMEvent = {
        id: crypto.randomUUID(),
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

      // Store alert
      this.activeAlerts.set(alert.id, alert);

      logger.info('Alert sent to SIEM', {
        alertId: alert.id,
        severity: alert.severity,
        title: alert.title
      });

    } catch (err: unknown) {
      logger.error('Failed to send alert to SIEM:', err as Record<string, unknown>);
    }
  }

  private enrichEvent(event: Partial<SIEMEvent>): SIEMEvent {
    const enrichedEvent: SIEMEvent = {
      id: event.id || crypto.randomUUID(),
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

    // Add standard enrichment
    enrichedEvent.customFields = {
      ...enrichedEvent.customFields,
      environment: process.env.NODE_ENV || 'unknown',
      application: 'BotRT',
      version: process.env.APP_VERSION || '1.0.0',
      hostname: process.env.HOSTNAME || 'unknown',
      eventSource: 'SecurityLogService'
    };

    // Add threat intelligence context
    if (enrichedEvent.network?.sourceIP) {
      enrichedEvent.threatIntel = this.getThreatIntelligence(enrichedEvent.network.sourceIP);
    }

    // Add compliance context
    enrichedEvent.compliance = this.getComplianceContext(enrichedEvent);

    return enrichedEvent;
  }

  private shouldSendEvent(event: SIEMEvent): boolean {
    // Check severity threshold
    const severityLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    const eventLevel = severityLevels[event.severity];
    const thresholdLevel = severityLevels[this.config.severityThreshold];

    if (eventLevel < thresholdLevel) {
      return false;
    }

    // Check event type filter
    if (this.config.eventTypeFilter.length > 0 &&
        !this.config.eventTypeFilter.includes(event.eventType)) {
      return false;
    }

    // Check rate limiting
    if (!this.checkRateLimit()) {
      return false;
    }

    return true;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000);

    const currentCount = this.rateLimiter.get(windowStart.toString()) || 0;

    if (currentCount >= this.config.maxRequestsPerSecond) {
      return false;
    }

    this.rateLimiter.set(windowStart.toString(), currentCount + 1);

    // Clean up old entries
    for (const [key] of this.rateLimiter.entries()) {
      if (parseInt(key) < windowStart - 60) { // Keep last 60 seconds
        this.rateLimiter.delete(key);
      }
    }

    return true;
  }

  private async sendSingleEvent(event: SIEMEvent): Promise<void> {
    const formattedEvent = this.formatEvent(event);

    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        await this.makeRequest([formattedEvent]);
        return;
      } catch (err: unknown) {
        retries++;
        if (retries >= this.config.maxRetries) {
          throw err;
        }
        await this.delay(this.config.retryDelayMs * retries);
      }
    }
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const formattedEvents = events.map(event => this.formatEvent(event));
      await this.makeRequest(formattedEvents);

      logger.debug(`Flushed ${events.length} events to SIEM`);

    } catch (err: unknown) {
      logger.error('Failed to flush event buffer to SIEM:', err as Record<string, unknown>);

      // Re-add events to buffer if it's not full
      if (this.eventBuffer.length + events.length <= this.config.batchSize * 2) {
        this.eventBuffer.unshift(...events);
      }
    }
  }

  private formatEvent(event: SIEMEvent): any {
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

  private formatAsJSON(event: SIEMEvent): any {
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

  private formatAsCEF(event: SIEMEvent): string {
    const severity = this.mapSeverityToCEF(event.severity);
    const sourceIP = event.network?.sourceIP || '';
    const user = event.user?.username || '';

    return `CEF:0|BotRT|SecurityService|1.0|${event.eventType}|${event.title}|${severity}|src=${sourceIP} suser=${user} act=${event.eventType} outcome=${event.customFields.success ? 'success' : 'failure'}`;
  }

  private formatAsLEEF(event: SIEMEvent): string {
    const sourceIP = event.network?.sourceIP || '';
    const user = event.user?.username || '';

    return `LEEF:2.0|BotRT|SecurityService|1.0|${event.eventType}|src=${sourceIP}|suser=${user}|devTime=${event.timestamp.toISOString()}|cat=${event.category}|sev=${event.severity}`;
  }

  private formatAsSyslog(event: SIEMEvent): string {
    const priority = this.mapSeverityToSyslog(event.severity);
    const timestamp = event.timestamp.toISOString();
    const hostname = event.assets?.hostName || 'botrt';

    return `<${priority}>${timestamp} ${hostname} BotRT-Security: ${JSON.stringify(this.formatAsJSON(event))}`;
  }

  private formatAsCustom(event: SIEMEvent): any {
    if (!this.config.customFormat) {
      return this.formatAsJSON(event);
    }

    // Implement custom formatting logic based on config.customFormat template
    return this.formatAsJSON(event);
  }

  private async makeRequest(events: any[]): Promise<void> {
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

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

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

    // Add tenant-specific headers
    if (this.config.tenantId) {
      headers['X-Tenant-ID'] = this.config.tenantId;
    }

    return headers;
  }

  private async getOAuth2Token(): Promise<string> {
    // SECURITY FIX: CWE-798 - Remove hardcoded token placeholder
    // Implement OAuth2 token acquisition with proper token management
    if (!process.env.SIEM_OAUTH2_CLIENT_ID || !process.env.SIEM_OAUTH2_CLIENT_SECRET) {
      throw new Error('SIEM OAuth2 credentials not configured. Set SIEM_OAUTH2_CLIENT_ID and SIEM_OAUTH2_CLIENT_SECRET');
    }

    // Token should be acquired from environment or secure token service
    // This is a placeholder for OAuth2 flow implementation
    throw new Error('OAuth2 token acquisition not yet implemented. Configure SIEM authentication in environment variables.');
  }

  private formatForElasticsearch(events: any[]): string {
    return events.map(event => {
      const indexLine = JSON.stringify({ index: { _index: 'botrt-security', _type: '_doc' } });
      const docLine = JSON.stringify(event);
      return `${indexLine}\n${docLine}`;
    }).join('\n') + '\n';
  }

  private async evaluateAlertRules(event: SIEMEvent): Promise<void> {
    for (const _rule of this.alertRules.values()) {
      if (!_rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(_rule, event);
        if (shouldAlert) {
          await this.triggerAlert(_rule, event);
        }
      } catch (err: unknown) {
        logger.error(`Failed to evaluate alert rule ${_rule.id}:`, err as Record<string, unknown>);
      }
    }
  }

  private async evaluateRule(rule: AlertRule, event: SIEMEvent): Promise<boolean> {
    // Simple rule evaluation - in production, this would be more sophisticated
    const matchesConditions = rule.conditions.every(condition => {
      const fieldValue = this.getFieldValue(event, condition.field);
      return this.evaluateCondition(fieldValue, condition);
    });

    if (!matchesConditions) {
      return false;
    }

    // Check threshold within time window
    const cacheKey = `rule_count:${rule.id}`;
    const currentCount = await tenantCacheService.get<number>('system', cacheKey) || 0;
    const newCount = currentCount + 1;

    await tenantCacheService.set(
      'system',
      cacheKey,
      newCount,
      { ttl: Math.floor(rule.timeWindow / 1000) }
    );

    return newCount >= rule.threshold;
  }

  private getFieldValue(event: SIEMEvent, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value: any = event;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private evaluateCondition(fieldValue: any, condition: AlertCondition): boolean {
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

  private async triggerAlert(_rule: AlertRule, triggeringEvent: SIEMEvent): Promise<void> {
    const alert: SIEMAlert = {
      id: crypto.randomUUID(),
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
      confidence: 0.8, // Default confidence
      falsePositiveRisk: 0.2,
      firstSeen: new Date(),
      lastSeen: new Date(),
      actions: []
    };

    await this.sendAlert(alert);

    logger.warn('SIEM alert triggered', {
      alertId: alert.id,
      ruleName: _rule.name,
      severity: alert.severity,
      eventId: triggeringEvent.id
    });
  }

  private getThreatIntelligence(_ip: string): SIEMEvent['threatIntel'] {
    // Placeholder for threat intelligence lookup
    return {
      indicators: [],
      tactics: [],
      techniques: []
    };
  }

  private getComplianceContext(event: SIEMEvent): SIEMEvent['compliance'] {
    const frameworks: string[] = [];
    const controls: string[] = [];
    const requirements: string[] = [];

    // Determine applicable frameworks based on event
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

  private mapSeverityToCEF(severity: SIEMEvent['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 10;
      case 'HIGH': return 8;
      case 'MEDIUM': return 5;
      case 'LOW': return 2;
      default: return 1;
    }
  }

  private mapSeverityToSyslog(severity: SIEMEvent['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 130; // Local0.Crit
      case 'HIGH': return 131;     // Local0.Err
      case 'MEDIUM': return 132;   // Local0.Warning
      case 'LOW': return 134;      // Local0.Info
      default: return 135;         // Local0.Debug
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.config.endpoint) {
      throw new Error('SIEM endpoint not configured');
    }

    try {
      const testEvent: SIEMEvent = {
        id: crypto.randomUUID(),
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
      logger.info('SIEM connection test successful');

    } catch (err: unknown) {
      logger.error('SIEM connection test failed:', err as Record<string, unknown>);
      this.healthStatus = 'unhealthy';
      throw err;
    }
  }

  private async loadActiveAlerts(): Promise<void> {
    // Implementation would load active alerts from storage
    logger.debug('Loading active alerts');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startBackgroundTasks(): void {
    // Periodic buffer flush
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEventBuffer().catch((err: unknown) => {
          logger.error('Background buffer flush failed:', err as Record<string, unknown>);
        });
      }
    }, this.config.batchTimeoutMs);

    // Health check
    if (this.config.enableHealthCheck) {
      setInterval(() => {
        this.performHealthCheck().catch((err: unknown) => {
          logger.error('SIEM health check failed:', err as Record<string, unknown>);
        });
      }, this.config.healthCheckIntervalMs);
    }

    // Clean up old rate limit entries
    setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      for (const [key] of this.rateLimiter.entries()) {
        if (parseInt(key) < now - 300) { // Keep last 5 minutes
          this.rateLimiter.delete(key);
        }
      }
    }, 60000); // Every minute
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.config.enableSIEM) {
      return;
    }

    try {
      await this.testConnection();

      if (this.healthStatus !== 'healthy') {
        this.healthStatus = 'healthy';
        logger.info('SIEM connection restored');
      }

    } catch (err: unknown) {
      this.healthStatus = 'unhealthy';

      if (this.config.alertOnFailure) {
        logger.error('SIEM health check failed, service degraded:', err as Record<string, unknown>);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: SIEMConfig;
    healthStatus: string;
    lastHealthCheck: Date;
    bufferSize: number;
    activeAlerts: number;
    rateLimitStatus: Record<string, number>;
  } {
    return {
      config: this.config,
      healthStatus: this.healthStatus,
      lastHealthCheck: this.lastHealthCheck,
      bufferSize: this.eventBuffer.length,
      activeAlerts: this.activeAlerts.size,
      rateLimitStatus: Object.fromEntries(this.rateLimiter)
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

    return {
      status: this.healthStatus,
      stats
    };
  }
}

// Export singleton instance
export const siemIntegrationService = SIEMIntegrationService.getInstance();
