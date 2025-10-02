import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { securityLogService } from '../services/SecurityLogService';

export interface AuditConfig {
  enableAuditing: boolean;
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  enableDataAccessLogging: boolean;
  enableAdminActionLogging: boolean;
  
  // Filtering options
  excludePaths: string[];
  excludeMethods: string[];
  excludeHeaders: string[];
  
  // PII protection
  enablePIIRedaction: boolean;
  piiFields: string[];
  
  // Performance
  maxRequestSize: number;
  maxResponseSize: number;
  enableAsyncLogging: boolean;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ResponseContext {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  duration: number;
  size: number;
}

export interface AuditEvent {
  requestId: string;
  eventType: string;
  timestamp: Date;
  request: RequestContext;
  response?: ResponseContext;
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  security: {
    riskScore: number;
    flags: string[];
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
  };
  compliance: {
    pii: boolean;
    gdpr: boolean;
    pci: boolean;
    hipaa: boolean;
  };
  metadata: Record<string, unknown>;
}

class SecurityAuditMiddleware {
  private config: AuditConfig;
  private auditBuffer: Map<string, AuditEvent> = new Map();

  constructor() {
    this.config = {
      enableAuditing: process.env.ENABLE_SECURITY_AUDITING !== 'false',
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
      enableResponseLogging: process.env.ENABLE_RESPONSE_LOGGING !== 'false',
      enableDataAccessLogging: process.env.ENABLE_DATA_ACCESS_LOGGING !== 'false',
      enableAdminActionLogging: process.env.ENABLE_ADMIN_ACTION_LOGGING !== 'false',
      
      excludePaths: (process.env.AUDIT_EXCLUDE_PATHS || '/health,/metrics,/favicon.ico').split(','),
      excludeMethods: (process.env.AUDIT_EXCLUDE_METHODS || 'OPTIONS').split(','),
      excludeHeaders: (process.env.AUDIT_EXCLUDE_HEADERS || 'authorization,cookie').split(','),
      
      enablePIIRedaction: process.env.ENABLE_PII_REDACTION !== 'false',
      piiFields: (process.env.PII_FIELDS || 'email,phone,ssn,creditCard,password').split(','),
      
      maxRequestSize: parseInt(process.env.MAX_AUDIT_REQUEST_SIZE || '10240'), // 10KB
      maxResponseSize: parseInt(process.env.MAX_AUDIT_RESPONSE_SIZE || '10240'), // 10KB
      enableAsyncLogging: process.env.ENABLE_ASYNC_AUDIT_LOGGING !== 'false'
    };

    logger.info('Security Audit Middleware initialized', {
      auditingEnabled: this.config.enableAuditing,
      requestLogging: this.config.enableRequestLogging,
      responseLogging: this.config.enableResponseLogging,
      piiRedaction: this.config.enablePIIRedaction
    });
  }

  /**
   * Main audit middleware
   */
  auditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableAuditing) {
        return next();
      }

      // Skip excluded paths and methods
      if (this.shouldSkipAudit(req)) {
        return next();
      }

      const startTime = Date.now();
      const requestId = this.generateRequestId();

