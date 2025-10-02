// file-type v21+ is ESM only, we need to use dynamic import
import * as fs from 'fs/promises';
import * as path from 'path';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: string;
  detectedMimeType?: string;
  error?: string;
  sanitizedFilename?: string;
}

export interface FileValidationOptions {
  allowedTypes: string[];
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  requireMagicByteValidation: boolean;
  sanitizeFilename: boolean;
}

/**
 * Secure file validator that checks files by magic bytes, not just extensions
 */
export class FileValidator {
  
  private static readonly DEFAULT_OPTIONS: FileValidationOptions = {
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf'
    ],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    requireMagicByteValidation: true,
    sanitizeFilename: true
  };

  /**
   * Validate file by reading its magic bytes
   */
  static async validateFile(
    filePath: string,
    options: Partial<FileValidationOptions> = {}
  ): Promise<FileValidationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      
      // Check file size
      if (stats.size > opts.maxSizeBytes) {
        return {
          isValid: false,
          error: `File size ${stats.size} exceeds maximum allowed size ${opts.maxSizeBytes}`
        };
      }

      // Read file buffer for magic byte validation
      const buffer = await fs.readFile(filePath);
      return this.validateBuffer(buffer, path.basename(filePath), opts);

    } catch (error) {
      logger.error('Error validating file:', error);
      return {
        isValid: false,
        error: 'Failed to read or validate file'
      };
    }
  }

  /**
   * Validate file buffer directly (useful for uploads in memory)
   */
  static async validateBuffer(
    buffer: Buffer,
    originalFilename: string,
    options: Partial<FileValidationOptions> = {}
  ): Promise<FileValidationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      // Check buffer size
      if (buffer.length > opts.maxSizeBytes) {
        return {
          isValid: false,
          error: `File size ${buffer.length} exceeds maximum allowed size ${opts.maxSizeBytes}`
        };
      }

      // Sanitize filename
      const sanitizedFilename = opts.sanitizeFilename ? 
        this.sanitizeFilename(originalFilename) : originalFilename;

      // Detect file type by magic bytes
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

        // Check if detected type is allowed
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

        // Validate that extension matches detected type
        const fileExtension = path.extname(originalFilename).toLowerCase().slice(1);
        const expectedExtensions = this.getExpectedExtensions(detectedType.mime);
        
        if (!expectedExtensions.includes(fileExtension)) {
          logger.warn('File extension mismatch detected', {
            originalFilename,
            fileExtension,
            detectedType: detectedType.ext,
            detectedMime: detectedType.mime,
            expectedExtensions
          });
          
          // For security, we can either reject or use the detected extension
          // For payment proofs, we'll be strict and reject mismatches
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

      // Fallback to extension-based validation (less secure)
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

    } catch (error) {
      logger.error('Error validating file buffer:', error);
      return {
        isValid: false,
        error: 'Failed to validate file content'
      };
    }
  }

  /**
   * Get expected file extensions for a MIME type
   */
  private static getExpectedExtensions(mimeType: string): string[] {
    const mimeToExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf']
    };

    return mimeToExtensions[mimeType] || [];
  }

  /**
   * Sanitize filename to prevent path traversal and other attacks
   */
  static sanitizeFilename(filename: string): string {
    // Remove path components
    let sanitized = path.basename(filename);
    
    // Remove or replace dangerous characters (control chars 0-31)
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F]/g, '');
    
    // Remove leading dots and spaces
    sanitized = sanitized.replace(/^[.\s]+/, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }
    
    // Ensure we have a filename
    if (!sanitized || sanitized === '.') {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Generate secure filename with timestamp and randomness
   */
  static generateSecureFilename(originalFilename: string, prefix: string = ''): string {
    const sanitized = this.sanitizeFilename(originalFilename);
    const extension = path.extname(sanitized);
    const baseName = path.basename(sanitized, extension);
    
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    
    const secureBaseName = baseName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50); // Limit base name length
    
    return `${prefix}${secureBaseName}_${timestamp}_${random}${extension}`;
  }

  /**
   * Validate payment proof file specifically
   */
  static async validatePaymentProof(
    buffer: Buffer,
    originalFilename: string
  ): Promise<FileValidationResult> {
    return this.validateBuffer(buffer, originalFilename, {
      allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
      allowedMimeTypes: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'application/pdf'
      ],
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      requireMagicByteValidation: true,
      sanitizeFilename: true
    });
  }

  /**
   * Check if buffer appears to be malicious (basic heuristics)
   */
  static async performBasicMalwareCheck(buffer: Buffer): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    
    // Check for embedded executables in images/PDFs
    const suspiciousPatterns = [
      Buffer.from('MZ'), // PE executable header
      Buffer.from('PK'), // ZIP file header (could be disguised executable)
      Buffer.from('\x7fELF'), // ELF executable header
      Buffer.from('#!/bin/'), // Shell script shebang
      Buffer.from('<?php'), // PHP code
      Buffer.from('<script'), // JavaScript
      Buffer.from('javascript:'), // JavaScript protocol
      Buffer.from('vbscript:'), // VBScript protocol
    ];

    for (const pattern of suspiciousPatterns) {
      if (buffer.includes(pattern)) {
        reasons.push(`Contains suspicious pattern: ${pattern.toString('hex')}`);
      }
    }

    // Check file size ratio (compressed files that expand too much might be zip bombs)
    if (buffer.length < 1000 && buffer.includes(Buffer.from('PK'))) {
      reasons.push('Suspicious: Very small ZIP file');
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons
    };
  }
}

/**
 * Express middleware for secure file validation
 */
export function createFileValidationMiddleware(options?: Partial<FileValidationOptions>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }

    try {
      const validation = await FileValidator.validateFile(req.file.path, options);
      
      if (!validation.isValid) {
        // Clean up the uploaded file
        try {
          await fs.unlink(req.file.path);
        } catch (error) {
          logger.error('Failed to cleanup invalid uploaded file:', error);
        }
        
        return res.status(400).json({
          error: 'File validation failed',
          details: validation.error
        });
      }

      // Attach validation result to request
      (req as any).fileValidation = validation;
      next();
    } catch (error) {
      logger.error('File validation middleware error:', error);
      res.status(500).json({ error: 'File validation failed' });
    }
  };
}
