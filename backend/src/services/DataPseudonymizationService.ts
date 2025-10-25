import * as crypto from 'crypto';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../utils/logger';
import { encryptionService } from './EncryptionService';
import { securityLogService } from './SecurityLogService';
import { getVaultService } from './VaultService';
const vaultService = getVaultService();

export enum PseudonymizationMethod {
  HASH = 'hash',                    // One-way hash with salt
  TOKENIZATION = 'tokenization',    // Format-preserving tokenization
  ENCRYPTION = 'encryption',        // Reversible encryption
  SYNTHETIC = 'synthetic',          // Synthetic data generation
  MASKING = 'masking',             // Pattern-based masking
  GENERALIZATION = 'generalization', // Data generalization
  SUPPRESSION = 'suppression'       // Data suppression
}

export enum ReversibilityLevel {
  IRREVERSIBLE = 'irreversible',   // Cannot be reversed
  RESTRICTED = 'restricted',       // Reversible with special access
  CONDITIONAL = 'conditional',     // Reversible under conditions
  REVERSIBLE = 'reversible'        // Fully reversible
}

export interface PseudonymizationRule {
  id: string;
  name: string;
  description: string;

  // Targeting
  fieldPattern: RegExp;
  tablePattern?: RegExp;
  dataTypes: string[];

  // Method configuration
  method: PseudonymizationMethod;
  reversibility: ReversibilityLevel;
  preserveFormat: boolean;
  preserveDistribution: boolean;

  // Transformation settings
  hashAlgorithm?: string;
  saltLength?: number;
  encryptionKeyId?: string;
  tokenizationFormat?: string;

  // Conditions
  conditions: {
    minLength?: number;
    maxLength?: number;
    dataPattern?: RegExp;
    purpose?: string[];
    environment?: ('production' | 'staging' | 'test' | 'development')[];
  };

  // Quality settings
  consistencyRequired: boolean;  // Same input -> same output
  uniquenessRequired: boolean;   // Unique inputs -> unique outputs

  // Compliance
  regulations: string[];
  legalBasis: string[];
  retentionPeriod: number;

  // Implementation
  enabled: boolean;
  priority: number;
  validateBeforeTransform: boolean;
  validateAfterTransform: boolean;
}

export interface PseudonymizationKey {
  id: string;
  keyId: string;
  algorithm: string;
  purpose: string;
  createdAt: Date;
  expiresAt?: Date;
  rotationSchedule?: string;
  usageCount: number;
  maxUsage?: number;
}

export interface TransformationResult {
  id: string;
  originalValue: string;
  transformedValue: string;
  method: PseudonymizationMethod;
  ruleId: string;
  keyId?: string;

  // Metadata
  transformedAt: Date;
  transformedBy: string;
  reversible: boolean;

  // Quality metrics
  formatPreserved: boolean;
  lengthPreserved: boolean;
  typePreserved: boolean;
  distributionPreserved: boolean;

  // Compliance
  purposes: string[];
  legalBasis: string[];
  retentionPeriod: number;

  // Validation
  validated: boolean;
  validationErrors: string[];
}

export interface PseudonymizationJob {
  id: string;
  type: 'transform' | 'reverse' | 'validate' | 'rotate';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  // Configuration
  scope: {
    tables: string[];
    fields: string[];
    conditions: Record<string, any>;
  };

  // Execution
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // Results
  recordsProcessed: number;
  transformationsApplied: number;
  validationErrors: string[];

  // Quality assessment
  qualityScore: number;
  consistencyScore: number;
  uniquenessScore: number;

  // Metadata
  executedBy: string;
  approvalRequired: boolean;
  approvedBy?: string;

  // Progress tracking
  progress: number; // 0-100
  currentTable?: string;
  estimatedCompletion?: Date;
}

export interface TokenMapping {
  originalHash: string;      // Hash of original value for lookup
  tokenValue: string;        // Generated token
  format: string;           // Format specification
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  keyVersion: string;
  expiresAt?: Date;
}

export class DataPseudonymizationService {
  private static instance: DataPseudonymizationService;
  private pseudonymizationRules: Map<string, PseudonymizationRule> = new Map();
  private pseudonymizationKeys: Map<string, PseudonymizationKey> = new Map();
  private transformationResults: Map<string, TransformationResult> = new Map();
  private activeJobs: Map<string, PseudonymizationJob> = new Map();
  private tokenMappings: Map<string, TokenMapping> = new Map();
  private formatPreservers: Map<string, any> = new Map();

