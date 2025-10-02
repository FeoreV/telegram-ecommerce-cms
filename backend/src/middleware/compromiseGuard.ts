import { Request, Response, NextFunction } from 'express';
import { compromiseResponseService } from '../services/CompromiseResponseService';

export function compromiseGuard(req: Request, res: Response, next: NextFunction) {
  if (compromiseResponseService.isKillSwitchActive()) {
    return res.status(503).json({
      error: 'Service is in kill-switch mode due to detected compromise',
      retryAfter: 600
    });
  }

  if (compromiseResponseService.isQuarantineActive()) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}


