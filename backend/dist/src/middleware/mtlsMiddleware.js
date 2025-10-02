"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mtlsValidator = exports.mtlsHealthCheck = exports.requireServiceIdentity = exports.mtlsLoggingMiddleware = exports.mtlsAuthMiddleware = void 0;
const TLSService_1 = require("../services/TLSService");
const logger_1 = require("../utils/logger");
class MTLSValidator {
    constructor() {
        this.trustedServices = new Map();
        this.certificateRevocationList = new Set();
        this.loadTrustedServices();
    }
    static getInstance() {
        if (!MTLSValidator.instance) {
            MTLSValidator.instance = new MTLSValidator();
        }
        return MTLSValidator.instance;
    }
    loadTrustedServices() {
        const trustedServices = [
            {
                commonName: 'backend.botrt.local',
                organization: 'Telegram Ecommerce Bot',
                organizationalUnit: 'Services',
                fingerprint: process.env.BACKEND_CERT_FINGERPRINT || '',
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            },
            {
                commonName: 'bot.botrt.local',
                organization: 'Telegram Ecommerce Bot',
                organizationalUnit: 'Services',
                fingerprint: process.env.BOT_CERT_FINGERPRINT || '',
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            },
            {
                commonName: 'frontend.botrt.local',
                organization: 'Telegram Ecommerce Bot',
                organizationalUnit: 'Services',
                fingerprint: process.env.FRONTEND_CERT_FINGERPRINT || '',
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            }
        ];
        trustedServices.forEach(service => {
            if (service.fingerprint) {
                this.trustedServices.set(service.commonName, service);
            }
        });
        logger_1.logger.info(`Loaded ${this.trustedServices.size} trusted service certificates`);
    }
    validateClientCertificate(cert) {
        try {
            if (!cert || !cert.subject) {
                return { valid: false, reason: 'No client certificate provided' };
            }
            const commonName = cert.subject.CN;
            const organization = cert.subject.O;
            const fingerprint = cert.fingerprint;
            if (this.certificateRevocationList.has(fingerprint)) {
                return { valid: false, reason: 'Certificate is revoked' };
            }
            const trustedService = this.trustedServices.get(commonName);
            if (!trustedService) {
                return { valid: false, reason: `Unknown service: ${commonName}` };
            }
            if (organization !== trustedService.organization) {
                return {
                    valid: false,
                    reason: `Invalid organization: expected ${trustedService.organization}, got ${organization}`
                };
            }
            const now = new Date();
            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);
            if (now < validFrom) {
                return { valid: false, reason: 'Certificate not yet valid' };
            }
            if (now > validTo) {
                return { valid: false, reason: 'Certificate has expired' };
            }
            const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 30) {
                logger_1.logger.warn(`Client certificate for ${commonName} expires in ${daysUntilExpiry} days`, {
                    service: commonName,
                    expiresAt: validTo,
                    daysLeft: daysUntilExpiry
                });
            }
            if (trustedService.fingerprint && fingerprint !== trustedService.fingerprint) {
                return {
                    valid: false,
                    reason: `Certificate fingerprint mismatch for ${commonName}`
                };
            }
            return {
                valid: true,
                identity: {
                    commonName,
                    organization,
                    organizationalUnit: cert.subject.OU || '',
                    fingerprint,
                    validFrom,
                    validTo
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Certificate validation error:', error);
            return { valid: false, reason: 'Certificate validation failed' };
        }
    }
    addTrustedService(identity) {
        this.trustedServices.set(identity.commonName, identity);
        logger_1.logger.info(`Added trusted service: ${identity.commonName}`);
    }
    revokeCertificate(fingerprint, reason) {
        this.certificateRevocationList.add(fingerprint);
        logger_1.logger.warn(`Certificate revoked: ${fingerprint}, reason: ${reason}`);
    }
    getTrustedServices() {
        return Array.from(this.trustedServices.values());
    }
    getCertificateRevocationList() {
        return Array.from(this.certificateRevocationList);
    }
}
const mtlsValidator = MTLSValidator.getInstance();
exports.mtlsValidator = mtlsValidator;
const mtlsAuthMiddleware = (req, res, next) => {
    try {
        if (!TLSService_1.tlsService.isEnabled()) {
            logger_1.logger.debug('mTLS disabled, skipping certificate validation');
            return next();
        }
        if (!req.secure && req.get('X-Forwarded-Proto') !== 'https') {
            logger_1.logger.warn('Non-HTTPS request received', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            return res.status(426).json({
                error: 'HTTPS Required',
                message: 'This endpoint requires a secure connection'
            });
        }
        const socket = req.socket;
        const clientCert = socket.getPeerCertificate();
        if (!clientCert || !clientCert.subject) {
            logger_1.logger.warn('mTLS authentication failed: No client certificate', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({
                error: 'Client Certificate Required',
                message: 'This endpoint requires mTLS authentication'
            });
        }
        const validation = mtlsValidator.validateClientCertificate(clientCert);
        if (!validation.valid) {
            logger_1.logger.warn('mTLS authentication failed', {
                ip: req.ip,
                path: req.path,
                reason: validation.reason,
                certificate: {
                    subject: clientCert.subject,
                    fingerprint: clientCert.fingerprint
                }
            });
            return res.status(403).json({
                error: 'Invalid Client Certificate',
                message: validation.reason
            });
        }
        req.clientCertificate = clientCert;
        req.mtlsVerified = true;
        req.serviceIdentity = validation.identity?.commonName;
        logger_1.logger.info('mTLS authentication successful', {
            service: validation.identity?.commonName,
            organization: validation.identity?.organization,
            fingerprint: validation.identity?.fingerprint,
            ip: req.ip,
            path: req.path
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('mTLS middleware error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Certificate validation failed'
        });
    }
};
exports.mtlsAuthMiddleware = mtlsAuthMiddleware;
const mtlsLoggingMiddleware = (req, res, next) => {
    if (req.mtlsVerified && req.clientCertificate) {
        const cert = req.clientCertificate;
        logger_1.logger.info('mTLS request', {
            service: req.serviceIdentity,
            method: req.method,
            path: req.path,
            ip: req.ip,
            certificate: {
                subject: cert.subject,
                issuer: cert.issuer,
                fingerprint: cert.fingerprint,
                validFrom: cert.valid_from,
                validTo: cert.valid_to
            }
        });
    }
    next();
};
exports.mtlsLoggingMiddleware = mtlsLoggingMiddleware;
const requireServiceIdentity = (allowedServices) => {
    return (req, res, next) => {
        if (!req.mtlsVerified || !req.serviceIdentity) {
            return res.status(401).json({
                error: 'Authentication Required',
                message: 'mTLS authentication required'
            });
        }
        if (!allowedServices.includes(req.serviceIdentity)) {
            logger_1.logger.warn('Service access denied', {
                service: req.serviceIdentity,
                allowedServices,
                path: req.path,
                ip: req.ip
            });
            return res.status(403).json({
                error: 'Access Denied',
                message: `Service ${req.serviceIdentity} is not authorized for this endpoint`
            });
        }
        next();
    };
};
exports.requireServiceIdentity = requireServiceIdentity;
const mtlsHealthCheck = async (req, res) => {
    try {
        const tlsHealth = await TLSService_1.tlsService.healthCheck();
        const trustedServices = mtlsValidator.getTrustedServices();
        const revokedCerts = mtlsValidator.getCertificateRevocationList();
        res.json({
            status: 'healthy',
            tls: tlsHealth,
            mtls: {
                enabled: TLSService_1.tlsService.isEnabled(),
                trustedServices: trustedServices.length,
                revokedCertificates: revokedCerts.length
            },
            services: trustedServices.map(s => ({
                commonName: s.commonName,
                organization: s.organization,
                validTo: s.validTo
            })),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('mTLS health check failed:', error);
        res.status(500).json({
            status: 'error',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
};
exports.mtlsHealthCheck = mtlsHealthCheck;
//# sourceMappingURL=mtlsMiddleware.js.map