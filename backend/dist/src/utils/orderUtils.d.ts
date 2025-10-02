export declare const generateOrderNumber: () => Promise<string>;
export declare const calculateOrderTotal: (items: Array<{
    price: number;
    quantity: number;
}>) => number;
interface OrderWithDetails {
    orderNumber: string;
    currency: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
    store: {
        name: string;
    };
    customer: {
        firstName: string;
        lastName: string;
    };
    items: Array<{
        quantity: number;
        price: number;
        product: {
            name: string;
        };
        variant?: {
            name: string;
            value: string;
        };
    }>;
}
export declare const formatOrderSummary: (order: OrderWithDetails) => string;
export {};
//# sourceMappingURL=orderUtils.d.ts.map