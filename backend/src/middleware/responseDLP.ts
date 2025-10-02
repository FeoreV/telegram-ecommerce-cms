import { Request, Response, NextFunction } from 'express';
import { DataClassificationService, DataClassification } from '../services/DataClassificationService';
import { SecretLeakDetectionService } from '../services/SecretLeakDetectionService';

const dataClassificationService = DataClassificationService.getInstance();
const secretLeakDetectionService = SecretLeakDetectionService.getInstance();

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/profile',
  '/auth/verify',
  '/auth/telegram/login'
];

const isAuthEndpoint = (path: string): boolean => {
  if (!path) {
    return false;
  }

  return AUTH_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
};

export function responseDLP(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (this: Response, ...args: Parameters<Response['json']>) {
    const body = args[0];
    try {
      const serialized = JSON.stringify(body);
      
      // Skip DLP entirely in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        console.log(`DLP: Disabled in development mode - ${req.path}`);
        return originalJson(body);
      }
      
      // Perform comprehensive DLP scanning
      const dlpPromise = performDLPScan(serialized, req, 'json_response');
      
      // Don't await to avoid blocking response, but handle the result
      dlpPromise.then((shouldBlock) => {
        if (shouldBlock) {
          // Log security incident but response already sent
          console.warn(`DLP violation detected in response after sending - Request ID: ${(req as Request & { requestId?: string }).requestId}`);
        }
      }).catch((err: unknown) => {
        console.error('DLP scan error:', err as Record<string, unknown>);
      });

      // Enhanced sensitivity check with data classification
      const classification = dataClassificationService.classifyData(serialized);
      
      if (classification === DataClassification.RESTRICTED || classification === DataClassification.TOP_SECRET) {
        console.warn(`Blocking ${classification} data in response - Request ID: ${(req as Request & { requestId?: string }).requestId}`);
        return originalJson({ 
          error: 'Response blocked by DLP policy', 
          requestId: (req as Request & { requestId?: string }).requestId,
          classification: classification,
          timestamp: new Date().toISOString()
        });
      }

      // Check for secrets and PII (skip for auth endpoints)
      if (!isAuthEndpoint(req.path) && containsSensitiveData(serialized)) {
        console.warn(`Sensitive data detected in response - Request ID: ${(req as Request & { requestId?: string }).requestId}`);
        return originalJson({ 
          error: 'Response contains sensitive data and has been blocked', 
          requestId: (req as Request & { requestId?: string }).requestId,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err: unknown) {
      console.error('DLP processing error:', err as Record<string, unknown>);
    }
    return originalJson(body);
  }.bind(res);

  res.send = function (this: Response, ...args: Parameters<Response['send']>) {
    const body = args[0];
    try {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      
      // Skip DLP entirely in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        console.log(`DLP: Text response disabled in development mode - ${req.path}`);
        return originalSend(body);
      }
      
      // Perform DLP scanning for text responses
      performDLPScan(str, req, 'text_response').catch((err: unknown) => {
        console.error('DLP scan error for text response:', err as Record<string, unknown>);
      });

      // Check for sensitive data in text responses
      if (containsSensitiveData(str)) {
        console.warn(`Sensitive data detected in text response - Request ID: ${(req as Request & { requestId?: string }).requestId}`);
        return originalSend('Response blocked by DLP policy');
      }
      
    } catch (err: unknown) {
      console.error('DLP processing error for text response:', err as Record<string, unknown>);
    }
    return originalSend(body);
  }.bind(res);

  next();
}

// Enhanced DLP scanning function
async function performDLPScan(data: string, req: Request, responseType: string): Promise<boolean> {
  try {
    // Scan for secrets (this is async and returns void, but logs internally)
    await secretLeakDetectionService.scanLogEntry(data, `http_${responseType}`);
    
    // Classify data sensitivity
    const classification = dataClassificationService.classifyData(data);
    
    // Check if this violates DLP policies
    const shouldBlock = classification === DataClassification.RESTRICTED || 
                       classification === DataClassification.TOP_SECRET;
    
    if (shouldBlock) {
      // Log security incident
      console.error('DLP Policy Violation', {
        requestId: (req as Request & { requestId?: string }).requestId,
        classification,
        responseType,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }
    
    return shouldBlock;
  } catch (err: unknown) {
    console.error('DLP scan failed:', err as Record<string, unknown>);
    return false;
  }
}

// Enhanced sensitive data detection
function containsSensitiveData(data: string): boolean {
  const sensitivePatterns = [
    /password\s*[:=]\s*["'][^"']+["']/i,
    /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']+["']/i,
    /token\s*[:=]\s*["'][^"']+["']/i,
    /bearer\s+[a-zA-Z0-9._-]+/i,
    /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
    /\b[A-F0-9]{32}\b/i, // MD5 hash
    /\b[A-F0-9]{40}\b/i, // SHA1 hash
    /\b[A-F0-9]{64}\b/i  // SHA256 hash
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(data));
}


