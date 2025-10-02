"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookQuarantineGuard = webhookQuarantineGuard;
const CompromiseResponseService_1 = require("../services/CompromiseResponseService");
function webhookQuarantineGuard(req, res, next) {
    if (CompromiseResponseService_1.compromiseResponseService.isQuarantineActive() || process.env.WEBHOOKS_DISABLED === 'true') {
        return res.status(503).json({ error: 'Webhooks temporarily disabled (quarantine)' });
    }
    next();
}
//# sourceMappingURL=webhookQuarantineGuard.js.map