import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getSecurityKeyId } from '../config/securityKeys';
import { sanitizeForLog } from '../utils/inputSanitizer';
import { logger, toLogMetadata } from '../utils/logger';
import { encryptionService } from './EncryptionService';
import { tenantCacheService } from './TenantCacheService';

export interface SecurityLogConfig {
  enableSecurityLogging: boolean;
  enableEncryption: boolean;
  enableCompression: boolean;
  enableWriteOnceStorage: boolean;

  // Log levels
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  securityEventLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Storage configuration
  storageType: 'file' | 's3' | 'elasticsearch' | 'splunk';
  retentionDays: number;
  maxLogSize: number; // bytes
  rotationInterval: number; // hours

  // Encryption settings
  encryptionAlgorithm: string;
  keyRotationInterval: number; // days
  enableIntegrityChecks: boolean;

  // SIEM integration
  enableSIEMIntegration: boolean;
  siemEndpoint?: string;
  siemApiKey?: string;
  siemFormat: 'CEF' | 'LEEF' | 'JSON' | 'SYSLOG';

  // Alert thresholds
  alertThresholds: {
    failedLogins: number;
    suspiciousActivity: number;
    dataAccess: number;
    privilegedAccess: number;
  };
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'authentication' | 'authorization' | 'data_access' | 'system' | 'network' | 'application';

  // Event context
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  resource?: string;
  action?: string;

  // Event details
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  details: Record<string, any>;

  // Security context
  riskScore: number;
  tags: string[];
  correlationId?: string;

  // Geolocation
  geoLocation?: {
    country: string;
    region: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };

  // Device information
  deviceInfo?: {
    fingerprint: string;
    type: string;
    os: string;
    browser: string;
  };

  // Compliance markers
  compliance: {
    pii: boolean;
    gdpr: boolean;
    pci: boolean;
    hipaa: boolean;
  };
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: string;
  message: string;
  metadata: SecurityEvent;
  source: string;
  encrypted: boolean;
  checksum: string;
  signature?: string;
}

export interface SIEMAlert {
  id: string;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  events: SecurityEvent[];
  indicators: string[];
  recommendations: string[];
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
}

interface AlertRule {
  type: 'threshold' | 'match' | 'pattern';
  field?: keyof SecurityEvent | string;
  value?: any;
  threshold?: number;
  timeWindow?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conditions?: {
    field: keyof SecurityEvent | string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex' | 'in' | 'exists';
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }[];
}

interface EncryptedLogResult {
  encrypted: true;
  algorithm: string;
  iv: string;
  data: string;
  authTag?: string;
}

export class SecurityLogService {
  private static instance: SecurityLogService;
  private config: SecurityLogConfig;
  private logBuffer: Map<string, SecurityEvent[]> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private readonly bufferFlushInterval = 30000; // 30 seconds
  private readonly maxBufferSize = 1000;
  private isInitialized: boolean = false;

