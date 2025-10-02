import { Request, Response, NextFunction } from 'express';
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
export declare class FileValidator {
    private static readonly DEFAULT_OPTIONS;
    static validateFile(filePath: string, options?: Partial<FileValidationOptions>): Promise<FileValidationResult>;
    static validateBuffer(buffer: Buffer, originalFilename: string, options?: Partial<FileValidationOptions>): Promise<FileValidationResult>;
    private static getExpectedExtensions;
    static sanitizeFilename(filename: string): string;
    static generateSecureFilename(originalFilename: string, prefix?: string): string;
    static validatePaymentProof(buffer: Buffer, originalFilename: string): Promise<FileValidationResult>;
    static performBasicMalwareCheck(buffer: Buffer): Promise<{
        isSuspicious: boolean;
        reasons: string[];
    }>;
}
export declare function createFileValidationMiddleware(options?: Partial<FileValidationOptions>): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=fileValidator.d.ts.map