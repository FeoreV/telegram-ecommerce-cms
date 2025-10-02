"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseDLP = responseDLP;
const DataClassificationService_1 = require("../services/DataClassificationService");
const SecretLeakDetectionService_1 = require("../services/SecretLeakDetectionService");
const dataClassificationService = DataClassificationService_1.DataClassificationService.getInstance();
const secretLeakDetectionService = SecretLeakDetectionService_1.SecretLeakDetectionService.getInstance();
const AUTH_ENDPOINTS = [
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
    '/auth/profile',
    '/auth/verify',
    '/auth/telegram/login'
];
const isAuthEndpoint = (path) => {
    if (!path) {
        return false;
    }
    return AUTH_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
};
function responseDLP(req, res, next) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    res.json = function (...args) {
        const body = args[0];
        try {
            const serialized = JSON.stringify(body);
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (isDevelopment) {
                console.log(`DLP: Disabled in development mode - ${req.path}`);
                return originalJson(body);
            }
            const dlpPromise = performDLPScan(serialized, req, 'json_response');
            dlpPromise.then((shouldBlock) => {
                if (shouldBlock) {
                    console.warn(`DLP violation detected in response after sending - Request ID: ${req.requestId}`);
                }
            }).catch((err) => {
                console.error('DLP scan error:', err);
            });
            const classification = dataClassificationService.classifyData(serialized);
            if (classification === DataClassificationService_1.DataClassification.RESTRICTED || classification === DataClassificationService_1.DataClassification.TOP_SECRET) {
                console.warn(`Blocking ${classification} data in response - Request ID: ${req.requestId}`);
                return originalJson({
                    error: 'Response blocked by DLP policy',
                    requestId: req.requestId,
                    classification: classification,
                    timestamp: new Date().toISOString()
                });
            }
            if (!isAuthEndpoint(req.path) && containsSensitiveData(serialized)) {
                console.warn(`Sensitive data detected in response - Request ID: ${req.requestId}`);
                return originalJson({
                    error: 'Response contains sensitive data and has been blocked',
                    requestId: req.requestId,
                    timestamp: new Date().toISOString()
                });
            }
        }
        catch (err) {
            console.error('DLP processing error:', err);
        }
        return originalJson(body);
    }.bind(res);
    res.send = function (...args) {
        const body = args[0];
        try {
            const str = typeof body === 'string' ? body : JSON.stringify(body);
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (isDevelopment) {
                console.log(`DLP: Text response disabled in development mode - ${req.path}`);
                return originalSend(body);
            }
            performDLPScan(str, req, 'text_response').catch((err) => {
                console.error('DLP scan error for text response:', err);
            });
            if (containsSensitiveData(str)) {
                console.warn(`Sensitive data detected in text response - Request ID: ${req.requestId}`);
                return originalSend('Response blocked by DLP policy');
            }
        }
        catch (err) {
            console.error('DLP processing error for text response:', err);
        }
        return originalSend(body);
    }.bind(res);
    next();
}
async function performDLPScan(data, req, responseType) {
    try {
        await secretLeakDetectionService.scanLogEntry(data, `http_${responseType}`);
        const classification = dataClassificationService.classifyData(data);
        const shouldBlock = classification === DataClassificationService_1.DataClassification.RESTRICTED ||
            classification === DataClassificationService_1.DataClassification.TOP_SECRET;
        if (shouldBlock) {
            console.error('DLP Policy Violation', {
                requestId: req.requestId,
                classification,
                responseType,
                userAgent: req.headers['user-agent'],
                ip: req.ip,
                timestamp: new Date().toISOString()
            });
        }
        return shouldBlock;
    }
    catch (err) {
        console.error('DLP scan failed:', err);
        return false;
    }
}
function containsSensitiveData(data) {
    const sensitivePatterns = [
        /password\s*[:=]\s*["'][^"']+["']/i,
        /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
        /secret\s*[:=]\s*["'][^"']+["']/i,
        /token\s*[:=]\s*["'][^"']+["']/i,
        /bearer\s+[a-zA-Z0-9._-]+/i,
        /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
        /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/,
        /\b[A-F0-9]{32}\b/i,
        /\b[A-F0-9]{40}\b/i,
        /\b[A-F0-9]{64}\b/i
    ];
    return sensitivePatterns.some(pattern => pattern.test(data));
}
//# sourceMappingURL=responseDLP.js.map