  private constructor() {
    this.config = {
      enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
      enableEncryption: process.env.ENABLE_LOG_ENCRYPTION !== 'false',
      enableCompression: process.env.ENABLE_LOG_COMPRESSION !== 'false',
      enableWriteOnceStorage: process.env.ENABLE_WRITE_ONCE_STORAGE !== 'false',

      logLevel: (process.env.SECURITY_LOG_LEVEL as SecurityLogConfig['logLevel']) || 'INFO',
      securityEventLevel: (process.env.SECURITY_EVENT_LEVEL as SecurityLogConfig['securityEventLevel']) || 'MEDIUM',

      storageType: (process.env.LOG_STORAGE_TYPE as SecurityLogConfig['storageType']) || 'file',
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '2555'), // 7 years
      maxLogSize: parseInt(process.env.MAX_LOG_SIZE || '104857600'), // 100MB
      rotationInterval: parseInt(process.env.LOG_ROTATION_INTERVAL || '24'), // 24 hours

      encryptionAlgorithm: process.env.LOG_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyRotationInterval: parseInt(process.env.LOG_KEY_ROTATION_DAYS || '90'),
      enableIntegrityChecks: process.env.ENABLE_LOG_INTEGRITY_CHECKS !== 'false',

      enableSIEMIntegration: process.env.ENABLE_SIEM_INTEGRATION === 'true',
      siemEndpoint: process.env.SIEM_ENDPOINT,
      siemApiKey: process.env.SIEM_API_KEY,
      siemFormat: (process.env.SIEM_FORMAT as SecurityLogConfig['siemFormat']) || 'JSON',

      alertThresholds: {
        failedLogins: parseInt(process.env.ALERT_FAILED_LOGINS || '5'),
        suspiciousActivity: parseInt(process.env.ALERT_SUSPICIOUS_ACTIVITY || '3'),
        dataAccess: parseInt(process.env.ALERT_DATA_ACCESS || '10'),
        privilegedAccess: parseInt(process.env.ALERT_PRIVILEGED_ACCESS || '1')
      }
    };

