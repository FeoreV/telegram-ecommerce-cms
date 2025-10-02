export declare class EgressGuardService {
    private static instance;
    private enabled;
    private originalHttpRequest;
    private originalHttpsRequest;
    private patched;
    private constructor();
    static getInstance(): EgressGuardService;
    initialize(): Promise<void>;
    enable(): void;
    disable(): void;
    private guardWrapperFactory;
    private patchHttpModules;
}
export declare const egressGuardService: EgressGuardService;
//# sourceMappingURL=EgressGuardService.d.ts.map