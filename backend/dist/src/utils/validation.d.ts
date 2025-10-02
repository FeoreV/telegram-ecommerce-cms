import { z } from 'zod';
export declare class ValidationError extends Error {
    errors?: z.ZodIssue[];
    constructor(message: string, errors?: z.ZodIssue[]);
}
export declare const validateInput: <T>(schema: z.ZodSchema<T>, data: unknown) => T;
//# sourceMappingURL=validation.d.ts.map