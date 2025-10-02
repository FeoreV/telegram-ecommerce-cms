export declare enum OrderStatus {
    PENDING_ADMIN = "PENDING_ADMIN",
    PAID = "PAID",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    REJECTED = "REJECTED"
}
export declare const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
export declare const STATUS_DESCRIPTIONS: Record<OrderStatus, {
    title: string;
    description: string;
}>;
export declare function validateStatusTransition(currentStatus: string, newStatus: string): void;
export declare function isFinalStatus(status: string): boolean;
export declare function getAvailableTransitions(currentStatus: string): OrderStatus[];
export declare function shouldRestoreStock(newStatus: string): boolean;
export declare function isActiveStatus(status: string): boolean;
declare const _default: {
    OrderStatus: typeof OrderStatus;
    VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
    STATUS_DESCRIPTIONS: Record<OrderStatus, {
        title: string;
        description: string;
    }>;
    validateStatusTransition: typeof validateStatusTransition;
    isFinalStatus: typeof isFinalStatus;
    getAvailableTransitions: typeof getAvailableTransitions;
    shouldRestoreStock: typeof shouldRestoreStock;
    isActiveStatus: typeof isActiveStatus;
};
export default _default;
//# sourceMappingURL=orderStateMachine.d.ts.map