      try {
        // Create request context
        const requestContext = await this.createRequestContext(req, requestId);
        
        // Log request if enabled
        if (this.config.enableRequestLogging) {
          await this.logRequest(requestContext);
        }

        // Store request context for response logging
        res.locals.auditContext = {
          requestId,
          startTime,
          requestContext
        };

        // Override res.json to capture response
        const originalJson = res.json;
        res.json = function(body: unknown) {
          res.locals.responseBody = body;
          return originalJson.call(this, body);
        };

        // Override res.send to capture response
        const originalSend = res.send;
        res.send = function(body: unknown) {
          if (!res.locals.responseBody) {
            res.locals.responseBody = body;
          }
          return originalSend.call(this, body);
        };

        // Continue to next middleware
        next();

      } catch (err: unknown) {
        logger.error('Audit middleware error:', err as Record<string, unknown>);
        next(); // Continue even if audit fails
      }
    };
  }

  /**
   * Response audit middleware (should be added after routes)
   */
  responseAuditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableAuditing || !res.locals.auditContext) {
        return next();
      }

      try {
        const { requestId, startTime, requestContext } = res.locals.auditContext;
        const duration = Date.now() - startTime;

        // Create response context
        const responseContext = this.createResponseContext(res, duration);

        // Log response if enabled
        if (this.config.enableResponseLogging) {
          await this.logResponse(requestContext, responseContext);
        }

        // Create complete audit event
        const auditEvent = await this.createAuditEvent(
          requestId,
          requestContext,
          responseContext,
          req
        );

        // Process audit event
        await this.processAuditEvent(auditEvent);

      } catch (err: unknown) {
        logger.error('Response audit middleware error:', err as Record<string, unknown>);
      }

      next();
    };
  }

  /**
   * Data access audit middleware
   */
  dataAccessAuditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableDataAccessLogging) {
        return next();
      }

      try {
        // Check if this is a data access operation
        if (this.isDataAccessOperation(req)) {
          await this.logDataAccess(req, res);
        }

      } catch (err: unknown) {
        logger.error('Data access audit error:', err as Record<string, unknown>);
      }

      next();
    };
  }

  /**
   * Admin action audit middleware
   */
  adminActionAuditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableAdminActionLogging) {
        return next();
      }

      try {
        // Check if this is an admin action
        if (this.isAdminAction(req)) {
          await this.logAdminAction(req, res);
        }

      } catch (err: unknown) {
        logger.error('Admin action audit error:', err as Record<string, unknown>);
      }

      next();
    };
  }

  private shouldSkipAudit(req: Request): boolean {
    // Check excluded paths
    if (this.config.excludePaths.some(path => req.path.startsWith(path))) {
      return true;
    }

    // Check excluded methods
    if (this.config.excludeMethods.includes(req.method)) {
      return true;
    }

    // Skip health checks and monitoring endpoints
    if (req.path.match(/\/(health|metrics|status|ping)/)) {
      return true;
    }

    return false;
  }

  private generateRequestId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async createRequestContext(req: Request, requestId: string): Promise<RequestContext> {
    const context: RequestContext = {
      requestId,
      userId: req.user?.id,
      sessionId: (req as any).sessionID || (req.session?.id as string | undefined),
      tenantId: (req as Request & { tenant?: { id: string } }).tenant?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      query: this.sanitizeObject(req.query) as Record<string, unknown>,
      headers: this.sanitizeHeaders(req.headers as Record<string, string>)
    };

    // Add request body if appropriate
    if (req.body && this.shouldLogRequestBody(req)) {
      const bodyString = JSON.stringify(req.body);
      if (bodyString.length <= this.config.maxRequestSize) {
        context.body = this.sanitizeObject(req.body);
      } else {
        context.body = { 
          _truncated: true, 
          _size: bodyString.length,
          _maxSize: this.config.maxRequestSize
        };
      }
    }

    return context;
  }

  private createResponseContext(res: Response, duration: number): ResponseContext {
    const context: ResponseContext = {
      statusCode: res.statusCode,
      headers: this.sanitizeHeaders(res.getHeaders() as Record<string, string>),
      duration,
      size: 0
    };

    // Add response body if appropriate
    if (res.locals.responseBody && this.shouldLogResponseBody(res)) {
      const bodyString = JSON.stringify(res.locals.responseBody);
      context.size = bodyString.length;
      
      if (bodyString.length <= this.config.maxResponseSize) {
        context.body = this.sanitizeObject(res.locals.responseBody);
      } else {
        context.body = { 
          _truncated: true, 
          _size: bodyString.length,
          _maxSize: this.config.maxResponseSize
        };
      }
    }

    return context;
  }

  private async createAuditEvent(
    requestId: string,
    requestContext: RequestContext,
    responseContext: ResponseContext,
    req: Request
  ): Promise<AuditEvent> {
    const eventType = this.determineEventType(requestContext, responseContext);
    const riskScore = this.calculateRiskScore(requestContext, responseContext);
    const classification = this.classifyRequest(requestContext);
    const compliance = this.determineCompliance(requestContext, responseContext);

    return {
      requestId,
      eventType,
      timestamp: requestContext.timestamp,
      request: requestContext,
      response: responseContext,
      user: req.user ? {
        id: req.user.id,
        role: req.user.role,
        permissions: req.user.permissions || []
      } : undefined,
      security: {
        riskScore,
        flags: this.generateSecurityFlags(requestContext, responseContext),
        classification
      },
      compliance,
      metadata: {
        source: 'SecurityAuditMiddleware',
        version: '1.0',
        environment: process.env.NODE_ENV || 'unknown'
      }
    };
  }

  private determineEventType(
    requestContext: RequestContext,
    responseContext: ResponseContext
  ): string {
    const { method, path } = requestContext;
    const { statusCode } = responseContext;

    // Authentication events
    if (path.includes('/auth/')) {
      if (statusCode >= 400) {
        return 'authentication_failed';
      }
      return 'authentication_success';
    }

    // Admin events
    if (path.includes('/admin/')) {
      return 'admin_action';
    }

    // Payment events
    if (path.includes('/payment/') || path.includes('/order/')) {
      return 'payment_operation';
    }

    // Data access events
    if (method === 'GET' && statusCode === 200) {
      return 'data_access';
    }

    // Data modification events
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (statusCode >= 200 && statusCode < 300) {
        return 'data_modification';
      } else {
        return 'data_modification_failed';
      }
    }

    // API access
    if (path.startsWith('/api/')) {
      return 'api_access';
    }

    return 'http_request';
  }

  private calculateRiskScore(
    requestContext: RequestContext,
    responseContext: ResponseContext
  ): number {
    let score = 0;

    // Base score by status code
    if (responseContext.statusCode >= 400) {
      score += 20;
    }
    if (responseContext.statusCode >= 500) {
      score += 30;
    }

    // Sensitive paths
    if (requestContext.path.includes('/admin/')) {
      score += 30;
    }
    if (requestContext.path.includes('/payment/')) {
      score += 25;
    }
    if (requestContext.path.includes('/auth/')) {
      score += 15;
    }

    // Sensitive methods
    if (['DELETE'].includes(requestContext.method)) {
      score += 20;
    }
    if (['PUT', 'PATCH'].includes(requestContext.method)) {
      score += 10;
    }

    // User agent analysis
    if (this.isSuspiciousUserAgent(requestContext.userAgent)) {
      score += 25;
    }

    // Time-based risk (off-hours access)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private classifyRequest(requestContext: RequestContext): 'public' | 'internal' | 'confidential' | 'restricted' {
    const { path } = requestContext;

    if (path.includes('/admin/') || path.includes('/auth/')) {
      return 'restricted';
    }
    if (path.includes('/payment/') || path.includes('/user/')) {
      return 'confidential';
    }
    if (path.startsWith('/api/')) {
      return 'internal';
    }

    return 'public';
  }

  private determineCompliance(
    requestContext: RequestContext,
    responseContext: ResponseContext
  ): AuditEvent['compliance'] {
    const { path, body } = requestContext;
    const responseBody = responseContext.body;

    const compliance = {
      pii: false,
      gdpr: false,
      pci: false,
      hipaa: false
    };

    // Check for PII in request or response
    if (this.containsPII(body) || this.containsPII(responseBody)) {
      compliance.pii = true;
      compliance.gdpr = true;
    }

    // PCI DSS scope
    if (path.includes('/payment/') || path.includes('/card/')) {
      compliance.pci = true;
    }

    // HIPAA scope (if applicable)
    if (path.includes('/health/') || path.includes('/medical/')) {
      compliance.hipaa = true;
    }

    return compliance;
  }

  private generateSecurityFlags(
    requestContext: RequestContext,
    responseContext: ResponseContext
  ): string[] {
    const flags: string[] = [];

    // Failed request flag
    if (responseContext.statusCode >= 400) {
      flags.push('failed_request');
    }

    // Privileged access flag
    if (requestContext.path.includes('/admin/')) {
      flags.push('privileged_access');
    }

    // Data modification flag
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(requestContext.method)) {
      flags.push('data_modification');
    }

    // Suspicious user agent flag
    if (this.isSuspiciousUserAgent(requestContext.userAgent)) {
      flags.push('suspicious_user_agent');
    }

    // Large request/response flag
    if (JSON.stringify(requestContext.body || {}).length > 1000) {
      flags.push('large_request');
    }
    if (responseContext.size > 10000) {
      flags.push('large_response');
    }

    // Slow request flag
    if (responseContext.duration > 5000) {
      flags.push('slow_request');
    }

    return flags;
  }

  private async processAuditEvent(auditEvent: AuditEvent): Promise<void> {
    try {
      // Log to security log service
      await securityLogService.logSecurityEvent({
        eventType: auditEvent.eventType,
        severity: this.mapRiskScoreToSeverity(auditEvent.security.riskScore),
        category: this.mapEventTypeToCategory(auditEvent.eventType),
        userId: auditEvent.user?.id,
        ipAddress: auditEvent.request.ipAddress,
        userAgent: auditEvent.request.userAgent,
        resource: auditEvent.request.path,
        action: auditEvent.request.method,
        success: auditEvent.response ? auditEvent.response.statusCode < 400 : true,
        details: {
          requestId: auditEvent.requestId,
          duration: auditEvent.response?.duration,
          statusCode: auditEvent.response?.statusCode,
          userRole: auditEvent.user?.role,
          classification: auditEvent.security.classification
        },
        riskScore: auditEvent.security.riskScore,
        tags: ['audit', ...auditEvent.security.flags],
        compliance: auditEvent.compliance
      });

      // Store in buffer for batch processing if async logging is enabled
      if (this.config.enableAsyncLogging) {
        this.auditBuffer.set(auditEvent.requestId, auditEvent);
        
        // Flush buffer if it gets too large
        if (this.auditBuffer.size > 1000) {
          await this.flushAuditBuffer();
        }
      }

    } catch (error) {
      logger.error('Failed to process audit event:', error);
    }
  }

  private mapRiskScoreToSeverity(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  private mapEventTypeToCategory(eventType: string): 'network' | 'system' | 'authentication' | 'authorization' | 'data_access' | 'application' {
    if (eventType.includes('authentication')) return 'authentication';
    if (eventType.includes('admin')) return 'authorization';
    if (eventType.includes('data')) return 'data_access';
    if (eventType.includes('payment')) return 'application';
    if (eventType.includes('network')) return 'network';
    return 'system';
  }

  private async logRequest(requestContext: RequestContext): Promise<void> {
    logger.info('HTTP Request', {
      requestId: requestContext.requestId,
      method: requestContext.method,
      path: requestContext.path,
      userId: requestContext.userId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent
    });
  }

  private async logResponse(
    requestContext: RequestContext,
    responseContext: ResponseContext
  ): Promise<void> {
    logger.info('HTTP Response', {
      requestId: requestContext.requestId,
      statusCode: responseContext.statusCode,
      duration: responseContext.duration,
      size: responseContext.size
    });
  }

  private async logDataAccess(req: Request, _res: Response): Promise<void> {
    await securityLogService.logDataAccessEvent(
      req.user?.id || 'anonymous',
      req.path,
      req.method,
      true, // Will be updated based on response
      this.getClientIP(req),
      {
        query: req.query,
        headers: this.sanitizeHeaders(req.headers as Record<string, string>)
      }
    );
  }

  private async logAdminAction(req: Request, _res: Response): Promise<void> {
    await securityLogService.logPrivilegedAccessEvent(
      req.user?.id || 'anonymous',
      req.method,
      req.path,
      this.getClientIP(req),
      true, // Will be updated based on response
      {
        userRole: req.user?.role,
        permissions: req.user?.permissions,
        body: this.sanitizeObject(req.body as unknown)
      }
    );
  }

  private isDataAccessOperation(req: Request): boolean {
    return req.method === 'GET' && 
           (req.path.includes('/api/') || 
            req.path.includes('/data/') ||
            req.path.includes('/users/') ||
            req.path.includes('/orders/'));
  }

  private isAdminAction(req: Request): boolean {
    return req.path.includes('/admin/') || 
           (req.user?.role && ['OWNER', 'ADMIN'].includes(req.user.role));
  }

  private shouldLogRequestBody(req: Request): boolean {
    // Don't log sensitive endpoints
    if (req.path.includes('/auth/') && req.method === 'POST') {
      return false;
    }

    // Don't log file uploads
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      return false;
    }

    return ['POST', 'PUT', 'PATCH'].includes(req.method);
  }

  private shouldLogResponseBody(res: Response): boolean {
    // Don't log error responses with sensitive info
    if (res.statusCode >= 400) {
      return false;
    }

    // Don't log binary content
    const contentType = res.getHeader('content-type') as string;
    if (contentType && !contentType.includes('application/json') && !contentType.includes('text/')) {
      return false;
    }

    return true;
  }

  private sanitizeObject(obj: unknown): unknown {
    if (!obj || !this.config.enablePIIRedaction) {
      return obj;
    }

    const sanitized = JSON.parse(JSON.stringify(obj));
    return this.redactPII(sanitized);
  }

  private redactPII(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactPII(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isPIIField(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = this.redactPII(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private isPIIField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.config.piiFields.some(piiField => 
      lowerField.includes(piiField.toLowerCase())
    );
  }

  private containsPII(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const objString = JSON.stringify(obj).toLowerCase();
    return this.config.piiFields.some(piiField => 
      objString.includes(piiField.toLowerCase())
    );
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.config.excludeHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java/i,
      /^$/,
      /mozilla\/[45]\.0$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private getClientIP(req: Request): string {
    return (req.get('CF-Connecting-IP') ||
            req.get('X-Forwarded-For')?.split(',')[0] ||
            req.get('X-Real-IP') ||
            req.ip ||
            'unknown').trim();
  }

  private async flushAuditBuffer(): Promise<void> {
    if (this.auditBuffer.size === 0) {
      return;
    }

    try {
      const events = Array.from(this.auditBuffer.values());
      this.auditBuffer.clear();
      
      // Process events in batches
      logger.debug(`Flushing ${events.length} audit events`);
      
    } catch (err: unknown) {
      logger.error('Failed to flush audit buffer:', err as Record<string, unknown>);
    }
  }
}

// Create singleton instance
const securityAuditMiddleware = new SecurityAuditMiddleware();

// Export middleware functions
export const auditMiddleware = securityAuditMiddleware.auditMiddleware.bind(securityAuditMiddleware);
export const responseAuditMiddleware = securityAuditMiddleware.responseAuditMiddleware.bind(securityAuditMiddleware);
export const dataAccessAuditMiddleware = securityAuditMiddleware.dataAccessAuditMiddleware.bind(securityAuditMiddleware);
export const adminActionAuditMiddleware = securityAuditMiddleware.adminActionAuditMiddleware.bind(securityAuditMiddleware);

export default securityAuditMiddleware;
