import { NextFunction, Request, Response } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export interface ValidationConfig {
  enableSanitization: boolean;
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
  allowedFileTypes: string[];
  maxFileSize: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  threats?: string[];
}

export class InputValidationService {
  private static instance: InputValidationService;
  private config: ValidationConfig;
  private suspiciousPatterns!: RegExp[];
  private sqlInjectionPatterns!: RegExp[];
  private xssPatterns!: RegExp[];

  private constructor() {
    this.config = {
      enableSanitization: process.env.ENABLE_INPUT_SANITIZATION !== 'false',
      enableXSSProtection: process.env.ENABLE_XSS_PROTECTION !== 'false',
      enableSQLInjectionProtection: process.env.ENABLE_SQLI_PROTECTION !== 'false',
      maxStringLength: parseInt(process.env.MAX_STRING_LENGTH || '10000'),
      maxArrayLength: parseInt(process.env.MAX_ARRAY_LENGTH || '1000'),
      maxObjectDepth: parseInt(process.env.MAX_OBJECT_DEPTH || '10'),
      allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,pdf,doc,docx').split(','),
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB
    };

    this.initializeSecurityPatterns();
  }

  public static getInstance(): InputValidationService {
    if (!InputValidationService.instance) {
      InputValidationService.instance = new InputValidationService();
    }
    return InputValidationService.instance;
  }

  private initializeSecurityPatterns(): void {
    // SQL Injection patterns
    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|(--)|#/gi,
      /(\b(OR|AND)\b.*[=<>].*[\d'"]+)|(\b(OR|AND)\b.*[=<>].*\b(TRUE|FALSE)\b)/gi,
      /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/gi,
      /(\bwaitfor\b.*\bdelay\b)|(\bwaitfor\b.*\btime\b)/gi,
      /(\bxp_cmdshell\b)|(\bsp_executesql\b)|(\bexec\b.*\bmaster\b)/gi
    ];

    // XSS patterns
    this.xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi
    ];

    // General suspicious patterns
    this.suspiciousPatterns = [
      /\.\.\//g, // Directory traversal
      /\0/g, // Null bytes
      /%00/g, // URL encoded null bytes
      /%2e%2e%2f/gi, // URL encoded directory traversal
      /\$\{.*\}/g, // Template injection
      /<%.*%>/g, // Server-side includes
      /\{\{.*\}\}/g, // Template expressions
      /__proto__|constructor|prototype/gi, // Prototype pollution
      /eval\s*\(|Function\s*\(/gi, // Code evaluation
      /document\.|window\.|location\./gi // DOM manipulation attempts
    ];
  }

  /**
   * Comprehensive input validation and sanitization
   */
  validateInput(data: any, schema?: ZodSchema): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      threats: []
    };

    try {
      // Deep clone to avoid mutating original data
      let processedData = this.deepClone(data);

      // Check object depth and size limits
      if (!this.checkStructuralLimits(processedData, result)) {
        return result;
      }

      // Detect security threats
      this.detectThreats(processedData, result);

      // Sanitize data if enabled
      if (this.config.enableSanitization) {
        processedData = this.sanitizeData(processedData);
      }

      // Validate against schema if provided
      if (schema) {
        try {
          processedData = schema.parse(processedData);
        } catch (error) {
          if (error instanceof ZodError) {
            result.isValid = false;
            result.errors = (error as any).errors.map((err: any) => `${err.path.join('.')}: ${err.message}`);
          } else {
            result.isValid = false;
            result.errors.push('Schema validation failed');
          }
        }
      }

      result.sanitizedData = processedData;

      // Log threats if detected
      if (result.threats && result.threats.length > 0) {
        logger.warn('Security threats detected in input', {
          threats: result.threats,
          dataType: typeof data,
          hasSchema: !!schema
        });
      }

      return result;

    } catch (error) {
      logger.error('Input validation error:', error);
      result.isValid = false;
      result.errors.push('Validation process failed');
      return result;
    }
  }