  private constructor() {
    this.loadPseudonymizationRules();
    this.setupFormatPreservers();
    // Async initialization will be handled separately
  }

  private async initialize(): Promise<void> {
    await this.initializeDataPseudonymization();

    logger.info('Data Pseudonymization Service initialized', {
      rules: this.pseudonymizationRules.size,
      keys: this.pseudonymizationKeys.size,
      formatPreservers: this.formatPreservers.size
    });
  }

  public static async getInstance(): Promise<DataPseudonymizationService> {
    if (!DataPseudonymizationService.instance) {
      DataPseudonymizationService.instance = new DataPseudonymizationService();
      await DataPseudonymizationService.instance.initialize();
    }
    return DataPseudonymizationService.instance;
  }

  private async initializeDataPseudonymization(): Promise<void> {
    try {
      // Initialize cryptographic keys
      await this.initializePseudonymizationKeys();

      // Load existing transformations
      await this.loadExistingTransformations();

      // Validate service health
      await this.validateServiceHealth();

      logger.info('Data pseudonymization initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize data pseudonymization:', error);
      throw error;
    }
  }

  private async initializePseudonymizationKeys(): Promise<void> {
    try {
      // Create or retrieve pseudonymization keys
      const keyTypes = [
        'hash-salt-key',
        'tokenization-key',
        'format-preserving-key',
        'synthetic-data-key'
      ];

      for (const keyType of keyTypes) {
        let keyValue = await vaultService.getSecret(`pseudonymization-keys/${keyType}`);

        if (!keyValue) {
          // Generate new key
          const keyBuffer = crypto.randomBytes(32); // 256-bit key
          keyValue = keyBuffer.toString('base64') as any;

          await vaultService.putSecret(`pseudonymization-keys/${keyType}`, { key: keyValue });

          logger.info(`Generated new pseudonymization key: ${keyType}`);
        }

        const pseudoKey: PseudonymizationKey = {
          id: keyType,
          keyId: `pseudonymization-keys/${keyType}`,
          algorithm: 'AES-256-GCM',
          purpose: keyType,
          createdAt: new Date(),
          rotationSchedule: '90d',
          usageCount: 0
        };

        this.pseudonymizationKeys.set(keyType, pseudoKey);
      }

      logger.info('Pseudonymization keys initialized');

    } catch (error) {
      logger.error('Failed to initialize pseudonymization keys:', error);
      throw error;
    }
  }

  private async loadExistingTransformations(): Promise<void> {
    // Load existing transformation mappings
    logger.debug('Loading existing transformation mappings');
  }

  private async validateServiceHealth(): Promise<void> {
    // Validate service health and dependencies
    logger.debug('Validating pseudonymization service health');
  }

