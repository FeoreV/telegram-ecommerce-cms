/**
 * Centralized validation utilities for security
 * Validates input data against whitelists and patterns
 */

import validator from 'validator';

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

/**
 * Validate phone number (international format)
 */
export function validatePhone(phone: string): boolean {
  // Basic validation for international phone numbers
  return /^\+?[1-9]\d{1,14}$/.test(phone);
}

/**
 * Validate UUID
 */
export function validateUuid(uuid: string): boolean {
  return validator.isUUID(uuid);
}

/**
 * Validate URL
 */
export function validateUrl(url: string): boolean {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  });
}

/**
 * Validate role name against allowed roles
 */
export function validateRole(role: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(role);
}

/**
 * Validate file extension against whitelist
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Validate JSON structure
 */
export function validateJson(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate string length
 */
export function validateLength(str: string, min: number, max: number): boolean {
  const len = str.length;
  return len >= min && len <= max;
}

/**
 * Validate alphanumeric string
 */
export function validateAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Validate slug format
 */
export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Validate hex color code
 */
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validate ISO date string
 */
export function validateIsoDate(dateString: string): boolean {
  return validator.isISO8601(dateString);
}

/**
 * Validate JWT token format (basic check)
 */
export function validateJwtFormat(token: string): boolean {
  return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate IP address
 */
export function validateIp(ip: string): boolean {
  return validator.isIP(ip);
}

/**
 * Validate port number
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate MongoDB ObjectId
 */
export function validateObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Validate allowed MIME type
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * Validate currency code (ISO 4217)
 */
export function validateCurrencyCode(code: string): boolean {
  const validCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'RUB', 'UAH', 'KZT', 'BYN'];
  return validCodes.includes(code.toUpperCase());
}

/**
 * Validate numeric string
 */
export function validateNumericString(str: string): boolean {
  return /^\d+$/.test(str);
}

/**
 * Validate boolean value from string
 */
export function validateBooleanString(str: string): boolean {
  return ['true', 'false', '1', '0'].includes(str.toLowerCase());
}

/**
 * Sanitize and validate integer
 */
export function validateInteger(value: any, min?: number, max?: number): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  const num = parseInt(value, 10);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Not a valid integer' };
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, error: `Value must be at most ${max}` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate environment variable name
 */
export function validateEnvVarName(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

