import { Request, Response, NextFunction } from 'express';
import { compromiseResponseService } from '../services/CompromiseResponseService';

export function webhookQuarantineGuard(req: Request, res: Response, next: NextFunction) {
  if (compromiseResponseService.isQuarantineActive() || process.env.WEBHOOKS_DISABLED === 'true') {
    return res.status(503).json({ error: 'Webhooks temporarily disabled (quarantine)' });
  }
  next();
}


