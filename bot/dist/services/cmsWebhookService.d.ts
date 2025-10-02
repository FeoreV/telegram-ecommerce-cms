interface WebhookEvent {
    id: string;
    type: 'product.created' | 'product.updated' | 'product.deleted' | 'inventory.updated' | 'order.created' | 'order.updated' | 'order.cancelled';
    data: any;
    timestamp: string;
    source: 'MEDUSA' | 'SHOPIFY' | 'WOOCOMMERCE';
}
export declare class CMSWebhookService {
    private static instance;
    static getInstance(): CMSWebhookService;
    processWebhook(webhookData: WebhookEvent): Promise<void>;
    private handleProductCreated;
    private handleProductUpdated;
    private handleProductDeleted;
    private handleInventoryUpdated;
    private handleOrderCreated;
    private handleOrderUpdated;
    private handleOrderCancelled;
    private triggerLowStockAlert;
    private notifyCustomersRestock;
    private notifyAdminsProductUpdate;
    private notifyCustomersProductUpdate;
    private notifyCustomerStatusChange;
    private notifyCustomerCancellation;
    private mapCMSStatusToLocal;
    validateWebhookSignature(payload: string, signature: string, secret: string): boolean;
    createWebhookResponse(success: boolean, message?: string): any;
    private findIntegrationMapping;
    private getOrderWithDetails;
    private getAdminToken;
    private mapVariantId;
}
export declare const cmsWebhookService: CMSWebhookService;
export {};
//# sourceMappingURL=cmsWebhookService.d.ts.map