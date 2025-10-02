"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inputValidationService = exports.validateFileUpload = exports.strictValidation = exports.validateInput = exports.InputValidationService = void 0;
const zod_1 = require("zod");
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const validator_1 = __importDefault(require("validator"));
const logger_1 = require("../utils/logger");
class InputValidationService {
    constructor() {
        this.config = {
            enableSanitization: process.env.ENABLE_INPUT_SANITIZATION !== 'false',
            enableXSSProtection: process.env.ENABLE_XSS_PROTECTION !== 'false',
            enableSQLInjectionProtection: process.env.ENABLE_SQLI_PROTECTION !== 'false',
            maxStringLength: parseInt(process.env.MAX_STRING_LENGTH || '10000'),
            maxArrayLength: parseInt(process.env.MAX_ARRAY_LENGTH || '1000'),
            maxObjectDepth: parseInt(process.env.MAX_OBJECT_DEPTH || '10'),
            allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,pdf,doc,docx').split(','),
            maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760')
        };
        this.initializeSecurityPatterns();
    }
    static getInstance() {
        if (!InputValidationService.instance) {
            InputValidationService.instance = new InputValidationService();
        }
        return InputValidationService.instance;
    }
    initializeSecurityPatterns() {
        this.sqlInjectionPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|(--)|#/gi,
            /(\b(OR|AND)\b.*[=<>].*[\d'"]+)|(\b(OR|AND)\b.*[=<>].*\b(TRUE|FALSE)\b)/gi,
            /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/gi,
            /(\bwaitfor\b.*\bdelay\b)|(\bwaitfor\b.*\btime\b)/gi,
            /(\bxp_cmdshell\b)|(\bsp_executesql\b)|(\bexec\b.*\bmaster\b)/gi
        ];
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
        this.suspiciousPatterns = [
            /\.\.\//g,
            /\0/g,
            /%00/g,
            /%2e%2e%2f/gi,
            /\$\{.*\}/g,
            /<%.*%>/g,
            /\{\{.*\}\}/g,
            /__proto__|constructor|prototype/gi,
            /eval\s*\(|Function\s*\(/gi,
            /document\.|window\.|location\./gi
        ];
    }
    validateInput(data, schema) {
        const result = {
            isValid: true,
            errors: [],
            threats: []
        };
        try {
            let processedData = this.deepClone(data);
            if (!this.checkStructuralLimits(processedData, result)) {
                return result;
            }
            this.detectThreats(processedData, result);
            if (this.config.enableSanitization) {
                processedData = this.sanitizeData(processedData);
            }
            if (schema) {
                try {
                    processedData = schema.parse(processedData);
                }
                catch (error) {
                    if (error instanceof zod_1.ZodError) {
                        result.isValid = false;
                        result.errors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
                    }
                    else {
                        result.isValid = false;
                        result.errors.push('Schema validation failed');
                    }
                }
            }
            result.sanitizedData = processedData;
            if (result.threats && result.threats.length > 0) {
                logger_1.logger.warn('Security threats detected in input', {
                    threats: result.threats,
                    dataType: typeof data,
                    hasSchema: !!schema
                });
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Input validation error:', error);
            result.isValid = false;
            result.errors.push('Validation process failed');
            return result;
        }
    }
    checkStructuralLimits(data, result, depth = 0) {
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
        }
        else if (Array.isArray(data)) {
            if (data.length > this.config.maxArrayLength) {
                result.isValid = false;
                result.errors.push(`Array length exceeds maximum of ${this.config.maxArrayLength}`);
                result.threats?.push('oversized_array');
                return false;
            }
            for (const item of data) {
                if (!this.checkStructuralLimits(item, result, depth + 1)) {
                    return false;
                }
            }
        }
        else if (typeof data === 'object' && data !== null) {
            for (const value of Object.values(data)) {
                if (!this.checkStructuralLimits(value, result, depth + 1)) {
                    return false;
                }
            }
        }
        return true;
    }
    detectThreats(data, result) {
        this.traverseData(data, (value) => {
            if (typeof value !== 'string')
                return;
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
    sanitizeData(data) {
        if (typeof data === 'string') {
            return this.sanitizeString(data);
        }
        else if (Array.isArray(data)) {
            return data.map(item => this.sanitizeData(item));
        }
        else if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                sanitized[this.sanitizeString(key)] = this.sanitizeData(value);
            }
            return sanitized;
        }
        return data;
    }
    sanitizeString(str) {
        if (typeof str !== 'string')
            return str;
        let sanitized = str;
        sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
        sanitized = sanitized.normalize('NFKC');
        sanitized = validator_1.default.escape(sanitized);
        if (this.config.enableXSSProtection) {
            sanitized = isomorphic_dompurify_1.default.sanitize(sanitized, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
                KEEP_CONTENT: true
            });
        }
        return sanitized;
    }
    traverseData(data, callback) {
        if (typeof data === 'string') {
            callback(data);
        }
        else if (Array.isArray(data)) {
            data.forEach(item => this.traverseData(item, callback));
        }
        else if (typeof data === 'object' && data !== null) {
            Object.values(data).forEach(value => this.traverseData(value, callback));
        }
    }
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object')
            return obj;
        if (obj instanceof Date)
            return new Date(obj.getTime());
        if (obj instanceof Array)
            return obj.map(item => this.deepClone(item));
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }
    validateEmail(email) {
        return validator_1.default.isEmail(email) && !this.containsThreats(email);
    }
    validateURL(url) {
        return validator_1.default.isURL(url, {
            protocols: ['http', 'https'],
            require_protocol: true,
            require_valid_protocol: true,
            allow_underscores: false,
            allow_trailing_dot: false,
            allow_protocol_relative_urls: false
        }) && !this.containsThreats(url);
    }
    validatePhoneNumber(phone) {
        return validator_1.default.isMobilePhone(phone, 'any') && !this.containsThreats(phone);
    }
    validateUUID(uuid) {
        return validator_1.default.isUUID(uuid) && !this.containsThreats(uuid);
    }
    validateCreditCard(card) {
        return validator_1.default.isCreditCard(card.replace(/\s/g, ''));
    }
    validateIPAddress(ip) {
        return validator_1.default.isIP(ip) && !this.containsThreats(ip);
    }
    containsThreats(str) {
        if (typeof str !== 'string')
            return false;
        const allPatterns = [
            ...this.sqlInjectionPatterns,
            ...this.xssPatterns,
            ...this.suspiciousPatterns
        ];
        return allPatterns.some(pattern => pattern.test(str));
    }
    getConfiguration() {
        return { ...this.config };
    }
}
exports.InputValidationService = InputValidationService;
const inputValidationService = InputValidationService.getInstance();
exports.inputValidationService = inputValidationService;
const validateInput = (schema, _options = {}) => {
    return (req, res, next) => {
        try {
            const inputData = {
                ...req.body,
                ...req.query,
                ...req.params
            };
            const result = inputValidationService.validateInput(inputData, schema);
            if (!result.isValid) {
                logger_1.logger.warn('Input validation failed', {
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
            if (result.sanitizedData) {
                const sanitizedBody = {};
                const sanitizedQuery = {};
                const sanitizedParams = {};
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
            if (result.threats && result.threats.length > 0) {
                logger_1.logger.security('Security threats detected but handled', {
                    path: req.path,
                    method: req.method,
                    threats: result.threats,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString()
                });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Input validation middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Input validation service unavailable',
                timestamp: new Date().toISOString()
            });
        }
    };
};
exports.validateInput = validateInput;
const strictValidation = (schema) => {
    return (0, exports.validateInput)(schema, {
        enableSanitization: true,
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        maxStringLength: 1000,
        maxArrayLength: 100,
        maxObjectDepth: 5
    });
};
exports.strictValidation = strictValidation;
const validateFileUpload = (allowedTypes, maxSize) => {
    return (req, res, next) => {
        try {
            if (!req.file && !req.files) {
                return next();
            }
            const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];
            const config = inputValidationService.getConfiguration();
            for (const file of files) {
                if (!file)
                    continue;
                if (Array.isArray(file))
                    continue;
                const sizeLimit = maxSize || config.maxFileSize;
                if (file.size > sizeLimit) {
                    return res.status(400).json({
                        error: 'File too large',
                        message: `File size exceeds maximum of ${sizeLimit} bytes`,
                        timestamp: new Date().toISOString()
                    });
                }
                const allowedFileTypes = allowedTypes || config.allowedFileTypes;
                const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
                if (!fileExtension || !allowedFileTypes.includes(fileExtension)) {
                    return res.status(400).json({
                        error: 'Invalid file type',
                        message: `File type not allowed. Allowed types: ${allowedFileTypes.join(', ')}`,
                        timestamp: new Date().toISOString()
                    });
                }
                if (inputValidationService['containsThreats'](file.originalname)) {
                    return res.status(400).json({
                        error: 'Invalid filename',
                        message: 'Filename contains potentially malicious content',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('File upload validation error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'File validation service unavailable',
                timestamp: new Date().toISOString()
            });
        }
    };
};
exports.validateFileUpload = validateFileUpload;
//# sourceMappingURL=inputValidationMiddleware.js.map