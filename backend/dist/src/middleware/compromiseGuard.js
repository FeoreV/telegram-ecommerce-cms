"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compromiseGuard = compromiseGuard;
const CompromiseResponseService_1 = require("../services/CompromiseResponseService");
function compromiseGuard(req, res, next) {
    if (CompromiseResponseService_1.compromiseResponseService.isKillSwitchActive()) {
        return res.status(503).json({
            error: 'Service is in kill-switch mode due to detected compromise',
            retryAfter: 600
        });
    }
    if (CompromiseResponseService_1.compromiseResponseService.isQuarantineActive()) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
    }
    next();
}
//# sourceMappingURL=compromiseGuard.js.map