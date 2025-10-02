"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminActionAuditMiddleware = exports.dataAccessAuditMiddleware = exports.responseAuditMiddleware = exports.auditMiddleware = void 0;
const logger_1 = require("../utils/logger");
const SecurityLogService_1 = require("../services/SecurityLogService");
class SecurityAuditMiddleware {
    constructor() {
        this.auditBuffer = new Map();
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
            maxRequestSize: parseInt(process.env.MAX_AUDIT_REQUEST_SIZE || '10240'),
            maxResponseSize: parseInt(process.env.MAX_AUDIT_RESPONSE_SIZE || '10240'),
            enableAsyncLogging: process.env.ENABLE_ASYNC_AUDIT_LOGGING !== 'false'
        };
        logger_1.logger.info('Security Audit Middleware initialized', {
            auditingEnabled: this.config.enableAuditing,
            requestLogging: this.config.enableRequestLogging,
            responseLogging: this.config.enableResponseLogging,
            piiRedaction: this.config.enablePIIRedaction
        });
    }
    auditMiddleware() {
        return async (req, res, next) => {
            if (!this.config.enableAuditing) {
                return next();
            }
            if (this.shouldSkipAudit(req)) {
                return next();
            }
            const startTime = Date.now();
            const requestId = this.generateRequestId();
            try {
                const requestContext = await this.createRequestContext(req, requestId);
                if (this.config.enableRequestLogging) {
                    await this.logRequest(requestContext);
                }
                res.locals.auditContext = {
                    requestId,
                    startTime,
                    requestContext
                };
                const originalJson = res.json;
                res.json = function (body) {
                    res.locals.responseBody = body;
                    return originalJson.call(this, body);
                };
                const originalSend = res.send;
                res.send = function (body) {
                    if (!res.locals.responseBody) {
                        res.locals.responseBody = body;
                    }
                    return originalSend.call(this, body);
                };
                next();
            }
            catch (err) {
                logger_1.logger.error('Audit middleware error:', err);
                next();
            }
        };
    }
    responseAuditMiddleware() {
        return async (req, res, next) => {
            if (!this.config.enableAuditing || !res.locals.auditContext) {
                return next();
            }
            try {
                const { requestId, startTime, requestContext } = res.locals.auditContext;
                const duration = Date.now() - startTime;
                const responseContext = this.createResponseContext(res, duration);
                if (this.config.enableResponseLogging) {
                    await this.logResponse(requestContext, responseContext);
                }
                const auditEvent = await this.createAuditEvent(requestId, requestContext, responseContext, req);
                await this.processAuditEvent(auditEvent);
            }
            catch (err) {
                logger_1.logger.error('Response audit middleware error:', err);
            }
            next();
        };
    }
    dataAccessAuditMiddleware() {
        return async (req, res, next) => {
            if (!this.config.enableDataAccessLogging) {
                return next();
            }
            try {
                if (this.isDataAccessOperation(req)) {
                    await this.logDataAccess(req, res);
                }
            }
            catch (err) {
                logger_1.logger.error('Data access audit error:', err);
            }
            next();
        };
    }
    adminActionAuditMiddleware() {
        return async (req, res, next) => {
            if (!this.config.enableAdminActionLogging) {
                return next();
            }
            try {
                if (this.isAdminAction(req)) {
                    await this.logAdminAction(req, res);
                }
            }
            catch (err) {
                logger_1.logger.error('Admin action audit error:', err);
            }
            next();
        };
    }
    shouldSkipAudit(req) {
        if (this.config.excludePaths.some(path => req.path.startsWith(path))) {
            return true;
        }
        if (this.config.excludeMethods.includes(req.method)) {
            return true;
        }
        if (req.path.match(/\/(health|metrics|status|ping)/)) {
            return true;
        }
        return false;
    }
    generateRequestId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    async createRequestContext(req, requestId) {
        const context = {
            requestId,
            userId: req.user?.id,
            sessionId: req.sessionID || req.session?.id,
            tenantId: req.tenant?.id,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent') || 'unknown',
            timestamp: new Date(),
            method: req.method,
            path: req.path,
            query: this.sanitizeObject(req.query),
            headers: this.sanitizeHeaders(req.headers)
        };
        if (req.body && this.shouldLogRequestBody(req)) {
            const bodyString = JSON.stringify(req.body);
            if (bodyString.length <= this.config.maxRequestSize) {
                context.body = this.sanitizeObject(req.body);
            }
            else {
                context.body = {
                    _truncated: true,
                    _size: bodyString.length,
                    _maxSize: this.config.maxRequestSize
                };
            }
        }
        return context;
    }
    createResponseContext(res, duration) {
        const context = {
            statusCode: res.statusCode,
            headers: this.sanitizeHeaders(res.getHeaders()),
            duration,
            size: 0
        };
        if (res.locals.responseBody && this.shouldLogResponseBody(res)) {
            const bodyString = JSON.stringify(res.locals.responseBody);
            context.size = bodyString.length;
            if (bodyString.length <= this.config.maxResponseSize) {
                context.body = this.sanitizeObject(res.locals.responseBody);
            }
            else {
                context.body = {
                    _truncated: true,
                    _size: bodyString.length,
                    _maxSize: this.config.maxResponseSize
                };
            }
        }
        return context;
    }
    async createAuditEvent(requestId, requestContext, responseContext, req) {
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
    determineEventType(requestContext, responseContext) {
        const { method, path } = requestContext;
        const { statusCode } = responseContext;
        if (path.includes('/auth/')) {
            if (statusCode >= 400) {
                return 'authentication_failed';
            }
            return 'authentication_success';
        }
        if (path.includes('/admin/')) {
            return 'admin_action';
        }
        if (path.includes('/payment/') || path.includes('/order/')) {
            return 'payment_operation';
        }
        if (method === 'GET' && statusCode === 200) {
            return 'data_access';
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            if (statusCode >= 200 && statusCode < 300) {
                return 'data_modification';
            }
            else {
                return 'data_modification_failed';
            }
        }
        if (path.startsWith('/api/')) {
            return 'api_access';
        }
        return 'http_request';
    }
    calculateRiskScore(requestContext, responseContext) {
        let score = 0;
        if (responseContext.statusCode >= 400) {
            score += 20;
        }
        if (responseContext.statusCode >= 500) {
            score += 30;
        }
        if (requestContext.path.includes('/admin/')) {
            score += 30;
        }
        if (requestContext.path.includes('/payment/')) {
            score += 25;
        }
        if (requestContext.path.includes('/auth/')) {
            score += 15;
        }
        if (['DELETE'].includes(requestContext.method)) {
            score += 20;
        }
        if (['PUT', 'PATCH'].includes(requestContext.method)) {
            score += 10;
        }
        if (this.isSuspiciousUserAgent(requestContext.userAgent)) {
            score += 25;
        }
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            score += 10;
        }
        return Math.min(100, score);
    }
    classifyRequest(requestContext) {
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
    determineCompliance(requestContext, responseContext) {
        const { path, body } = requestContext;
        const responseBody = responseContext.body;
        const compliance = {
            pii: false,
            gdpr: false,
            pci: false,
            hipaa: false
        };
        if (this.containsPII(body) || this.containsPII(responseBody)) {
            compliance.pii = true;
            compliance.gdpr = true;
        }
        if (path.includes('/payment/') || path.includes('/card/')) {
            compliance.pci = true;
        }
        if (path.includes('/health/') || path.includes('/medical/')) {
            compliance.hipaa = true;
        }
        return compliance;
    }
    generateSecurityFlags(requestContext, responseContext) {
        const flags = [];
        if (responseContext.statusCode >= 400) {
            flags.push('failed_request');
        }
        if (requestContext.path.includes('/admin/')) {
            flags.push('privileged_access');
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(requestContext.method)) {
            flags.push('data_modification');
        }
        if (this.isSuspiciousUserAgent(requestContext.userAgent)) {
            flags.push('suspicious_user_agent');
        }
        if (JSON.stringify(requestContext.body || {}).length > 1000) {
            flags.push('large_request');
        }
        if (responseContext.size > 10000) {
            flags.push('large_response');
        }
        if (responseContext.duration > 5000) {
            flags.push('slow_request');
        }
        return flags;
    }
    async processAuditEvent(auditEvent) {
        try {
            await SecurityLogService_1.securityLogService.logSecurityEvent({
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
            if (this.config.enableAsyncLogging) {
                this.auditBuffer.set(auditEvent.requestId, auditEvent);
                if (this.auditBuffer.size > 1000) {
                    await this.flushAuditBuffer();
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to process audit event:', error);
        }
    }
    mapRiskScoreToSeverity(riskScore) {
        if (riskScore >= 80)
            return 'CRITICAL';
        if (riskScore >= 60)
            return 'HIGH';
        if (riskScore >= 30)
            return 'MEDIUM';
        return 'LOW';
    }
    mapEventTypeToCategory(eventType) {
        if (eventType.includes('authentication'))
            return 'authentication';
        if (eventType.includes('admin'))
            return 'authorization';
        if (eventType.includes('data'))
            return 'data_access';
        if (eventType.includes('payment'))
            return 'application';
        if (eventType.includes('network'))
            return 'network';
        return 'system';
    }
    async logRequest(requestContext) {
        logger_1.logger.info('HTTP Request', {
            requestId: requestContext.requestId,
            method: requestContext.method,
            path: requestContext.path,
            userId: requestContext.userId,
            ipAddress: requestContext.ipAddress,
            userAgent: requestContext.userAgent
        });
    }
    async logResponse(requestContext, responseContext) {
        logger_1.logger.info('HTTP Response', {
            requestId: requestContext.requestId,
            statusCode: responseContext.statusCode,
            duration: responseContext.duration,
            size: responseContext.size
        });
    }
    async logDataAccess(req, _res) {
        await SecurityLogService_1.securityLogService.logDataAccessEvent(req.user?.id || 'anonymous', req.path, req.method, true, this.getClientIP(req), {
            query: req.query,
            headers: this.sanitizeHeaders(req.headers)
        });
    }
    async logAdminAction(req, _res) {
        await SecurityLogService_1.securityLogService.logPrivilegedAccessEvent(req.user?.id || 'anonymous', req.method, req.path, this.getClientIP(req), true, {
            userRole: req.user?.role,
            permissions: req.user?.permissions,
            body: this.sanitizeObject(req.body)
        });
    }
    isDataAccessOperation(req) {
        return req.method === 'GET' &&
            (req.path.includes('/api/') ||
                req.path.includes('/data/') ||
                req.path.includes('/users/') ||
                req.path.includes('/orders/'));
    }
    isAdminAction(req) {
        return req.path.includes('/admin/') ||
            (req.user?.role && ['OWNER', 'ADMIN'].includes(req.user.role));
    }
    shouldLogRequestBody(req) {
        if (req.path.includes('/auth/') && req.method === 'POST') {
            return false;
        }
        if (req.headers['content-type']?.includes('multipart/form-data')) {
            return false;
        }
        return ['POST', 'PUT', 'PATCH'].includes(req.method);
    }
    shouldLogResponseBody(res) {
        if (res.statusCode >= 400) {
            return false;
        }
        const contentType = res.getHeader('content-type');
        if (contentType && !contentType.includes('application/json') && !contentType.includes('text/')) {
            return false;
        }
        return true;
    }
    sanitizeObject(obj) {
        if (!obj || !this.config.enablePIIRedaction) {
            return obj;
        }
        const sanitized = JSON.parse(JSON.stringify(obj));
        return this.redactPII(sanitized);
    }
    redactPII(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.redactPII(item));
        }
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (this.isPIIField(key)) {
                result[key] = '[REDACTED]';
            }
            else if (typeof value === 'object') {
                result[key] = this.redactPII(value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    isPIIField(fieldName) {
        const lowerField = fieldName.toLowerCase();
        return this.config.piiFields.some(piiField => lowerField.includes(piiField.toLowerCase()));
    }
    containsPII(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        const objString = JSON.stringify(obj).toLowerCase();
        return this.config.piiFields.some(piiField => objString.includes(piiField.toLowerCase()));
    }
    sanitizeHeaders(headers) {
        const sanitized = {};
        for (const [key, value] of Object.entries(headers)) {
            if (this.config.excludeHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    isSuspiciousUserAgent(userAgent) {
        const suspiciousPatterns = [
            /bot|crawler|spider|scraper/i,
            /curl|wget|python|java/i,
            /^$/,
            /mozilla\/[45]\.0$/i
        ];
        return suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }
    getClientIP(req) {
        return (req.get('CF-Connecting-IP') ||
            req.get('X-Forwarded-For')?.split(',')[0] ||
            req.get('X-Real-IP') ||
            req.ip ||
            'unknown').trim();
    }
    async flushAuditBuffer() {
        if (this.auditBuffer.size === 0) {
            return;
        }
        try {
            const events = Array.from(this.auditBuffer.values());
            this.auditBuffer.clear();
            logger_1.logger.debug(`Flushing ${events.length} audit events`);
        }
        catch (err) {
            logger_1.logger.error('Failed to flush audit buffer:', err);
        }
    }
}
const securityAuditMiddleware = new SecurityAuditMiddleware();
exports.auditMiddleware = securityAuditMiddleware.auditMiddleware.bind(securityAuditMiddleware);
exports.responseAuditMiddleware = securityAuditMiddleware.responseAuditMiddleware.bind(securityAuditMiddleware);
exports.dataAccessAuditMiddleware = securityAuditMiddleware.dataAccessAuditMiddleware.bind(securityAuditMiddleware);
exports.adminActionAuditMiddleware = securityAuditMiddleware.adminActionAuditMiddleware.bind(securityAuditMiddleware);
exports.default = securityAuditMiddleware;
//# sourceMappingURL=securityAuditMiddleware.js.map