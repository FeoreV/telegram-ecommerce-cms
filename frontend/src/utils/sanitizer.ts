/**
 * Frontend Sanitization Utilities
 * SECURITY: Prevents XSS attacks (CWE-79)
 * Using DOMPurify for production-grade protection
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS with DOMPurify
 * For use with dangerouslySetInnerHTML
 *
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Strip all HTML tags
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    console.warn('Blocked potentially dangerous URL:', sanitizeForLog(url));
    return '#';
  }

  return url;
}

/**
 * SECURITY FIX: CWE-117 - Sanitize string for logging to prevent log injection
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
 * Validate and sanitize external URLs
 */
export function sanitizeExternalUrl(url: string, allowedDomains?: string[]): string {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('Invalid protocol:', sanitizeForLog(parsed.protocol));
      return '#';
    }

    // Check against allowed domains if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        console.warn('Domain not in allowlist:', sanitizeForLog(parsed.hostname));
        return '#';
      }
    }

    return url;
  } catch (error) {
    console.warn('Invalid URL:', sanitizeForLog(url));
    return '#';
  }
}

/**
 * Sanitize CSS class names
 */
export function sanitizeClassName(className: string): string {
  // Only allow alphanumeric, dash, underscore
  return className.replace(/[^a-zA-Z0-9-_\s]/g, '');
}

/**
 * Sanitize user input for display
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return '';

  return escapeHtml(input.trim());
}

/**
 * Safe component for rendering user-generated content
 * Usage: <SafeHtml html={userContent} />
 */
export function createSafeHtml(html: string): { __html: string } {
  return {
    __html: sanitizeHtml(html)
  };
}

/**
 * Validate email format (client-side check only)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize filename for display
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and special characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\.\./g, '')
    .trim();
}