  private loadPseudonymizationRules(): void {
    // Email pseudonymization rule
    const emailRule: PseudonymizationRule = {
      id: 'email-tokenization',
      name: 'Email Address Tokenization',
      description: 'Tokenize email addresses while preserving domain for analytics',
      fieldPattern: /email/i,
      dataTypes: ['varchar', 'text', 'string'],
      method: PseudonymizationMethod.TOKENIZATION,
      reversibility: ReversibilityLevel.RESTRICTED,
      preserveFormat: true,
      preserveDistribution: false,
      // NOTE: This is a format identifier, not a credential (CWE-798 false positive)
      tokenizationFormat: 'email',
      conditions: {
        minLength: 5,
        dataPattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        purpose: ['analytics', 'testing'],
        environment: ['staging', 'test', 'development']
      },
      consistencyRequired: true,
      uniquenessRequired: true,
      regulations: ['GDPR', 'CCPA'],
      legalBasis: ['pseudonymous_data_processing'],
      retentionPeriod: 1095, // 3 years
      enabled: true,
      priority: 1,
      validateBeforeTransform: true,
      validateAfterTransform: true
    };

    // Phone number masking rule
    const phoneRule: PseudonymizationRule = {
      id: 'phone-masking',
      name: 'Phone Number Masking',
      description: 'Mask phone numbers while preserving country code and format',
      fieldPattern: /phone|mobile|tel/i,
      dataTypes: ['varchar', 'text', 'string'],
      method: PseudonymizationMethod.MASKING,
      reversibility: ReversibilityLevel.IRREVERSIBLE,
      preserveFormat: true,
      preserveDistribution: true,
      conditions: {
        minLength: 7,
        dataPattern: /^\+?[1-9]\d{1,14}$/,
        purpose: ['analytics', 'reporting'],
        environment: ['staging', 'test', 'development']
      },
      consistencyRequired: false,
      uniquenessRequired: false,
      regulations: ['GDPR', 'CCPA'],
      legalBasis: ['legitimate_interest'],
      retentionPeriod: 1095,
      enabled: true,
      priority: 2,
      validateBeforeTransform: true,
      validateAfterTransform: true
    };

    // Name hashing rule
    const nameRule: PseudonymizationRule = {
      id: 'name-hashing',
      name: 'Name Field Hashing',
      description: 'Hash personal names for analytics while maintaining uniqueness',
      fieldPattern: /name|first_name|last_name|full_name/i,
      dataTypes: ['varchar', 'text', 'string'],
      method: PseudonymizationMethod.HASH,
      reversibility: ReversibilityLevel.IRREVERSIBLE,
      preserveFormat: false,
      preserveDistribution: false,
      hashAlgorithm: 'SHA-256',
      saltLength: 16,
      conditions: {
        minLength: 1,
        purpose: ['analytics', 'research'],
        environment: ['staging', 'test', 'development']
      },
      consistencyRequired: true,
      uniquenessRequired: true,
      regulations: ['GDPR', 'CCPA'],
      legalBasis: ['pseudonymous_data_processing'],
      retentionPeriod: 2555, // 7 years
      enabled: true,
      priority: 3,
      validateBeforeTransform: true,
      validateAfterTransform: true
    };

    // Address generalization rule
    const addressRule: PseudonymizationRule = {
      id: 'address-generalization',
      name: 'Address Generalization',
      description: 'Generalize addresses to postal code level for geographic analytics',
      fieldPattern: /address|street|location/i,
      dataTypes: ['varchar', 'text', 'string'],
      method: PseudonymizationMethod.GENERALIZATION,
      reversibility: ReversibilityLevel.IRREVERSIBLE,
      preserveFormat: false,
      preserveDistribution: true,
      conditions: {
        minLength: 5,
        purpose: ['geographic_analytics', 'demographics'],
        environment: ['staging', 'test', 'development']
      },
      consistencyRequired: false,
      uniquenessRequired: false,
      regulations: ['GDPR'],
      legalBasis: ['legitimate_interest'],
      retentionPeriod: 1095,
      enabled: true,
      priority: 4,
      validateBeforeTransform: true,
      validateAfterTransform: true
    };

    // Sensitive ID encryption rule
    const sensitiveIdRule: PseudonymizationRule = {
      id: 'sensitive-id-encryption',
      name: 'Sensitive ID Encryption',
      description: 'Encrypt sensitive IDs while maintaining referential integrity',
      fieldPattern: /ssn|passport|driver_license|tax_id/i,
      dataTypes: ['varchar', 'text', 'string'],
      method: PseudonymizationMethod.ENCRYPTION,
      reversibility: ReversibilityLevel.RESTRICTED,
      preserveFormat: false,
      preserveDistribution: false,
      encryptionKeyId: 'format-preserving-key',
      conditions: {
        minLength: 5,
        purpose: ['compliance', 'audit'],
        environment: ['production', 'staging']
      },
      consistencyRequired: true,
      uniquenessRequired: true,
      regulations: ['GDPR', 'CCPA', 'HIPAA'],
      legalBasis: ['legal_obligation', 'vital_interests'],
      retentionPeriod: 2555,
      enabled: true,
      priority: 10,
      validateBeforeTransform: true,
      validateAfterTransform: true
    };

    this.pseudonymizationRules.set(emailRule.id, emailRule);
    this.pseudonymizationRules.set(phoneRule.id, phoneRule);
    this.pseudonymizationRules.set(nameRule.id, nameRule);
    this.pseudonymizationRules.set(addressRule.id, addressRule);
    this.pseudonymizationRules.set(sensitiveIdRule.id, sensitiveIdRule);

    logger.info('Pseudonymization rules loaded', {
      ruleCount: this.pseudonymizationRules.size
    });
  }

