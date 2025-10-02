"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const socket_1 = require("../lib/socket");
const cmsClient_1 = require("../utils/cmsClient");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
const webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
const seenSignatures = new Map();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;
function verifySignature(req, secret) {
    if (!secret)
        return false;
    const signature = req.header('x-medusa-signature') || '';
    const tsHeader = req.header('x-medusa-timestamp');
    const timestamp = tsHeader ? Number(tsHeader) : NaN;
    if (!Number.isFinite(timestamp)) {
        return false;
    }
    if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
        return false;
    }
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const hmac = crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
    if (signature.length !== hmac.length)
        return false;
    const valid = crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));
    if (!valid)
        return false;
    const lastSeen = seenSignatures.get(signature);
    const now = Date.now();
    if (seenSignatures.size > 1000) {
        const cutoff = now - REPLAY_WINDOW_MS;
        for (const [sig, ts] of seenSignatures) {
            if (ts < cutoff)
                seenSignatures.delete(sig);
        }
    }
    if (lastSeen && now - lastSeen < REPLAY_WINDOW_MS) {
        return false;
    }
    seenSignatures.set(signature, now);
    return true;
}
router.post('/webhooks/medusa', webhookLimiter, (req, res) => {
    try {
        const reqLogger = req.logger || logger_1.logger;
        const secret = env_1.env.MEDUSA_WEBHOOK_TOKEN;
        if (!verifySignature(req, secret)) {
            reqLogger.warn('Medusa webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        const event = req.header('x-medusa-event') || 'unknown';
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        const payload = (() => {
            try {
                return JSON.parse(raw.toString('utf8'));
            }
            catch (error) {
                return {};
            }
        })();
        reqLogger.info(`Medusa webhook received: ${event}`);
        switch (event) {
            case 'product.updated':
            case 'product.created':
            case 'variant.updated':
            case 'price.updated':
                try {
                    const io = (0, socket_1.getIO)();
                    io.emit('catalog_updated', { event, payload });
                }
                catch (error) {
                }
                break;
            case 'inventory.updated':
            case 'reservation.released':
                try {
                    const io = (0, socket_1.getIO)();
                    io.emit('inventory_updated', { event, payload });
                }
                catch (error) {
                }
                break;
            default:
                reqLogger.debug(`Unhandled Medusa event: ${event}`);
        }
        return res.json({ ok: true });
    }
    catch (err) {
        const reqLogger = req.logger || logger_1.logger;
        reqLogger.error('Medusa webhook handler error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});
exports.default = router;
router.get('/health', async (req, res) => {
    try {
        const data = await cmsClient_1.cmsClient.listProducts({ limit: 1 });
        return res.json({ ok: true, cms: 'reachable', sample: data?.count ?? 0 });
    }
    catch (e) {
        const error = e instanceof Error ? e.message : 'CMS unreachable';
        return res.status(503).json({ ok: false, error });
    }
});
//# sourceMappingURL=cms.js.map