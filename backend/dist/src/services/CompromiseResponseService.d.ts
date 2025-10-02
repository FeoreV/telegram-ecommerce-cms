export declare class CompromiseResponseService {
    private static instance;
    private killSwitchActive;
    private quarantineActive;
    private constructor();
    static getInstance(): CompromiseResponseService;
    initialize(): Promise<void>;
    isKillSwitchActive(): boolean;
    isQuarantineActive(): boolean;
    activateKillSwitch(reason: string): Promise<void>;
    deactivateKillSwitch(): Promise<void>;
    activateQuarantine(reason: string): Promise<void>;
    deactivateQuarantine(): Promise<void>;
    private zeroizeSecrets;
    private alertSIEM;
}
export declare const compromiseResponseService: CompromiseResponseService;
//# sourceMappingURL=CompromiseResponseService.d.ts.map