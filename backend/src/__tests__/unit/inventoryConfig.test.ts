import InventoryConfigManager, {
  AlertSeverity,
  InventoryAlertType,
  DEFAULT_THRESHOLDS,
  InventoryThresholds,
  StoreInventoryConfig,
  ProductInventoryConfig
} from '../../utils/inventoryConfig';

describe('Inventory Configuration Manager', () => {
  beforeEach(() => {
    // Clear singleton state before each test
    InventoryConfigManager.clearConfigurations();
  });

  describe('Default Thresholds', () => {
    test('should have correct default threshold templates', () => {
      expect(DEFAULT_THRESHOLDS).toHaveProperty('small');
      expect(DEFAULT_THRESHOLDS).toHaveProperty('medium');
      expect(DEFAULT_THRESHOLDS).toHaveProperty('large');
      expect(DEFAULT_THRESHOLDS).toHaveProperty('enterprise');

      // Test small store template
      expect(DEFAULT_THRESHOLDS.small).toEqual({
        criticalStock: 2,
        lowStock: 10,
        reorderPoint: 15,
        maxStock: 1000,
        safetyStock: 5
      });

      // Test enterprise template
      expect(DEFAULT_THRESHOLDS.enterprise).toEqual({
        criticalStock: 25,
        lowStock: 100,
        reorderPoint: 200,
        maxStock: 100000,
        safetyStock: 100
      });
    });

    test('should maintain logical relationships in all templates', () => {
      Object.values(DEFAULT_THRESHOLDS).forEach(template => {
        expect(template.criticalStock).toBeLessThan(template.lowStock);
        expect(template.lowStock).toBeLessThan(template.reorderPoint);
        expect(template.reorderPoint).toBeLessThan(template.maxStock);
        expect(template.safetyStock).toBeGreaterThanOrEqual(template.criticalStock);
      });
    });
  });

  describe('Store Configuration Management', () => {
    test('should create default store configuration', () => {
      const config = InventoryConfigManager.getStoreConfig('store-123');

      expect(config).toMatchObject({
        storeId: 'store-123',
        enableStockAlerts: true,
        enableAutoReorder: false,
        thresholds: DEFAULT_THRESHOLDS.medium,
        alertChannels: ['socket', 'telegram'],
        alertRecipients: [],
        alertFrequency: 'immediate',
        currency: 'USD',
        timezone: 'UTC'
      });
    });

    test('should return same configuration for repeated calls', () => {
      const config1 = InventoryConfigManager.getStoreConfig('store-123');
      const config2 = InventoryConfigManager.getStoreConfig('store-123');

      expect(config1).toBe(config2);
    });

    test('should update store configuration', () => {
      const updates: Partial<StoreInventoryConfig> = {
        enableAutoReorder: true,
        currency: 'EUR',
        alertFrequency: 'hourly',
        thresholds: {
          criticalStock: 3,
          lowStock: 15,
          reorderPoint: 30,
          maxStock: 500,
          safetyStock: 10
        }
      };

      const updatedConfig = InventoryConfigManager.updateStoreConfig('store-123', updates);

      expect(updatedConfig.enableAutoReorder).toBe(true);
      expect(updatedConfig.currency).toBe('EUR');
      expect(updatedConfig.alertFrequency).toBe('hourly');
      expect(updatedConfig.thresholds.criticalStock).toBe(3);
    });

    test('should validate thresholds on update', () => {
      const invalidThresholds = {
        thresholds: {
          criticalStock: 20,
          lowStock: 10, // Invalid: less than critical
          reorderPoint: 5, // Invalid: less than low stock
          maxStock: 2, // Invalid: less than reorder point
          safetyStock: 1 // Invalid: less than critical
        }
      };

      const config = InventoryConfigManager.updateStoreConfig('store-123', invalidThresholds);

      // Should auto-correct invalid relationships
      expect(config.thresholds.lowStock).toBeGreaterThan(config.thresholds.criticalStock);
      expect(config.thresholds.reorderPoint).toBeGreaterThan(config.thresholds.lowStock);
      expect(config.thresholds.maxStock).toBeGreaterThan(config.thresholds.reorderPoint);
      expect(config.thresholds.safetyStock).toBeGreaterThanOrEqual(config.thresholds.criticalStock);
    });
  });

  describe('Product Configuration Management', () => {
    test('should create default product configuration', () => {
      const config = InventoryConfigManager.getProductConfig('product-123');

      expect(config).toMatchObject({
        productId: 'product-123',
        variantId: undefined,
        trackStock: true,
        allowNegativeStock: false,
        autoReorder: false
      });
    });

    test('should handle variant-specific configuration', () => {
      const config = InventoryConfigManager.getProductConfig('product-123', 'variant-456');

      expect(config.productId).toBe('product-123');
      expect(config.variantId).toBe('variant-456');
    });

    test('should update product configuration', () => {
      const updates: Partial<ProductInventoryConfig> = {
        allowNegativeStock: true,
        autoReorder: true,
        reorderQuantity: 50,
        leadTimeDays: 7,
        customThresholds: {
          criticalStock: 1,
          lowStock: 5,
          reorderPoint: 10,
          safetyStock: 2
        }
      };

      const config = InventoryConfigManager.updateProductConfig('product-123', updates);

      expect(config.allowNegativeStock).toBe(true);
      expect(config.autoReorder).toBe(true);
      expect(config.reorderQuantity).toBe(50);
      expect(config.customThresholds).toEqual(expect.objectContaining({
        criticalStock: 1,
        lowStock: 5,
        reorderPoint: 10
      }));
    });

    test('should handle variant updates separately', () => {
      InventoryConfigManager.updateProductConfig('product-123', { autoReorder: true });
      InventoryConfigManager.updateProductConfig('product-123', { autoReorder: false }, 'variant-456');

      const productConfig = InventoryConfigManager.getProductConfig('product-123');
      const variantConfig = InventoryConfigManager.getProductConfig('product-123', 'variant-456');

      expect(productConfig.autoReorder).toBe(true);
      expect(variantConfig.autoReorder).toBe(false);
    });
  });

  describe('Effective Thresholds Calculation', () => {
    test('should return store defaults when no product overrides', () => {
      const storeConfig = InventoryConfigManager.getStoreConfig('store-123');
      const thresholds = InventoryConfigManager.getEffectiveThresholds('store-123', 'product-123');

      expect(thresholds).toEqual(storeConfig.thresholds);
    });

    test('should merge product overrides with store defaults', () => {
      // Set custom store thresholds
      InventoryConfigManager.updateStoreConfig('store-123', {
        thresholds: {
          criticalStock: 5,
          lowStock: 20,
          reorderPoint: 40,
          maxStock: 1000,
          safetyStock: 10
        }
      });

      // Set product overrides
      InventoryConfigManager.updateProductConfig('product-123', {
        customThresholds: {
          criticalStock: 3,
          lowStock: 15
          // reorderPoint and maxStock should come from store
        }
      });

      const effectiveThresholds = InventoryConfigManager.getEffectiveThresholds('store-123', 'product-123');

      expect(effectiveThresholds).toEqual({
        criticalStock: 3, // From product
        lowStock: 15, // From product
        reorderPoint: 40, // From store
        maxStock: 1000, // From store
        safetyStock: 10 // From store
      });
    });

    test('should validate merged thresholds', () => {
      InventoryConfigManager.updateStoreConfig('store-123', {
        thresholds: {
          criticalStock: 10,
          lowStock: 20,
          reorderPoint: 30,
          maxStock: 1000,
          safetyStock: 15
        }
      });

      InventoryConfigManager.updateProductConfig('product-123', {
        customThresholds: {
          criticalStock: 25, // Higher than store lowStock
          lowStock: 15 // Lower than store reorderPoint
        }
      });

      const thresholds = InventoryConfigManager.getEffectiveThresholds('store-123', 'product-123');

      // Should auto-correct relationships
      expect(thresholds.lowStock).toBeGreaterThan(thresholds.criticalStock);
      expect(thresholds.reorderPoint).toBeGreaterThan(thresholds.lowStock);
    });
  });

  describe('Alert Severity Determination', () => {
    const testThresholds: InventoryThresholds = {
      criticalStock: 5,
      lowStock: 20,
      reorderPoint: 40,
      maxStock: 1000,
      safetyStock: 10
    };

    test('should determine CRITICAL severity correctly', () => {
      expect(InventoryConfigManager.determineAlertSeverity(0, testThresholds)).toBe(AlertSeverity.CRITICAL);
      expect(InventoryConfigManager.determineAlertSeverity(3, testThresholds)).toBe(AlertSeverity.CRITICAL);
      expect(InventoryConfigManager.determineAlertSeverity(5, testThresholds)).toBe(AlertSeverity.CRITICAL);
    });

    test('should determine HIGH severity correctly', () => {
      expect(InventoryConfigManager.determineAlertSeverity(10, testThresholds)).toBe(AlertSeverity.HIGH);
      expect(InventoryConfigManager.determineAlertSeverity(20, testThresholds)).toBe(AlertSeverity.HIGH);
    });

    test('should determine MEDIUM severity correctly', () => {
      expect(InventoryConfigManager.determineAlertSeverity(30, testThresholds)).toBe(AlertSeverity.MEDIUM);
      expect(InventoryConfigManager.determineAlertSeverity(40, testThresholds)).toBe(AlertSeverity.MEDIUM);
    });

    test('should handle overstocked items', () => {
      expect(InventoryConfigManager.determineAlertSeverity(1200, testThresholds)).toBe(AlertSeverity.MEDIUM);
    });

    test('should return LOW severity for healthy stock levels', () => {
      expect(InventoryConfigManager.determineAlertSeverity(100, testThresholds)).toBe(AlertSeverity.LOW);
      expect(InventoryConfigManager.determineAlertSeverity(500, testThresholds)).toBe(AlertSeverity.LOW);
    });
  });

  describe('Alert Detection', () => {
    const testThresholds: InventoryThresholds = {
      criticalStock: 5,
      lowStock: 20,
      reorderPoint: 40,
      maxStock: 1000,
      safetyStock: 10
    };

    test('should detect out of stock alert', () => {
      const result = InventoryConfigManager.shouldAlert(0, 10, testThresholds);

      expect(result.shouldAlert).toBe(true);
      expect(result.alertType).toBe(InventoryAlertType.OUT_OF_STOCK);
      expect(result.severity).toBe(AlertSeverity.CRITICAL);
    });

    test('should detect critical stock alert', () => {
      const result = InventoryConfigManager.shouldAlert(3, 10, testThresholds);

      expect(result.shouldAlert).toBe(true);
      expect(result.alertType).toBe(InventoryAlertType.LOW_STOCK);
      expect(result.severity).toBe(AlertSeverity.CRITICAL);
    });

    test('should detect low stock alert', () => {
      const result = InventoryConfigManager.shouldAlert(15, 25, testThresholds);

      expect(result.shouldAlert).toBe(true);
      expect(result.alertType).toBe(InventoryAlertType.LOW_STOCK);
      expect(result.severity).toBe(AlertSeverity.HIGH);
    });

    test('should detect reorder point alert', () => {
      const result = InventoryConfigManager.shouldAlert(35, 45, testThresholds);

      expect(result.shouldAlert).toBe(true);
      expect(result.alertType).toBe(InventoryAlertType.REORDER_POINT);
      expect(result.severity).toBe(AlertSeverity.MEDIUM);
    });

    test('should detect overstocked alert', () => {
      const result = InventoryConfigManager.shouldAlert(1200, 800, testThresholds);

      expect(result.shouldAlert).toBe(true);
      expect(result.alertType).toBe(InventoryAlertType.OVERSTOCKED);
      expect(result.severity).toBe(AlertSeverity.MEDIUM);
    });

    test('should not alert for healthy stock changes', () => {
      const result = InventoryConfigManager.shouldAlert(100, 95, testThresholds);

      expect(result.shouldAlert).toBe(false);
    });

    test('should not alert for stock increases', () => {
      const result = InventoryConfigManager.shouldAlert(25, 15, testThresholds); // Stock increased

      expect(result.shouldAlert).toBe(false);
    });
  });

  describe('Reorder Quantity Calculation', () => {
    const testThresholds: InventoryThresholds = {
      criticalStock: 5,
      lowStock: 20,
      reorderPoint: 40,
      maxStock: 1000,
      safetyStock: 10
    };

    test('should calculate reorder quantity based on safety stock', () => {
      const quantity = InventoryConfigManager.calculateReorderQuantity(
        15, // current stock
        testThresholds,
        2, // average daily sales
        7 // lead time days
      );

      // Should order enough to reach safety stock + expected sales during lead time
      // Expected sales: 2 * 7 = 14
      // Target: safety stock (10) + expected sales (14) = 24
      // Need to order: 24 - 15 = 9 minimum, but also consider reorder point
      expect(quantity).toBeGreaterThan(0);
      expect(quantity).toBeLessThanOrEqual(100); // Reasonable upper bound
    });

    test('should handle zero or negative current stock', () => {
      const quantity = InventoryConfigManager.calculateReorderQuantity(0, testThresholds, 1, 7);

      expect(quantity).toBeGreaterThan(0);
      expect(quantity).toBeGreaterThanOrEqual(testThresholds.reorderPoint);
    });

    test('should handle zero sales velocity', () => {
      const quantity = InventoryConfigManager.calculateReorderQuantity(5, testThresholds, 0, 7);

      expect(quantity).toBeGreaterThanOrEqual(0);
    });

    test('should not order when stock is above reorder point', () => {
      const quantity = InventoryConfigManager.calculateReorderQuantity(50, testThresholds, 1, 7);

      expect(quantity).toBe(0);
    });

    test('should handle high sales velocity', () => {
      const quantity = InventoryConfigManager.calculateReorderQuantity(
        10,
        testThresholds,
        20, // High daily sales
        14 // Long lead time
      );

      expect(quantity).toBeGreaterThan(100); // Should order a lot
    });
  });

  describe('Inventory Health Score', () => {
    const testThresholds: InventoryThresholds = {
      criticalStock: 5,
      lowStock: 20,
      reorderPoint: 40,
      maxStock: 1000,
      safetyStock: 10
    };

    test('should return 0 for out of stock', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(0, testThresholds);
      expect(score).toBe(0);
    });

    test('should return low score for critical stock', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(3, testThresholds);
      expect(score).toBe(20);
    });

    test('should return medium score for low stock', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(15, testThresholds);
      expect(score).toBe(50);
    });

    test('should return good score for stock at reorder point', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(40, testThresholds);
      expect(score).toBe(75);
    });

    test('should return high score for healthy stock levels', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(100, testThresholds);
      expect(score).toBe(100);
    });

    test('should penalize overstocking', () => {
      const score = InventoryConfigManager.calculateInventoryHealthScore(1200, testThresholds);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(30);
    });

    test('should consider sales velocity in scoring', () => {
      const scoreNoVelocity = InventoryConfigManager.calculateInventoryHealthScore(100, testThresholds, 0, 30);
      const scoreGoodVelocity = InventoryConfigManager.calculateInventoryHealthScore(100, testThresholds, 3, 30);
      const scoreTooFast = InventoryConfigManager.calculateInventoryHealthScore(100, testThresholds, 50, 30);

      expect(scoreGoodVelocity).toBeGreaterThanOrEqual(scoreNoVelocity);
      expect(scoreGoodVelocity).toBeGreaterThan(scoreTooFast);
    });

    test('should always return score between 0 and 100', () => {
      const extremeScores = [
        InventoryConfigManager.calculateInventoryHealthScore(-10, testThresholds),
        InventoryConfigManager.calculateInventoryHealthScore(0, testThresholds),
        InventoryConfigManager.calculateInventoryHealthScore(100000, testThresholds),
        InventoryConfigManager.calculateInventoryHealthScore(1, testThresholds, 1000, 1)
      ];

      extremeScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Configuration Export and Import', () => {
    test('should export configurations correctly', () => {
      // Set up some configurations
      InventoryConfigManager.updateStoreConfig('store-1', { currency: 'EUR' });
      InventoryConfigManager.updateStoreConfig('store-2', { currency: 'RUB' });
      InventoryConfigManager.updateProductConfig('product-1', { autoReorder: true });

      const exported = InventoryConfigManager.exportConfigurations();

      expect(exported).toHaveProperty('storeConfigs');
      expect(exported).toHaveProperty('productConfigs');
      expect(exported).toHaveProperty('defaultThresholds');

      expect(Object.keys(exported.storeConfigs)).toHaveLength(2);
      expect(Object.keys(exported.productConfigs)).toHaveLength(1);
      expect(exported.defaultThresholds).toEqual(DEFAULT_THRESHOLDS);
    });

    test('should clear configurations', () => {
      InventoryConfigManager.updateStoreConfig('store-1', { currency: 'EUR' });
      InventoryConfigManager.updateProductConfig('product-1', { autoReorder: true });

      let exported = InventoryConfigManager.exportConfigurations();
      expect(Object.keys(exported.storeConfigs)).toHaveLength(1);

      InventoryConfigManager.clearConfigurations();

      exported = InventoryConfigManager.exportConfigurations();
      expect(Object.keys(exported.storeConfigs)).toHaveLength(0);
      expect(Object.keys(exported.productConfigs)).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null/undefined values gracefully', () => {
      expect(() => {
        InventoryConfigManager.getStoreConfig(null as string | null);
      }).not.toThrow();

      expect(() => {
        InventoryConfigManager.getProductConfig(undefined as string | undefined);
      }).not.toThrow();
    });

    test('should handle invalid threshold values', () => {
      const invalidThresholds = {
        criticalStock: -5,
        lowStock: -10,
        reorderPoint: -15,
        maxStock: -20,
        safetyStock: -1
      };

      const config = InventoryConfigManager.updateStoreConfig('store-123', {
        thresholds: invalidThresholds
      });

      // Should correct negative values
      expect(config.thresholds.criticalStock).toBeGreaterThanOrEqual(0);
      expect(config.thresholds.lowStock).toBeGreaterThan(config.thresholds.criticalStock);
    });

    test('should handle concurrent configuration updates', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        return InventoryConfigManager.updateStoreConfig(`store-${i}`, {
          currency: 'USD',
          alertFrequency: 'immediate'
        });
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((config, i) => {
        expect(config.storeId).toBe(`store-${i}`);
        expect(config.currency).toBe('USD');
      });
    });

    test('should handle extreme sales velocity values', () => {
      const testThresholds: InventoryThresholds = {
        criticalStock: 5,
        lowStock: 20,
        reorderPoint: 40,
        maxStock: 1000,
        safetyStock: 10
      };

      // Very high velocity
      const highVelocityScore = InventoryConfigManager.calculateInventoryHealthScore(
        100, testThresholds, 1000, 1
      );

      // Very low velocity  
      const lowVelocityScore = InventoryConfigManager.calculateInventoryHealthScore(
        100, testThresholds, 0.001, 365
      );

      expect(highVelocityScore).toBeGreaterThanOrEqual(0);
      expect(highVelocityScore).toBeLessThanOrEqual(100);
      expect(lowVelocityScore).toBeGreaterThanOrEqual(0);
      expect(lowVelocityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large numbers of configurations efficiently', () => {
      const startTime = Date.now();

      // Create many configurations
      for (let i = 0; i < 1000; i++) {
        InventoryConfigManager.getStoreConfig(`store-${i}`);
        InventoryConfigManager.getProductConfig(`product-${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('should efficiently calculate health scores', () => {
      const testThresholds: InventoryThresholds = {
        criticalStock: 5,
        lowStock: 20,
        reorderPoint: 40,
        maxStock: 1000,
        safetyStock: 10
      };

      const startTime = Date.now();

      for (let i = 0; i < 10000; i++) {
        InventoryConfigManager.calculateInventoryHealthScore(
          Math.random() * 1000,
          testThresholds,
          Math.random() * 10,
          Math.random() * 30
        );
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should be very fast
    });
  });
});