    // Start initialization - but don't wait in constructor to avoid blocking
    this.initializeSecurityLogging()
      .then(() => {
        this.isInitialized = true;
        this.startBackgroundTasks();
        logger.info('Security Log Service initialized successfully', {
          encryptionEnabled: this.config.enableEncryption,
          siemEnabled: this.config.enableSIEMIntegration,
          storageType: this.config.storageType,
          retentionDays: this.config.retentionDays
        });
      })
      .catch((error: unknown) => {
        logger.error('Failed to initialize Security Log Service:', toLogMetadata(error));
        this.isInitialized = false;
      });
  }

  public static getInstance(): SecurityLogService {
    if (!SecurityLogService.instance) {
      SecurityLogService.instance = new SecurityLogService();
    }
    return SecurityLogService.instance;
  }

  /**
   * Wait for the service to be fully initialized
   * @param timeoutMs Maximum time to wait in milliseconds (default: 30000)
   * @returns Promise that resolves when service is ready
   */
  public async waitForInitialization(timeoutMs: number = 30000): Promise<void> {
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

  private async initializeSecurityLogging(): Promise<void> {
    try {
      // Initialize encryption keys
      await this.initializeEncryptionKeys();

      // Initialize alert rules
      this.initializeAlertRules();

      // Setup storage
      await this.initializeStorage();

      // Test SIEM connection
      if (this.config.enableSIEMIntegration) {
        await this.testSIEMConnection();
      }

      logger.info('Security logging initialized successfully');

    } catch (error: unknown) {
      logger.error('Failed to initialize security logging:', toLogMetadata(error));
      throw error;
    }
  }

  private async initializeEncryptionKeys(): Promise<void> {
    if (!this.config.enableEncryption) {
      return;
    }

    try {
      // Generate or retrieve encryption key for logs using secure configuration
      const keyId = getSecurityKeyId('securityLogsEncryptionKeyId');
      let encryptionKey = await encryptionService.getDataKey(keyId);

      if (!encryptionKey) {
        // Generate new key
        encryptionKey = await encryptionService.generateDataKey(keyId, 32); // 256-bit key
        logger.info('Generated new encryption key for security logs');
      }

      // Keys from SecretManager are in hex format, convert to Buffer
      this.encryptionKeys.set(keyId, Buffer.from(encryptionKey, 'hex'));

    } catch (error: unknown) {
      logger.error('Failed to initialize encryption keys:', toLogMetadata(error));
      throw error;
    }
  }

  private initializeAlertRules(): void {
    // Authentication alert rules
    this.alertRules.set('failed_login_threshold', {
      type: 'threshold',
      field: 'eventType',
      value: 'authentication_failed',
      threshold: this.config.alertThresholds.failedLogins,
      timeWindow: 300000, // 5 minutes
      severity: 'HIGH'
    });

    // Privileged access alerts
    this.alertRules.set('privileged_access', {
      type: 'match',
      field: 'tags',
      value: 'privileged_access',
      threshold: this.config.alertThresholds.privilegedAccess,
      timeWindow: 60000, // 1 minute
      severity: 'CRITICAL'
    });

    // Data access anomalies
    this.alertRules.set('data_access_anomaly', {
      type: 'threshold',
      field: 'category',
      value: 'data_access',
      threshold: this.config.alertThresholds.dataAccess,
      timeWindow: 600000, // 10 minutes
      severity: 'MEDIUM'
    });

    // Suspicious activity patterns
    this.alertRules.set('suspicious_activity', {
      type: 'pattern',
      conditions: [
        { field: 'riskScore', operator: 'gte', value: 70 },
        { field: 'success', operator: 'eq', value: false }
      ],
      threshold: this.config.alertThresholds.suspiciousActivity,
      timeWindow: 900000, // 15 minutes
      severity: 'HIGH'
    });
  }

  private async initializeStorage(): Promise<void> {
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

  private async initializeFileStorage(): Promise<void> {
    const logDir = path.join(process.cwd(), 'logs', 'security');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Ensure write-once permissions if enabled
    if (this.config.enableWriteOnceStorage) {
      try {
        // Set directory permissions to prevent modifications
        fs.chmodSync(logDir, 0o755);
      } catch (error: unknown) {
        logger.warn('Could not set write-once permissions:', toLogMetadata(error));
      }
    }
  }

  private async initializeElasticsearchStorage(): Promise<void> {
    // Elasticsearch initialization would go here
    logger.info('Elasticsearch storage initialized');
  }

  private async initializeS3Storage(): Promise<void> {
    // S3 initialization would go here
    logger.info('S3 storage initialized');
  }

  private async initializeSplunkStorage(): Promise<void> {
    // Splunk initialization would go here
    logger.info('Splunk storage initialized');
  }

  private async testSIEMConnection(): Promise<void> {
    if (!this.config.siemEndpoint) {
      logger.warn('SIEM endpoint not configured');
      return;
    }

    try {
      // Test connection to SIEM
      const testEvent = this.createTestEvent();
      await this.sendToSIEM([testEvent]);
      logger.info('SIEM connection test successful');

    } catch (error: unknown) {
      logger.error('SIEM connection test failed:', toLogMetadata(error));
    }
  }

  private createTestEvent(): SecurityEvent {
    return {
      id: crypto.randomUUID(),
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

  /**
   * Log security event
   */
  async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    if (!this.config.enableSecurityLogging) {
      return;
    }

    try {
      const securityEvent: SecurityEvent = {
        id: event.id || crypto.randomUUID(),
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

      // Add to buffer
      const bufferKey = `${securityEvent.category}_${securityEvent.severity}`;
      if (!this.logBuffer.has(bufferKey)) {
        this.logBuffer.set(bufferKey, []);
      }
      const currentBuffer = this.logBuffer.get(bufferKey);
      if (currentBuffer) {
        currentBuffer.push(securityEvent);

        // Check if immediate flush is needed
        if (securityEvent.severity === 'CRITICAL' || currentBuffer.length >= this.maxBufferSize) {
          await this.flushBuffer(bufferKey);
        }
      }

      // Check for alerts
      await this.checkAlertRules(securityEvent);

      // Send to SIEM if enabled
      if (this.config.enableSIEMIntegration) {
        await this.sendToSIEM([securityEvent]);
      }

    } catch (error: unknown) {
      logger.error('Failed to log security event:', toLogMetadata(error));
    }
  }

  /**
   * Log authentication event
   */
  async logAuthenticationEvent(
    userId: string,
    action: string,
    success: boolean,
    ipAddress: string,
    userAgent?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
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

  /**
   * Log data access event
   */
  async logDataAccessEvent(
    userId: string,
    resource: string,
    action: string,
    success: boolean,
    ipAddress: string,
    details: Record<string, any> = {}
  ): Promise<void> {
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

  /**
   * Log privileged access event
   */
  async logPrivilegedAccessEvent(
    userId: string,
    action: string,
    resource: string,
    ipAddress: string,
    success: boolean,
    details: Record<string, any> = {}
  ): Promise<void> {
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

  /**
   * Log network security event
   */
  async logNetworkSecurityEvent(
    eventType: string,
    severity: SecurityEvent['severity'],
    ipAddress: string,
    details: Record<string, any> = {}
  ): Promise<void> {
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

  /**
   * Log application security event
   */
  async logApplicationSecurityEvent(
    eventType: string,
    severity: SecurityEvent['severity'],
    ipAddress: string,
    userAgent?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
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

  private calculateNetworkRiskScore(severity: SecurityEvent['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 90;
      case 'HIGH': return 70;
      case 'MEDIUM': return 40;
      case 'LOW': return 10;
      default: return 0;
    }
  }

  private calculateApplicationRiskScore(
    severity: SecurityEvent['severity'],
    eventType: string
  ): number {
    let baseScore = this.calculateNetworkRiskScore(severity);

    // Adjust based on event type
    if (eventType.includes('injection')) {
      baseScore += 20;
    } else if (eventType.includes('xss')) {
      baseScore += 15;
    } else if (eventType.includes('csrf')) {
      baseScore += 10;
    }

    return Math.min(100, baseScore);
  }

  /**
   * Check alert rules against event
   */
  private async checkAlertRules(event: SecurityEvent): Promise<void> {
    for (const [ruleName, rule] of this.alertRules.entries()) {
      try {
        if (await this.evaluateAlertRule(rule, event)) {
          await this.triggerAlert(ruleName, rule, event);
        }
      } catch (error: unknown) {
        // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
        logger.error(`Failed to evaluate alert rule ${sanitizeForLog(ruleName)}:`, toLogMetadata(error));
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule, event: SecurityEvent): Promise<boolean> {
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

  private async evaluateThresholdRule(rule: AlertRule, event: SecurityEvent): Promise<boolean> {
    if (event[rule.field as keyof SecurityEvent] !== rule.value) {
      return false;
    }

    // Check how many similar events occurred in the time window
    const cacheKey = `alert_count:${rule.field}:${rule.value}`;
    const currentCount = await tenantCacheService.get<number>('system', cacheKey) || 0;
    const newCount = currentCount + 1;

    await tenantCacheService.set(
      'system',
      cacheKey,
      newCount,
      { ttl: Math.floor(rule.timeWindow! / 1000) }
    );

    return newCount >= rule.threshold!;
  }

  private evaluateMatchRule(rule: AlertRule, event: SecurityEvent): boolean {
    const fieldValue = event[rule.field as keyof SecurityEvent];

    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(rule.value);
    }

    return fieldValue === rule.value;
  }

  private evaluatePatternRule(rule: AlertRule, event: SecurityEvent): boolean {
    return rule.conditions!.every((condition) => {
      const fieldValue = event[condition.field as keyof SecurityEvent];

      switch (condition.operator) {
        case 'eq': return fieldValue === condition.value;
        case 'ne': return fieldValue !== condition.value;
        case 'gt': return (fieldValue as number) > condition.value;
        case 'gte': return (fieldValue as number) >= condition.value;
        case 'lt': return (fieldValue as number) < condition.value;
        case 'lte': return (fieldValue as number) <= condition.value;
        case 'contains': return (fieldValue as string).includes(condition.value);
        default: return false;
      }
    });
  }

  private async triggerAlert(ruleName: string, rule: AlertRule, event: SecurityEvent): Promise<void> {
    const alert: SIEMAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      severity: rule.severity,
      title: `Security Alert: ${ruleName}`,
      description: `Alert triggered by rule: ${ruleName}`,
      events: [event],
      indicators: this.extractIndicators(event),
      recommendations: this.generateRecommendations(ruleName, event),
      status: 'open'
    };

    // Log the alert
    logger.warn('Security alert triggered', {
      alertId: alert.id,
      ruleName,
      severity: alert.severity,
      eventId: event.id
    });

    // Send to SIEM
    if (this.config.enableSIEMIntegration) {
      await this.sendAlertToSIEM(alert);
    }

    // Store alert for investigation
    await this.storeAlert(alert);
  }

  private extractIndicators(event: SecurityEvent): string[] {
    const indicators: string[] = [];

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

  private generateRecommendations(ruleName: string, _event: SecurityEvent): string[] {
    const recommendations: string[] = [];

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

  /**
   * Flush log buffer to storage
   */
  private async flushBuffer(bufferKey?: string): Promise<void> {
    const keysToFlush = bufferKey ? [bufferKey] : Array.from(this.logBuffer.keys());

    for (const key of keysToFlush) {
      const events = this.logBuffer.get(key);
      if (!events || events.length === 0) continue;

      try {
        await this.writeEventsToStorage(events);
        this.logBuffer.set(key, []); // Clear buffer after successful write

      } catch (error: unknown) {
        // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
        logger.error(`Failed to flush buffer ${sanitizeForLog(key)}:`, toLogMetadata(error));
      }
    }
  }

  private async writeEventsToStorage(events: SecurityEvent[]): Promise<void> {
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

  private async writeToFileStorage(events: SecurityEvent[]): Promise<void> {
    const logDir = path.join(process.cwd(), 'logs', 'security');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `security-${timestamp}.log`;
    const filepath = path.join(logDir, filename);

    // Check if file exists and is read-only, if so make it writable temporarily
    let wasReadOnly = false;
    if (fs.existsSync(filepath)) {
      try {
        const stats = fs.statSync(filepath);
        // Check if file is read-only (no write permission)
        wasReadOnly = !(stats.mode & 0o200);
        if (wasReadOnly) {
          // Make file writable temporarily
          fs.chmodSync(filepath, 0o644);
        }
      } catch (error: unknown) {
        logger.warn('Could not check/modify file permissions:', toLogMetadata(error));
      }
    }

    for (const event of events) {
      const logEntry = await this.createLogEntry(event);
      const logLine = JSON.stringify(logEntry) + '\n';

      // Encrypt if enabled
      const dataToWrite = this.config.enableEncryption
        ? await this.encryptLogData(logLine)
        : logLine;

      fs.appendFileSync(filepath, dataToWrite);
    }

    // Set immutable attribute if write-once storage is enabled and wasn't already read-only
    if (this.config.enableWriteOnceStorage && !wasReadOnly) {
      try {
        fs.chmodSync(filepath, 0o444); // Read-only
      } catch (error: unknown) {
        logger.warn('Could not set file immutable:', toLogMetadata(error));
      }
    }
  }

  private async writeToElasticsearch(events: SecurityEvent[]): Promise<void> {
    // Elasticsearch implementation would go here
    logger.debug(`Writing ${events.length} events to Elasticsearch`);
  }

  private async writeToS3Storage(events: SecurityEvent[]): Promise<void> {
    // S3 implementation would go here
    logger.debug(`Writing ${events.length} events to S3`);
  }

  private async writeToSplunk(events: SecurityEvent[]): Promise<void> {
    // Splunk implementation would go here
    logger.debug(`Writing ${events.length} events to Splunk`);
  }

  private async createLogEntry(_event: SecurityEvent): Promise<LogEntry> {
    const logData = JSON.stringify(_event);
    const checksum = crypto.createHash('sha256').update(logData).digest('hex');

    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'SECURITY',
      message: _event.eventType,
      metadata: _event,
      source: 'SecurityLogService',
      encrypted: this.config.enableEncryption,
      checksum
    };
  }

  private async encryptLogData(data: string): Promise<string> {
    if (!this.isInitialized) {
      logger.info('Waiting for SecurityLogService initialization to complete...');
      // Simple polling with exponential backoff
      let attempts = 0;
      while (!this.isInitialized && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 5000)));
        attempts++;
      }

      if (!this.isInitialized) {
        logger.error('SecurityLogService initialization timeout - falling back to unencrypted logs');
        return data;
      }
    }
    if (!this.config.enableEncryption) {
      return data;
    }

    try {
      const keyId = getSecurityKeyId('securityLogsEncryptionKeyId');
      const encryptionKey = this.encryptionKeys.get(keyId);

      if (!encryptionKey) {
        // If key is not available, try to initialize it again
        logger.warn('Encryption key not found, attempting to reinitialize...');
        await this.initializeEncryptionKeys();

        const retryKey = this.encryptionKeys.get(keyId);
        if (!retryKey) {
          throw new Error('Encryption key not found after reinitialization');
        }

        // Validate key length for AES-256
        if (retryKey.length !== 32) {
          throw new Error(`Invalid key length: expected 32 bytes, got ${retryKey.length} bytes`);
        }

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.config.encryptionAlgorithm, retryKey, iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const result: EncryptedLogResult = {
          encrypted: true,
          algorithm: this.config.encryptionAlgorithm,
          iv: iv.toString('hex'),
          data: encrypted
        };

        // Add auth tag for GCM mode
        if (this.config.encryptionAlgorithm.includes('gcm')) {
          result.authTag = (cipher as crypto.CipherGCM).getAuthTag().toString('hex');
        }

        return JSON.stringify(result);
      }

      // Validate key length for AES-256
      if (encryptionKey.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${encryptionKey.length} bytes`);
      }

      const iv = crypto.randomBytes(16);

      // Use modern crypto API with explicit algorithm and IV
      const cipher = crypto.createCipheriv(this.config.encryptionAlgorithm, encryptionKey, iv);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const result: EncryptedLogResult = {
        encrypted: true,
        algorithm: this.config.encryptionAlgorithm,
        iv: iv.toString('hex'),
        data: encrypted
      };

      // Add auth tag for GCM mode
      if (this.config.encryptionAlgorithm.includes('gcm')) {
        result.authTag = (cipher as crypto.CipherGCM).getAuthTag().toString('hex');
      }

      return JSON.stringify(result);

    } catch (error: unknown) {
      logger.error('Failed to encrypt log data:', toLogMetadata(error));
      return data; // Fallback to unencrypted
    }
  }

  /**
   * Send events to SIEM
   */
  private async sendToSIEM(events: SecurityEvent[]): Promise<void> {
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

      logger.debug(`Sent ${events.length} events to SIEM successfully`);

    } catch (error: unknown) {
      logger.error('Failed to send events to SIEM:', toLogMetadata(error));
    }
  }

  private formatEventsForSIEM(events: SecurityEvent[]): (SecurityEvent | string)[] {
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

  private formatAsCEF(event: SecurityEvent): string {
    return `CEF:0|BotRT|SecurityLogService|1.0|${event.eventType}|${event.eventType}|${this.mapSeverityToCEF(event.severity)}|src=${event.ipAddress} suser=${event.userId || ''} act=${event.action || ''} outcome=${event.success ? 'success' : 'failure'}`;
  }

  private formatAsLEEF(event: SecurityEvent): string {
    return `LEEF:2.0|BotRT|SecurityLogService|1.0|${event.eventType}|src=${event.ipAddress}|suser=${event.userId || ''}|act=${event.action || ''}|outcome=${event.success ? 'success' : 'failure'}`;
  }

  private formatAsSyslog(event: SecurityEvent): string {
    const priority = this.mapSeverityToSyslog(event.severity);
    const timestamp = event.timestamp.toISOString();
    return `<${priority}>${timestamp} botrt-security: ${JSON.stringify(event)}`;
  }

  private formatAsJSON(event: SecurityEvent): SecurityEvent {
    return {
      ...event,
      resource: event.resource || 'BotRT',
      product: 'SecurityLogService',
      version: '1.0'
    } as SecurityEvent;
  }

  private mapSeverityToCEF(severity: SecurityEvent['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 10;
      case 'HIGH': return 8;
      case 'MEDIUM': return 5;
      case 'LOW': return 2;
      default: return 1;
    }
  }

  private mapSeverityToSyslog(severity: SecurityEvent['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 130; // Local0.Crit
      case 'HIGH': return 131;     // Local0.Err
      case 'MEDIUM': return 132;   // Local0.Warning
      case 'LOW': return 134;      // Local0.Info
      default: return 135;         // Local0.Debug
    }
  }

  private async sendAlertToSIEM(alert: SIEMAlert): Promise<void> {
    if (!this.config.enableSIEMIntegration) {
      return;
    }

    try {
      const alertData: any = {
        type: 'security_alert',
        alert,
        timestamp: new Date().toISOString(),
        resource: 'BotRT-SecurityLogService'
      };

      await this.sendToSIEM([alertData as SecurityEvent]);

    } catch (error: unknown) {
      logger.error('Failed to send alert to SIEM:', toLogMetadata(error));
    }
  }

  private async storeAlert(alert: SIEMAlert): Promise<void> {
    try {
      // Store alert in cache for quick access
      await tenantCacheService.set(
        'system',
        `security_alert_${alert.id}`,
        alert,
        { ttl: 86400, namespace: 'security_alerts' } // 24 hours
      );

      logger.info('Security alert stored', {
        alertId: alert.id,
        severity: alert.severity
      });

    } catch (error: unknown) {
      logger.error('Failed to store alert:', toLogMetadata(error));
    }
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Periodic buffer flush
    setInterval(() => {
      this.flushBuffer().catch((error: unknown) => {
        logger.error('Background buffer flush failed:', toLogMetadata(error));
      });
    }, this.bufferFlushInterval);

    // Log rotation check
    setInterval(() => {
      this.rotateLogsIfNeeded().catch((error: unknown) => {
        logger.error('Log rotation failed:', toLogMetadata(error));
      });
    }, this.config.rotationInterval * 3600000); // Convert hours to milliseconds

    // Key rotation check
    setInterval(() => {
      this.rotateEncryptionKeysIfNeeded().catch((error: unknown) => {
        logger.error('Key rotation failed:', toLogMetadata(error));
      });
    }, 24 * 3600000); // Daily check
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    if (this.config.storageType !== 'file') {
      return;
    }

    // Implementation for log rotation
    logger.debug('Checking if log rotation is needed');
  }

  private async rotateEncryptionKeysIfNeeded(): Promise<void> {
    if (!this.config.enableEncryption) {
      return;
    }

    // Implementation for key rotation
    logger.debug('Checking if encryption key rotation is needed');
  }

  /**
   * Get security statistics
   */
  getStats(): {
    config: SecurityLogConfig;
    bufferSizes: Record<string, number>;
    encryptionEnabled: boolean;
    siemConnected: boolean;
  } {
    const bufferSizes: Record<string, number> = {};
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

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: ReturnType<SecurityLogService['getStats']>;
  }> {
    try {
      const stats = this.getStats();

      // Test encryption if enabled
      if (this.config.enableEncryption) {
        await this.encryptLogData('health_check_test');
      }

      // Test SIEM connection if enabled
      if (this.config.enableSIEMIntegration) {
        // Could implement a lightweight ping here
      }

      return {
        status: 'healthy',
        stats
      };

    } catch (error: unknown) {
      logger.error('Security log service health check failed:', toLogMetadata(error));
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

// Export singleton instance
export const securityLogService = SecurityLogService.getInstance();
