declare module 'validator' {
  interface CurrencyOptions {
    symbol?: string;
    require_symbol?: boolean;
    allow_space_after_symbol?: boolean;
    symbol_after_digits?: boolean;
    allow_negatives?: boolean;
    parens_for_negatives?: boolean;
    negative_sign_before_digits?: boolean;
    negative_sign_after_digits?: boolean;
    allow_negative_sign_placeholder?: boolean;
    thousands_separator?: string;
    decimal_separator?: string;
    allow_decimal?: boolean;
    require_decimal?: boolean;
    digits_after_decimal?: number[];
    allow_space_after_digits?: boolean;
  }

  interface DecimalOptions {
    force_decimal?: boolean;
    decimal_digits?: string;
    locale?: string;
  }

  interface EmailOptions {
    allow_display_name?: boolean;
    require_display_name?: boolean;
    allow_utf8_local_part?: boolean;
    require_tld?: boolean;
    allow_ip_domain?: boolean;
    domain_specific_validation?: boolean;
    blacklisted_chars?: string;
    host_blacklist?: string[];
  }

  interface FQDNOptions {
    require_tld?: boolean;
    allow_underscores?: boolean;
    allow_trailing_dot?: boolean;
    allow_numeric_tld?: boolean;
    allow_wildcard?: boolean;
  }

  interface FloatOptions {
    min?: number;
    max?: number;
    gt?: number;
    lt?: number;
    locale?: string;
  }

  interface ISSNOptions {
    case_sensitive?: boolean;
    require_hyphen?: boolean;
  }

  interface IntOptions {
    min?: number;
    max?: number;
    allow_leading_zeroes?: boolean;
    gt?: number;
    lt?: number;
  }

  interface URLOptions {
    protocols?: string[];
    require_tld?: boolean;
    require_protocol?: boolean;
    require_host?: boolean;
    require_port?: boolean;
    require_valid_protocol?: boolean;
    allow_underscores?: boolean;
    host_whitelist?: string[];
    host_blacklist?: string[];
    allow_trailing_dot?: boolean;
    allow_protocol_relative_urls?: boolean;
    allow_fragments?: boolean;
    allow_query_components?: boolean;
    disallow_auth?: boolean;
    validate_length?: boolean;
  }

  interface NormalizeEmailOptions {
    all_lowercase?: boolean;
    gmail_lowercase?: boolean;
    gmail_remove_dots?: boolean;
    gmail_remove_subaddress?: boolean;
    gmail_convert_googlemaildotcom?: boolean;
    outlookdotcom_lowercase?: boolean;
    outlookdotcom_remove_subaddress?: boolean;
    yahoo_lowercase?: boolean;
    yahoo_remove_subaddress?: boolean;
    icloud_lowercase?: boolean;
    icloud_remove_subaddress?: boolean;
  }

  interface ValidatorJS {
    contains(str: string, seed: string): boolean;
    equals(str: string, comparison: string): boolean;
    isAfter(str: string, date?: string): boolean;
    isAlpha(str: string, locale?: string): boolean;
    isAlphanumeric(str: string, locale?: string): boolean;
    isAscii(str: string): boolean;
    isBase32(str: string): boolean;
    isBase64(str: string): boolean;
    isBefore(str: string, date?: string): boolean;
    isBoolean(str: string): boolean;
    isCreditCard(str: string): boolean;
    isCurrency(str: string, options?: CurrencyOptions): boolean;
    isDataURI(str: string): boolean;
    isDate(str: string): boolean;
    isDecimal(str: string, options?: DecimalOptions): boolean;
    isDivisibleBy(str: string, number: number): boolean;
    isEmail(str: string, options?: EmailOptions): boolean;
    isEmpty(str: string): boolean;
    isFQDN(str: string, options?: FQDNOptions): boolean;
    isFloat(str: string, options?: FloatOptions): boolean;
    isFullWidth(str: string): boolean;
    isHalfWidth(str: string): boolean;
    isHash(str: string, algorithm: string): boolean;
    isHexColor(str: string): boolean;
    isHexadecimal(str: string): boolean;
    isIP(str: string, version?: number): boolean;
    isIPRange(str: string): boolean;
    isISBN(str: string, version?: number): boolean;
    isISIN(str: string): boolean;
    isISO8601(str: string): boolean;
    isISO31661Alpha2(str: string): boolean;
    isISO31661Alpha3(str: string): boolean;
    isISRC(str: string): boolean;
    isISSN(str: string, options?: ISSNOptions): boolean;
    isIn(str: string, values: string[] | number[]): boolean;
    isInt(str: string, options?: IntOptions): boolean;
    isJSON(str: string): boolean;
    isJWT(str: string): boolean;
    isLatLong(str: string): boolean;
    isLength(str: string, options: { min?: number; max?: number }): boolean;
    isLowercase(str: string): boolean;
    isMACAddress(str: string): boolean;
    isMD5(str: string): boolean;
    isMimeType(str: string): boolean;
    isMobilePhone(str: string, locale?: string): boolean;
    isMongoId(str: string): boolean;
    isMultibyte(str: string): boolean;
    isNumeric(str: string): boolean;
    isPort(str: string): boolean;
    isPostalCode(str: string, locale: string): boolean;
    isSurrogatePair(str: string): boolean;
    isURL(str: string, options?: URLOptions): boolean;
    isUUID(str: string, version?: number): boolean;
    isUppercase(str: string): boolean;
    isVariableWidth(str: string): boolean;
    isWhitelisted(str: string, chars: string | string[]): boolean;
    matches(str: string, pattern: RegExp | string, modifiers?: string): boolean;
    // Sanitizers
    blacklist(str: string, chars: string): string;
    escape(str: string): string;
    unescape(str: string): string;
    ltrim(str: string, chars?: string): string;
    normalizeEmail(str: string, options?: NormalizeEmailOptions): string;
    rtrim(str: string, chars?: string): string;
    stripLow(str: string, keep_new_lines?: boolean): string;
    toBoolean(str: string, strict?: boolean): boolean;
    toDate(str: string): Date;
    toFloat(str: string): number;
    toInt(str: string, radix?: number): number;
    toString(input: unknown): string;
    trim(str: string, chars?: string): string;
    whitelist(str: string, chars: string): string;
  }

  const validator: ValidatorJS;
  export = validator;
}
