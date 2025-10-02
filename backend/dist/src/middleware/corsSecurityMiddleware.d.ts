import { Request, Response, NextFunction } from 'express';
export interface CorsSecurityConfig {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
    credentials: boolean;
    enableCSRF: boolean;
    csrfTokenName: string;
    csrfHeaderName: string;
    csrfCookieName: string;
    csrfTokenTTL: number;
    enableOriginValidation: boolean;
    enableReferrerValidation: boolean;
    strictModeEnabled: boolean;
}
export interface CSRFToken {
    token: string;
    createdAt: Date;
    expiresAt: Date;
    userId?: string;
    sessionId?: string;
    ipAddress: string;
}
export declare class CorsSecurityService {
    private static instance;
    private config;
    private csrfTokens;
    private originWhitelist;
    private suspiciousOrigins;
    private constructor();
    static getInstance(): CorsSecurityService;
    private parseAllowedOrigins;
    private initializeOriginWhitelist;
    getCorsMiddleware(): any;
    private isOriginAllowed;
    private matchOriginPattern;
    private logSuspiciousOrigin;
    generateCSRFToken(userId?: string, sessionId?: string, ipAddress?: string): string;
    validateCSRFToken(token: string, userId?: string, sessionId?: string, ipAddress?: string): boolean;
    getCSRFMiddleware(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    getCSRFTokenEndpoint(): (req: Request, res: Response) => void;
    getSecurityHeadersMiddleware(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    private isRefererValid;
    private startCleanupTimer;
    addAllowedOrigin(origin: string): void;
    removeAllowedOrigin(origin: string): void;
    getSecurityStats(): {
        activeCSRFTokens: number;
        suspiciousOrigins: number;
        allowedOrigins: string[];
        config: CorsSecurityConfig;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const corsSecurityService: CorsSecurityService;
export declare const corsMiddleware: any;
export declare const csrfMiddleware: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const securityHeadersMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const csrfTokenEndpoint: (req: Request, res: Response) => void;
//# sourceMappingURL=corsSecurityMiddleware.d.ts.map