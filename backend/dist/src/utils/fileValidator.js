"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileValidator = void 0;
exports.createFileValidationMiddleware = createFileValidationMiddleware;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
class FileValidator {
    static async validateFile(filePath, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        try {
            const stats = await fs.stat(filePath);
            if (stats.size > opts.maxSizeBytes) {
                return {
                    isValid: false,
                    error: `File size ${stats.size} exceeds maximum allowed size ${opts.maxSizeBytes}`
                };
            }
            const buffer = await fs.readFile(filePath);
            return this.validateBuffer(buffer, path.basename(filePath), opts);
        }
        catch (error) {
            logger_1.logger.error('Error validating file:', error);
            return {
                isValid: false,
                error: 'Failed to read or validate file'
            };
        }
    }
    static async validateBuffer(buffer, originalFilename, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        try {
            if (buffer.length > opts.maxSizeBytes) {
                return {
                    isValid: false,
                    error: `File size ${buffer.length} exceeds maximum allowed size ${opts.maxSizeBytes}`
                };
            }
            const sanitizedFilename = opts.sanitizeFilename ?
                this.sanitizeFilename(originalFilename) : originalFilename;
            if (opts.requireMagicByteValidation) {
                const { fileTypeFromBuffer } = await import('file-type');
                const detectedType = await fileTypeFromBuffer(buffer);
                if (!detectedType) {
                    return {
                        isValid: false,
                        error: 'Unable to detect file type from content',
                        sanitizedFilename
                    };
                }
                if (!opts.allowedTypes.includes(detectedType.ext) ||
                    !opts.allowedMimeTypes.includes(detectedType.mime)) {
                    return {
                        isValid: false,
                        error: `File type ${detectedType.ext} (${detectedType.mime}) is not allowed`,
                        detectedType: detectedType.ext,
                        detectedMimeType: detectedType.mime,
                        sanitizedFilename
                    };
                }
                const fileExtension = path.extname(originalFilename).toLowerCase().slice(1);
                const expectedExtensions = this.getExpectedExtensions(detectedType.mime);
                if (!expectedExtensions.includes(fileExtension)) {
                    logger_1.logger.warn('File extension mismatch detected', {
                        originalFilename,
                        fileExtension,
                        detectedType: detectedType.ext,
                        detectedMime: detectedType.mime,
                        expectedExtensions
                    });
                    return {
                        isValid: false,
                        error: `File extension ${fileExtension} does not match detected type ${detectedType.ext}`,
                        detectedType: detectedType.ext,
                        detectedMimeType: detectedType.mime,
                        sanitizedFilename
                    };
                }
                return {
                    isValid: true,
                    detectedType: detectedType.ext,
                    detectedMimeType: detectedType.mime,
                    sanitizedFilename
                };
            }
            const fileExtension = path.extname(originalFilename).toLowerCase().slice(1);
            if (!opts.allowedTypes.includes(fileExtension)) {
                return {
                    isValid: false,
                    error: `File extension ${fileExtension} is not allowed`,
                    sanitizedFilename
                };
            }
            return {
                isValid: true,
                sanitizedFilename
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating file buffer:', error);
            return {
                isValid: false,
                error: 'Failed to validate file content'
            };
        }
    }
    static getExpectedExtensions(mimeType) {
        const mimeToExtensions = {
            'image/jpeg': ['jpg', 'jpeg'],
            'image/png': ['png'],
            'image/gif': ['gif'],
            'image/webp': ['webp'],
            'application/pdf': ['pdf']
        };
        return mimeToExtensions[mimeType] || [];
    }
    static sanitizeFilename(filename) {
        let sanitized = path.basename(filename);
        sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '')
            .replace(/[\u0000-\u001F]/g, '');
        sanitized = sanitized.replace(/^[.\s]+/, '');
        if (sanitized.length > 255) {
            const ext = path.extname(sanitized);
            const name = path.basename(sanitized, ext);
            sanitized = name.substring(0, 255 - ext.length) + ext;
        }
        if (!sanitized || sanitized === '.') {
            sanitized = 'unnamed_file';
        }
        return sanitized;
    }
    static generateSecureFilename(originalFilename, prefix = '') {
        const sanitized = this.sanitizeFilename(originalFilename);
        const extension = path.extname(sanitized);
        const baseName = path.basename(sanitized, extension);
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const secureBaseName = baseName
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 50);
        return `${prefix}${secureBaseName}_${timestamp}_${random}${extension}`;
    }
    static async validatePaymentProof(buffer, originalFilename) {
        return this.validateBuffer(buffer, originalFilename, {
            allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
            allowedMimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf'
            ],
            maxSizeBytes: 10 * 1024 * 1024,
            requireMagicByteValidation: true,
            sanitizeFilename: true
        });
    }
    static async performBasicMalwareCheck(buffer) {
        const reasons = [];
        const suspiciousPatterns = [
            Buffer.from('MZ'),
            Buffer.from('PK'),
            Buffer.from('\x7fELF'),
            Buffer.from('#!/bin/'),
            Buffer.from('<?php'),
            Buffer.from('<script'),
            Buffer.from('javascript:'),
            Buffer.from('vbscript:'),
        ];
        for (const pattern of suspiciousPatterns) {
            if (buffer.includes(pattern)) {
                reasons.push(`Contains suspicious pattern: ${pattern.toString('hex')}`);
            }
        }
        if (buffer.length < 1000 && buffer.includes(Buffer.from('PK'))) {
            reasons.push('Suspicious: Very small ZIP file');
        }
        return {
            isSuspicious: reasons.length > 0,
            reasons
        };
    }
}
exports.FileValidator = FileValidator;
FileValidator.DEFAULT_OPTIONS = {
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
    allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ],
    maxSizeBytes: 10 * 1024 * 1024,
    requireMagicByteValidation: true,
    sanitizeFilename: true
};
function createFileValidationMiddleware(options) {
    return async (req, res, next) => {
        if (!req.file) {
            return next();
        }
        try {
            const validation = await FileValidator.validateFile(req.file.path, options);
            if (!validation.isValid) {
                try {
                    await fs.unlink(req.file.path);
                }
                catch (error) {
                    logger_1.logger.error('Failed to cleanup invalid uploaded file:', error);
                }
                return res.status(400).json({
                    error: 'File validation failed',
                    details: validation.error
                });
            }
            req.fileValidation = validation;
            next();
        }
        catch (error) {
            logger_1.logger.error('File validation middleware error:', error);
            res.status(500).json({ error: 'File validation failed' });
        }
    };
}
//# sourceMappingURL=fileValidator.js.map