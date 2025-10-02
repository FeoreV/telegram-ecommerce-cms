"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tlsService = exports.TLSService = void 0;
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const tls_1 = __importDefault(require("tls"));
const logger_1 = require("../utils/logger");
class TLSService {
    constructor() {
        this.certificates = new Map();
        this.config = this.loadTLSConfig();
        this.initializeCertificates();
    }
    static getInstance() {
        if (!TLSService.instance) {
            TLSService.instance = new TLSService();
        }
        return TLSService.instance;
    }
    loadTLSConfig() {
        return {
            enabled: process.env.TLS_ENABLED === 'true',
            certPath: process.env.TLS_CERT_PATH || '/certs/server.cert.pem',
            keyPath: process.env.TLS_KEY_PATH || '/certs/server.key.pem',
            caPath: process.env.TLS_CA_PATH || '/certs/ca.cert.pem',
            clientCertPath: process.env.TLS_CLIENT_CERT_PATH,
            clientKeyPath: process.env.TLS_CLIENT_KEY_PATH,
            rejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED !== 'false',
            minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
            maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3',
            ciphers: process.env.TLS_CIPHERS || [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES128-SHA256',
                'ECDHE-RSA-AES256-SHA384',
                'ECDHE-RSA-AES256-SHA256',
                'ECDHE-RSA-AES128-SHA',
                'ECDHE-RSA-AES256-SHA',
                'AES128-GCM-SHA256',
                'AES256-GCM-SHA384',
                'AES128-SHA256',
                'AES256-SHA256',
                'AES128-SHA',
                'AES256-SHA',
                'DES-CBC3-SHA',
                '!aNULL',
                '!eNULL',
                '!EXPORT',
                '!DES',
                '!RC4',
                '!MD5',
                '!PSK',
                '!SRP',
                '!CAMELLIA'
            ].join(':'),
            honorCipherOrder: true,
            dhparam: process.env.TLS_DHPARAM_PATH,
            certificatesLoaded: this.certificates.size,
        };
    }
    initializeCertificates() {
        if (!this.config.enabled) {
            logger_1.logger.info('TLS disabled, skipping certificate loading');
            return;
        }
        try {
            this.loadServerCertificates();
            if (this.config.clientCertPath && this.config.clientKeyPath) {
                this.loadClientCertificates();
            }
            logger_1.logger.info('TLS certificates loaded successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to load TLS certificates:', err);
            if (process.env.NODE_ENV === 'production') {
                throw new Error('TLS certificates are required in production');
            }
        }
    }
    loadServerCertificates() {
        const cert = fs_1.default.readFileSync(this.config.certPath);
        const key = fs_1.default.readFileSync(this.config.keyPath);
        const ca = fs_1.default.readFileSync(this.config.caPath);
        this.certificates.set('server', { cert, key, ca });
        logger_1.logger.info('Server certificates loaded');
    }
    loadClientCertificates() {
        if (!this.config.clientCertPath || !this.config.clientKeyPath) {
            return;
        }
        const cert = fs_1.default.readFileSync(this.config.clientCertPath);
        const key = fs_1.default.readFileSync(this.config.clientKeyPath);
        const ca = fs_1.default.readFileSync(this.config.caPath);
        this.certificates.set('client', { cert, key, ca });
        logger_1.logger.info('Client certificates loaded');
    }
    getServerOptions() {
        const serverCerts = this.certificates.get('server');
        if (!serverCerts) {
            throw new Error('Server certificates not loaded');
        }
        const options = {
            cert: serverCerts.cert,
            key: serverCerts.key,
            ca: serverCerts.ca,
            requestCert: true,
            rejectUnauthorized: this.config.rejectUnauthorized,
            minVersion: this.config.minVersion,
            maxVersion: this.config.maxVersion,
            ciphers: this.config.ciphers,
            honorCipherOrder: this.config.honorCipherOrder,
            secureProtocol: 'TLSv1_2_method'
        };
        if (this.config.dhparam && fs_1.default.existsSync(this.config.dhparam)) {
            options.dhparam = fs_1.default.readFileSync(this.config.dhparam);
        }
        return options;
    }
    getClientOptions(host, port, servername) {
        const clientCerts = this.certificates.get('client');
        if (!clientCerts) {
            throw new Error('Client certificates not loaded');
        }
        return {
            host,
            port,
            cert: clientCerts.cert,
            key: clientCerts.key,
            ca: clientCerts.ca,
            rejectUnauthorized: this.config.rejectUnauthorized,
            servername: servername || host
        };
    }
    createSecureContext(certPath, keyPath, caPath) {
        const cert = fs_1.default.readFileSync(certPath);
        const key = fs_1.default.readFileSync(keyPath);
        const ca = caPath ? fs_1.default.readFileSync(caPath) : undefined;
        return tls_1.default.createSecureContext({
            cert,
            key,
            ca,
            minVersion: this.config.minVersion,
            maxVersion: this.config.maxVersion,
            ciphers: this.config.ciphers,
            honorCipherOrder: this.config.honorCipherOrder
        });
    }
    validateCertificateChain(certPath, caPath) {
        try {
            const cert = fs_1.default.readFileSync(certPath, 'utf8');
            const ca = fs_1.default.readFileSync(caPath, 'utf8');
            return cert.includes('-----BEGIN CERTIFICATE-----') &&
                ca.includes('-----BEGIN CERTIFICATE-----');
        }
        catch (err) {
            logger_1.logger.error('Certificate validation failed:', err);
            return false;
        }
    }
    getCertificateExpiration(certPath) {
        try {
            const cert = fs_1.default.readFileSync(certPath, 'utf8');
            const match = cert.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
            if (match) {
                return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            }
            return null;
        }
        catch (err) {
            logger_1.logger.error('Failed to parse certificate expiration:', err);
            return null;
        }
    }
    async checkCertificateExpiration() {
        const results = [];
        const certPaths = [
            { name: 'server', path: this.config.certPath },
            { name: 'client', path: this.config.clientCertPath }
        ].filter((c) => !!c.path);
        for (const { name, path } of certPaths) {
            const expiration = this.getCertificateExpiration(path);
            if (expiration) {
                const daysLeft = Math.floor((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                results.push({
                    cert: name,
                    expiresAt: expiration,
                    daysLeft
                });
                if (daysLeft < 30) {
                    logger_1.logger.warn(`Certificate ${name} expires in ${daysLeft} days`, {
                        cert: name,
                        expiresAt: expiration,
                        daysLeft
                    });
                }
            }
        }
        return results;
    }
    async reloadCertificates() {
        try {
            logger_1.logger.info('Reloading TLS certificates...');
            this.certificates.clear();
            this.initializeCertificates();
            logger_1.logger.info('TLS certificates reloaded successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to reload TLS certificates:', err);
            throw err;
        }
    }
    getDatabaseTLSConfig() {
        if (!this.config.enabled) {
            return { ssl: false };
        }
        const clientCerts = this.certificates.get('client');
        if (!clientCerts) {
            return {
                ssl: {
                    rejectUnauthorized: this.config.rejectUnauthorized,
                    ca: fs_1.default.readFileSync(this.config.caPath)
                }
            };
        }
        return {
            ssl: {
                cert: clientCerts.cert,
                key: clientCerts.key,
                ca: clientCerts.ca,
                rejectUnauthorized: this.config.rejectUnauthorized,
                minVersion: this.config.minVersion,
                maxVersion: this.config.maxVersion
            }
        };
    }
    getRedisTLSConfig() {
        if (!this.config.enabled) {
            return null;
        }
        const clientCerts = this.certificates.get('client');
        if (!clientCerts) {
            return {
                tls: {
                    ca: fs_1.default.readFileSync(this.config.caPath),
                    rejectUnauthorized: this.config.rejectUnauthorized
                }
            };
        }
        return {
            tls: {
                cert: clientCerts.cert,
                key: clientCerts.key,
                ca: clientCerts.ca,
                rejectUnauthorized: this.config.rejectUnauthorized,
                minVersion: this.config.minVersion,
                maxVersion: this.config.maxVersion
            }
        };
    }
    createSecureHttpClient() {
        const clientCerts = this.certificates.get('client');
        if (!clientCerts) {
            throw new Error('Client certificates required for mTLS');
        }
        return new https_1.default.Agent({
            cert: clientCerts.cert,
            key: clientCerts.key,
            ca: clientCerts.ca,
            rejectUnauthorized: this.config.rejectUnauthorized,
            minVersion: this.config.minVersion,
            maxVersion: this.config.maxVersion,
            ciphers: this.config.ciphers,
            honorCipherOrder: this.config.honorCipherOrder,
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10
        });
    }
    async healthCheck() {
        const certificateStatus = await this.checkCertificateExpiration();
        return {
            status: this.config.enabled ? 'enabled' : 'disabled',
            certificates: certificateStatus,
            config: {
                minVersion: this.config.minVersion,
                maxVersion: this.config.maxVersion,
                rejectUnauthorized: this.config.rejectUnauthorized,
                certificatesLoaded: this.certificates.size
            }
        };
    }
    getConfig() {
        return { ...this.config };
    }
    isEnabled() {
        return this.config.enabled;
    }
}
exports.TLSService = TLSService;
exports.tlsService = TLSService.getInstance();
//# sourceMappingURL=TLSService.js.map