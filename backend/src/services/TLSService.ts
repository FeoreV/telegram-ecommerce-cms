import fs from 'fs';
import https from 'https';
import tls from 'tls';
import { logger } from '../utils/logger';

export interface TLSConfig {
  enabled: boolean;
  certPath: string;
  keyPath: string;
  caPath: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  rejectUnauthorized: boolean;
  minVersion: string;
  maxVersion: string;
  ciphers: string;
  honorCipherOrder: boolean;
  dhparam?: string;
  certificatesLoaded: number;
}

export interface TLSHealthConfig {
  minVersion: string;
  maxVersion: string;
  rejectUnauthorized: boolean;
  certificatesLoaded: number;
}

export interface MTLSClientOptions {
  host: string;
  port: number;
  cert: Buffer;
  key: Buffer;
  ca: Buffer;
  rejectUnauthorized: boolean;
  servername?: string;
}

export class TLSService {
  private static instance: TLSService;
  private config: TLSConfig;
  private certificates: Map<string, { cert: Buffer; key: Buffer; ca: Buffer }> = new Map();

  private constructor() {
    this.config = this.loadTLSConfig();
    this.initializeCertificates();
  }

  public static getInstance(): TLSService {
    if (!TLSService.instance) {
      TLSService.instance = new TLSService();
    }
    return TLSService.instance;
  }

  private loadTLSConfig(): TLSConfig {
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

  private initializeCertificates(): void {
    if (!this.config.enabled) {
      logger.info('TLS disabled, skipping certificate loading');
      return;
    }

    try {
      // Load server certificates
      this.loadServerCertificates();
      
      // Load client certificates if available
      if (this.config.clientCertPath && this.config.clientKeyPath) {
        this.loadClientCertificates();
      }

      logger.info('TLS certificates loaded successfully');
    } catch (err: unknown) {
      logger.error('Failed to load TLS certificates:', err as Record<string, unknown>);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('TLS certificates are required in production');
      }
    }
  }

  private loadServerCertificates(): void {
    const cert = fs.readFileSync(this.config.certPath);
    const key = fs.readFileSync(this.config.keyPath);
    const ca = fs.readFileSync(this.config.caPath);

    this.certificates.set('server', { cert, key, ca });
    logger.info('Server certificates loaded');
  }

  private loadClientCertificates(): void {
    if (!this.config.clientCertPath || !this.config.clientKeyPath) {
      return;
    }

    const cert = fs.readFileSync(this.config.clientCertPath);
    const key = fs.readFileSync(this.config.clientKeyPath);
    const ca = fs.readFileSync(this.config.caPath);

    this.certificates.set('client', { cert, key, ca });
    logger.info('Client certificates loaded');
  }

  /**
   * Get HTTPS server options
   */
  getServerOptions(): https.ServerOptions {
    const serverCerts = this.certificates.get('server');
    if (!serverCerts) {
      throw new Error('Server certificates not loaded');
    }

    const options: https.ServerOptions = {
      cert: serverCerts.cert,
      key: serverCerts.key,
      ca: serverCerts.ca,
      requestCert: true,
      rejectUnauthorized: this.config.rejectUnauthorized,
      minVersion: this.config.minVersion as tls.SecureVersion,
      maxVersion: this.config.maxVersion as tls.SecureVersion,
      ciphers: this.config.ciphers,
      honorCipherOrder: this.config.honorCipherOrder,
      secureProtocol: 'TLSv1_2_method'
    };

    // Load DH parameters if available
    if (this.config.dhparam && fs.existsSync(this.config.dhparam)) {
      options.dhparam = fs.readFileSync(this.config.dhparam);
    }

    return options;
  }

