import { Request, Response, NextFunction } from 'express';
import { TLSSocket } from 'tls';
import { PeerCertificate } from 'tls';
import { tlsService } from '../services/TLSService';
import { logger } from '../utils/logger';

export interface MTLSRequest extends Request {
  clientCertificate?: PeerCertificate;
  mtlsVerified?: boolean;
  serviceIdentity?: string;
}

export interface ServiceIdentity {
  commonName: string;
  organization: string;
  organizationalUnit: string;
  fingerprint: string;
  validFrom: Date;
  validTo: Date;
}

class MTLSValidator {
  private static instance: MTLSValidator;
  private trustedServices: Map<string, ServiceIdentity> = new Map();
  private certificateRevocationList: Set<string> = new Set();

  private constructor() {
    this.loadTrustedServices();
  }

  public static getInstance(): MTLSValidator {
    if (!MTLSValidator.instance) {
      MTLSValidator.instance = new MTLSValidator();
    }
    return MTLSValidator.instance;
  }

  private loadTrustedServices(): void {
    // Load trusted service certificates from configuration
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

    logger.info(`Loaded ${this.trustedServices.size} trusted service certificates`);
  }

  validateClientCertificate(cert: PeerCertificate): {
    valid: boolean;
    identity?: ServiceIdentity;
    reason?: string;
  } {
    try {
      // Check if certificate is present
      if (!cert || !cert.subject) {
        return { valid: false, reason: 'No client certificate provided' };
      }

      // Extract certificate details
      const commonName = cert.subject.CN;
      const organization = cert.subject.O;
      const fingerprint = cert.fingerprint;

      // Check if certificate is revoked
      if (this.certificateRevocationList.has(fingerprint)) {
        return { valid: false, reason: 'Certificate is revoked' };
      }

      // Check if service is trusted
      const trustedService = this.trustedServices.get(commonName);
      if (!trustedService) {
        return { valid: false, reason: `Unknown service: ${commonName}` };
      }

      // Validate organization
      if (organization !== trustedService.organization) {
        return { 
          valid: false, 
          reason: `Invalid organization: expected ${trustedService.organization}, got ${organization}` 
        };
      }

      // Check certificate expiration
      const now = new Date();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);

      if (now < validFrom) {
        return { valid: false, reason: 'Certificate not yet valid' };
      }

      if (now > validTo) {
        return { valid: false, reason: 'Certificate has expired' };
      }

      // Check if certificate expires soon (within 30 days)
      const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30) {
        logger.warn(`Client certificate for ${commonName} expires in ${daysUntilExpiry} days`, {
          service: commonName,
          expiresAt: validTo,
          daysLeft: daysUntilExpiry
        });
      }

      // Validate fingerprint if configured
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

    } catch (error) {
      logger.error('Certificate validation error:', error);
      return { valid: false, reason: 'Certificate validation failed' };
    }
  }

  addTrustedService(identity: ServiceIdentity): void {
    this.trustedServices.set(identity.commonName, identity);
    logger.info(`Added trusted service: ${identity.commonName}`);
  }

  revokeCertificate(fingerprint: string, reason: string): void {
    this.certificateRevocationList.add(fingerprint);
    logger.warn(`Certificate revoked: ${fingerprint}, reason: ${reason}`);
  }

  getTrustedServices(): ServiceIdentity[] {
    return Array.from(this.trustedServices.values());
  }

  getCertificateRevocationList(): string[] {
    return Array.from(this.certificateRevocationList);
  }
}

const mtlsValidator = MTLSValidator.getInstance();

/**
 * Middleware to enforce mTLS authentication
 */
export const mtlsAuthMiddleware = (
  req: MTLSRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // Skip mTLS if not enabled
    if (!tlsService.isEnabled()) {
      logger.debug('mTLS disabled, skipping certificate validation');
      return next();
    }

    // Check if connection is secure
    if (!req.secure && req.get('X-Forwarded-Proto') !== 'https') {
      logger.warn('Non-HTTPS request received', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(426).json({
        error: 'HTTPS Required',
        message: 'This endpoint requires a secure connection'
      });
    }

    // Get client certificate from TLS socket
    const socket = req.socket as TLSSocket;
    const clientCert = socket.getPeerCertificate();

    if (!clientCert || !clientCert.subject) {
      logger.warn('mTLS authentication failed: No client certificate', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Client Certificate Required',
        message: 'This endpoint requires mTLS authentication'
      });
    }

    // Validate client certificate
    const validation = mtlsValidator.validateClientCertificate(clientCert);
    
    if (!validation.valid) {
      logger.warn('mTLS authentication failed', {
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

    // Attach certificate information to request
    req.clientCertificate = clientCert;
    req.mtlsVerified = true;
    req.serviceIdentity = validation.identity?.commonName;

    logger.info('mTLS authentication successful', {
      service: validation.identity?.commonName,
      organization: validation.identity?.organization,
      fingerprint: validation.identity?.fingerprint,
      ip: req.ip,
      path: req.path
    });

    next();

  } catch (error) {
    logger.error('mTLS middleware error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate validation failed'
    });
  }
};

/**
 * Middleware to log mTLS certificate information
 */
export const mtlsLoggingMiddleware = (
  req: MTLSRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.mtlsVerified && req.clientCertificate) {
    const cert = req.clientCertificate;
    
    logger.info('mTLS request', {
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

/**
 * Middleware to require specific service identity
 */
export const requireServiceIdentity = (allowedServices: string[]) => {
  return (req: MTLSRequest, res: Response, next: NextFunction): Response | void => {
    if (!req.mtlsVerified || !req.serviceIdentity) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'mTLS authentication required'
      });
    }

    if (!allowedServices.includes(req.serviceIdentity)) {
      logger.warn('Service access denied', {
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

/**
 * Health check endpoint for mTLS status
 */
export const mtlsHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const tlsHealth = await tlsService.healthCheck();
    const trustedServices = mtlsValidator.getTrustedServices();
    const revokedCerts = mtlsValidator.getCertificateRevocationList();

    res.json({
      status: 'healthy',
      tls: tlsHealth,
      mtls: {
        enabled: tlsService.isEnabled(),
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
  } catch (error) {
    logger.error('mTLS health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

export { mtlsValidator };
