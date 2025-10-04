/**
 * Security Keys Configuration
 * 
 * Centralized configuration for all encryption keys, key IDs, and security-related identifiers.
 * All values should be loaded from environment variables in production.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

interface SecurityKeysConfig {
  // Encryption Key IDs
  securityLogsEncryptionKeyId: string;
  sbomSigningKeyId: string;
  communicationEncryptionKeyId: string;
  websocketEncryptionKeyId: string;
  backupEncryptionKeyId: string;
  storageEncryptionKeyId: string;
  logEncryptionKeyId: string;
  
  // Algorithm specifications
  defaultHashAlgorithm: string;
  defaultEncryptionAlgorithm: string;
  jwtAlgorithm: string;
}

/**
 * Load security configuration from environment variables with secure defaults
 */
function loadSecurityConfig(): SecurityKeysConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Validate required environment variables in production
  if (isProduction) {
    const requiredVars = [
      'SECURITY_LOGS_KEY_ID',
      'SBOM_SIGNING_KEY_ID',
      'COMMUNICATION_KEY_ID',
      'WEBSOCKET_KEY_ID',
      'BACKUP_KEY_ID',
      'STORAGE_KEY_ID',
      'LOG_KEY_ID'
    ];
    
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      const error = `CRITICAL: Missing required security key IDs in production: ${missing.join(', ')}`;
      logger.error(error);
      throw new Error(error);
    }
  }
  
  return {
    // Key IDs from environment or secure defaults for development
    securityLogsEncryptionKeyId: process.env.SECURITY_LOGS_KEY_ID || generateSecureKeyId('security-logs'),
    sbomSigningKeyId: process.env.SBOM_SIGNING_KEY_ID || generateSecureKeyId('sbom-signing'),
    communicationEncryptionKeyId: process.env.COMMUNICATION_KEY_ID || generateSecureKeyId('communication'),
    websocketEncryptionKeyId: process.env.WEBSOCKET_KEY_ID || generateSecureKeyId('websocket'),
    backupEncryptionKeyId: process.env.BACKUP_KEY_ID || generateSecureKeyId('backup'),
    storageEncryptionKeyId: process.env.STORAGE_KEY_ID || generateSecureKeyId('storage'),
    logEncryptionKeyId: process.env.LOG_KEY_ID || generateSecureKeyId('log'),
    
    // Algorithm specifications
    defaultHashAlgorithm: process.env.HASH_ALGORITHM || 'sha256',
    defaultEncryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    jwtAlgorithm: 'HS256',
  };
}

/**
 * Generate a secure key ID for development environments
 * @param purpose - The purpose of the key
 * @returns A secure key ID
 */
function generateSecureKeyId(purpose: string): string {
  const random = crypto.randomBytes(16).toString('hex');
  const keyId = `${purpose}-${random}`;
  
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`Generated temporary key ID for ${purpose}. Set ${purpose.toUpperCase().replace(/-/g, '_')}_KEY_ID in production!`);
  }
  
  return keyId;
}

// Export singleton instance
export const securityKeys: SecurityKeysConfig = loadSecurityConfig();

/**
 * Validate security configuration
 * @returns Object with validation result and any errors
 */
export function validateSecurityConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for placeholder values
  const placeholders = ['CHANGE_THIS', 'YOUR_', 'EXAMPLE_', 'TEST_'];
  Object.entries(securityKeys).forEach(([key, value]) => {
    if (typeof value === 'string' && placeholders.some(p => value.toUpperCase().includes(p))) {
      errors.push(`Security key ${key} appears to contain a placeholder value`);
    }
  });
  
  // Validate key lengths (minimum 32 characters for key IDs)
  const keyIdFields = [
    'securityLogsEncryptionKeyId',
    'sbomSigningKeyId',
    'communicationEncryptionKeyId',
    'websocketEncryptionKeyId',
    'backupEncryptionKeyId',
    'storageEncryptionKeyId',
    'logEncryptionKeyId'
  ];
  
  keyIdFields.forEach(field => {
    const value = securityKeys[field as keyof SecurityKeysConfig];
    if (typeof value === 'string' && value.length < 16) {
      errors.push(`Security key ${field} is too short (minimum 16 characters)`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get a specific security key by its type
 * @param keyType - The type of key to retrieve
 * @returns The key ID or throws an error if not found
 */
export function getSecurityKeyId(keyType: keyof SecurityKeysConfig): string {
  const keyId = securityKeys[keyType];
  if (!keyId) {
    throw new Error(`Security key ID not configured for type: ${keyType}`);
  }
  return String(keyId);
}