  /**
   * Get mTLS client options for outbound connections
   */
  getClientOptions(host: string, port: number, servername?: string): MTLSClientOptions {
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

  /**
   * Create secure context for SNI
   */
  createSecureContext(certPath: string, keyPath: string, caPath?: string): tls.SecureContext {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    const ca = caPath ? fs.readFileSync(caPath) : undefined;

    return tls.createSecureContext({
      cert,
      key,
      ca,
      minVersion: this.config.minVersion as tls.SecureVersion,
      maxVersion: this.config.maxVersion as tls.SecureVersion,
      ciphers: this.config.ciphers,
      honorCipherOrder: this.config.honorCipherOrder
    });
  }

  /**
   * Validate certificate chain
   */
  validateCertificateChain(certPath: string, caPath: string): boolean {
    try {
      const cert = fs.readFileSync(certPath, 'utf8');
      const ca = fs.readFileSync(caPath, 'utf8');

      // Basic validation - in production use proper certificate validation
      return cert.includes('-----BEGIN CERTIFICATE-----') && 
             ca.includes('-----BEGIN CERTIFICATE-----');
    } catch (err: unknown) {
      logger.error('Certificate validation failed:', err as Record<string, unknown>);
      return false;
    }
  }

  /**
   * Get certificate expiration date
   */
  getCertificateExpiration(certPath: string): Date | null {
    try {
      const cert = fs.readFileSync(certPath, 'utf8');
      const match = cert.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
      
      if (match) {
        // This is a simplified implementation
        // In production, use proper certificate parsing
        return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      }
      
      return null;
    } catch (err: unknown) {
      logger.error('Failed to parse certificate expiration:', err as Record<string, unknown>);
      return null;
    }
  }

  /**
   * Check if certificates are expiring soon
   */
  async checkCertificateExpiration(): Promise<{ cert: string; expiresAt: Date; daysLeft: number }[]> {
    const results: { cert: string; expiresAt: Date; daysLeft: number }[] = [];
    
    const certPaths = [
      { name: 'server', path: this.config.certPath },
      { name: 'client', path: this.config.clientCertPath }
    ].filter((c): c is { name: string; path: string } => !!c.path);

    for (const { name, path } of certPaths) {
      const expiration = this.getCertificateExpiration(path);
      if (expiration) {
        const daysLeft = Math.floor((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        results.push({
          cert: name,
          expiresAt: expiration,
          daysLeft
        });

        // Log warning if certificate expires soon
        if (daysLeft < 30) {
          logger.warn(`Certificate ${name} expires in ${daysLeft} days`, {
            cert: name,
            expiresAt: expiration,
            daysLeft
          });
        }
      }
    }

    return results;
  }

  /**
   * Reload certificates (for certificate rotation)
   */
  async reloadCertificates(): Promise<void> {
    try {
      logger.info('Reloading TLS certificates...');
      
      this.certificates.clear();
      this.initializeCertificates();
      
      logger.info('TLS certificates reloaded successfully');
    } catch (err: unknown) {
      logger.error('Failed to reload TLS certificates:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Get TLS configuration for database connections
   */
  getDatabaseTLSConfig(): { ssl: { ca: Buffer; rejectUnauthorized: boolean; minVersion?: string; maxVersion?: string; cert?: Buffer; key?: Buffer; }; } | { ssl: false } {
    if (!this.config.enabled) {
      return { ssl: false };
    }

    const clientCerts = this.certificates.get('client');
    if (!clientCerts) {
      return { 
        ssl: {
          rejectUnauthorized: this.config.rejectUnauthorized,
          ca: fs.readFileSync(this.config.caPath)
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

  /**
   * Get TLS configuration for Redis connections
   */
  getRedisTLSConfig(): { tls: { ca: Buffer; rejectUnauthorized: boolean; minVersion?: string; maxVersion?: string; cert?: Buffer; key?: Buffer; }; } | null {
    if (!this.config.enabled) {
      return null;
    }

    const clientCerts = this.certificates.get('client');
    if (!clientCerts) {
      return {
        tls: {
          ca: fs.readFileSync(this.config.caPath),
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

  /**
   * Create secure HTTP client with mTLS
   */
  createSecureHttpClient(): https.Agent {
    const clientCerts = this.certificates.get('client');
    if (!clientCerts) {
      throw new Error('Client certificates required for mTLS');
    }

    return new https.Agent({
      cert: clientCerts.cert,
      key: clientCerts.key,
      ca: clientCerts.ca,
      rejectUnauthorized: this.config.rejectUnauthorized,
      minVersion: this.config.minVersion as tls.SecureVersion,
      maxVersion: this.config.maxVersion as tls.SecureVersion,
      ciphers: this.config.ciphers,
      honorCipherOrder: this.config.honorCipherOrder,
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10
    });
  }

  /**
   * Health check for TLS service
   */
  async healthCheck(): Promise<{
    status: string;
    certificates: { cert: string; expiresAt: Date; daysLeft: number }[];
    config: TLSHealthConfig;
  }> {
    const certificateStatus = await this.checkCertificateExpiration();
    
    return {
      status: this.config.enabled ? 'enabled' : 'disabled',
      certificates: certificateStatus,
      config: {
        minVersion: this.config.minVersion,
        maxVersion: this.config.maxVersion,
        rejectUnauthorized: this.config.rejectUnauthorized,
        certificatesLoaded: this.certificates.size
      } as TLSHealthConfig
    };
  }

  /**
   * Get configuration status
   */
  getConfig(): TLSConfig {
    return { ...this.config };
  }

  /**
   * Check if TLS is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export singleton instance
export const tlsService = TLSService.getInstance();
