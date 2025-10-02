export declare class BotDataService {
    private storeId;
    constructor(storeId: string);
    getProducts(options?: {
        categoryId?: string;
        isActive?: boolean;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        products: ({
            category: {
                id: string;
                name: string;
                slug: string;
            };
            variants: {
                id: string;
                value: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                sku: string | null;
                price: number | null;
                stock: number | null;
                productId: string;
            }[];
        } & {
            storeId: string;
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sku: string | null;
            price: number;
            stock: number;
            trackStock: boolean;
            images: string | null;
            categoryId: string | null;
        })[];
        total: number;
    }>;
    getProduct(productId: string): Promise<{
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            slug: string;
            parentId: string | null;
        };
        variants: {
            id: string;
            value: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            sku: string | null;
            price: number | null;
            stock: number | null;
            productId: string;
        }[];
    } & {
        storeId: string;
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        sku: string | null;
        price: number;
        stock: number;
        trackStock: boolean;
        images: string | null;
        categoryId: string | null;
    }>;
    getCategories(): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        parentId: string | null;
    })[]>;
    createOrder(orderData: {
        customerId: string;
        items: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            price: number;
        }>;
        customerInfo: any;
        notes?: string;
    }): Promise<{
        items: ({
            product: {
                storeId: string;
                id: string;
                name: string;
                description: string | null;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sku: string | null;
                price: number;
                stock: number;
                trackStock: boolean;
                images: string | null;
                categoryId: string | null;
            };
            variant: {
                id: string;
                value: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                sku: string | null;
                price: number | null;
                stock: number | null;
                productId: string;
            };
        } & {
            orderId: string;
            id: string;
            createdAt: Date;
            price: number;
            productId: string;
            quantity: number;
            variantId: string | null;
        })[];
        customer: {
            id: string;
            username: string;
            firstName: string;
            lastName: string;
        };
    } & {
        storeId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        customerId: string;
        orderNumber: string;
        clientRequestId: string | null;
        totalAmount: number;
        customerInfo: string;
        notes: string | null;
        paidAt: Date | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        trackingNumber: string | null;
        carrier: string | null;
        deliveryNotes: string | null;
        cancellationReason: string | null;
        paymentProof: string | null;
    }>;
    getOrder(orderId: string): Promise<{
        items: ({
            product: {
                storeId: string;
                id: string;
                name: string;
                description: string | null;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sku: string | null;
                price: number;
                stock: number;
                trackStock: boolean;
                images: string | null;
                categoryId: string | null;
            };
            variant: {
                id: string;
                value: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                sku: string | null;
                price: number | null;
                stock: number | null;
                productId: string;
            };
        } & {
            orderId: string;
            id: string;
            createdAt: Date;
            price: number;
            productId: string;
            quantity: number;
            variantId: string | null;
        })[];
        customer: {
            id: string;
            username: string;
            telegramId: string;
            firstName: string;
            lastName: string;
        };
    } & {
        storeId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        customerId: string;
        orderNumber: string;
        clientRequestId: string | null;
        totalAmount: number;
        customerInfo: string;
        notes: string | null;
        paidAt: Date | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        trackingNumber: string | null;
        carrier: string | null;
        deliveryNotes: string | null;
        cancellationReason: string | null;
        paymentProof: string | null;
    }>;
    getOrderByNumber(orderNumber: string): Promise<{
        items: ({
            product: {
                storeId: string;
                id: string;
                name: string;
                description: string | null;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sku: string | null;
                price: number;
                stock: number;
                trackStock: boolean;
                images: string | null;
                categoryId: string | null;
            };
            variant: {
                id: string;
                value: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                sku: string | null;
                price: number | null;
                stock: number | null;
                productId: string;
            };
        } & {
            orderId: string;
            id: string;
            createdAt: Date;
            price: number;
            productId: string;
            quantity: number;
            variantId: string | null;
        })[];
        customer: {
            id: string;
            username: string;
            telegramId: string;
            firstName: string;
            lastName: string;
        };
    } & {
        storeId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        customerId: string;
        orderNumber: string;
        clientRequestId: string | null;
        totalAmount: number;
        customerInfo: string;
        notes: string | null;
        paidAt: Date | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        trackingNumber: string | null;
        carrier: string | null;
        deliveryNotes: string | null;
        cancellationReason: string | null;
        paymentProof: string | null;
    }>;
    getCustomerOrders(customerId: string, limit?: number): Promise<({
        items: ({
            product: {
                id: string;
                name: string;
                images: string;
            };
        } & {
            orderId: string;
            id: string;
            createdAt: Date;
            price: number;
            productId: string;
            quantity: number;
            variantId: string | null;
        })[];
    } & {
        storeId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        customerId: string;
        orderNumber: string;
        clientRequestId: string | null;
        totalAmount: number;
        customerInfo: string;
        notes: string | null;
        paidAt: Date | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        trackingNumber: string | null;
        carrier: string | null;
        deliveryNotes: string | null;
        cancellationReason: string | null;
        paymentProof: string | null;
    })[]>;
    getOrCreateCustomer(telegramId: string, userData: {
        username?: string;
        firstName?: string;
        lastName?: string;
    }): Promise<{
        password: string | null;
        id: string;
        username: string | null;
        role: string;
        telegramId: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        isActive: boolean;
        lastLoginAt: Date | null;
        profilePhoto: string | null;
    }>;
    getStoreInfo(): Promise<{
        botSettings: any;
        id: string;
        name: string;
        description: string;
        _count: {
            orders: number;
            products: number;
        };
        currency: string;
        contactInfo: string;
    }>;
    updateStoreStats(): Promise<void>;
    private generateOrderNumber;
    validateStoreAccess(): Promise<boolean>;
    getBasicStats(): Promise<{
        products: {
            total: number;
            active: number;
        };
        orders: {
            total: number;
            pending: number;
        };
        revenue: number;
    }>;
}
export default BotDataService;
//# sourceMappingURL=botDataService.d.ts.map