export interface CacheShredderConfig {
    enabled: boolean;
    shredPaths: string[];
    shredPatterns: string[];
    flushRedis: boolean;
}
export declare class CacheShredderService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): CacheShredderService;
    initialize(): Promise<void>;
    shredAll(): Promise<void>;
    private shredDirectorySafe;
    private shouldShredFile;
    private secureDelete;
}
export declare const cacheShredderService: CacheShredderService;
//# sourceMappingURL=CacheShredderService.d.ts.map