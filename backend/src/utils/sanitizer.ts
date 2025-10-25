/**
 * Centralized sanitization utilities for security
 * Prevents XSS, Log Injection, and other input-based attacks
 */

import validator from 'validator';

/**
 * Sanitize string for logging to prevent log injection (CWE-117)
 * Removes newlines and control characters
 */
export function sanitizeForLog(input: any): string {
  if (input === null || input === undefined) {
    return 'null';
  }

  const str = String(input);

  // Remove newlines, carriage returns, and other control characters that could be used for log injection
  return str
    .replace(/[\r\n]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\\/g, '\\\\') // Escape backslashes
    .trim();
}

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return validator.escape(input);
}

/**
 * General input sanitization for XSS prevention
 * Alias for sanitizeHtml for convenience
 */
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input);
}

/**
 * SECURITY FIX: Sanitize file path to prevent path traversal (CWE-22)
 */
export function sanitizePath(filePath: string, allowedDirectory: string): string {
  const path = require('path');

  // SECURITY: Remove any null bytes to prevent null byte injection
  const cleanPath = filePath.replace(/\0/g, '');

  // Normalize the path to resolve . and .. segments
  const normalized = path.normalize(cleanPath);

  // Resolve to absolute path within allowed directory
  const allowedBase = path.resolve(allowedDirectory);
  const resolved = path.resolve(allowedBase, normalized);

  // SECURITY: Ensure the resolved path is within the allowed directory
  // Use realpath-style check to prevent symlink attacks
  if (!resolved.startsWith(allowedBase + path.sep) && resolved !== allowedBase) {
    throw new Error('SECURITY: Path traversal detected - path outside allowed directory');
  }

  // SECURITY: Check for suspicious patterns
  if (normalized.includes('..') || normalized.includes('~') || normalized.includes('\0')) {
    throw new Error('SECURITY: Invalid path pattern detected');
  }

  // SECURITY: Validate no path separators in filename component
  const basename = path.basename(normalized);
  if (basename !== normalized && (basename.includes('/') || basename.includes('\\'))) {
    throw new Error('SECURITY: Path separator in filename');
  }

  return resolved;
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
 * Remove sensitive data from error messages (CWE-117)
 */
export function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';

  if (error instanceof Error) {
    const message = sanitizeForLog(error.message);
    // Remove potential file paths and credentials
    return message.replace(/([a-zA-Z]:\\|\/)[^\s]*/g, '[PATH]');
  }

  return sanitizeForLog(String(error));
}

/**
 * Sanitize SQL-like input (for additional safety, though we use Prisma)
 */
export function sanitizeSqlInput(input: string): string {
  if (!input) return '';

  // Remove common SQL injection patterns
  return input
    .replace(/['";]/g, '')
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '')
    .trim();
}

/**
 * Sanitize URL to prevent SSRF
 */
export function sanitizeUrl(url: string, allowedDomains: string[] = []): string {
  try {
    const parsed = new URL(url);

    // Block internal/private IPs
    const blockedPatterns = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^82.147.84.78$/i,
      /^0\.0\.0\.0$/
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(parsed.hostname)) {
        throw new Error('Access to internal/private IPs is not allowed');
      }
    }

    // Check against allowed domains if provided
    if (allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        throw new Error(`Domain ${parsed.hostname} is not in the allowed list`);
      }
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize command line arguments to prevent command injection
 */
export function sanitizeCommandArg(arg: string): string {
  // Only allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(arg)) {
    throw new Error('Invalid command argument: contains forbidden characters');
  }
  return arg;
}

