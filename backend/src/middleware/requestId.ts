import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const headerId = (req.header('x-request-id') || '').trim();
  const id = headerId.length > 0 ? headerId : randomUUID();
  (req as any).requestId = id;
  res.setHeader('x-request-id', id);

  // Bind requestId to logger for this request lifecycle
  (req as any).logger = logger.child({ requestId: id });

  next();
}


