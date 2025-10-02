"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exfiltrationTrap = exfiltrationTrap;
const HoneytokenService_1 = require("../services/HoneytokenService");
function exfiltrationTrap(req, res, next) {
    try {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        const headersStr = JSON.stringify(req.headers || {});
        if (HoneytokenService_1.honeytokenService.isHoneytoken(bodyStr) || HoneytokenService_1.honeytokenService.isHoneytoken(headersStr)) {
            HoneytokenService_1.honeytokenService.triggerAlert({ source: 'http_request', sample: bodyStr?.slice(0, 128) }).catch(() => { });
        }
    }
    catch (error) {
    }
    next();
}
//# sourceMappingURL=exfiltrationTrap.js.map