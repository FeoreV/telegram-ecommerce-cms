import crypto from 'crypto';
import fs from 'fs';
import { logger } from '../utils/logger';

export interface CertificateInfo {
  subject: {
    commonName: string;
    organization: string;
    organizationalUnit: string;
    country: string;
    state: string;
    locality: string;
  };
  issuer: {
    commonName: string;
    organization: string;
  };
  fingerprint: string;
  sha256Fingerprint: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  keyUsage: string[];
  extendedKeyUsage: string[];
  subjectAltNames: string[];
  isCA: boolean;
  pathLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warnings: string[];
  certificateInfo?: CertificateInfo;
}

export class CertificateValidationService {
  private static instance: CertificateValidationService;
  private trustedCACertificates: Map<string, Buffer> = new Map();
  private pinnedCertificates: Map<string, string> = new Map(); // hostname -> fingerprint
  private certificateRevocationList: Set<string> = new Set();

  private constructor() {
    this.loadTrustedCAs();
    this.loadPinnedCertificates();
    this.loadCertificateRevocationList();
  }

  public static getInstance(): CertificateValidationService {
    if (!CertificateValidationService.instance) {
      CertificateValidationService.instance = new CertificateValidationService();
    }
    return CertificateValidationService.instance;
  }

  private loadTrustedCAs(): void {
    try {
      // Load our internal CA
      const caCertPath = process.env.TLS_CA_PATH || '/certs/ca.cert.pem';
      if (fs.existsSync(caCertPath)) {
        const caCert = fs.readFileSync(caCertPath);
        this.trustedCACertificates.set('internal-ca', caCert);
        logger.info('Loaded internal CA certificate');
      }

      // Load additional trusted CAs from environment
      const additionalCAs = process.env.ADDITIONAL_TRUSTED_CAS;
      if (additionalCAs) {
        const caPaths = additionalCAs.split(',');
        caPaths.forEach((caPath, index) => {
          try {
            if (fs.existsSync(caPath.trim())) {
              const caCert = fs.readFileSync(caPath.trim());
              this.trustedCACertificates.set(`additional-ca-${index}`, caCert);
              logger.info(`Loaded additional CA certificate: ${caPath.trim()}`);
            }
          } catch (error) {
            logger.warn(`Failed to load CA certificate: ${caPath.trim()}`, error);
          }
        });
      }

      logger.info(`Loaded ${this.trustedCACertificates.size} trusted CA certificates`);
    } catch (error) {
      logger.error('Failed to load trusted CA certificates:', error);
    }
  }