  private setupFormatPreservers(): void {
    // Email format preserver
    this.formatPreservers.set('email', {
      pattern: /^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
      transform: (match: RegExpMatchArray) => {
        const localPart = this.generateToken(match[1], 'alphanumeric', match[1].length);
        return `${localPart}@${match[2]}`;
      }
    });

    // Phone format preserver
    this.formatPreservers.set('phone', {
      pattern: /^(\+?[1-9])(\d{3})(\d{3})(\d{4})$/,
      transform: (match: RegExpMatchArray) => {
        const masked = match[2].replace(/\d/g, 'X') +
                      match[3].replace(/\d/g, 'X') +
                      match[4];
        return `${match[1]}${masked}`;
      }
    });

    // Credit card format preserver
    this.formatPreservers.set('credit_card', {
      pattern: /^(\d{4})(\d{4})(\d{4})(\d{4})$/,
      transform: (match: RegExpMatchArray) => {
        return `${match[1]}XXXXXXXX${match[4]}`;
      }
    });

    logger.debug('Format preservers setup completed');
  }

  /**
   * Transform data using pseudonymization rules
   */
  async transformData(
    data: Record<string, any>,
    tableName: string,
    _environment: string = 'production'
  ): Promise<{
    transformedData: Record<string, any>;
    transformations: TransformationResult[];
    qualityScore: number;
  }> {
    const transformations: TransformationResult[] = [];
    const transformedData = { ...data };
    let totalQualityScore = 0;
    let transformationCount = 0;

    try {
      for (const [fieldName, originalValue] of Object.entries(data)) {
        if (originalValue === null || originalValue === undefined) {
          continue;
        }

        const applicableRules = this.findApplicableRules(fieldName, tableName, originalValue, _environment);

        if (applicableRules.length > 0) {
          // Apply highest priority rule
          const rule = applicableRules[0];

          try {
            const transformation = await this.applyTransformation(
              fieldName,
              originalValue.toString(),
              rule,
              _environment
            );

            transformations.push(transformation);
            transformedData[fieldName] = transformation.transformedValue;

            // Calculate quality score for this transformation
            const qualityScore = this.calculateTransformationQuality(transformation);
            totalQualityScore += qualityScore;
            transformationCount++;

          } catch (error) {
            logger.error('Transformation failed', {
              field: fieldName,
              rule: rule.id,
              error: getErrorMessage(error)
            });
          }
        }
      }

      const overallQualityScore = transformationCount > 0
        ? totalQualityScore / transformationCount
        : 100;

      logger.debug('Data transformation completed', {
        tableName,
        environment: _environment,
        transformationsApplied: transformations.length,
        qualityScore: overallQualityScore
      });

      // Log transformation event
      await securityLogService.logSecurityEvent({
        eventType: 'data_pseudonymization_applied',
        severity: 'LOW',
        category: 'data_access',
        ipAddress: '82.147.84.78',
        success: true,
        details: {
          tableName,
          environment: _environment,
          transformationsApplied: transformations.length,
          qualityScore: overallQualityScore
        },
        riskScore: 10,
        tags: ['data_pseudonymization', 'privacy', 'data_protection'],
        compliance: {
          pii: true,
          gdpr: true,
          pci: false,
          hipaa: false
        }
      });

      return {
        transformedData,
        transformations,
        qualityScore: overallQualityScore
      };

    } catch (error) {
      logger.error('Data transformation failed:', error);
      throw error;
    }
  }

  private findApplicableRules(
    fieldName: string,
    tableName: string,
    value: any,
    environment: string
  ): PseudonymizationRule[] {
    const applicableRules: PseudonymizationRule[] = [];

    for (const rule of this.pseudonymizationRules.values()) {
      if (!rule.enabled) continue;

      // Check field pattern
      if (!rule.fieldPattern.test(fieldName)) continue;

      // Check table pattern if specified
      if (rule.tablePattern && !rule.tablePattern.test(tableName)) continue;

      // Check environment
      if (rule.conditions.environment &&
          !rule.conditions.environment.includes(environment as any)) continue;

      // Check data pattern if specified
      if (rule.conditions.dataPattern &&
          !rule.conditions.dataPattern.test(value.toString())) continue;

      // Check length constraints
      const valueLength = value.toString().length;
      if (rule.conditions.minLength && valueLength < rule.conditions.minLength) continue;
      if (rule.conditions.maxLength && valueLength > rule.conditions.maxLength) continue;

      applicableRules.push(rule);
    }

    // Sort by priority (higher priority first)
    return applicableRules.sort((a, b) => b.priority - a.priority);
  }

