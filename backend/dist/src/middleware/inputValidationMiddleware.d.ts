import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
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
export declare class InputValidationService {
    private static instance;
    private config;
    private suspiciousPatterns;
    private sqlInjectionPatterns;
    private xssPatterns;
    private constructor();
    static getInstance(): InputValidationService;
    private initializeSecurityPatterns;
    validateInput(data: any, schema?: ZodSchema): ValidationResult;
    private checkStructuralLimits;
    private detectThreats;
    private sanitizeData;
    private sanitizeString;
    private traverseData;
    private deepClone;
    validateEmail(email: string): boolean;
    validateURL(url: string): boolean;
    validatePhoneNumber(phone: string): boolean;
    validateUUID(uuid: string): boolean;
    validateCreditCard(card: string): boolean;
    validateIPAddress(ip: string): boolean;
    private containsThreats;
    getConfiguration(): ValidationConfig;
}
declare const inputValidationService: InputValidationService;
export declare const validateInput: (schema?: ZodSchema, _options?: Partial<ValidationConfig>) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const strictValidation: (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const validateFileUpload: (allowedTypes?: string[], maxSize?: number) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export { inputValidationService };
//# sourceMappingURL=inputValidationMiddleware.d.ts.map