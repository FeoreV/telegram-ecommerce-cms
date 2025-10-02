"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
function requestId(req, res, next) {
    const headerId = (req.header('x-request-id') || '').trim();
    const id = headerId.length > 0 ? headerId : (0, crypto_1.randomUUID)();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    req.logger = logger_1.logger.child({ requestId: id });
    next();
}
//# sourceMappingURL=requestId.js.map