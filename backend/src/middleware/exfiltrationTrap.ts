import { Request, Response, NextFunction } from 'express';
import { honeytokenService } from '../services/HoneytokenService';

// Simple outgoing payload scanner for honeytokens
export function exfiltrationTrap(req: Request, res: Response, next: NextFunction) {
  try {
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const headersStr = JSON.stringify(req.headers || {});

    if (honeytokenService.isHoneytoken(bodyStr) || honeytokenService.isHoneytoken(headersStr)) {
      honeytokenService.triggerAlert({ source: 'http_request', sample: bodyStr?.slice(0, 128) }).catch(() => {});
    }
  } catch (error) {
    // Ignore trap validation errors to prevent disruption
  }
  next();
}


