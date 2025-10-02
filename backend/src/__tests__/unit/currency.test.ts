import {
  CURRENCY_CONFIGS,
  getSupportedCurrencies,
  getCurrencyConfig,
  formatCurrency,
  parseCurrency,
  convertCurrency,
  isValidCurrencyCode,
  getDisplayPrice,
  calculateCurrencyStats
} from '../../utils/currency';

describe('Currency System', () => {
  describe('Currency Configuration', () => {
    test('should have all required currency configurations', () => {
      const expectedCurrencies = ['USD', 'EUR', 'RUB', 'UAH', 'GBP', 'JPY', 'BTC', 'ETH'];
      
      expectedCurrencies.forEach(currency => {
        expect(CURRENCY_CONFIGS[currency]).toBeDefined();
        expect(CURRENCY_CONFIGS[currency]).toMatchObject({
          code: currency,
          symbol: expect.any(String),
          name: expect.any(String),
          decimals: expect.any(Number),
          position: expect.stringMatching(/^(before|after)$/),
          thousandsSeparator: expect.any(String),
          decimalSeparator: expect.any(String)
        });
      });
    });

    test('should return list of supported currencies', () => {
      const currencies = getSupportedCurrencies();
      
      expect(currencies).toBeInstanceOf(Array);
      expect(currencies.length).toBeGreaterThan(0);
      expect(currencies[0]).toHaveProperty('code');
      expect(currencies[0]).toHaveProperty('symbol');
      expect(currencies[0]).toHaveProperty('name');
    });

    test('should get specific currency configuration', () => {
      const usdConfig = getCurrencyConfig('USD');
      
      expect(usdConfig).toEqual({
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        decimals: 2,
        position: 'before',
        thousandsSeparator: ',',
        decimalSeparator: '.',
        locale: 'en-US'
      });
    });

    test('should fallback to USD for invalid currency', () => {
      const config = getCurrencyConfig('INVALID');
      expect(config.code).toBe('USD');
    });

    test('should handle case insensitive currency codes', () => {
      const config1 = getCurrencyConfig('usd');
      const config2 = getCurrencyConfig('USD');
      
      expect(config1).toEqual(config2);
    });
  });

  describe('Currency Validation', () => {
    test('should validate correct currency codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('BTC')).toBe(true);
      expect(isValidCurrencyCode('usd')).toBe(true);
    });

    test('should reject invalid currency codes', () => {
      expect(isValidCurrencyCode('INVALID')).toBe(false);
      expect(isValidCurrencyCode('')).toBe(false);
      expect(isValidCurrencyCode('ABC')).toBe(false);
    });

    test('should handle null/undefined values', () => {
      expect(isValidCurrencyCode(null)).toBe(false);
      expect(isValidCurrencyCode(undefined)).toBe(false);
    });
  });

  describe('Currency Formatting', () => {
    test('should format USD correctly', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
      expect(formatCurrency(1000000, 'USD')).toBe('$1,000,000.00');
    });

    test('should format EUR correctly', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('1 234,56 €');
      expect(formatCurrency(1000, 'EUR')).toBe('1 000,00 €');
    });

    test('should format RUB correctly', () => {
      expect(formatCurrency(1234.56, 'RUB')).toBe('1 234,56 ₽');
    });

    test('should format JPY correctly (no decimals)', () => {
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235'); // Rounded to nearest yen
      expect(formatCurrency(1234, 'JPY')).toBe('¥1,234');
    });

    test('should format BTC correctly (8 decimals)', () => {
      expect(formatCurrency(1.23456789, 'BTC')).toBe('₿1.23456789');
      expect(formatCurrency(0.00000001, 'BTC')).toBe('₿0.00000001');
    });

    test('should handle formatting options', () => {
      // Without decimals
      expect(formatCurrency(1234.56, 'USD', { showDecimals: false })).toBe('$1,235');
      
      // With custom symbol
      expect(formatCurrency(100, 'USD', { customSymbol: 'USD' })).toBe('USD100.00');
      
      // Without locale formatting
      expect(formatCurrency(1234.56, 'EUR', { useLocale: false })).toBe('1 234,56 €');
    });

    test('should handle edge cases', () => {
      expect(formatCurrency(0.01, 'USD')).toBe('$0.01');
      expect(formatCurrency(-100, 'USD')).toBe('-$100.00');
      expect(formatCurrency(Infinity, 'USD')).toBe('Infinity USD'); // Fallback
      expect(formatCurrency(NaN, 'USD')).toBe('NaN USD'); // Fallback
    });

    test('should handle very large numbers', () => {
      expect(formatCurrency(999999999.99, 'USD')).toBe('$999,999,999.99');
    });

    test('should handle very small numbers', () => {
      expect(formatCurrency(0.000001, 'BTC')).toBe('₿0.00000100');
    });
  });

  describe('Currency Parsing', () => {
    test('should parse USD values correctly', () => {
      expect(parseCurrency('$1,234.56', 'USD')).toBe(1234.56);
      expect(parseCurrency('$1,000,000.00', 'USD')).toBe(1000000);
      expect(parseCurrency('$ 500.25', 'USD')).toBe(500.25);
    });

    test('should parse EUR values correctly', () => {
      expect(parseCurrency('1 234,56 €', 'EUR')).toBe(1234.56);
      expect(parseCurrency('1000,00€', 'EUR')).toBe(1000);
    });

    test('should parse values without symbols', () => {
      expect(parseCurrency('1234.56', 'USD')).toBe(1234.56);
      expect(parseCurrency('1000', 'USD')).toBe(1000);
    });

    test('should handle invalid input gracefully', () => {
      expect(parseCurrency('invalid', 'USD')).toBe(0);
      expect(parseCurrency('', 'USD')).toBe(0);
      expect(parseCurrency('$abc', 'USD')).toBe(0);
    });

    test('should handle negative values', () => {
      expect(parseCurrency('-$100.50', 'USD')).toBe(-100.50);
    });
  });

  describe('Currency Conversion', () => {
    test('should handle same currency conversion', async () => {
      const result = await convertCurrency(100, 'USD', 'USD');
      
      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should convert between different currencies', async () => {
      const result = await convertCurrency(100, 'USD', 'EUR');
      
      expect(result.amount).toBeGreaterThan(0);
      expect(result.rate).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle invalid currency codes', async () => {
      const result = await convertCurrency(100, 'USD', 'INVALID');
      
      expect(result.amount).toBe(100); // Fallback rate of 1
      expect(result.rate).toBe(1);
    });

    test('should handle zero amounts', async () => {
      const result = await convertCurrency(0, 'USD', 'EUR');
      
      expect(result.amount).toBe(0);
      expect(result.rate).toBeGreaterThan(0);
    });

    test('should handle negative amounts', async () => {
      const result = await convertCurrency(-100, 'USD', 'EUR');
      
      expect(result.amount).toBeLessThan(0);
    });

    test('should use real rates when specified', async () => {
      // This would test real API integration
      const result = await convertCurrency(100, 'USD', 'EUR', true);
      
      expect(result.amount).toBeGreaterThan(0);
      expect(result.rate).toBeGreaterThan(0);
    });
  });

  describe('Display Price Formatting', () => {
    test('should format display prices with default options', () => {
      expect(getDisplayPrice(1234.56, 'USD')).toBe('$1,234.56');
    });

    test('should format with custom format strings', () => {
      expect(getDisplayPrice(100, 'USD', { 
        customFormat: '{amount} {code}' 
      })).toBe('100.00 USD');

      expect(getDisplayPrice(100, 'USD', { 
        customFormat: '{symbol}{amount}' 
      })).toBe('$100.00');
    });

    test('should handle options correctly', () => {
      expect(getDisplayPrice(1234.56, 'USD', { 
        showDecimals: false 
      })).toBe('$1,235');

      expect(getDisplayPrice(1234.56, 'USD', { 
        useSymbol: false 
      })).toBe('1,234.56');
    });
  });

  describe('Currency Statistics', () => {
    const mockOrders = [
      { total: 100, currency: 'USD', status: 'PAID' },
      { total: 200, currency: 'USD', status: 'DELIVERED' },
      { total: 150, currency: 'EUR', status: 'SHIPPED' },
      { total: 300, currency: 'USD', status: 'CANCELLED' }, // Should be excluded
      { total: 75, currency: 'EUR', status: 'PAID' },
      { total: 500, currency: 'RUB', status: 'DELIVERED' }
    ];

    test('should calculate currency statistics correctly', () => {
      const stats = calculateCurrencyStats(mockOrders);
      
      expect(stats).toHaveLength(3); // USD, EUR, RUB
      
      // USD stats (2 completed orders: 100 + 200 = 300)
      const usdStats = stats.find(s => s.code === 'USD');
      expect(usdStats).toEqual({
        code: 'USD',
        totalOrders: 2,
        totalRevenue: 300,
        averageOrderValue: 150
      });

      // EUR stats (2 completed orders: 150 + 75 = 225)
      const eurStats = stats.find(s => s.code === 'EUR');
      expect(eurStats).toEqual({
        code: 'EUR',
        totalOrders: 2,
        totalRevenue: 225,
        averageOrderValue: 112.5
      });

      // RUB stats (1 completed order: 500)
      const rubStats = stats.find(s => s.code === 'RUB');
      expect(rubStats).toEqual({
        code: 'RUB',
        totalOrders: 1,
        totalRevenue: 500,
        averageOrderValue: 500
      });
    });

    test('should sort by revenue (highest first)', () => {
      const stats = calculateCurrencyStats(mockOrders);
      
      expect(stats[0].totalRevenue).toBeGreaterThanOrEqual(stats[1].totalRevenue);
      expect(stats[1].totalRevenue).toBeGreaterThanOrEqual(stats[2].totalRevenue);
    });

    test('should handle empty orders array', () => {
      const stats = calculateCurrencyStats([]);
      expect(stats).toEqual([]);
    });

    test('should handle orders with missing fields', () => {
      interface Order {
        total: number;
        currency: string;
        status: string;
      }
      const incompleteOrders: Partial<Order>[] = [
        { total: 100, status: 'PAID' }, // Missing currency
        { currency: 'USD', status: 'PAID' }, // Missing total
        { total: 200, currency: 'USD' } // Missing status
      ];

      expect(() => calculateCurrencyStats(incompleteOrders)).not.toThrow();
    });

    test('should case-insensitive currency handling', () => {
      const mixedCaseOrders = [
        { total: 100, currency: 'usd', status: 'PAID' },
        { total: 200, currency: 'USD', status: 'DELIVERED' },
        { total: 150, currency: 'Usd', status: 'SHIPPED' }
      ];

      const stats = calculateCurrencyStats(mixedCaseOrders);
      
      expect(stats).toHaveLength(1);
      expect(stats[0].code).toBe('USD');
      expect(stats[0].totalOrders).toBe(3);
      expect(stats[0].totalRevenue).toBe(450);
    });
  });

  describe('Performance Tests', () => {
    test('should format large numbers of currencies efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        formatCurrency(Math.random() * 10000, 'USD');
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    test('should handle concurrent currency operations', async () => {
      const promises = Array.from({ length: 50 }, async (_, i) => {
        const amount = 100 + i;
        const formatted = formatCurrency(amount, 'USD');
        const parsed = parseCurrency(formatted, 'USD');
        return Math.abs(parsed - amount) < 0.01; // Allow for floating point precision
      });

      const results = await Promise.all(promises);
      expect(results.every(result => result === true)).toBe(true);
    });

    test('should handle large currency statistics datasets', () => {
      const largeOrderSet = Array.from({ length: 10000 }, (_, i) => ({
        total: Math.random() * 1000,
        currency: ['USD', 'EUR', 'RUB', 'UAH'][i % 4],
        status: ['PAID', 'SHIPPED', 'DELIVERED'][i % 3]
      }));

      const startTime = Date.now();
      const stats = calculateCurrencyStats(largeOrderSet);
      const duration = Date.now() - startTime;

      expect(stats.length).toBe(4);
      expect(duration).toBeLessThan(100); // Should complete efficiently
    });
  });

  describe('Localization Support', () => {
    test('should support different locales for number formatting', () => {
      // These tests might need to be adjusted based on Node.js Intl support
      const amount = 1234.56;

      expect(formatCurrency(amount, 'USD', { useLocale: true })).toMatch(/1.234[,.]56/);
      expect(formatCurrency(amount, 'EUR', { useLocale: true })).toMatch(/1.234[,.]56/);
    });

    test('should fallback gracefully when locale is not supported', () => {
      // Test with a potentially unsupported locale
      expect(() => formatCurrency(1234.56, 'USD', { useLocale: true })).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle null and undefined values', () => {
      expect(() => isValidCurrencyCode(null)).toBe(false);
      expect(() => isValidCurrencyCode(undefined)).toBe(false);
      expect(() => formatCurrency(null as unknown as number, 'USD')).not.toThrow();
      expect(() => formatCurrency(undefined as unknown as number, 'USD')).not.toThrow();
      expect(() => parseCurrency(null as unknown as string, 'USD')).not.toThrow();
    });

    test('should handle non-string input in parseCurrency', () => {
      expect(parseCurrency(123 as unknown as string, 'USD')).toBe(0);
      expect(parseCurrency({} as unknown as string, 'USD')).toBe(0);
      expect(parseCurrency([] as unknown as string, 'USD')).toBe(0);
    });

    test('should handle invalid numeric values in formatCurrency', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('NaN USD');
      expect(formatCurrency(Infinity, 'USD')).toBe('Infinity USD');
      expect(formatCurrency(-Infinity, 'USD')).toBe('-Infinity USD');
    });

    test('should handle extremely large precision numbers', () => {
      const result = formatCurrency(1.12345678, 'BTC');
      expect(result).toContain('₿');
      expect(result).toMatch(/1\.12345678/); // Should handle BTC precision
    });
  });
});
