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
export declare const CURRENCY_CONFIGS: Record<string, CurrencyConfig>;
export declare const getSupportedCurrencies: () => CurrencyConfig[];
export declare const getCurrencyConfig: (currencyCode: string) => CurrencyConfig;
export declare const formatCurrency: (amount: number, currencyCode: string, options?: {
    showDecimals?: boolean;
    useLocale?: boolean;
    customSymbol?: string;
}) => string;
export declare const parseCurrency: (currencyString: string, currencyCode: string) => number;
export interface ExchangeRate {
    from: string;
    to: string;
    rate: number;
    timestamp: Date;
}
export declare const convertCurrency: (amount: number, fromCurrency: string, toCurrency: string, useRealRates?: boolean) => Promise<{
    amount: number;
    rate: number;
    timestamp: Date;
}>;
export declare const isValidCurrencyCode: (code: string) => boolean;
export declare const getDisplayPrice: (price: number, currencyCode: string, options?: {
    showDecimals?: boolean;
    useSymbol?: boolean;
    customFormat?: string;
}) => string;
export interface CurrencyStats {
    code: string;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    conversionRate?: number;
}
export declare const calculateCurrencyStats: (orders: Array<{
    total: number;
    currency: string;
    status: string;
}>, _baseCurrency?: string) => CurrencyStats[];
declare const _default: {
    CURRENCY_CONFIGS: Record<string, CurrencyConfig>;
    getSupportedCurrencies: () => CurrencyConfig[];
    getCurrencyConfig: (currencyCode: string) => CurrencyConfig;
    formatCurrency: (amount: number, currencyCode: string, options?: {
        showDecimals?: boolean;
        useLocale?: boolean;
        customSymbol?: string;
    }) => string;
    parseCurrency: (currencyString: string, currencyCode: string) => number;
    convertCurrency: (amount: number, fromCurrency: string, toCurrency: string, useRealRates?: boolean) => Promise<{
        amount: number;
        rate: number;
        timestamp: Date;
    }>;
    isValidCurrencyCode: (code: string) => boolean;
    getDisplayPrice: (price: number, currencyCode: string, options?: {
        showDecimals?: boolean;
        useSymbol?: boolean;
        customFormat?: string;
    }) => string;
    calculateCurrencyStats: (orders: Array<{
        total: number;
        currency: string;
        status: string;
    }>, _baseCurrency?: string) => CurrencyStats[];
};
export default _default;
//# sourceMappingURL=currency.d.ts.map