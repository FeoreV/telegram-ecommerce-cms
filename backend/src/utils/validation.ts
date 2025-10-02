import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string, public errors?: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateInput = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      throw new ValidationError(`Validation failed: ${message}`, error.issues);
    }
    throw error;
  }
};