  /**
   * Check structural limits (depth, array size, string length)
   */
  private checkStructuralLimits(data: any, result: ValidationResult, depth: number = 0): boolean {
    if (depth > this.config.maxObjectDepth) {
      result.isValid = false;
      result.errors.push(`Object depth exceeds maximum of ${this.config.maxObjectDepth}`);
      result.threats?.push('excessive_nesting');
      return false;
    }

    if (typeof data === 'string') {
      if (data.length > this.config.maxStringLength) {
        result.isValid = false;
        result.errors.push(`String length exceeds maximum of ${this.config.maxStringLength}`);
        result.threats?.push('oversized_string');
        return false;
      }
    } else if (Array.isArray(data)) {
      if (data.length > this.config.maxArrayLength) {
        result.isValid = false;
        result.errors.push(`Array length exceeds maximum of ${this.config.maxArrayLength}`);
        result.threats?.push('oversized_array');
        return false;
      }

      // Recursively check array elements
      for (const item of data) {
        if (!this.checkStructuralLimits(item, result, depth + 1)) {
          return false;
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      // Recursively check object properties
      for (const value of Object.values(data)) {
        if (!this.checkStructuralLimits(value, result, depth + 1)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Detect security threats in data
   * SECURITY: Implements ReDoS protection (CWE-1333, CWE-400)
   */
  private detectThreats(data: any, result: ValidationResult): void {
    this.traverseData(data, (value: string) => {
      if (typeof value !== 'string') return;

      // SECURITY: ReDoS Protection - Limit string length before regex operations (CWE-1333)
      // Maximum 10KB to prevent Regular Expression Denial of Service attacks
      const MAX_REGEX_INPUT_LENGTH = 10 * 1024; // 10KB

      if (value.length > MAX_REGEX_INPUT_LENGTH) {
        logger.warn('String too long for regex validation, rejecting', {
          length: value.length,
          maxLength: MAX_REGEX_INPUT_LENGTH,
          truncated: value.substring(0, 100) + '...'
        });
        result.threats?.push('oversized_input_redos_risk');
        result.isValid = false;
        result.errors.push(`Input too large for safe regex validation (max ${MAX_REGEX_INPUT_LENGTH} bytes)`);
        return; // Skip regex checks for oversized input
      }

      // Check SQL injection patterns
      if (this.config.enableSQLInjectionProtection) {
        for (const pattern of this.sqlInjectionPatterns) {
          if (pattern.test(value)) {
            result.threats?.push('sql_injection');
            result.isValid = false;
            result.errors.push('Potential SQL injection detected');
            break;
          }
        }
      }

      // Check XSS patterns
      if (this.config.enableXSSProtection) {
        for (const pattern of this.xssPatterns) {
          if (pattern.test(value)) {
            result.threats?.push('xss_attempt');
            result.isValid = false;
            result.errors.push('Potential XSS attack detected');
            break;
          }
        }
      }

      // Check suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(value)) {
          result.threats?.push('suspicious_pattern');
          result.isValid = false;
          result.errors.push('Suspicious pattern detected');
          break;
        }
      }
    });
  }

  /**
   * Sanitize data recursively
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    } else if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    } else if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeData(value);
      }
      return sanitized;
    }
    return data;
  }

  /**
   * Sanitize individual string
   * CRITICAL: Order is normalization → removal → escaping (CWE-176, CWE-79)
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    let sanitized = str;

    // PHASE 1: NORMALIZATION - Must happen FIRST
    // Normalize Unicode to prevent bypass attacks with lookalike characters
    sanitized = sanitized.normalize('NFKC');

    // PHASE 2: REMOVAL - After normalization
    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    // Use DOMPurify for XSS content removal
    if (this.config.enableXSSProtection) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
      });
    }

    // PHASE 3: ESCAPING - Must happen LAST
    // HTML encode dangerous characters after removal
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  /**
   * Traverse data structure and apply callback to strings
   */
  private traverseData(data: any, callback: (value: string) => void): void {
    if (typeof data === 'string') {
      callback(data);
    } else if (Array.isArray(data)) {
      data.forEach(item => this.traverseData(item, callback));
    } else if (typeof data === 'object' && data !== null) {
      Object.values(data).forEach(value => this.traverseData(value, callback));
    }
  }

  /**
   * Deep clone object
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));

    const cloned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Validate specific data types
   */
  validateEmail(email: string): boolean {
    return validator.isEmail(email) && !this.containsThreats(email);
  }

  validateURL(url: string): boolean {
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    }) && !this.containsThreats(url);
  }

  validatePhoneNumber(phone: string): boolean {
    return validator.isMobilePhone(phone, 'any') && !this.containsThreats(phone);
  }

  validateUUID(uuid: string): boolean {
    return validator.isUUID(uuid) && !this.containsThreats(uuid);
  }

  validateCreditCard(card: string): boolean {
    return validator.isCreditCard(card.replace(/\s/g, ''));
  }

  validateIPAddress(ip: string): boolean {
    return validator.isIP(ip) && !this.containsThreats(ip);
  }

  /**
   * Check if string contains security threats
   * SECURITY: Implements ReDoS protection (CWE-1333)
   */
  private containsThreats(str: string): boolean {
    if (typeof str !== 'string') return false;

    // SECURITY: ReDoS Protection - Limit string length before regex operations
    const MAX_REGEX_INPUT_LENGTH = 10 * 1024; // 10KB
    if (str.length > MAX_REGEX_INPUT_LENGTH) {
      logger.warn('String too long for threat detection regex', {
        length: str.length,
        maxLength: MAX_REGEX_INPUT_LENGTH
      });
      return true; // Treat oversized input as threat
    }

    // Check all threat patterns
    const allPatterns = [
      ...this.sqlInjectionPatterns,
      ...this.xssPatterns,
      ...this.suspiciousPatterns
    ];

    return allPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Get validation configuration
   */
  getConfiguration(): ValidationConfig {
    return { ...this.config };
  }
}

// Singleton instance
const inputValidationService = InputValidationService.getInstance();

/**
 * Middleware factory for input validation
 */
export const validateInput = (schema?: ZodSchema, _options: Partial<ValidationConfig> = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Combine request data
      const inputData = {
        ...req.body,
        ...req.query,
        ...req.params
      };

      // Validate input
      const result = inputValidationService.validateInput(inputData, schema);

      if (!result.isValid) {
        logger.warn('Input validation failed', {
          path: req.path,
          method: req.method,
          errors: result.errors,
          threats: result.threats,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains invalid or potentially malicious data',
          details: result.errors,
          timestamp: new Date().toISOString()
        });
      }

      // Replace request data with sanitized version
      if (result.sanitizedData) {
        // Separate sanitized data back into body, query, params
        const sanitizedBody: any = {};
        const sanitizedQuery: any = {};
        const sanitizedParams: any = {};

        Object.keys(result.sanitizedData).forEach(key => {
          if (req.body && key in req.body) {
            sanitizedBody[key] = result.sanitizedData[key];
          }
          if (req.query && key in req.query) {
            sanitizedQuery[key] = result.sanitizedData[key];
          }
          if (req.params && key in req.params) {
            sanitizedParams[key] = result.sanitizedData[key];
          }
        });

        req.body = { ...req.body, ...sanitizedBody };
        req.query = { ...req.query, ...sanitizedQuery };
        req.params = { ...req.params, ...sanitizedParams };
      }

      // Log threats for monitoring
      if (result.threats && result.threats.length > 0) {
        logger.security('Security threats detected but handled', {
          path: req.path,
          method: req.method,
          threats: result.threats,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }

      next();

    } catch (error) {
      logger.error('Input validation middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Input validation service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Strict validation middleware for sensitive endpoints
 */
export const strictValidation = (schema: ZodSchema) => {
  return validateInput(schema, {
    enableSanitization: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    maxStringLength: 1000,
    maxArrayLength: 100,
    maxObjectDepth: 5
  });
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (allowedTypes?: string[], maxSize?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];
      const config = inputValidationService.getConfiguration();

      for (const file of files) {
        if (!file) continue;

        // Check if file is array (skip arrays)
        if (Array.isArray(file)) continue;

        // Check file size
        const sizeLimit = maxSize || config.maxFileSize;
        if ((file as any).size > sizeLimit) {
          return res.status(400).json({
            error: 'File too large',
            message: `File size exceeds maximum of ${sizeLimit} bytes`,
            timestamp: new Date().toISOString()
          });
        }

        // Check file type
        const allowedFileTypes = allowedTypes || config.allowedFileTypes;
        const fileExtension = (file as any).originalname.split('.').pop()?.toLowerCase();

        if (!fileExtension || !allowedFileTypes.includes(fileExtension)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: `File type not allowed. Allowed types: ${allowedFileTypes.join(', ')}`,
            timestamp: new Date().toISOString()
          });
        }

        // Check filename for suspicious patterns
        if (inputValidationService['containsThreats']((file as any).originalname)) {
          return res.status(400).json({
            error: 'Invalid filename',
            message: 'Filename contains potentially malicious content',
            timestamp: new Date().toISOString()
          });
        }
      }

      next();

    } catch (error) {
      logger.error('File upload validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'File validation service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  };
};

export { inputValidationService };