  private async applyTransformation(
    fieldName: string,
    originalValue: string,
    rule: PseudonymizationRule,
    _environment: string
  ): Promise<TransformationResult> {
    const transformationId = crypto.randomUUID();

    // Validate before transformation
    if (rule.validateBeforeTransform) {
      await this.validateInput(originalValue, rule);
    }

    let transformedValue: string;

    switch (rule.method) {
      case PseudonymizationMethod.HASH:
        transformedValue = await this.applyHashTransformation(originalValue, rule);
        break;
      case PseudonymizationMethod.TOKENIZATION:
        transformedValue = await this.applyTokenization(originalValue, rule);
        break;
      case PseudonymizationMethod.ENCRYPTION:
        transformedValue = await this.applyEncryption(originalValue, rule);
        break;
      case PseudonymizationMethod.MASKING:
        transformedValue = await this.applyMasking(originalValue, rule);
        break;
      case PseudonymizationMethod.GENERALIZATION:
        transformedValue = await this.applyGeneralization(originalValue, rule);
        break;
      case PseudonymizationMethod.SYNTHETIC:
        transformedValue = await this.applySyntheticGeneration(originalValue, rule);
        break;
      case PseudonymizationMethod.SUPPRESSION:
        transformedValue = await this.applySuppression(originalValue, rule);
        break;
      default:
        throw new Error(`Unsupported pseudonymization method: ${rule.method}`);
    }

    // Create transformation result
    const transformation: TransformationResult = {
      id: transformationId,
      originalValue,
      transformedValue,
      method: rule.method,
      ruleId: rule.id,
      keyId: rule.encryptionKeyId,
      transformedAt: new Date(),
      transformedBy: 'system',
      reversible: rule.reversibility !== ReversibilityLevel.IRREVERSIBLE,
      formatPreserved: rule.preserveFormat && this.isFormatPreserved(originalValue, transformedValue, rule),
      lengthPreserved: originalValue.length === transformedValue.length,
      typePreserved: this.isTypePreserved(originalValue, transformedValue),
      distributionPreserved: rule.preserveDistribution,
      purposes: rule.conditions.purpose || [],
      legalBasis: rule.legalBasis,
      retentionPeriod: rule.retentionPeriod,
      validated: false,
      validationErrors: []
    };

    // Validate after transformation
    if (rule.validateAfterTransform) {
      const validationResult = await this.validateTransformation(transformation, rule);
      transformation.validated = validationResult.valid;
      transformation.validationErrors = validationResult.errors;
    }

    // Store transformation
    this.transformationResults.set(transformationId, transformation);

    return transformation;
  }

  private async applyHashTransformation(value: string, rule: PseudonymizationRule): Promise<string> {
    const algorithm = rule.hashAlgorithm || 'SHA-256';
    const saltLength = rule.saltLength || 16;

    // Generate or retrieve consistent salt for this rule
    const saltKey = `hash-salt-${rule.id}`;
    let salt = await vaultService.getSecret(`pseudonymization-salts/${saltKey}`);

    if (!salt) {
      salt = crypto.randomBytes(saltLength).toString('hex') as any;
      await vaultService.putSecret(`pseudonymization-salts/${saltKey}`, { salt });
    }

    const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
    hash.update(value + salt);

    return hash.digest('hex');
  }

  private async applyTokenization(value: string, rule: PseudonymizationRule): Promise<string> {
    const originalHash = crypto.createHash('sha256').update(value).digest('hex');

    // Check if we already have a token for this value
    const existingMapping = Array.from(this.tokenMappings.values())
      .find(mapping => mapping.originalHash === originalHash);

    if (existingMapping && rule.consistencyRequired) {
      existingMapping.lastUsed = new Date();
      existingMapping.usageCount++;
      return existingMapping.tokenValue;
    }

    // Generate new token
    let tokenValue: string;

    if (rule.preserveFormat && rule.tokenizationFormat) {
      tokenValue = await this.generateFormatPreservingToken(value, rule.tokenizationFormat);
    } else {
      tokenValue = this.generateRandomToken(value.length);
    }

    // Store mapping
    const mapping: TokenMapping = {
      originalHash,
      tokenValue,
      format: rule.tokenizationFormat || 'generic',
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 1,
      // NOTE: This is a version identifier, not a credential (CWE-798 false positive)
      keyVersion: '1.0'
    };

    this.tokenMappings.set(tokenValue, mapping);

    return tokenValue;
  }

