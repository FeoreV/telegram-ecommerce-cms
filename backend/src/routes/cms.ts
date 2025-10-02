import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { getIO } from '../lib/socket';
import { cmsClient } from '../utils/cmsClient';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limit for webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple in-memory replay cache
const seenSignatures: Map<string, number> = new Map();
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function verifySignature(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const signature = req.header('x-medusa-signature') || '';
  const tsHeader = req.header('x-medusa-timestamp');
  const timestamp = tsHeader ? Number(tsHeader) : NaN;
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  // Reject old timestamps
  if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
    return false;
  }
  const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (signature.length !== hmac.length) return false;
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));
  if (!valid) return false;
  // Replay protection: dedupe signature within window
  const lastSeen = seenSignatures.get(signature);
  const now = Date.now();
  // Clean up old entries occasionally
  if (seenSignatures.size > 1000) {
    const cutoff = now - REPLAY_WINDOW_MS;
    for (const [sig, ts] of seenSignatures) {
      if (ts < cutoff) seenSignatures.delete(sig);
    }
  }
  if (lastSeen && now - lastSeen < REPLAY_WINDOW_MS) {
    return false;
  }
  seenSignatures.set(signature, now);
  return true;
}

router.post('/webhooks/medusa', webhookLimiter, (req: Request, res: Response) => {
  try {
    const reqLogger = (req as Request & { logger?: typeof logger }).logger || logger;
    const secret = env.MEDUSA_WEBHOOK_TOKEN;
    if (!verifySignature(req, secret)) {
      reqLogger.warn('Medusa webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.header('x-medusa-event') || 'unknown';
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const payload = (() => {
      try { return JSON.parse(raw.toString('utf8')); } catch (error) { return {}; }
    })();

    reqLogger.info(`Medusa webhook received: ${event}`);

    switch (event) {
      case 'product.updated':
      case 'product.created':
      case 'variant.updated':
      case 'price.updated':
        try {
          const io = getIO();
          io.emit('catalog_updated', { event, payload } as { event: string; payload: unknown });
        } catch (error) {
          // Socket emission failed, but we continue processing
        }
        break;
      case 'inventory.updated':
      case 'reservation.released':
        try {
          const io = getIO();
          io.emit('inventory_updated', { event, payload } as { event: string; payload: unknown });
        } catch (error) {
          // Socket emission failed, but we continue processing
        }
        break;
      default:
        reqLogger.debug(`Unhandled Medusa event: ${event}`);
    }

    return res.json({ ok: true });
  } catch (err) {
    const reqLogger = (req as Request & { logger?: typeof logger }).logger || logger;
    reqLogger.error('Medusa webhook handler error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;

// Health endpoint for CMS connectivity
router.get('/health', async (req: Request, res: Response) => {
  try {
    const data = await cmsClient.listProducts({ limit: 1 });
    return res.json({ ok: true, cms: 'reachable', sample: data?.count ?? 0 });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'CMS unreachable';
    return res.status(503).json({ ok: false, error });
  }
});


