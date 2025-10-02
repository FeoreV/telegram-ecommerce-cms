export interface HoneytokenConfig {
    enabled: boolean;
    autoQuarantine: boolean;
    tokenCount: number;
}
export declare class HoneytokenService {
    private static instance;
    private config;
    private tokens;
    private constructor();
    static getInstance(): HoneytokenService;
    initialize(): Promise<void>;
    getTokens(): string[];
    isHoneytoken(value?: string | null): boolean;
    triggerAlert(context: {
        source: string;
        sample?: string;
    }): Promise<void>;
    private generateHoneytoken;
}
export declare const honeytokenService: HoneytokenService;
//# sourceMappingURL=HoneytokenService.d.ts.map