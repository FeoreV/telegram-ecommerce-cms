declare class CmsService {
    private client;
    private baseURL;
    initialize(baseURL: string): void;
    private getClient;
    listProducts(params?: {
        limit?: number;
        offset?: number;
        q?: string;
    }): Promise<any>;
    retrieveProduct(id: string): Promise<any>;
    listVariants(productId: string): Promise<any>;
}
export declare const cmsService: CmsService;
export {};
//# sourceMappingURL=cmsService.d.ts.map