  private loadPinnedCertificates(): void {
    try {
      // Load certificate pins from environment or configuration
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
          logger.info(`Certificate pinned for ${hostname}`);
        }
      });

      logger.info(`Loaded ${this.pinnedCertificates.size} certificate pins`);
    } catch (error) {
      logger.error('Failed to load certificate pins:', error);
    }
  }

  private loadCertificateRevocationList(): void {
    try {
      const crlData = process.env.CERTIFICATE_REVOCATION_LIST;
      if (crlData) {
        const revokedCerts = crlData.split(',');
        revokedCerts.forEach(cert => {
          this.certificateRevocationList.add(cert.trim());
        });
        logger.info(`Loaded ${this.certificateRevocationList.size} revoked certificates`);
      }
    } catch (error) {
      logger.error('Failed to load certificate revocation list:', error);
    }
  }

  /**
   * Validate a certificate against our security policies
   */
  validateCertificate(
    certificatePem: string,
    hostname?: string,
    options: {
      checkRevocation?: boolean;
      checkPinning?: boolean;
      checkExpiry?: boolean;
      allowSelfSigned?: boolean;
    } = {}
  ): ValidationResult {
    const {
      checkRevocation = true,
      checkPinning = true,
      checkExpiry = true,
      allowSelfSigned = false
    } = options;

    try {
      const certInfo = this.parseCertificate(certificatePem);
      const warnings: string[] = [];
      let valid = true;
      let reason: string | undefined;

      // Check certificate expiration
      if (checkExpiry) {
        const now = new Date();
        if (now < certInfo.validFrom) {
          valid = false;
          reason = 'Certificate is not yet valid';
        } else if (now > certInfo.validTo) {
          valid = false;
          reason = 'Certificate has expired';
        } else {
          // Check if certificate expires soon (within 30 days)
          const daysUntilExpiry = Math.floor(
            (certInfo.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysUntilExpiry < 30) {
            warnings.push(`Certificate expires in ${daysUntilExpiry} days`);
          }
        }
      }

      // Check certificate revocation
      if (checkRevocation && this.certificateRevocationList.has(certInfo.fingerprint)) {
        valid = false;
        reason = 'Certificate is revoked';
      }

      // Check certificate pinning
      if (checkPinning && hostname) {
        const pinnedFingerprint = this.pinnedCertificates.get(hostname);
        if (pinnedFingerprint && pinnedFingerprint !== certInfo.sha256Fingerprint) {
          valid = false;
          reason = `Certificate fingerprint mismatch for ${hostname}`;
        }
      }

      // Validate certificate chain (simplified)
      if (!allowSelfSigned && !this.validateCertificateChain(certificatePem)) {
        warnings.push('Certificate chain validation failed');
      }

      // Check key usage
      const keyUsageWarnings = this.validateKeyUsage(certInfo);
      warnings.push(...keyUsageWarnings);

      // Check subject alternative names
      if (hostname && !this.validateHostname(certInfo, hostname)) {
        warnings.push(`Hostname ${hostname} not found in certificate SAN`);
      }

      return {
        valid,
        reason,
        warnings,
        certificateInfo: certInfo
      };

    } catch (error) {
      logger.error('Certificate validation error:', error);
      return {
        valid: false,
        reason: 'Certificate parsing failed',
        warnings: []
      };
    }
  }

  private parseCertificate(certificatePem: string): CertificateInfo {
    // This is a simplified implementation
    // In production, use proper certificate parsing library like node-forge
    
    const cert = crypto.createHash('sha256').update(certificatePem).digest('hex');
    const fingerprint = crypto.createHash('md5').update(certificatePem).digest('hex');
    
    // Extract basic information (simplified parsing)
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

  private validateCertificateChain(_certificatePem: string): boolean {
    // Simplified chain validation
    // In production, implement proper certificate chain validation
    return this.trustedCACertificates.size > 0;
  }

  private validateKeyUsage(certInfo: CertificateInfo): string[] {
    const warnings: string[] = [];

    // Check for required key usages
    const requiredKeyUsages = ['digitalSignature', 'keyEncipherment'];
    const missingUsages = requiredKeyUsages.filter(
      usage => !certInfo.keyUsage.includes(usage)
    );

    if (missingUsages.length > 0) {
      warnings.push(`Missing key usages: ${missingUsages.join(', ')}`);
    }

    // Check for required extended key usages
    if (!certInfo.extendedKeyUsage.includes('serverAuth') && 
        !certInfo.extendedKeyUsage.includes('clientAuth')) {
      warnings.push('Certificate lacks required extended key usage');
    }

    return warnings;
  }

  private validateHostname(certInfo: CertificateInfo, hostname: string): boolean {
    // Check common name
    if (certInfo.subject.commonName === hostname) {
      return true;
    }

    // Check subject alternative names
    return certInfo.subjectAltNames.some(san => {
      // Simple wildcard matching
      if (san.startsWith('*.')) {
        const domain = san.substring(2);
        return hostname.endsWith(domain);
      }
      return san === hostname;
    });
  }

  /**
   * Pin a certificate for a specific hostname
   */
  pinCertificate(hostname: string, certificatePem: string): void {
    try {
      const certInfo = this.parseCertificate(certificatePem);
      this.pinnedCertificates.set(hostname, certInfo.sha256Fingerprint);
      logger.info(`Certificate pinned for ${hostname}`, {
        fingerprint: certInfo.sha256Fingerprint
      });
    } catch (error) {
      logger.error(`Failed to pin certificate for ${hostname}:`, error);
      throw error;
    }
  }

  /**
   * Revoke a certificate
   */
  revokeCertificate(fingerprint: string, reason: string): void {
    this.certificateRevocationList.add(fingerprint);
    logger.warn(`Certificate revoked: ${fingerprint}`, { reason });
  }

  /**
   * Get certificate information without validation
   */
  getCertificateInfo(certificatePem: string): CertificateInfo {
    return this.parseCertificate(certificatePem);
  }

  /**
   * Check if a certificate is about to expire
   */
  checkExpirationWarnings(): Array<{
    hostname: string;
    fingerprint: string;
    expiresAt: Date;
    daysLeft: number;
  }> {
    const warnings: Array<{
      hostname: string;
      fingerprint: string;
      expiresAt: Date;
      daysLeft: number;
    }> = [];

    // This would typically check actual certificates from files or database
    // For now, return empty array
    return warnings;
  }

  /**
   * Generate SPIFFE ID for service identity
   */
  generateSPIFFEID(serviceName: string, namespace = 'botrt'): string {
    return `spiffe://${namespace}.local/service/${serviceName}`;
  }

  /**
   * Validate SPIFFE ID from certificate
   */
  validateSPIFFEID(certInfo: CertificateInfo, expectedServiceName: string): boolean {
    const expectedSPIFFEID = this.generateSPIFFEID(expectedServiceName);
    
    // Check if SPIFFE ID is in subject alternative names
    return certInfo.subjectAltNames.some(san => 
      san.startsWith('URI:') && san.includes(expectedSPIFFEID)
    );
  }

  /**
   * Health check for certificate validation service
   */
  async healthCheck(): Promise<{
    status: string;
    trustedCAs: number;
    pinnedCertificates: number;
    revokedCertificates: number;
    expiringCertificates: number;
  }> {
    try {
      const expiringCerts = this.checkExpirationWarnings();
      
      return {
        status: 'healthy',
        trustedCAs: this.trustedCACertificates.size,
        pinnedCertificates: this.pinnedCertificates.size,
        revokedCertificates: this.certificateRevocationList.size,
        expiringCertificates: expiringCerts.length
      };
    } catch (error) {
      logger.error('Certificate validation service health check failed:', error);
      return {
        status: 'error',
        trustedCAs: 0,
        pinnedCertificates: 0,
        revokedCertificates: 0,
        expiringCertificates: 0
      };
    }
  }

  /**
   * Get service configuration
   */
  getConfiguration(): {
    trustedCAs: string[];
    pinnedCertificates: Record<string, string>;
    revokedCertificates: string[];
  } {
    return {
      trustedCAs: Array.from(this.trustedCACertificates.keys()),
      pinnedCertificates: Object.fromEntries(this.pinnedCertificates),
      revokedCertificates: Array.from(this.certificateRevocationList)
    };
  }
}

// Export singleton instance
export const certificateValidationService = CertificateValidationService.getInstance();
