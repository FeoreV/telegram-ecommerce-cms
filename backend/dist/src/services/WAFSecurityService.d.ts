import { Request, Response, NextFunction } from 'express';
export interface WAFConfig {
    enableWAF: boolean;
    enableBotProtection: boolean;
    enableAnomalyDetection: boolean;
    enableIPReputation: boolean;
    enableGeoBlocking: boolean;
    enableRateLimiting: boolean;
    challengeMode: 'captcha' | 'javascript' | 'proof_of_work' | 'behavioral';
    botScoreThreshold: number;
    suspiciousUserAgentThreshold: number;
    globalRateLimit: number;
    perIPRateLimit: number;
    perUserRateLimit: number;
    burstLimit: number;
    anomalyThreshold: number;
    learningPeriod: number;
    enableMLDetection: boolean;
    blockedCountries: string[];
    allowedCountries: string[];
    reputationSources: string[];
    reputationThreshold: number;
    blockAction: 'block' | 'challenge' | 'monitor';
    challengeAction: 'captcha' | 'js_challenge' | 'managed_challenge';
}
export interface ThreatIntelligence {
    ipAddress: string;
    reputation: number;
    categories: string[];
    lastSeen: Date;
    sources: string[];
    confidence: number;
    isBot: boolean;
    isMalicious: boolean;
    geolocation: {
        country: string;
        region: string;
        city: string;
        asn: number;
        organization: string;
    };
}
export interface SecurityEvent {
    id: string;
    type: 'bot_detected' | 'anomaly_detected' | 'rate_limit_exceeded' | 'geo_blocked' | 'reputation_blocked';
    severity: 'low' | 'medium' | 'high' | 'critical';
    ipAddress: string;
    userAgent: string;
    path: string;
    method: string;
    timestamp: Date;
    details: Record<string, any>;
    action: 'allowed' | 'blocked' | 'challenged';
    score: number;
}
export interface RateLimitState {
    requests: number;
    resetTime: number;
    blocked: boolean;
    lastRequest: number;
}
export declare class WAFSecurityService {
    private static instance;
    private config;
    private threatIntelligence;
    private rateLimitStates;
    private anomalyBaseline;
    private securityEvents;
    private botSignatures;
    private maliciousPatterns;
    private constructor();
    static getInstance(): WAFSecurityService;
    private initializeSecurityPatterns;
    getWAFMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private checkIPReputation;
    private fetchThreatIntelligence;
    private getInternalReputation;
    private checkGeographicRestrictions;
    private getCountryFromIP;
    private getCountryFromInternalDB;
    private checkRateLimit;
    private detectBot;
    private detectAnomalies;
    private analyzePayload;
    private handleSecurityEvent;
    private sendBlockResponse;
    private sendChallengeResponse;
    private generateChallengeHTML;
    private addSecurityHeaders;
    private getClientIP;
    private generateEventId;
    private generateChallengeId;
    private startCleanupTimer;
    private cleanupOldData;
    getStats(): {
        config: WAFConfig;
        activeRateLimits: number;
        threatIntelligenceEntries: number;
        recentEvents: number;
        eventsByType: Record<string, number>;
        eventsBySeverity: Record<string, number>;
    };
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
}
export declare const wafSecurityService: WAFSecurityService;
//# sourceMappingURL=WAFSecurityService.d.ts.map