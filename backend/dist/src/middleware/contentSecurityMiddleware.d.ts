import { Request, Response, NextFunction } from 'express';
export interface ContentSecurityConfig {
    enableCSP: boolean;
    enableXSSProtection: boolean;
    enableOutputSanitization: boolean;
    enableFrameProtection: boolean;
    cspDirectives: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        imgSrc: string[];
        connectSrc: string[];
        fontSrc: string[];
        objectSrc: string[];
        mediaSrc: string[];
        frameSrc: string[];
        childSrc: string[];
        workerSrc: string[];
        manifestSrc: string[];
        formAction: string[];
        frameAncestors: string[];
        baseUri: string[];
        upgradeInsecureRequests: boolean;
        blockAllMixedContent: boolean;
    };
    reportUri?: string;
    reportOnly: boolean;
    nonce: boolean;
    allowedTags: string[];
    allowedAttributes: string[];
    sanitizationOptions: {
        allowHTML: boolean;
        allowSVG: boolean;
        allowMathML: boolean;
        keepComments: boolean;
        keepWhitespace: boolean;
    };
}
export declare class ContentSecurityService {
    private static instance;
    private config;
    private nonceCache;
    private nonceTTL;
    private constructor();
    static getInstance(): ContentSecurityService;
    generateCSPHeader(nonce?: string): string;
    private camelToKebab;
    generateNonce(requestId?: string): string;
    getNonce(requestId: string): string | null;
    getCSPMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    getOutputSanitizationMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    private sanitizeOutput;
    private sanitizeString;
    sanitizeHTML(html: string): string;
    sanitizeUserInput(input: string, options?: {
        allowHTML?: boolean;
        maxLength?: number;
        stripTags?: boolean;
    }): string;
    getCSPReportEndpoint(): (req: Request, res: Response) => void;
    private storeCSPViolation;
    private startNonceCleanup;
    updateCSPDirective(directive: string, values: string[]): void;
    addAllowedSource(directive: string, source: string): void;
    getStats(): {
        config: ContentSecurityConfig;
        activenonces: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
    getConfiguration(): ContentSecurityConfig;
}
export declare const contentSecurityService: ContentSecurityService;
export declare const cspMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const outputSanitizationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const cspReportEndpoint: (req: Request, res: Response) => void;
//# sourceMappingURL=contentSecurityMiddleware.d.ts.map