/**
 * Centralized sanitization utilities for security in bot
 * Prevents Log Injection and other input-based attacks
 */

/**
 * Sanitize string for logging to prevent log injection
 * Removes newlines and control characters
 */
export function sanitizeForLog(input: any): string {
  if (input === null || input === undefined) {
    return 'null';
  }

  const str = String(input);

  // Remove newlines, carriage returns, and other control characters
  return str
    .replace(/[\r\n]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize object for logging (recursive)
 */
export function sanitizeObjectForLog(obj: any, depth = 0): any {
  if (depth > 10) return '[Max Depth Reached]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeForLog(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectForLog(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Mask sensitive fields
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('credential')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObjectForLog(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(obj);
}

/**
 * Remove sensitive data from error messages
 */
export function sanitizeError(error: Error): { message: string; stack?: string } {
  const message = sanitizeForLog(error.message);
  const stack = error.stack ? sanitizeForLog(error.stack) : undefined;

  // Remove potential file paths and credentials
  const cleanMessage = message.replace(/([a-zA-Z]:\\|\/)[^\s]*/g, '[PATH]');

  return {
    message: cleanMessage,
    stack: stack ? stack.replace(/([a-zA-Z]:\\|\/)[^\s]*/g, '[PATH]') : undefined
  };
}

