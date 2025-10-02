import { Request, Response, NextFunction } from 'express';
export interface AuditConfig {
    enableAuditing: boolean;
    enableRequestLogging: boolean;
    enableResponseLogging: boolean;
    enableDataAccessLogging: boolean;
    enableAdminActionLogging: boolean;
    excludePaths: string[];
    excludeMethods: string[];
    excludeHeaders: string[];
    enablePIIRedaction: boolean;
    piiFields: string[];
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
declare class SecurityAuditMiddleware {
    private config;
    private auditBuffer;
    constructor();
    auditMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    responseAuditMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    dataAccessAuditMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    adminActionAuditMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private shouldSkipAudit;
    private generateRequestId;
    private createRequestContext;
    private createResponseContext;
    private createAuditEvent;
    private determineEventType;
    private calculateRiskScore;
    private classifyRequest;
    private determineCompliance;
    private generateSecurityFlags;
    private processAuditEvent;
    private mapRiskScoreToSeverity;
    private mapEventTypeToCategory;
    private logRequest;
    private logResponse;
    private logDataAccess;
    private logAdminAction;
    private isDataAccessOperation;
    private isAdminAction;
    private shouldLogRequestBody;
    private shouldLogResponseBody;
    private sanitizeObject;
    private redactPII;
    private isPIIField;
    private containsPII;
    private sanitizeHeaders;
    private isSuspiciousUserAgent;
    private getClientIP;
    private flushAuditBuffer;
}
declare const securityAuditMiddleware: SecurityAuditMiddleware;
export declare const auditMiddleware: any;
export declare const responseAuditMiddleware: any;
export declare const dataAccessAuditMiddleware: any;
export declare const adminActionAuditMiddleware: any;
export default securityAuditMiddleware;
//# sourceMappingURL=securityAuditMiddleware.d.ts.map