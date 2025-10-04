/**
 * Runtime Security Validator Middleware
 * Проверяет входящие запросы на потенциальные атаки в реальном времени
 *
 * SECURITY: CWE-20 - Improper Input Validation
 * SECURITY: CWE-89 - SQL Injection Prevention
 * SECURITY: CWE-79 - XSS Prevention
 * SECURITY: CWE-78 - OS Command Injection Prevention
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  field: string;
  value: string;
  pattern: string;
}

/**
 * Опасные паттерны для обнаружения атак
 */
const ATTACK_PATTERNS = {
  // SQL Injection patterns
  sqlInjection: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/gi,
    /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
    /(\'\s*OR\s*\'1\'\s*=\s*\'1)/gi,
  ],

  // XSS patterns
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
  ],

  // Command Injection patterns
  commandInjection: [
    /[;&|`$()]/g,
    /\.\.\//g,
    /(bash|sh|cmd|powershell|exec|eval)/gi,
  ],

  // Path Traversal patterns
  pathTraversal: [
    /\.\.[\/\\]/g,
    /(\/etc\/passwd|\/etc\/shadow)/gi,
    /[\/\\](windows|winnt|system32)/gi,
  ],

  // NoSQL Injection patterns
  noSqlInjection: [
    /\$where/gi,
    /\$regex/gi,
    /\{\s*\$\w+/g,
  ],

  // LDAP Injection patterns
  ldapInjection: [
    /[*()\\]/g,
  ],
};

/**
 * Опасные заголовки, которые могут указывать на атаку
 */
const SUSPICIOUS_HEADERS = [
  'x-forwarded-host',
  'x-original-url',
  'x-rewrite-url',
];

/**
 * Проверка значения на опасные паттерны
 */
function checkForAttackPatterns(value: any, fieldName: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  // Конвертируем значение в строку для проверки
  const stringValue = String(value);

  // Проверка SQL Injection
  for (const pattern of ATTACK_PATTERNS.sqlInjection) {
    if (pattern.test(stringValue)) {
      violations.push({
        type: 'SQL_INJECTION',
        severity: 'critical',
        field: fieldName,
        value: stringValue.substring(0, 100), // Только первые 100 символов в лог
        pattern: pattern.source,
      });
    }
  }

  // Проверка XSS
  for (const pattern of ATTACK_PATTERNS.xss) {
    if (pattern.test(stringValue)) {
      violations.push({
        type: 'XSS',
        severity: 'high',
        field: fieldName,
        value: stringValue.substring(0, 100),
        pattern: pattern.source,
      });
    }
  }

  // Проверка Command Injection
  for (const pattern of ATTACK_PATTERNS.commandInjection) {
    if (pattern.test(stringValue)) {
      violations.push({
        type: 'COMMAND_INJECTION',
        severity: 'critical',
        field: fieldName,
        value: stringValue.substring(0, 100),
        pattern: pattern.source,
      });
    }
  }

  // Проверка Path Traversal
  for (const pattern of ATTACK_PATTERNS.pathTraversal) {
    if (pattern.test(stringValue)) {
      violations.push({
        type: 'PATH_TRAVERSAL',
        severity: 'high',
        field: fieldName,
        value: stringValue.substring(0, 100),
        pattern: pattern.source,
      });
    }
  }

  return violations;
}

/**
 * Рекурсивная проверка объекта на атаки
 */
function scanObject(obj: any, path: string = ''): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  if (!obj || typeof obj !== 'object') {
    return violations;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) {
      continue;
    }

    // Проверяем примитивные значения
    if (typeof value === 'string' || typeof value === 'number') {
      violations.push(...checkForAttackPatterns(value, currentPath));
    }

    // Рекурсивно проверяем вложенные объекты
    if (typeof value === 'object' && !Array.isArray(value)) {
      violations.push(...scanObject(value, currentPath));
    }

    // Проверяем массивы
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' || typeof item === 'number') {
          violations.push(...checkForAttackPatterns(item, `${currentPath}[${index}]`));
        } else if (typeof item === 'object') {
          violations.push(...scanObject(item, `${currentPath}[${index}]`));
        }
      });
    }
  }

  return violations;
}

/**
 * Middleware для runtime security validation
 */
export const runtimeSecurityValidator = (options: {
  blockOnViolation?: boolean;
  logViolations?: boolean;
  excludePaths?: RegExp[];
} = {}) => {
  const {
    blockOnViolation = true,
    logViolations = true,
    excludePaths = [/^\/health/, /^\/metrics/],
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Проверяем, не исключен ли этот путь
      const isExcluded = excludePaths.some(pattern => pattern.test(req.path));
      if (isExcluded) {
        return next();
      }

      const violations: SecurityViolation[] = [];

      // 1. Проверка Query Parameters
      if (req.query && Object.keys(req.query).length > 0) {
        violations.push(...scanObject(req.query, 'query'));
      }

      // 2. Проверка Request Body
      if (req.body && Object.keys(req.body).length > 0) {
        violations.push(...scanObject(req.body, 'body'));
      }

      // 3. Проверка Path Parameters
      if (req.params && Object.keys(req.params).length > 0) {
        violations.push(...scanObject(req.params, 'params'));
      }

      // 4. Проверка подозрительных заголовков
      for (const suspiciousHeader of SUSPICIOUS_HEADERS) {
        if (req.headers[suspiciousHeader]) {
          violations.push({
            type: 'SUSPICIOUS_HEADER',
            severity: 'medium',
            field: `headers.${suspiciousHeader}`,
            value: String(req.headers[suspiciousHeader]).substring(0, 100),
            pattern: 'suspicious_header',
          });
        }
      }

      // 5. Проверка размера request body (защита от DoS)
      const contentLength = req.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
        violations.push({
          type: 'LARGE_PAYLOAD',
          severity: 'medium',
          field: 'content-length',
          value: contentLength,
          pattern: 'size_limit_exceeded',
        });
      }

      // Обработка нарушений
      if (violations.length > 0) {
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        const highViolations = violations.filter(v => v.severity === 'high');

        // Логирование
        if (logViolations) {
          logger.warn('Security violations detected', {
            ip: req.ip,
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            violations: violations.map(v => ({
              type: v.type,
              severity: v.severity,
              field: v.field,
            })),
            total: violations.length,
            critical: criticalViolations.length,
            high: highViolations.length,
          });
        }

        // Блокировка при критических нарушениях
        if (blockOnViolation && (criticalViolations.length > 0 || highViolations.length > 0)) {
          logger.error('Request blocked due to security violations', {
            ip: req.ip,
            path: req.path,
            violationTypes: [...new Set(violations.map(v => v.type))],
          });

          return res.status(400).json({
            error: 'Invalid request detected',
            code: 'SECURITY_VIOLATION',
            message: 'Your request contains potentially malicious content',
            // Не раскрываем детали атаки злоумышленнику
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Runtime security validator error', { error });
      // В случае ошибки валидатора - пропускаем запрос (fail-open)
      // Это предотвращает DoS через сбой валидатора
      next();
    }
  };
};

/**
 * Sanitizer для строк - удаляет опасные символы
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Удаляем < и >
    .replace(/['"`;]/g, '') // Удаляем кавычки и точку с запятой
    .replace(/\\/g, '') // Удаляем обратные слеши
    .trim();
}

/**
 * Валидатор для database identifiers (имена таблиц, колонок)
 */
export function validateDatabaseIdentifier(identifier: string): boolean {
  // Только буквы, цифры и подчеркивания
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * Валидатор для путей файлов
 */
export function validateFilePath(filePath: string): boolean {
  // SECURITY: CWE-22 - Path Traversal Prevention
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Запрещаем path traversal
  if (filePath.includes('..')) {
    return false;
  }

  // Запрещаем абсолютные пути
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
    return false;
  }

  // Запрещаем специальные символы
  if (/[<>:"|?*]/.test(filePath)) {
    return false;
  }

  return true;
}

/**
 * Валидатор для email адресов
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 simplified
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Экспорт всех валидаторов
 */
export const SecurityValidators = {
  sanitizeString,
  validateDatabaseIdentifier,
  validateFilePath,
  validateEmail,
};

