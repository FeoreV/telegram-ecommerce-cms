import { AxiosInstance } from 'axios';
declare class MedusaClient {
    private client;
    get(): AxiosInstance;
    listProducts(params?: {
        limit?: number;
        offset?: number;
        q?: string;
    }): Promise<any>;
    retrieveProduct(id: string): Promise<any>;
}
export declare const cmsClient: MedusaClient;
export {};
//# sourceMappingURL=cmsClient.d.ts.map