import { logger } from './loggerEnhanced';

// Supported currencies configuration
export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  position: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
  locale?: string;
}

// Default currency configurations
export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    position: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-US'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    position: 'after',
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'de-DE'
  },
  RUB: {
    code: 'RUB',
    symbol: '₽',
    name: 'Russian Ruble',
    decimals: 2,
    position: 'after',
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'ru-RU'
  },
  UAH: {
    code: 'UAH',
    symbol: '₴',
    name: 'Ukrainian Hryvnia',
    decimals: 2,
    position: 'after',
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'uk-UA'
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    decimals: 2,
    position: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-GB'
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    decimals: 0,
    position: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'ja-JP'
  },
  BTC: {
    code: 'BTC',
    symbol: '₿',
    name: 'Bitcoin',
    decimals: 8,
    position: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-US'
  },
  ETH: {
    code: 'ETH',
    symbol: 'Ξ',
    name: 'Ethereum',
    decimals: 6,
    position: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-US'
  }
};

// Get list of supported currencies
export const getSupportedCurrencies = (): CurrencyConfig[] => {
  return Object.values(CURRENCY_CONFIGS);
};

// Get currency configuration
export const getCurrencyConfig = (currencyCode: string): CurrencyConfig => {
  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()];
  if (!config) {
    logger.warn(`Currency ${currencyCode} not found, using USD as fallback`);
    return CURRENCY_CONFIGS.USD;
  }
  return config;
};

// Format currency amount
export const formatCurrency = (
  amount: number, 
  currencyCode: string, 
  options: {
    showDecimals?: boolean;
    useLocale?: boolean;
    customSymbol?: string;
  } = {}
): string => {
  try {
    const config = getCurrencyConfig(currencyCode);
    const {
      showDecimals = true,
      useLocale = true,
      customSymbol
    } = options;

    const symbol = customSymbol || config.symbol;
    const decimals = showDecimals ? config.decimals : 0;

    // Use native Intl.NumberFormat if locale is available and useLocale is true
    if (useLocale && config.locale) {
      try {
        const formatter = new Intl.NumberFormat(config.locale, {
          style: 'currency',
          currency: config.code,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
        return formatter.format(amount);
      } catch (localeError) {
        logger.warn(`Failed to use locale formatting for ${config.locale}`, { error: localeError });
      }
    }

    // Manual formatting
    const parts = amount.toFixed(decimals).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Add thousands separator
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
    
    // Combine integer and decimal parts
    let formattedAmount = formattedInteger;
    if (showDecimals && decimals > 0 && decimalPart) {
      formattedAmount += config.decimalSeparator + decimalPart;
    }

    // Add currency symbol based on position
    return config.position === 'before' 
      ? `${symbol}${formattedAmount}`
      : `${formattedAmount} ${symbol}`;

  } catch (error) {
    logger.error('Error formatting currency', { amount, currencyCode, error });
    return `${amount} ${currencyCode}`;
  }
};

// Parse currency string to number
export const parseCurrency = (currencyString: string, currencyCode: string): number => {
  try {
    const config = getCurrencyConfig(currencyCode);
    
    // Remove currency symbol and spaces
    let cleanString = currencyString
      .replace(config.symbol, '')
      .trim();
    
    // Replace thousands separators
    if (config.thousandsSeparator) {
      cleanString = cleanString.replace(new RegExp('\\' + config.thousandsSeparator, 'g'), '');
    }
    
    // Replace decimal separator with standard dot
    if (config.decimalSeparator !== '.') {
      cleanString = cleanString.replace(config.decimalSeparator, '.');
    }
    
    const parsed = parseFloat(cleanString);
    
    if (isNaN(parsed)) {
      throw new Error(`Cannot parse currency string: ${currencyString}`);
    }
    
    return parsed;
  } catch (error) {
    logger.error('Error parsing currency', { currencyString, currencyCode, error });
    return 0;
  }
};

// Convert between currencies (requires external rate provider)
export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

// Mock exchange rates for development (in production, use real API)
const MOCK_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  USD: { EUR: 0.85, RUB: 90, UAH: 27, GBP: 0.73, JPY: 110 },
  EUR: { USD: 1.18, RUB: 105, UAH: 32, GBP: 0.86, JPY: 130 },
  RUB: { USD: 0.011, EUR: 0.0095, UAH: 0.30, GBP: 0.008, JPY: 1.22 },
  UAH: { USD: 0.037, EUR: 0.031, RUB: 3.33, GBP: 0.027, JPY: 4.07 }
};

export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  useRealRates: boolean = false
): Promise<{ amount: number; rate: number; timestamp: Date }> => {
  try {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1, timestamp: new Date() };
    }

    let rate = 1;
    
    if (useRealRates) {
      // In production, integrate with real exchange rate API
      // For now, use mock rates
      rate = MOCK_EXCHANGE_RATES[fromCurrency.toUpperCase()]?.[toCurrency.toUpperCase()] || 1;
      logger.warn('Using mock exchange rates - integrate with real API for production');
    } else {
      rate = MOCK_EXCHANGE_RATES[fromCurrency.toUpperCase()]?.[toCurrency.toUpperCase()] || 1;
    }

    const convertedAmount = amount * rate;
    
    logger.debug('Currency conversion', {
      from: fromCurrency,
      to: toCurrency,
      originalAmount: amount,
      rate,
      convertedAmount
    });

    return {
      amount: convertedAmount,
      rate,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Error converting currency', {
      amount,
      fromCurrency,
      toCurrency,
      error
    });
    throw new Error('Currency conversion failed');
  }
};

