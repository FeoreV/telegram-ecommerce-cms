"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCurrencyStats = exports.getDisplayPrice = exports.isValidCurrencyCode = exports.convertCurrency = exports.parseCurrency = exports.formatCurrency = exports.getCurrencyConfig = exports.getSupportedCurrencies = exports.CURRENCY_CONFIGS = void 0;
const loggerEnhanced_1 = require("./loggerEnhanced");
exports.CURRENCY_CONFIGS = {
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
const getSupportedCurrencies = () => {
    return Object.values(exports.CURRENCY_CONFIGS);
};
exports.getSupportedCurrencies = getSupportedCurrencies;
const getCurrencyConfig = (currencyCode) => {
    const config = exports.CURRENCY_CONFIGS[currencyCode.toUpperCase()];
    if (!config) {
        loggerEnhanced_1.logger.warn(`Currency ${currencyCode} not found, using USD as fallback`);
        return exports.CURRENCY_CONFIGS.USD;
    }
    return config;
};
exports.getCurrencyConfig = getCurrencyConfig;
const formatCurrency = (amount, currencyCode, options = {}) => {
    try {
        const config = (0, exports.getCurrencyConfig)(currencyCode);
        const { showDecimals = true, useLocale = true, customSymbol } = options;
        const symbol = customSymbol || config.symbol;
        const decimals = showDecimals ? config.decimals : 0;
        if (useLocale && config.locale) {
            try {
                const formatter = new Intl.NumberFormat(config.locale, {
                    style: 'currency',
                    currency: config.code,
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                return formatter.format(amount);
            }
            catch (localeError) {
                loggerEnhanced_1.logger.warn(`Failed to use locale formatting for ${config.locale}`, { error: localeError });
            }
        }
        const parts = amount.toFixed(decimals).split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1];
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
        let formattedAmount = formattedInteger;
        if (showDecimals && decimals > 0 && decimalPart) {
            formattedAmount += config.decimalSeparator + decimalPart;
        }
        return config.position === 'before'
            ? `${symbol}${formattedAmount}`
            : `${formattedAmount} ${symbol}`;
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error formatting currency', { amount, currencyCode, error });
        return `${amount} ${currencyCode}`;
    }
};
exports.formatCurrency = formatCurrency;
const parseCurrency = (currencyString, currencyCode) => {
    try {
        const config = (0, exports.getCurrencyConfig)(currencyCode);
        let cleanString = currencyString
            .replace(config.symbol, '')
            .trim();
        if (config.thousandsSeparator) {
            cleanString = cleanString.replace(new RegExp('\\' + config.thousandsSeparator, 'g'), '');
        }
        if (config.decimalSeparator !== '.') {
            cleanString = cleanString.replace(config.decimalSeparator, '.');
        }
        const parsed = parseFloat(cleanString);
        if (isNaN(parsed)) {
            throw new Error(`Cannot parse currency string: ${currencyString}`);
        }
        return parsed;
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error parsing currency', { currencyString, currencyCode, error });
        return 0;
    }
};
exports.parseCurrency = parseCurrency;
const MOCK_EXCHANGE_RATES = {
    USD: { EUR: 0.85, RUB: 90, UAH: 27, GBP: 0.73, JPY: 110 },
    EUR: { USD: 1.18, RUB: 105, UAH: 32, GBP: 0.86, JPY: 130 },
    RUB: { USD: 0.011, EUR: 0.0095, UAH: 0.30, GBP: 0.008, JPY: 1.22 },
    UAH: { USD: 0.037, EUR: 0.031, RUB: 3.33, GBP: 0.027, JPY: 4.07 }
};
const convertCurrency = async (amount, fromCurrency, toCurrency, useRealRates = false) => {
    try {
        if (fromCurrency === toCurrency) {
            return { amount, rate: 1, timestamp: new Date() };
        }
        let rate = 1;
        if (useRealRates) {
            rate = MOCK_EXCHANGE_RATES[fromCurrency.toUpperCase()]?.[toCurrency.toUpperCase()] || 1;
            loggerEnhanced_1.logger.warn('Using mock exchange rates - integrate with real API for production');
        }
        else {
            rate = MOCK_EXCHANGE_RATES[fromCurrency.toUpperCase()]?.[toCurrency.toUpperCase()] || 1;
        }
        const convertedAmount = amount * rate;
        loggerEnhanced_1.logger.debug('Currency conversion', {
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
    }
    catch (error) {
        loggerEnhanced_1.logger.error('Error converting currency', {
            amount,
            fromCurrency,
            toCurrency,
            error
        });
        throw new Error('Currency conversion failed');
    }
};
exports.convertCurrency = convertCurrency;
const isValidCurrencyCode = (code) => {
    return Object.prototype.hasOwnProperty.call(exports.CURRENCY_CONFIGS, code.toUpperCase());
};
exports.isValidCurrencyCode = isValidCurrencyCode;
const getDisplayPrice = (price, currencyCode, options = {}) => {
    const { showDecimals = true, useSymbol = true, customFormat } = options;
    if (customFormat) {
        const config = (0, exports.getCurrencyConfig)(currencyCode);
        const formattedAmount = (0, exports.formatCurrency)(price, currencyCode, {
            showDecimals,
            useLocale: false,
            customSymbol: ''
        });
        return customFormat
            .replace('{amount}', formattedAmount.trim())
            .replace('{code}', config.code)
            .replace('{symbol}', config.symbol);
    }
    return (0, exports.formatCurrency)(price, currencyCode, { showDecimals, useLocale: useSymbol });
};
exports.getDisplayPrice = getDisplayPrice;
const calculateCurrencyStats = (orders, _baseCurrency = 'USD') => {
    const currencyMap = new Map();
    const completedOrders = orders.filter(order => ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status));
    for (const order of completedOrders) {
        const currency = order.currency.toUpperCase();
        const existing = currencyMap.get(currency) || { totalOrders: 0, totalRevenue: 0 };
        existing.totalOrders++;
        existing.totalRevenue += order.total;
        currencyMap.set(currency, existing);
    }
    const stats = [];
    for (const [code, data] of currencyMap) {
        stats.push({
            code,
            totalOrders: data.totalOrders,
            totalRevenue: data.totalRevenue,
            averageOrderValue: data.totalRevenue / data.totalOrders,
        });
    }
    return stats.sort((a, b) => b.totalRevenue - a.totalRevenue);
};
exports.calculateCurrencyStats = calculateCurrencyStats;
exports.default = {
    CURRENCY_CONFIGS: exports.CURRENCY_CONFIGS,
    getSupportedCurrencies: exports.getSupportedCurrencies,
    getCurrencyConfig: exports.getCurrencyConfig,
    formatCurrency: exports.formatCurrency,
    parseCurrency: exports.parseCurrency,
    convertCurrency: exports.convertCurrency,
    isValidCurrencyCode: exports.isValidCurrencyCode,
    getDisplayPrice: exports.getDisplayPrice,
    calculateCurrencyStats: exports.calculateCurrencyStats
};
//# sourceMappingURL=currency.js.map