/**
 * Secure Input Sanitizer
 * Комплексная санитизация всех типов пользовательского ввода
 *
 * SECURITY: CWE-20 - Improper Input Validation
 * SECURITY: CWE-79 - XSS Prevention
 * SECURITY: CWE-89 - SQL Injection Prevention
 * SECURITY: CWE-78 - Command Injection Prevention
 */

import { logger } from './logger';
import { validateEmail } from './validator';

/**
 * HTML Encoding для предотвращения XSS
 */
export function encodeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, char => htmlEntities[char] || char);
}

/**
 * SQL Sanitizer - экранирование для SQL запросов
 * ПРИМЕЧАНИЕ: Всегда используйте prepared statements!
 * Это только дополнительный слой защиты
 */
export function sanitizeSql(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Удаляем опасные SQL символы и ключевые слова
  return input
    .replace(/['";\\]/g, '') // Удаляем кавычки и экранирование
    .replace(/--/g, '') // Удаляем SQL комментарии
    .replace(/\/\*/g, '') // Удаляем многострочные комментарии
    .replace(/\*\//g, '')
    .replace(/\bxp_\w+/gi, '') // Удаляем расширенные процедуры
    .replace(/\bsp_\w+/gi, '') // Удаляем системные процедуры
    .trim();
}

/**
 * Command Sanitizer - для безопасного использования в shell командах
 */
export function sanitizeCommand(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // SECURITY: Разрешаем только буквы, цифры, дефис и подчеркивание
  return input.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Path Sanitizer - предотвращает path traversal
 */
export function sanitizePath(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // SECURITY: CWE-22 - Path Traversal Prevention
  return input
    .replace(/\.\./g, '') // Удаляем ..
    .replace(/[<>:"|?*]/g, '') // Удаляем недопустимые символы для путей
    .replace(/^[\/\\]+/, '') // Удаляем начальные слеши
    .trim();
}

/**
 * URL Sanitizer и валидатор
 */
export function sanitizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  try {
    const url = new URL(input);

    // SECURITY: Разрешаем только HTTP и HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      logger.warn('Invalid URL protocol', { protocol: url.protocol });
      return null;
    }

    // SECURITY: Проверяем на SSRF атаки (82.147.84.78, private IPs)
    const hostname = url.hostname.toLowerCase();
    const privateRanges = [
      '82.147.84.78',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];

    if (privateRanges.some(range => hostname.includes(range))) {
      logger.warn('URL points to private network', { hostname });
      return null;
    }

    // Проверяем на private IP ranges
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)) {
      logger.warn('URL points to private IP range', { hostname });
      return null;
    }

    return url.toString();
  } catch (error) {
    logger.warn('Invalid URL format', { input: input.substring(0, 100) });
    return null;
  }
}

/**
 * Sanitizer для JSON input
 */
export function sanitizeJson(input: string): any | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  try {
    // SECURITY: Ограничиваем размер JSON
    if (input.length > 1024 * 1024) { // 1MB max
      logger.warn('JSON input too large', { size: input.length });
      return null;
    }

    const parsed = JSON.parse(input);

    // SECURITY: Проверяем глубину вложенности (защита от DoS)
    const maxDepth = 10;
    function checkDepth(obj: any, depth = 0): boolean {
      if (depth > maxDepth) {
        return false;
      }

      if (obj && typeof obj === 'object') {
        for (const value of Object.values(obj)) {
          if (!checkDepth(value, depth + 1)) {
            return false;
          }
        }
      }

      return true;
    }

    if (!checkDepth(parsed)) {
      logger.warn('JSON nesting too deep', { maxDepth });
      return null;
    }

    return parsed;
  } catch (error) {
    logger.warn('Invalid JSON input', { error });
    return null;
  }
}

/**
 * Integer validator с пределами
 */
export function validateInteger(
  input: any,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = parseInt(String(input), 10);

  if (isNaN(num)) {
    return null;
  }

  if (num < min || num > max) {
    logger.warn('Integer out of range', { value: num, min, max });
    return null;
  }

  return num;
}

/**
 * String length validator
 */
export function validateStringLength(
  input: string,
  minLength: number = 0,
  maxLength: number = 10000
): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const length = input.length;

  if (length < minLength || length > maxLength) {
    logger.debug('String length validation failed', {
      length,
      minLength,
      maxLength,
    });
    return false;
  }

  return true;
}

/**
 * Sanitizer для телефонных номеров
 */
export function sanitizePhone(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Оставляем только цифры и +
  return input.replace(/[^0-9+]/g, '');
}

/**
 * Sanitizer для username
 */
export function sanitizeUsername(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Только буквы, цифры, дефис, подчеркивание
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 50); // Ограничиваем длину
}

/**
 * Validator для UUID
 */
export function validateUuid(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

/**
 * Комплексный sanitizer для объектов
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  schema: Record<keyof T, 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid'>
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, type] of Object.entries(schema)) {
    const value = obj[key as keyof T];

    if (value === undefined || value === null) {
      continue;
    }

    switch (type) {
      case 'string':
        sanitized[key as keyof T] = encodeHtml(String(value)) as any;
        break;

      case 'number':
        const num = validateInteger(value);
        if (num !== null) {
          sanitized[key as keyof T] = num as any;
        }
        break;

      case 'boolean':
        sanitized[key as keyof T] = Boolean(value) as any;
        break;

      case 'email':
        const email = String(value).toLowerCase().trim();
        if (validateEmail(email)) {
          sanitized[key as keyof T] = email as any;
        }
        break;

      case 'url':
        const url = sanitizeUrl(String(value));
        if (url) {
          sanitized[key as keyof T] = url as any;
        }
        break;

      case 'uuid':
        const uuid = String(value);
        if (validateUuid(uuid)) {
          sanitized[key as keyof T] = uuid as any;
        }
        break;
    }
  }

  return sanitized;
}

/**
 * Validator для Telegram Bot Token
 */
export function validateTelegramBotToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Формат Telegram bot token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
  const botTokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35,}$/;

  return botTokenRegex.test(token);
}

/**
 * Экспорт всех санитайзеров и валидаторов
 */
export const SecureSanitizers = {
  encodeHtml,
  sanitizeSql,
  sanitizeCommand,
  sanitizePath,
  sanitizeUrl,
  sanitizeJson,
  sanitizePhone,
  sanitizeUsername,
  sanitizeObject,
  validateInteger,
  validateStringLength,
  validateEmail: (email: string) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  },
  validateUuid,
  validateTelegramBotToken,
};

export default SecureSanitizers;

