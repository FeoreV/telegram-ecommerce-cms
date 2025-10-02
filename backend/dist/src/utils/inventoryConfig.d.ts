export declare enum AlertSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum InventoryAlertType {
    LOW_STOCK = "LOW_STOCK",
    OUT_OF_STOCK = "OUT_OF_STOCK",
    OVERSTOCKED = "OVERSTOCKED",
    STOCK_MOVEMENT = "STOCK_MOVEMENT",
    REORDER_POINT = "REORDER_POINT"
}
export interface InventoryThresholds {
    criticalStock: number;
    lowStock: number;
    reorderPoint: number;
    maxStock?: number;
    safetyStock: number;
}
export interface StoreInventoryConfig {
    storeId: string;
    enableStockAlerts: boolean;
    enableAutoReorder: boolean;
    thresholds: InventoryThresholds;
    alertChannels: string[];
    alertRecipients: string[];
    alertFrequency: 'immediate' | 'hourly' | 'daily';
    currency: string;
    timezone: string;
}
export declare const DEFAULT_THRESHOLDS: Record<string, InventoryThresholds>;
export interface ProductInventoryConfig {
    productId: string;
    variantId?: string;
    customThresholds?: Partial<InventoryThresholds>;
    trackStock: boolean;
    allowNegativeStock: boolean;
    autoReorder: boolean;
    reorderQuantity?: number;
    supplierId?: string;
    leadTimeDays?: number;
}
export declare class InventoryConfigManager {
    private static storeConfigs;
    private static productConfigs;
    static getStoreConfig(storeId: string): StoreInventoryConfig;
    static updateStoreConfig(storeId: string, updates: Partial<StoreInventoryConfig>): StoreInventoryConfig;
    static getProductConfig(productId: string, variantId?: string): ProductInventoryConfig;
    static updateProductConfig(productId: string, updates: Partial<ProductInventoryConfig>, variantId?: string): ProductInventoryConfig;
    static getEffectiveThresholds(storeId: string, productId: string, variantId?: string): InventoryThresholds;
    static validateThresholds(thresholds: InventoryThresholds): InventoryThresholds;
    static determineAlertSeverity(currentStock: number, thresholds: InventoryThresholds): AlertSeverity;
    static shouldAlert(currentStock: number, previousStock: number, thresholds: InventoryThresholds): {
        shouldAlert: boolean;
        alertType: InventoryAlertType;
        severity: AlertSeverity;
    };
    static calculateReorderQuantity(currentStock: number, thresholds: InventoryThresholds, averageDailySales?: number, leadTimeDays?: number): number;
    static calculateInventoryHealthScore(currentStock: number, thresholds: InventoryThresholds, salesVelocity?: number, daysInStock?: number): number;
    static loadFromDatabase(): Promise<void>;
    static exportConfigurations(): {
        storeConfigs: {
            [k: string]: StoreInventoryConfig;
        };
        productConfigs: {
            [k: string]: ProductInventoryConfig;
        };
        defaultThresholds: Record<string, InventoryThresholds>;
    };
    static clearConfigurations(): void;
}
export default InventoryConfigManager;
//# sourceMappingURL=inventoryConfig.d.ts.map