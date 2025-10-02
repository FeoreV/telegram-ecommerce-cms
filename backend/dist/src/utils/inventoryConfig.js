"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryConfigManager = exports.DEFAULT_THRESHOLDS = exports.InventoryAlertType = exports.AlertSeverity = void 0;
const loggerEnhanced_1 = require("./loggerEnhanced");
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "LOW";
    AlertSeverity["MEDIUM"] = "MEDIUM";
    AlertSeverity["HIGH"] = "HIGH";
    AlertSeverity["CRITICAL"] = "CRITICAL";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var InventoryAlertType;
(function (InventoryAlertType) {
    InventoryAlertType["LOW_STOCK"] = "LOW_STOCK";
    InventoryAlertType["OUT_OF_STOCK"] = "OUT_OF_STOCK";
    InventoryAlertType["OVERSTOCKED"] = "OVERSTOCKED";
    InventoryAlertType["STOCK_MOVEMENT"] = "STOCK_MOVEMENT";
    InventoryAlertType["REORDER_POINT"] = "REORDER_POINT";
})(InventoryAlertType || (exports.InventoryAlertType = InventoryAlertType = {}));
exports.DEFAULT_THRESHOLDS = {
    small: {
        criticalStock: 2,
        lowStock: 10,
        reorderPoint: 15,
        maxStock: 1000,
        safetyStock: 5
    },
    medium: {
        criticalStock: 5,
        lowStock: 25,
        reorderPoint: 50,
        maxStock: 5000,
        safetyStock: 20
    },
    large: {
        criticalStock: 10,
        lowStock: 50,
        reorderPoint: 100,
        maxStock: 20000,
        safetyStock: 50
    },
    enterprise: {
        criticalStock: 25,
        lowStock: 100,
        reorderPoint: 200,
        maxStock: 100000,
        safetyStock: 100
    }
};
class InventoryConfigManager {
    static getStoreConfig(storeId) {
        const existing = this.storeConfigs.get(storeId);
        if (existing) {
            return existing;
        }
        const defaultConfig = {
            storeId,
            enableStockAlerts: true,
            enableAutoReorder: false,
            thresholds: exports.DEFAULT_THRESHOLDS.medium,
            alertChannels: ['socket', 'telegram'],
            alertRecipients: [],
            alertFrequency: 'immediate',
            currency: 'USD',
            timezone: 'UTC'
        };
        this.storeConfigs.set(storeId, defaultConfig);
        return defaultConfig;
    }
    static updateStoreConfig(storeId, updates) {
        const current = this.getStoreConfig(storeId);
        const updated = { ...current, ...updates };
        if (updates.thresholds) {
            updated.thresholds = this.validateThresholds({ ...current.thresholds, ...updates.thresholds });
        }
        this.storeConfigs.set(storeId, updated);
        loggerEnhanced_1.logger.info('Store inventory configuration updated', {
            storeId,
            updates: Object.keys(updates),
            newConfig: updated
        });
        return updated;
    }
    static getProductConfig(productId, variantId) {
        const key = variantId ? `${productId}_${variantId}` : productId;
        const existing = this.productConfigs.get(key);
        if (existing) {
            return existing;
        }
        const defaultConfig = {
            productId,
            variantId,
            trackStock: true,
            allowNegativeStock: false,
            autoReorder: false
        };
        this.productConfigs.set(key, defaultConfig);
        return defaultConfig;
    }
    static updateProductConfig(productId, updates, variantId) {
        const key = variantId ? `${productId}_${variantId}` : productId;
        const current = this.getProductConfig(productId, variantId);
        const updated = { ...current, ...updates };
        this.productConfigs.set(key, updated);
        loggerEnhanced_1.logger.info('Product inventory configuration updated', {
            productId,
            variantId,
            updates: Object.keys(updates)
        });
        return updated;
    }
    static getEffectiveThresholds(storeId, productId, variantId) {
        const storeConfig = this.getStoreConfig(storeId);
        const productConfig = this.getProductConfig(productId, variantId);
        const thresholds = { ...storeConfig.thresholds };
        if (productConfig.customThresholds) {
            Object.assign(thresholds, productConfig.customThresholds);
        }
        return this.validateThresholds(thresholds);
    }
    static validateThresholds(thresholds) {
        const validated = { ...thresholds };
        if (validated.criticalStock < 0) {
            validated.criticalStock = 0;
        }
        if (validated.lowStock <= validated.criticalStock) {
            validated.lowStock = validated.criticalStock + 1;
        }
        if (validated.reorderPoint <= validated.lowStock) {
            validated.reorderPoint = validated.lowStock + Math.ceil(validated.lowStock * 0.5);
        }
        if (validated.safetyStock < validated.criticalStock) {
            validated.safetyStock = validated.criticalStock;
        }
        if (validated.maxStock && validated.maxStock <= validated.reorderPoint) {
            validated.maxStock = validated.reorderPoint * 5;
        }
        return validated;
    }
    static determineAlertSeverity(currentStock, thresholds) {
        if (currentStock <= 0) {
            return AlertSeverity.CRITICAL;
        }
        if (currentStock <= thresholds.criticalStock) {
            return AlertSeverity.CRITICAL;
        }
        if (currentStock <= thresholds.lowStock) {
            return AlertSeverity.HIGH;
        }
        if (currentStock <= thresholds.reorderPoint) {
            return AlertSeverity.MEDIUM;
        }
        if (thresholds.maxStock && currentStock >= thresholds.maxStock) {
            return AlertSeverity.MEDIUM;
        }
        return AlertSeverity.LOW;
    }
    static shouldAlert(currentStock, previousStock, thresholds) {
        const severity = this.determineAlertSeverity(currentStock, thresholds);
        if (currentStock <= 0 && previousStock > 0) {
            return {
                shouldAlert: true,
                alertType: InventoryAlertType.OUT_OF_STOCK,
                severity: AlertSeverity.CRITICAL
            };
        }
        if (currentStock <= thresholds.criticalStock && previousStock > thresholds.criticalStock) {
            return {
                shouldAlert: true,
                alertType: InventoryAlertType.LOW_STOCK,
                severity: AlertSeverity.CRITICAL
            };
        }
        if (currentStock <= thresholds.lowStock && previousStock > thresholds.lowStock) {
            return {
                shouldAlert: true,
                alertType: InventoryAlertType.LOW_STOCK,
                severity: AlertSeverity.HIGH
            };
        }
        if (currentStock <= thresholds.reorderPoint && previousStock > thresholds.reorderPoint) {
            return {
                shouldAlert: true,
                alertType: InventoryAlertType.REORDER_POINT,
                severity: AlertSeverity.MEDIUM
            };
        }
        if (thresholds.maxStock && currentStock >= thresholds.maxStock && previousStock < thresholds.maxStock) {
            return {
                shouldAlert: true,
                alertType: InventoryAlertType.OVERSTOCKED,
                severity: AlertSeverity.MEDIUM
            };
        }
        return {
            shouldAlert: false,
            alertType: InventoryAlertType.STOCK_MOVEMENT,
            severity
        };
    }
    static calculateReorderQuantity(currentStock, thresholds, averageDailySales = 0, leadTimeDays = 7) {
        const expectedSalesDuringLeadTime = averageDailySales * leadTimeDays;
        const recommendedQuantity = Math.max(thresholds.safetyStock + expectedSalesDuringLeadTime - currentStock, thresholds.reorderPoint - currentStock);
        return Math.max(0, Math.ceil(recommendedQuantity));
    }
    static calculateInventoryHealthScore(currentStock, thresholds, salesVelocity = 0, daysInStock = 0) {
        let score = 100;
        if (currentStock <= 0) {
            score = 0;
        }
        else if (currentStock <= thresholds.criticalStock) {
            score = 20;
        }
        else if (currentStock <= thresholds.lowStock) {
            score = 50;
        }
        else if (currentStock <= thresholds.reorderPoint) {
            score = 75;
        }
        if (thresholds.maxStock && currentStock >= thresholds.maxStock) {
            score = Math.max(30, score - 30);
        }
        if (salesVelocity > 0 && daysInStock > 0) {
            const turnoverRate = salesVelocity / currentStock;
            if (turnoverRate < 0.05) {
                score = Math.max(40, score - 20);
            }
            else if (turnoverRate > 0.3) {
                score = Math.max(60, score - 15);
            }
        }
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    static async loadFromDatabase() {
        try {
            const defaultLowStock = parseInt(process.env.DEFAULT_LOW_STOCK_THRESHOLD || '10');
            const defaultCriticalStock = parseInt(process.env.DEFAULT_CRITICAL_STOCK_THRESHOLD || '5');
            const defaultReorderPoint = parseInt(process.env.DEFAULT_REORDER_POINT || '20');
            Object.keys(exports.DEFAULT_THRESHOLDS).forEach(size => {
                if (defaultLowStock)
                    exports.DEFAULT_THRESHOLDS[size].lowStock = defaultLowStock;
                if (defaultCriticalStock)
                    exports.DEFAULT_THRESHOLDS[size].criticalStock = defaultCriticalStock;
                if (defaultReorderPoint)
                    exports.DEFAULT_THRESHOLDS[size].reorderPoint = defaultReorderPoint;
            });
            loggerEnhanced_1.logger.info('Inventory configuration loaded', {
                defaultThresholds: exports.DEFAULT_THRESHOLDS.medium,
                storeConfigsLoaded: this.storeConfigs.size,
                productConfigsLoaded: this.productConfigs.size
            });
        }
        catch (error) {
            loggerEnhanced_1.logger.error('Failed to load inventory configuration from database', { error });
        }
    }
    static exportConfigurations() {
        return {
            storeConfigs: Object.fromEntries(this.storeConfigs),
            productConfigs: Object.fromEntries(this.productConfigs),
            defaultThresholds: exports.DEFAULT_THRESHOLDS
        };
    }
    static clearConfigurations() {
        this.storeConfigs.clear();
        this.productConfigs.clear();
    }
}
exports.InventoryConfigManager = InventoryConfigManager;
InventoryConfigManager.storeConfigs = new Map();
InventoryConfigManager.productConfigs = new Map();
InventoryConfigManager.loadFromDatabase();
exports.default = InventoryConfigManager;
//# sourceMappingURL=inventoryConfig.js.map