  private async generateFormatPreservingToken(value: string, format: string): Promise<string> {
    const preserver = this.formatPreservers.get(format);
    if (!preserver) {
      throw new Error(`No format preserver found for format: ${format}`);
    }

    const match = value.match(preserver.pattern);
    if (!match) {
      throw new Error(`Value does not match expected format: ${format}`);
    }

    return preserver.transform(match);
  }

  private generateRandomToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateToken(input: string, type: 'alphanumeric' | 'numeric' | 'alpha', length: number): string {
    const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const numeric = '0123456789';
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    let chars: string;
    switch (type) {
      case 'numeric':
        chars = numeric;
        break;
      case 'alpha':
        chars = alpha;
        break;
      default:
        chars = alphanumeric;
    }

    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async applyEncryption(value: string, rule: PseudonymizationRule): Promise<string> {
    const keyId = rule.encryptionKeyId || 'format-preserving-key';

    try {
      const encrypted = await encryptionService.encryptData(value, keyId);
      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${getErrorMessage(error)}`);
    }
  }

  private async applyMasking(value: string, rule: PseudonymizationRule): Promise<string> {
    if (rule.tokenizationFormat) {
      const preserver = this.formatPreservers.get(rule.tokenizationFormat);
      if (preserver) {
        const match = value.match(preserver.pattern);
        if (match) {
          return preserver.transform(match);
        }
      }
    }

    // Default masking: replace middle characters with X
    if (value.length <= 4) {
      return 'X'.repeat(value.length);
    }

    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    const middle = 'X'.repeat(value.length - 4);

    return start + middle + end;
  }

  private async applyGeneralization(value: string, rule: PseudonymizationRule): Promise<string> {
    // Example: Generalize address to postal code only
    if (rule.fieldPattern.test('address')) {
      // Extract postal code pattern (simplified)
      const postalCodeMatch = value.match(/\b\d{5}(-\d{4})?\b/);
      if (postalCodeMatch) {
        return postalCodeMatch[0].substring(0, 3) + 'XX'; // Generalize to first 3 digits
      }
    }

    // Default generalization: truncate to first few characters
    return value.substring(0, Math.min(3, value.length)) + '*'.repeat(Math.max(0, value.length - 3));
  }

  private async applySyntheticGeneration(value: string, rule: PseudonymizationRule): Promise<string> {
    // Generate synthetic data that maintains statistical properties
    if (rule.fieldPattern.test('name')) {
      const syntheticNames = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Jamie'];
      return syntheticNames[Math.floor(Math.random() * syntheticNames.length)];
    }

    if (rule.fieldPattern.test('email')) {
      const domains = ['example.com', 'test.org', 'sample.net'];
      const localPart = this.generateToken('', 'alphanumeric', 8);
      const domain = domains[Math.floor(Math.random() * domains.length)];
      return `${localPart}@${domain}`;
    }

    // Default: generate random string of same length
    return this.generateRandomToken(value.length);
  }

  private async applySuppression(_value: string, _rule: PseudonymizationRule): Promise<string> {
    // Complete suppression - replace with placeholder
    return '[SUPPRESSED]';
  }

  private async validateInput(value: string, rule: PseudonymizationRule): Promise<void> {
    if (rule.conditions.dataPattern && !rule.conditions.dataPattern.test(value)) {
      throw new Error(`Input value does not match required pattern for rule ${rule.id}`);
    }

    if (rule.conditions.minLength && value.length < rule.conditions.minLength) {
      throw new Error(`Input value too short for rule ${rule.id}`);
    }

    if (rule.conditions.maxLength && value.length > rule.conditions.maxLength) {
      throw new Error(`Input value too long for rule ${rule.id}`);
    }
  }

  private async validateTransformation(
    transformation: TransformationResult,
    rule: PseudonymizationRule
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check format preservation
    if (rule.preserveFormat && !transformation.formatPreserved) {
      errors.push('Format not preserved as required');
    }

    // Check uniqueness if required
    if (rule.uniquenessRequired) {
      const duplicates = Array.from(this.transformationResults.values())
        .filter(t => t.transformedValue === transformation.transformedValue && t.id !== transformation.id);

      if (duplicates.length > 0) {
        errors.push('Uniqueness requirement violated');
      }
    }

    // Check reversibility constraints
    if (transformation.reversible && rule.reversibility === ReversibilityLevel.IRREVERSIBLE) {
      errors.push('Transformation should be irreversible but is marked as reversible');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isFormatPreserved(original: string, transformed: string, rule: PseudonymizationRule): boolean {
    if (!rule.preserveFormat) return true;

    // Check if basic format characteristics are preserved
    const originalDigits = (original.match(/\d/g) || []).length;
    const transformedDigits = (transformed.match(/\d/g) || []).length;

    const originalLetters = (original.match(/[a-zA-Z]/g) || []).length;
    const transformedLetters = (transformed.match(/[a-zA-Z]/g) || []).length;

    const originalSpecial = original.length - originalDigits - originalLetters;
    const transformedSpecial = transformed.length - transformedDigits - transformedLetters;

    // Allow some variation but not complete format change
    return Math.abs(originalDigits - transformedDigits) <= 2 &&
           Math.abs(originalLetters - transformedLetters) <= 2 &&
           Math.abs(originalSpecial - transformedSpecial) <= 1;
  }

  private isTypePreserved(original: string, transformed: string): boolean {
    const originalIsNumeric = /^\d+$/.test(original);
    const transformedIsNumeric = /^\d+$/.test(transformed);

    const originalIsAlpha = /^[a-zA-Z]+$/.test(original);
    const transformedIsAlpha = /^[a-zA-Z]+$/.test(transformed);

    return (originalIsNumeric === transformedIsNumeric) &&
           (originalIsAlpha === transformedIsAlpha);
  }

  private calculateTransformationQuality(transformation: TransformationResult): number {
    let score = 100;

    // Deduct points for quality issues
    if (!transformation.formatPreserved) score -= 20;
    if (!transformation.lengthPreserved) score -= 10;
    if (!transformation.typePreserved) score -= 15;
    if (transformation.validationErrors.length > 0) score -= (transformation.validationErrors.length * 10);

    return Math.max(0, score);
  }

  /**
   * Reverse pseudonymization for authorized access
   */
  async reverseTransformation(
    transformedValue: string,
    transformationId: string,
    authorizedUser: string,
    justification: string
  ): Promise<string> {
    const transformation = this.transformationResults.get(transformationId);
    if (!transformation) {
      throw new Error(`Transformation not found: ${transformationId}`);
    }

    if (!transformation.reversible) {
      throw new Error('Transformation is not reversible');
    }

    const rule = this.pseudonymizationRules.get(transformation.ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${transformation.ruleId}`);
    }

    if (rule.reversibility === ReversibilityLevel.IRREVERSIBLE) {
      throw new Error('Rule does not allow reversal');
    }

    // Log reversal attempt
    await securityLogService.logSecurityEvent({
      eventType: 'pseudonymization_reversal_attempted',
      severity: 'HIGH',
      category: 'data_access',
      ipAddress: '82.147.84.78',
      success: true,
      details: {
        transformationId,
        authorizedUser,
        justification,
        ruleId: rule.id,
        method: transformation.method
      },
      riskScore: 70,
      tags: ['pseudonymization_reversal', 'data_access', 'privacy'],
      compliance: {
        pii: true,
        gdpr: true,
        pci: false,
        hipaa: false
      }
    });

    try {
      let originalValue: string;

      switch (transformation.method) {
        case PseudonymizationMethod.ENCRYPTION: {
          if (!transformation.keyId) {
            throw new Error('Encryption key ID not found');
          }
          const decrypted = await encryptionService.decryptData(transformedValue, transformation.keyId);
          originalValue = decrypted;
          break;
        }

        case PseudonymizationMethod.TOKENIZATION: {
          const mapping = this.tokenMappings.get(transformedValue);
          if (!mapping) {
            throw new Error('Token mapping not found');
          }
          // For tokenization, we can't reverse to original, but we can provide the consistent token
          originalValue = `[TOKENIZED:${transformedValue}]`;
          break;
        }

        default:
          throw new Error(`Reversal not supported for method: ${transformation.method}`);
      }

      logger.info('Pseudonymization reversed', {
        transformationId,
        authorizedUser,
        justification
      });

      return originalValue;

    } catch (error) {
      logger.error('Pseudonymization reversal failed', {
        transformationId,
        authorizedUser,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  /**
   * Bulk pseudonymization job
   */
  async executePseudonymizationJob(
    tables: string[],
    environment: string,
    dryRun: boolean = false
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    const job: PseudonymizationJob = {
      id: jobId,
      type: 'transform',
      status: 'pending',
      scope: {
        tables,
        fields: [],
        conditions: { environment }
      },
      startTime: new Date(),
      recordsProcessed: 0,
      transformationsApplied: 0,
      validationErrors: [],
      qualityScore: 0,
      consistencyScore: 0,
      uniquenessScore: 0,
      executedBy: 'system',
      approvalRequired: false,
      progress: 0
    };

    this.activeJobs.set(jobId, job);

    try {
      logger.info('Starting pseudonymization job', {
        jobId,
        tables,
        environment,
        dryRun
      });

      job.status = 'running';

      let totalQualityScore = 0;
      let totalRecords = 0;

      for (const tableName of tables) {
        job.currentTable = tableName;

        // Simulate processing records (in real implementation, would query database)
        const simulatedRecords = this.generateSimulatedRecords(tableName, 100);

        for (const record of simulatedRecords) {
          const result = await this.transformData(record, tableName, environment);

          job.recordsProcessed++;
          job.transformationsApplied += result.transformations.length;
          totalQualityScore += result.qualityScore;
          totalRecords++;

          // Update progress
          job.progress = Math.round((job.recordsProcessed / (tables.length * 100)) * 100);
        }
      }

      job.qualityScore = totalRecords > 0 ? totalQualityScore / totalRecords : 100;
      job.consistencyScore = this.calculateConsistencyScore(job);
      job.uniquenessScore = this.calculateUniquenessScore(job);

      job.status = 'completed';
      job.endTime = new Date();
      job.duration = job.endTime.getTime() - job.startTime.getTime();

      logger.info('Pseudonymization job completed', {
        jobId,
        recordsProcessed: job.recordsProcessed,
        transformationsApplied: job.transformationsApplied,
        qualityScore: job.qualityScore,
        duration: job.duration
      });

      return jobId;

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.duration = job.endTime!.getTime() - job.startTime.getTime();

      logger.error('Pseudonymization job failed', {
        jobId,
        error: getErrorMessage(error)
      });

      throw error;
    }
  }

  private generateSimulatedRecords(tableName: string, count: number): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    for (let i = 0; i < count; i++) {
      const record: Record<string, any> = {
        id: i + 1
      };

      // Add table-specific fields
      switch (tableName) {
        case 'users':
          record.email = `user${i}@example.com`;
          record.first_name = `FirstName${i}`;
          record.last_name = `LastName${i}`;
          record.phone = `+1234567${String(i).padStart(4, '0')}`;
          break;
        case 'orders':
          record.user_id = i + 1;
          record.customer_email = `customer${i}@example.com`;
          break;
        case 'payments':
          record.card_number = `4111111111111${String(i).padStart(3, '0')}`;
          record.card_holder = `Card Holder ${i}`;
          break;
      }

      records.push(record);
    }

    return records;
  }

  private calculateConsistencyScore(job: PseudonymizationJob): number {
    // Calculate how consistent transformations are
    return 95; // Simplified score
  }

  private calculateUniquenessScore(job: PseudonymizationJob): number {
    // Calculate how unique transformations are
    return 98; // Simplified score
  }

  /**
   * Get pseudonymization statistics
   */
  getStats(): {
    rules: number;
    keys: number;
    transformations: number;
    activeJobs: number;
    tokenMappings: number;
    averageQualityScore: number;
  } {
    const completedTransformations = Array.from(this.transformationResults.values());
    const averageQualityScore = completedTransformations.length > 0
      ? completedTransformations.reduce((sum, t) => sum + this.calculateTransformationQuality(t), 0) / completedTransformations.length
      : 100;

    const activeJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'running').length;

    return {
      rules: this.pseudonymizationRules.size,
      keys: this.pseudonymizationKeys.size,
      transformations: this.transformationResults.size,
      activeJobs,
      tokenMappings: this.tokenMappings.size,
      averageQualityScore
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    const stats = this.getStats();

    let status = 'healthy';

    if (stats.averageQualityScore < 90) {
      status = 'warning'; // Quality issues
    }

    if (stats.activeJobs > 5) {
      status = 'degraded'; // Too many active jobs
    }

    if (stats.averageQualityScore < 70) {
      status = 'critical'; // Critical quality issues
    }

    // Check key health
    const expiredKeys = Array.from(this.pseudonymizationKeys.values())
      .filter(key => key.expiresAt && key.expiresAt < new Date()).length;

    if (expiredKeys > 0) {
      status = 'warning';
    }

    return {
      status,
      stats: {
        ...stats,
        expiredKeys
      }
    };
  }
}

// Export singleton instance
export const dataPseudonymizationService = DataPseudonymizationService.getInstance();
