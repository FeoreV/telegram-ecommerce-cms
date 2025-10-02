import { logger } from './loggerEnhanced';

// Inventory alert severity levels
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Inventory alert types
export enum InventoryAlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  OVERSTOCKED = 'OVERSTOCKED',
  STOCK_MOVEMENT = 'STOCK_MOVEMENT',
  REORDER_POINT = 'REORDER_POINT'
}

// Default inventory thresholds configuration
export interface InventoryThresholds {
  criticalStock: number;      // Stock level that triggers critical alerts
  lowStock: number;           // Stock level that triggers low stock alerts
  reorderPoint: number;       // Stock level that triggers reorder suggestions
  maxStock?: number;          // Maximum stock level (for overstocking alerts)
  safetyStock: number;        // Minimum safety stock to maintain
}

// Store-specific inventory configuration
export interface StoreInventoryConfig {
  storeId: string;
  enableStockAlerts: boolean;
  enableAutoReorder: boolean;
  thresholds: InventoryThresholds;
  alertChannels: string[];    // ['email', 'telegram', 'socket']
  alertRecipients: string[];  // User IDs to notify
  alertFrequency: 'immediate' | 'hourly' | 'daily';
  currency: string;
  timezone: string;
}

// Default thresholds by store size/type
export const DEFAULT_THRESHOLDS: Record<string, InventoryThresholds> = {
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

// Product-specific thresholds (can override store defaults)
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

// Inventory configuration manager
export class InventoryConfigManager {
  private static storeConfigs = new Map<string, StoreInventoryConfig>();
  private static productConfigs = new Map<string, ProductInventoryConfig>();

  // Get store inventory configuration
  static getStoreConfig(storeId: string): StoreInventoryConfig {
    const existing = this.storeConfigs.get(storeId);
    if (existing) {
      return existing;
    }

    // Create default configuration
    const defaultConfig: StoreInventoryConfig = {
      storeId,
      enableStockAlerts: true,
      enableAutoReorder: false,
      thresholds: DEFAULT_THRESHOLDS.medium, // Default to medium store size
      alertChannels: ['socket', 'telegram'],
      alertRecipients: [],
      alertFrequency: 'immediate',
      currency: 'USD',
      timezone: 'UTC'
    };

    this.storeConfigs.set(storeId, defaultConfig);
    return defaultConfig;
  }

  // Update store configuration
  static updateStoreConfig(storeId: string, updates: Partial<StoreInventoryConfig>): StoreInventoryConfig {
    const current = this.getStoreConfig(storeId);
    const updated = { ...current, ...updates };
    
    // Validate thresholds
    if (updates.thresholds) {
      updated.thresholds = this.validateThresholds({ ...current.thresholds, ...updates.thresholds });
    }

    this.storeConfigs.set(storeId, updated);
    
    logger.info('Store inventory configuration updated', {
      storeId,
      updates: Object.keys(updates),
      newConfig: updated
    });

    return updated;
  }

  // Get product-specific configuration
  static getProductConfig(productId: string, variantId?: string): ProductInventoryConfig {
    const key = variantId ? `${productId}_${variantId}` : productId;
    const existing = this.productConfigs.get(key);
    
    if (existing) {
      return existing;
    }

    // Create default configuration
    const defaultConfig: ProductInventoryConfig = {
      productId,
      variantId,
      trackStock: true,
      allowNegativeStock: false,
      autoReorder: false
    };

    this.productConfigs.set(key, defaultConfig);
    return defaultConfig;
  }

  // Update product configuration
  static updateProductConfig(
    productId: string, 
    updates: Partial<ProductInventoryConfig>, 
    variantId?: string
  ): ProductInventoryConfig {
    const key = variantId ? `${productId}_${variantId}` : productId;
    const current = this.getProductConfig(productId, variantId);
    const updated = { ...current, ...updates };

    this.productConfigs.set(key, updated);
    
    logger.info('Product inventory configuration updated', {
      productId,
      variantId,
      updates: Object.keys(updates)
    });

    return updated;
  }

  // Get effective thresholds for a product (combining store and product configs)
  static getEffectiveThresholds(storeId: string, productId: string, variantId?: string): InventoryThresholds {
    const storeConfig = this.getStoreConfig(storeId);
    const productConfig = this.getProductConfig(productId, variantId);
    
    // Start with store defaults
    const thresholds = { ...storeConfig.thresholds };
    
    // Override with product-specific settings
    if (productConfig.customThresholds) {
      Object.assign(thresholds, productConfig.customThresholds);
    }

    return this.validateThresholds(thresholds);
  }

  // Validate threshold configuration
  static validateThresholds(thresholds: InventoryThresholds): InventoryThresholds {
    const validated = { ...thresholds };

    // Ensure logical relationships between thresholds
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

  // Determine alert severity based on stock level
  static determineAlertSeverity(currentStock: number, thresholds: InventoryThresholds): AlertSeverity {
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
      return AlertSeverity.MEDIUM; // Overstocked
    }
    
    return AlertSeverity.LOW;
  }

  // Check if stock level requires an alert
  static shouldAlert(
    currentStock: number, 
    previousStock: number, 
    thresholds: InventoryThresholds
  ): { shouldAlert: boolean; alertType: InventoryAlertType; severity: AlertSeverity } {
    const severity = this.determineAlertSeverity(currentStock, thresholds);
    
    // Out of stock alert
    if (currentStock <= 0 && previousStock > 0) {
      return {
        shouldAlert: true,
        alertType: InventoryAlertType.OUT_OF_STOCK,
        severity: AlertSeverity.CRITICAL
      };
    }

    // Critical stock alert
    if (currentStock <= thresholds.criticalStock && previousStock > thresholds.criticalStock) {
      return {
        shouldAlert: true,
        alertType: InventoryAlertType.LOW_STOCK,
        severity: AlertSeverity.CRITICAL
      };
    }

    // Low stock alert
    if (currentStock <= thresholds.lowStock && previousStock > thresholds.lowStock) {
      return {
        shouldAlert: true,
        alertType: InventoryAlertType.LOW_STOCK,
        severity: AlertSeverity.HIGH
      };
    }

    // Reorder point alert
    if (currentStock <= thresholds.reorderPoint && previousStock > thresholds.reorderPoint) {
      return {
        shouldAlert: true,
        alertType: InventoryAlertType.REORDER_POINT,
        severity: AlertSeverity.MEDIUM
      };
    }

    // Overstocked alert
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

  // Calculate recommended reorder quantity
  static calculateReorderQuantity(
    currentStock: number,
    thresholds: InventoryThresholds,
    averageDailySales: number = 0,
    leadTimeDays: number = 7
  ): number {
    // Safety stock + expected sales during lead time
    const expectedSalesDuringLeadTime = averageDailySales * leadTimeDays;
    const recommendedQuantity = Math.max(
      thresholds.safetyStock + expectedSalesDuringLeadTime - currentStock,
      thresholds.reorderPoint - currentStock
    );

    return Math.max(0, Math.ceil(recommendedQuantity));
  }

  // Get inventory health score (0-100)
  static calculateInventoryHealthScore(
    currentStock: number,
    thresholds: InventoryThresholds,
    salesVelocity: number = 0,
    daysInStock: number = 0
  ): number {
    let score = 100;

    // Stock level scoring
    if (currentStock <= 0) {
      score = 0;
    } else if (currentStock <= thresholds.criticalStock) {
      score = 20;
    } else if (currentStock <= thresholds.lowStock) {
      score = 50;
    } else if (currentStock <= thresholds.reorderPoint) {
      score = 75;
    }

    // Adjust for overstocking
    if (thresholds.maxStock && currentStock >= thresholds.maxStock) {
      score = Math.max(30, score - 30);
    }

    // Adjust for sales velocity
    if (salesVelocity > 0 && daysInStock > 0) {
      const turnoverRate = salesVelocity / currentStock;
      
      // Ideal turnover is around 0.1-0.2 (stock lasts 5-10 days)
      if (turnoverRate < 0.05) { // Too much stock
        score = Math.max(40, score - 20);
      } else if (turnoverRate > 0.3) { // Stock moving too fast
        score = Math.max(60, score - 15);
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Load configurations from database
  static async loadFromDatabase() {
    try {
      // This would typically load from your database
      // For now, we'll use environment variables and defaults
      
      const defaultLowStock = parseInt(process.env.DEFAULT_LOW_STOCK_THRESHOLD || '10');
      const defaultCriticalStock = parseInt(process.env.DEFAULT_CRITICAL_STOCK_THRESHOLD || '5');
      const defaultReorderPoint = parseInt(process.env.DEFAULT_REORDER_POINT || '20');

      // Update default thresholds if environment variables are set
      Object.keys(DEFAULT_THRESHOLDS).forEach(size => {
        if (defaultLowStock) DEFAULT_THRESHOLDS[size].lowStock = defaultLowStock;
        if (defaultCriticalStock) DEFAULT_THRESHOLDS[size].criticalStock = defaultCriticalStock;
        if (defaultReorderPoint) DEFAULT_THRESHOLDS[size].reorderPoint = defaultReorderPoint;
      });

      logger.info('Inventory configuration loaded', {
        defaultThresholds: DEFAULT_THRESHOLDS.medium,
        storeConfigsLoaded: this.storeConfigs.size,
        productConfigsLoaded: this.productConfigs.size
      });

    } catch (error) {
      logger.error('Failed to load inventory configuration from database', { error });
    }
  }

  // Export configurations for backup
  static exportConfigurations() {
    return {
      storeConfigs: Object.fromEntries(this.storeConfigs),
      productConfigs: Object.fromEntries(this.productConfigs),
      defaultThresholds: DEFAULT_THRESHOLDS
    };
  }

  // Clear all configurations (for testing)
  static clearConfigurations() {
    this.storeConfigs.clear();
    this.productConfigs.clear();
  }
}

// Initialize configuration manager
InventoryConfigManager.loadFromDatabase();

export default InventoryConfigManager;
