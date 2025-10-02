export interface SSRFConfig {
    enableProtection: boolean;
    allowedDomains: string[];
    allowedIPs: string[];
    blockedDomains: string[];
    blockedIPs: string[];
    allowPrivateIPs: boolean;
    allowLoopback: boolean;
    allowLinkLocal: boolean;
    allowMulticast: boolean;
    allowBroadcast: boolean;
    maxRedirects: number;
    requestTimeout: number;
    userAgent: string;
    enableDNSValidation: boolean;
    enableSchemeValidation: boolean;
    allowedSchemes: string[];
}
export interface ValidationResult {
    isAllowed: boolean;
    reason?: string;
    resolvedIP?: string;
    originalURL: string;
    normalizedURL?: string;
}
export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    maxRedirects?: number;
    followRedirects?: boolean;
}
export declare class SSRFProtectionService {
    private static instance;
    private config;
    private dnsCache;
    private dnsCacheTTL;
    private constructor();
    static getInstance(): SSRFProtectionService;
    private parseList;
    validateURL(url: string): Promise<ValidationResult>;
    private resolveHostname;
    private validateIPAddress;
    private isPrivateIP;
    private matchesDomain;
    private matchesIP;
    private ipToInt;
    makeSecureRequest(url: string, options?: RequestOptions): Promise<any>;
    validateWebhookURL(url: string): Promise<ValidationResult>;
    addAllowedDomain(domain: string): void;
    removeAllowedDomain(domain: string): void;
    addBlockedDomain(domain: string): void;
    private startDNSCacheCleanup;
    getStats(): {
        config: SSRFConfig;
        dnsCacheSize: number;
        allowedDomains: number;
        blockedDomains: number;
        allowedIPs: number;
        blockedIPs: number;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
    getConfiguration(): SSRFConfig;
}
export declare const ssrfProtectionService: SSRFProtectionService;
//# sourceMappingURL=SSRFProtectionService.d.ts.map