// Validate currency code
export const isValidCurrencyCode = (code: string): boolean => {
  return Object.prototype.hasOwnProperty.call(CURRENCY_CONFIGS, code.toUpperCase());
};

// Get formatted price with currency for display
export const getDisplayPrice = (
  price: number, 
  currencyCode: string, 
  options: {
    showDecimals?: boolean;
    useSymbol?: boolean;
    customFormat?: string;
  } = {}
): string => {
  const {
    showDecimals = true,
    useSymbol = true,
    customFormat
  } = options;

  if (customFormat) {
    // Custom format like "{amount} {code}" or "{symbol}{amount}"
    const config = getCurrencyConfig(currencyCode);
    const formattedAmount = formatCurrency(price, currencyCode, { 
      showDecimals, 
      useLocale: false, 
      customSymbol: '' 
    });
    
    return customFormat
      .replace('{amount}', formattedAmount.trim())
      .replace('{code}', config.code)
      .replace('{symbol}', config.symbol);
  }

  return formatCurrency(price, currencyCode, { showDecimals, useLocale: useSymbol });
};

// Currency statistics for analytics
export interface CurrencyStats {
  code: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate?: number;
}

// Calculate currency statistics for a store
export const calculateCurrencyStats = (
  orders: Array<{ total: number; currency: string; status: string }>,
  _baseCurrency: string = 'USD'
): CurrencyStats[] => {
  const currencyMap = new Map<string, { totalOrders: number; totalRevenue: number }>();
  
  // Filter completed orders
  const completedOrders = orders.filter(order => 
    ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)
  );

  for (const order of completedOrders) {
    const currency = order.currency.toUpperCase();
    const existing = currencyMap.get(currency) || { totalOrders: 0, totalRevenue: 0 };
    
    existing.totalOrders++;
    existing.totalRevenue += order.total;
    
    currencyMap.set(currency, existing);
  }

  const stats: CurrencyStats[] = [];
  
  for (const [code, data] of currencyMap) {
    stats.push({
      code,
      totalOrders: data.totalOrders,
      totalRevenue: data.totalRevenue,
      averageOrderValue: data.totalRevenue / data.totalOrders,
      // conversionRate would be calculated if we have real exchange rates
    });
  }

  return stats.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

export default {
  CURRENCY_CONFIGS,
  getSupportedCurrencies,
  getCurrencyConfig,
  formatCurrency,
  parseCurrency,
  convertCurrency,
  isValidCurrencyCode,
  getDisplayPrice,
  calculateCurrencyStats
};
