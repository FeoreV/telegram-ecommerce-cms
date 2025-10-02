"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificateValidationService = exports.CertificateValidationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../utils/logger");
class CertificateValidationService {
    constructor() {
        this.trustedCACertificates = new Map();
        this.pinnedCertificates = new Map();
        this.certificateRevocationList = new Set();
        this.loadTrustedCAs();
        this.loadPinnedCertificates();
        this.loadCertificateRevocationList();
    }
    static getInstance() {
        if (!CertificateValidationService.instance) {
            CertificateValidationService.instance = new CertificateValidationService();
        }
        return CertificateValidationService.instance;
    }
    loadTrustedCAs() {
        try {
            const caCertPath = process.env.TLS_CA_PATH || '/certs/ca.cert.pem';
            if (fs_1.default.existsSync(caCertPath)) {
                const caCert = fs_1.default.readFileSync(caCertPath);
                this.trustedCACertificates.set('internal-ca', caCert);
                logger_1.logger.info('Loaded internal CA certificate');
            }
            const additionalCAs = process.env.ADDITIONAL_TRUSTED_CAS;
            if (additionalCAs) {
                const caPaths = additionalCAs.split(',');
                caPaths.forEach((caPath, index) => {
                    try {
                        if (fs_1.default.existsSync(caPath.trim())) {
                            const caCert = fs_1.default.readFileSync(caPath.trim());
                            this.trustedCACertificates.set(`additional-ca-${index}`, caCert);
                            logger_1.logger.info(`Loaded additional CA certificate: ${caPath.trim()}`);
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to load CA certificate: ${caPath.trim()}`, error);
                    }
                });
            }
            logger_1.logger.info(`Loaded ${this.trustedCACertificates.size} trusted CA certificates`);
        }
        catch (error) {
            logger_1.logger.error('Failed to load trusted CA certificates:', error);
        }
    }
    loadPinnedCertificates() {
        try {
            const pinnedCerts = {
                'backend.botrt.local': process.env.BACKEND_CERT_PIN,
                'bot.botrt.local': process.env.BOT_CERT_PIN,
                'frontend.botrt.local': process.env.FRONTEND_CERT_PIN,
                'postgres.botrt.local': process.env.POSTGRES_CERT_PIN,
                'redis.botrt.local': process.env.REDIS_CERT_PIN,
                'vault.botrt.local': process.env.VAULT_CERT_PIN,
            };
            Object.entries(pinnedCerts).forEach(([hostname, pin]) => {
                if (pin) {
                    this.pinnedCertificates.set(hostname, pin);
                    logger_1.logger.info(`Certificate pinned for ${hostname}`);
                }
            });
            logger_1.logger.info(`Loaded ${this.pinnedCertificates.size} certificate pins`);
        }
        catch (error) {
            logger_1.logger.error('Failed to load certificate pins:', error);
        }
    }
    loadCertificateRevocationList() {
        try {
            const crlData = process.env.CERTIFICATE_REVOCATION_LIST;
            if (crlData) {
                const revokedCerts = crlData.split(',');
                revokedCerts.forEach(cert => {
                    this.certificateRevocationList.add(cert.trim());
                });
                logger_1.logger.info(`Loaded ${this.certificateRevocationList.size} revoked certificates`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load certificate revocation list:', error);
        }
    }
    validateCertificate(certificatePem, hostname, options = {}) {
        const { checkRevocation = true, checkPinning = true, checkExpiry = true, allowSelfSigned = false } = options;
        try {
            const certInfo = this.parseCertificate(certificatePem);
            const warnings = [];
            let valid = true;
            let reason;
            if (checkExpiry) {
                const now = new Date();
                if (now < certInfo.validFrom) {
                    valid = false;
                    reason = 'Certificate is not yet valid';
                }
                else if (now > certInfo.validTo) {
                    valid = false;
                    reason = 'Certificate has expired';
                }
                else {
                    const daysUntilExpiry = Math.floor((certInfo.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilExpiry < 30) {
                        warnings.push(`Certificate expires in ${daysUntilExpiry} days`);
                    }
                }
            }
            if (checkRevocation && this.certificateRevocationList.has(certInfo.fingerprint)) {
                valid = false;
                reason = 'Certificate is revoked';
            }
            if (checkPinning && hostname) {
                const pinnedFingerprint = this.pinnedCertificates.get(hostname);
                if (pinnedFingerprint && pinnedFingerprint !== certInfo.sha256Fingerprint) {
                    valid = false;
                    reason = `Certificate fingerprint mismatch for ${hostname}`;
                }
            }
            if (!allowSelfSigned && !this.validateCertificateChain(certificatePem)) {
                warnings.push('Certificate chain validation failed');
            }
            const keyUsageWarnings = this.validateKeyUsage(certInfo);
            warnings.push(...keyUsageWarnings);
            if (hostname && !this.validateHostname(certInfo, hostname)) {
                warnings.push(`Hostname ${hostname} not found in certificate SAN`);
            }
            return {
                valid,
                reason,
                warnings,
                certificateInfo: certInfo
            };
        }
        catch (error) {
            logger_1.logger.error('Certificate validation error:', error);
            return {
                valid: false,
                reason: 'Certificate parsing failed',
                warnings: []
            };
        }
    }
    parseCertificate(certificatePem) {
        const cert = crypto_1.default.createHash('sha256').update(certificatePem).digest('hex');
        const fingerprint = crypto_1.default.createHash('md5').update(certificatePem).digest('hex');
        const subjectMatch = certificatePem.match(/Subject:.*CN\s*=\s*([^,\n]+)/);
        const issuerMatch = certificatePem.match(/Issuer:.*CN\s*=\s*([^,\n]+)/);
        return {
            subject: {
                commonName: subjectMatch?.[1]?.trim() || 'Unknown',
                organization: 'Telegram Ecommerce Bot',
                organizationalUnit: 'Services',
                country: 'RU',
                state: 'Moscow',
                locality: 'Moscow'
            },
            issuer: {
                commonName: issuerMatch?.[1]?.trim() || 'Unknown',
                organization: 'Telegram Ecommerce Bot'
            },
            fingerprint,
            sha256Fingerprint: cert,
            serialNumber: '1000',
            validFrom: new Date(),
            validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            keyUsage: ['digitalSignature', 'keyEncipherment'],
            extendedKeyUsage: ['serverAuth', 'clientAuth'],
            subjectAltNames: [],
            isCA: false
        };
    }
    validateCertificateChain(_certificatePem) {
        return this.trustedCACertificates.size > 0;
    }
    validateKeyUsage(certInfo) {
        const warnings = [];
        const requiredKeyUsages = ['digitalSignature', 'keyEncipherment'];
        const missingUsages = requiredKeyUsages.filter(usage => !certInfo.keyUsage.includes(usage));
        if (missingUsages.length > 0) {
            warnings.push(`Missing key usages: ${missingUsages.join(', ')}`);
        }
        if (!certInfo.extendedKeyUsage.includes('serverAuth') &&
            !certInfo.extendedKeyUsage.includes('clientAuth')) {
            warnings.push('Certificate lacks required extended key usage');
        }
        return warnings;
    }
    validateHostname(certInfo, hostname) {
        if (certInfo.subject.commonName === hostname) {
            return true;
        }
        return certInfo.subjectAltNames.some(san => {
            if (san.startsWith('*.')) {
                const domain = san.substring(2);
                return hostname.endsWith(domain);
            }
            return san === hostname;
        });
    }
    pinCertificate(hostname, certificatePem) {
        try {
            const certInfo = this.parseCertificate(certificatePem);
            this.pinnedCertificates.set(hostname, certInfo.sha256Fingerprint);
            logger_1.logger.info(`Certificate pinned for ${hostname}`, {
                fingerprint: certInfo.sha256Fingerprint
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to pin certificate for ${hostname}:`, error);
            throw error;
        }
    }
    revokeCertificate(fingerprint, reason) {
        this.certificateRevocationList.add(fingerprint);
        logger_1.logger.warn(`Certificate revoked: ${fingerprint}`, { reason });
    }
    getCertificateInfo(certificatePem) {
        return this.parseCertificate(certificatePem);
    }
    checkExpirationWarnings() {
        const warnings = [];
        return warnings;
    }
    generateSPIFFEID(serviceName, namespace = 'botrt') {
        return `spiffe://${namespace}.local/service/${serviceName}`;
    }
    validateSPIFFEID(certInfo, expectedServiceName) {
        const expectedSPIFFEID = this.generateSPIFFEID(expectedServiceName);
        return certInfo.subjectAltNames.some(san => san.startsWith('URI:') && san.includes(expectedSPIFFEID));
    }
    async healthCheck() {
        try {
            const expiringCerts = this.checkExpirationWarnings();
            return {
                status: 'healthy',
                trustedCAs: this.trustedCACertificates.size,
                pinnedCertificates: this.pinnedCertificates.size,
                revokedCertificates: this.certificateRevocationList.size,
                expiringCertificates: expiringCerts.length
            };
        }
        catch (error) {
            logger_1.logger.error('Certificate validation service health check failed:', error);
            return {
                status: 'error',
                trustedCAs: 0,
                pinnedCertificates: 0,
                revokedCertificates: 0,
                expiringCertificates: 0
            };
        }
    }
    getConfiguration() {
        return {
            trustedCAs: Array.from(this.trustedCACertificates.keys()),
            pinnedCertificates: Object.fromEntries(this.pinnedCertificates),
            revokedCertificates: Array.from(this.certificateRevocationList)
        };
    }
}
exports.CertificateValidationService = CertificateValidationService;
exports.certificateValidationService = CertificateValidationService.getInstance();
//# sourceMappingURL=CertificateValidationService.js.map