import { Request, Response, NextFunction } from 'express';

// Async handler to catch errors in async route handlers
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void | Response>
) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req as T, res, next)).catch(next);
};
