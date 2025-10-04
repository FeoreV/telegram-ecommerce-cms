/**
 * Log Sanitizer Utility
 * Prevents log injection attacks by sanitizing user input before logging
 */

/**
 * Sanitize a string value for safe logging
 * Removes/escapes newlines, carriage returns, and other control characters
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  const str = String(value);
  
  // Replace control characters that could be used for log injection
  return str
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\x00/g, '\\x00')
    // Limit length to prevent log flooding
    .substring(0, 1000);
}

/**
 * Sanitize an object for safe logging
 * Recursively sanitizes all string values in the object
 */
export function sanitizeObjectForLog<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeForLog(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObjectForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Create a safe log message with sanitized interpolated values
 */
export function createSafeLogMessage(template: string, ...values: unknown[]): string {
  const sanitizedValues = values.map(v => sanitizeForLog(v));
  let message = template;
  
  for (const value of sanitizedValues) {
    message = message.replace('%s', value);
  }
  
  return message;
}

/**
 * Sanitize sensitive data patterns in logs
 */
export function sanitizeSensitiveData(message: string): string {
  return message
    // Mask email addresses
    .replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '$1@***')
    // Mask phone numbers
    .replace(/\b\d{10,15}\b/g, '***PHONE***')
    // Mask potential tokens/keys (sequences of 20+ alphanumeric chars)
    .replace(/\b[A-Za-z0-9]{20,}\b/g, '***TOKEN***')
    // Mask credit card patterns
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '***CARD***')
    // Mask IPv4 addresses (last octet)
    .replace(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}/g, '$1***');
}

