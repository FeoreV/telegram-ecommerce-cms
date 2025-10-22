/**
 * Input Sanitization Utilities
 * 
 * Comprehensive input sanitization to prevent:
 * - Cross-Site Scripting (XSS) - CWE-79, 80
 * - Log Injection - CWE-117
 * - Path Traversal - CWE-22, 23
 * - SQL Injection - CWE-89
 * - Command Injection - CWE-78
 * - Code Injection - CWE-94
 */

import DOMPurify from 'isomorphic-dompurify';
import path from 'path';
import { logger } from './logger';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Untrusted HTML string
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string, options?: DOMPurify.Config): string {
  if (typeof dirty !== 'string') {
    return '';
  }
  
  const defaultOptions: DOMPurify.Config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    ...options
  };
  
  return DOMPurify.sanitize(dirty, defaultOptions);
}

/**
 * Sanitize plain text to prevent XSS
 * Removes all HTML tags and dangerous characters
 * @param input - Untrusted text string
 * @returns Sanitized plain text
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove all HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return sanitized;
}

/**
 * Sanitize input for logging to prevent log injection
 * Removes newlines, carriage returns, and control characters
 * @param input - Untrusted string to be logged
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLog(input: unknown): string {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  let str: string;
  if (typeof input === 'object') {
    try {
      str = JSON.stringify(input);
    } catch {
      str = String(input);
    }
  } else {
    str = String(input);
  }
  
  // Remove control characters, newlines, and carriage returns
  return str
    .replace(/[\n\r]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize file path to prevent path traversal attacks
 * @param userPath - User-provided path component
 * @param basePath - Base directory that should contain the file
 * @returns Sanitized absolute path or throws error if invalid
 */
export function sanitizeFilePath(userPath: string, basePath: string): string {
  if (typeof userPath !== 'string' || typeof basePath !== 'string') {
    throw new Error('Invalid path parameters');
  }
  
  // Remove null bytes
  if (userPath.includes('\0')) {
    throw new Error('Null bytes not allowed in file paths');
  }
  
  // Resolve to absolute paths
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(resolvedBase, userPath);
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = ['..', './', '\\..', '\\.\\'];
  for (const pattern of suspiciousPatterns) {
    if (userPath.includes(pattern)) {
      logger.warn('Suspicious path pattern detected', { 
        userPath: sanitizeForLog(userPath), 
        pattern 
      });
    }
  }
  
  return resolvedPath;
}

/**
 * Sanitize filename to prevent directory traversal and invalid characters
 * @param filename - User-provided filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    throw new Error('Filename must be a string');
  }
  
  // Remove path separators and special characters
  let sanitized = filename
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/^\.+/, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>:"|?*]/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Invalid filename');
  }
  
  return sanitized;
}

/**
 * Sanitize SQL input (though Prisma should handle this, use as extra layer)
 * @param input - Untrusted string
 * @returns Sanitized string
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove SQL special characters and keywords
  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b/gi, '');
}

/**
 * Sanitize shell command arguments to prevent command injection
 * @param input - User-provided command argument
 * @returns Sanitized argument
 */
export function sanitizeShellArg(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Shell argument must be a string');
  }
  
  // Remove shell metacharacters
  const dangerous = /[;&|`$()<>'"\\!{}[\]*?~]/g;
  if (dangerous.test(input)) {
    throw new Error('Shell metacharacters not allowed');
  }
  
  return input;
}

/**
 * Validate and sanitize URL to prevent SSRF and open redirect
 * @param input - User-provided URL
 * @param allowedProtocols - Allowed URL protocols (default: ['http:', 'https:'])
 * @param allowedHosts - Optional whitelist of allowed hosts
 * @returns Sanitized URL object or throws error
 */
export function sanitizeUrl(
  input: string, 
  allowedProtocols: string[] = ['http:', 'https:'],
  allowedHosts?: string[]
): URL {
  if (typeof input !== 'string') {
    throw new Error('URL must be a string');
  }
  
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid URL format');
  }
  
  // Check protocol
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`Protocol ${url.protocol} not allowed`);
  }
  
  // Block internal/private IP addresses (SSRF prevention)
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '[::]',
    '[::1]',
    '169.254.169.254', // AWS metadata endpoint
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.'
  ];
  
  const hostname = url.hostname.toLowerCase();
  for (const blocked of blockedHosts) {
    if (hostname === blocked || hostname.startsWith(blocked)) {
      throw new Error('Private/internal IP addresses not allowed');
    }
  }
  
  // Check against whitelist if provided
  if (allowedHosts && allowedHosts.length > 0) {
    const isAllowed = allowedHosts.some(allowed => 
      hostname === allowed.toLowerCase() || 
      hostname.endsWith('.' + allowed.toLowerCase())
    );
    
    if (!isAllowed) {
      throw new Error('Host not in allowlist');
    }
  }
  
  return url;
}

/**
 * Sanitize object keys and values recursively
 * @param obj - Object to sanitize
 * @param maxDepth - Maximum recursion depth
 * @returns Sanitized object
 */
export function sanitizeObject(obj: any, maxDepth: number = 10): any {
  if (maxDepth <= 0) {
    return '[Max depth reached]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeText(key);
      sanitized[sanitizedKey] = sanitizeObject(value, maxDepth - 1);
    }
    return sanitized;
  }
  
  return String(obj);
}

/**
 * Validate and sanitize email address
 * @param email - User-provided email
 * @returns Sanitized email or throws error
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email regex validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }
  
  // Check for suspicious patterns
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    throw new Error('Invalid email format');
  }
  
  return trimmed;
}

/**
 * Sanitize numeric input
 * @param input - User-provided number
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Validated number or throws error
 */
export function sanitizeNumber(input: any, min?: number, max?: number): number {
  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid number');
  }
  
  if (min !== undefined && num < min) {
    throw new Error(`Number must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    throw new Error(`Number must be at most ${max}`);
  }
  
  return num;
}

/**
 * Sanitize boolean input
 * @param input - User-provided value
 * @returns Boolean value
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
  }
  
  if (typeof input === 'number') {
    return input !== 0;
  }
  
  return Boolean(input);
}

/**
 * Create a sanitization middleware for Express
 * @param fields - Fields to sanitize in req.body, req.query, req.params
 * @returns Express middleware function
 */
export function createSanitizationMiddleware(fields?: {
  body?: string[];
  query?: string[];
  params?: string[];
}) {
  return (req: any, res: any, next: any) => {
    try {
      // Sanitize body fields
      if (fields?.body && req.body) {
        fields.body.forEach(field => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = sanitizeText(req.body[field]);
          }
        });
      }
      
      // Sanitize query fields
      if (fields?.query && req.query) {
        fields.query.forEach(field => {
          if (req.query[field] && typeof req.query[field] === 'string') {
            req.query[field] = sanitizeText(req.query[field]);
          }
        });
      }
      
      // Sanitize param fields
      if (fields?.params && req.params) {
        fields.params.forEach(field => {
          if (req.params[field] && typeof req.params[field] === 'string') {
            req.params[field] = sanitizeText(req.params[field]);
          }
        });
      }
      
      next();
    } catch (error) {
      res.status(400).json({ 
        error: 'Invalid input', 
        message: error instanceof Error ? error.message : 'Input sanitization failed' 
      });
    }
  };
}

