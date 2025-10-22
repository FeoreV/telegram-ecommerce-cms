import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { securityLogService } from './SecurityLogService';

export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL', 
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  TOP_SECRET = 'TOP_SECRET'
}

export enum DataCategory {
  // Personal Identifiable Information
  PII_DIRECT = 'PII_DIRECT',           // Name, email, phone, address
  PII_INDIRECT = 'PII_INDIRECT',       // IP address, device ID, user ID
  PII_SENSITIVE = 'PII_SENSITIVE',     // SSN, passport, driver license
  
  // Financial Information
  FINANCIAL_ACCOUNT = 'FINANCIAL_ACCOUNT',     // Bank account, credit card
  FINANCIAL_TRANSACTION = 'FINANCIAL_TRANSACTION', // Payment details
  FINANCIAL_CREDIT = 'FINANCIAL_CREDIT',       // Credit score, history
  
  // Business Information
  BUSINESS_CONFIDENTIAL = 'BUSINESS_CONFIDENTIAL', // Trade secrets
  BUSINESS_PROPRIETARY = 'BUSINESS_PROPRIETARY',   // IP, algorithms
  BUSINESS_OPERATIONAL = 'BUSINESS_OPERATIONAL',   // Internal processes
  
  // Technical Information
  SYSTEM_CREDENTIALS = 'SYSTEM_CREDENTIALS',   // Passwords, API keys
  SYSTEM_LOGS = 'SYSTEM_LOGS',                // System events
  SYSTEM_METRICS = 'SYSTEM_METRICS',          // Performance data
  
  // Health Information (if applicable)
  HEALTH_RECORD = 'HEALTH_RECORD',            // Medical records
  HEALTH_BIOMETRIC = 'HEALTH_BIOMETRIC',      // Biometric data
  
  // Legal Information
  LEGAL_CONTRACT = 'LEGAL_CONTRACT',          // Contracts, agreements
  LEGAL_COMPLIANCE = 'LEGAL_COMPLIANCE',      // Audit, compliance data
  
  // Public Information
  PUBLIC_CONTENT = 'PUBLIC_CONTENT',          // Public posts, reviews
  PUBLIC_METADATA = 'PUBLIC_METADATA'        // Non-sensitive metadata
}

export enum PrivacyRegulation {
  GDPR = 'GDPR',           // General Data Protection Regulation (EU)
  CCPA = 'CCPA',           // California Consumer Privacy Act (US)
  PIPEDA = 'PIPEDA',       // Personal Information Protection (Canada)
  LGPD = 'LGPD',           // Lei Geral de Proteção de Dados (Brazil)
  PDPA_SG = 'PDPA_SG',     // Personal Data Protection Act (Singapore)
  PDPA_TH = 'PDPA_TH',     // Personal Data Protection Act (Thailand)
  POPIA = 'POPIA',         // Protection of Personal Information Act (South Africa)
  HIPAA = 'HIPAA'          // Health Insurance Portability (US)
}

export interface DataElement {
  id: string;
  fieldName: string;
  tableName?: string;
  classification: DataClassification;
  category: DataCategory;
  
  // Privacy attributes
  isPII: boolean;
  isSensitive: boolean;
  isEncrypted: boolean;
  
  // Regulatory requirements
  regulations: PrivacyRegulation[];
  retentionPeriod: number; // in days
  minimumAge: number; // minimum age requirement
  
  // Processing information
  purpose: string[];
  legalBasis: string[];
  dataSubject: 'customer' | 'employee' | 'vendor' | 'visitor';
  
  // Security requirements
  encryptionRequired: boolean;
  accessControls: string[];
  auditRequired: boolean;
  
  // Discovery information
  discoveredAt: Date;
  lastScanned: Date;
  confidence: number; // 0-1, confidence in classification
  
  // Data minimization
  canBeMinimized: boolean;
  minimizationStrategy?: 'hash' | 'tokenize' | 'pseudonymize' | 'remove';
  minimizationApplied: boolean;
  
  // Cross-border transfer
  allowCrossBorderTransfer: boolean;
  approvedCountries: string[];
  adequacyDecisions: string[];
}

export interface DataInventory {
  id: string;
  timestamp: Date;
  version: string;
  
  // Inventory metadata
  scope: string[];
  coverage: number; // percentage of system scanned
  
  // Classification results
  elements: DataElement[];
  summary: {
    totalElements: number;
    byClassification: Record<DataClassification, number>;
    byCategory: Record<DataCategory, number>;
    byRegulation: Record<PrivacyRegulation, number>;
  };
  
  // Privacy impact
  privacyRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceGaps: string[];
  recommendations: string[];
  
  // Validation
  validated: boolean;
  validatedBy?: string;
  validatedAt?: Date;
}

export interface PIIMinimizationRule {
  id: string;
  name: string;
  description: string;
  
  // Targeting
  fieldPattern: RegExp;
  dataCategory: DataCategory[];
  classification: DataClassification[];
  
  // Minimization strategy
  strategy: 'remove' | 'hash' | 'tokenize' | 'pseudonymize' | 'encrypt';
  preserveFormat: boolean;
  reversible: boolean;
  
  // Conditions
  conditions: {
    age?: number;           // Apply after N days
    lastAccess?: number;    // Apply if not accessed for N days
    purpose?: string[];     // Apply for specific purposes
    userConsent?: boolean;  // Apply based on consent status
  };
  
  // Implementation
  enabled: boolean;
  priority: number;
  schedule?: string; // cron expression
  
  // Compliance
  regulations: PrivacyRegulation[];
  legalBasis: string;
  retentionPeriod: number;
}

export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  requestedAt: Date;
  
  // Subject information
  subjectId: string;
  subjectEmail: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  
  // Request details
  description: string;
  scope: string[];
  urgency: 'normal' | 'urgent';
  
  // Processing
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  assignedTo?: string;
  processedAt?: Date;
  
  // Response
  responseTime: number; // in hours
  actions: string[];
  affectedSystems: string[];
  dataExported?: string; // file path for portability requests
  
  // Compliance
  regulation: PrivacyRegulation;
  legalBasis: string;
  deadline: Date;
  
  // Audit trail
  auditTrail: {
    timestamp: Date;
    action: string;
    user: string;
    details: Record<string, any>;
  }[];
}

export class DataClassificationService {
  private static instance: DataClassificationService;
  private dataInventory: Map<string, DataInventory> = new Map();
  private minimizationRules: Map<string, PIIMinimizationRule> = new Map();
  private dataSubjectRequests: Map<string, DataSubjectRequest> = new Map();
  private classificationRules: Map<string, any> = new Map();
  private scanScheduler: NodeJS.Timeout[] = [];

  private constructor() {
    this.initializeDataClassification();
    this.loadClassificationRules();
    this.loadMinimizationRules();
    this.startAutomatedScanning();

    logger.info('Data Classification Service initialized', {
      enabledRegulations: this.getEnabledRegulations(),
      scheduledScanning: true,
      piiMinimization: true
    });
  }

  public static getInstance(): DataClassificationService {
    if (!DataClassificationService.instance) {
      DataClassificationService.instance = new DataClassificationService();
    }
    return DataClassificationService.instance;
  }

  private async initializeDataClassification(): Promise<void> {
    try {
      // Initialize classification patterns
      await this.initializeClassificationPatterns();
      
      // Load existing inventory
      await this.loadExistingInventory();
      
      // Validate current compliance status
      await this.validateComplianceStatus();

      logger.info('Data classification initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize data classification:', error);
      throw error;
    }
  }

  private async initializeClassificationPatterns(): Promise<void> {
    // PII Direct patterns
    this.classificationRules.set('email', {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      classification: DataClassification.CONFIDENTIAL,
      category: DataCategory.PII_DIRECT,
      isPII: true,
      regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA]
    });

    this.classificationRules.set('phone', {
      pattern: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      classification: DataClassification.CONFIDENTIAL,
      category: DataCategory.PII_DIRECT,
      isPII: true,
      regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA]
    });

    this.classificationRules.set('ssn', {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      classification: DataClassification.RESTRICTED,
      category: DataCategory.PII_SENSITIVE,
      isPII: true,
      regulations: [PrivacyRegulation.CCPA, PrivacyRegulation.HIPAA]
    });

    this.classificationRules.set('credit_card', {
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      classification: DataClassification.RESTRICTED,
      category: DataCategory.FINANCIAL_ACCOUNT,
      isPII: true,
      regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA]
    });

    this.classificationRules.set('ip_address', {
      pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      classification: DataClassification.INTERNAL,
      category: DataCategory.PII_INDIRECT,
      isPII: true,
      regulations: [PrivacyRegulation.GDPR]
    });

    // Field name patterns
    this.classificationRules.set('password_field', {
      pattern: /^(password|passwd|pwd|secret|token|key)$/i,
      classification: DataClassification.TOP_SECRET,
      category: DataCategory.SYSTEM_CREDENTIALS,
      isPII: false,
      regulations: []
    });

    this.classificationRules.set('name_field', {
      pattern: /^(first_?name|last_?name|full_?name|display_?name)$/i,
      classification: DataClassification.CONFIDENTIAL,
      category: DataCategory.PII_DIRECT,
      isPII: true,
      regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA]
    });

    logger.debug('Classification patterns initialized');
  }

  private async loadExistingInventory(): Promise<void> {
    // Load from persistent storage if available
    logger.debug('Loading existing data inventory');
  }

  private async validateComplianceStatus(): Promise<void> {
    // Validate current compliance with regulations
    logger.debug('Validating compliance status');
  }

  private loadClassificationRules(): void {
    // Additional classification rules can be loaded from configuration
    logger.debug('Classification rules loaded');
  }

  private loadMinimizationRules(): void {
    // Email anonymization rule
    const emailMinimizationRule: PIIMinimizationRule = {
      id: 'email-anonymization',
      name: 'Email Address Anonymization',
      description: 'Anonymize email addresses after retention period',
      fieldPattern: /email/i,
      dataCategory: [DataCategory.PII_DIRECT],
      classification: [DataClassification.CONFIDENTIAL],
      strategy: 'hash',
      preserveFormat: false,
      reversible: false,
      conditions: {
        age: 2555, // 7 years
        lastAccess: 1095 // 3 years
      },
      enabled: true,
      priority: 1,
      regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA],
      legalBasis: 'legitimate_interest',
      retentionPeriod: 2555
    };

    // Phone number tokenization rule
    const phoneMinimizationRule: PIIMinimizationRule = {
      id: 'phone-tokenization',
      name: 'Phone Number Tokenization',
      description: 'Tokenize phone numbers for analytics while preserving format',
      fieldPattern: /phone|mobile|tel/i,
      dataCategory: [DataCategory.PII_DIRECT],
      classification: [DataClassification.CONFIDENTIAL],
      strategy: 'tokenize',
      preserveFormat: true,
      reversible: true,
      conditions: {
        purpose: ['analytics', 'reporting']
      },
      enabled: true,
      priority: 2,
      regulations: [PrivacyRegulation.GDPR],
      legalBasis: 'consent',
      retentionPeriod: 1095
    };

    // Sensitive data removal rule
    const ssnRemovalRule: PIIMinimizationRule = {
      id: 'ssn-removal',
      name: 'SSN Data Removal',
      description: 'Remove SSN data after business requirement fulfilled',
      fieldPattern: /ssn|social_security|tax_id/i,
      dataCategory: [DataCategory.PII_SENSITIVE],
      classification: [DataClassification.RESTRICTED],
      strategy: 'remove',
      preserveFormat: false,
      reversible: false,
      conditions: {
        age: 2555, // 7 years for tax purposes
        purpose: ['tax_reporting', 'compliance']
      },
      enabled: true,
      priority: 10,
      regulations: [PrivacyRegulation.CCPA, PrivacyRegulation.HIPAA],
      legalBasis: 'legal_obligation',
      retentionPeriod: 2555
    };

    this.minimizationRules.set(emailMinimizationRule.id, emailMinimizationRule);
    this.minimizationRules.set(phoneMinimizationRule.id, phoneMinimizationRule);
    this.minimizationRules.set(ssnRemovalRule.id, ssnRemovalRule);

    logger.info('PII minimization rules loaded', {
      ruleCount: this.minimizationRules.size
    });
  }

  /**
   * Classify data content based on patterns and rules
   */
  public classifyData(data: string): DataClassification {
    try {
      // Convert data to string if needed
      const content = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Check for highly sensitive patterns first
      for (const rule of this.classificationRules.values()) {
        if (rule.pattern && rule.pattern.test(content)) {
          // Reset regex state for next use
          rule.pattern.lastIndex = 0;
          
          // Return the highest classification found
          if (rule.classification === DataClassification.TOP_SECRET || 
              rule.classification === DataClassification.RESTRICTED) {
            return rule.classification;
          }
          
          if (rule.classification === DataClassification.CONFIDENTIAL) {
            return DataClassification.CONFIDENTIAL;
          }
        }
      }
      
      // Default to internal for structured data, public for simple data
      return content.includes('{') || content.includes('[') ? 
        DataClassification.INTERNAL : DataClassification.PUBLIC;
        
    } catch (error) {
      logger.error('Error classifying data:', error);
      // Default to restricted when classification fails for safety
      return DataClassification.RESTRICTED;
    }
  }

  /**
   * Perform automated data discovery and classification
   */
  async performDataDiscovery(scope: string[] = []): Promise<string> {
    const inventoryId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      logger.info('Starting data discovery', { inventoryId, scope });

      const elements: DataElement[] = [];
      const systemScope = scope.length > 0 ? scope : this.getDefaultScanScope();

      // Scan database schemas
      for (const system of systemScope) {
        const systemElements = await this.scanSystem(system);
        elements.push(...systemElements);
      }

      // Calculate coverage and summary
      const coverage = this.calculateCoverage(systemScope);
      const summary = this.generateSummary(elements);
      const privacyRisk = this.assessPrivacyRisk(elements);
      const complianceGaps = await this.identifyComplianceGaps(elements);
      const recommendations = this.generateRecommendations(elements, complianceGaps);

      const inventory: DataInventory = {
        id: inventoryId,
        timestamp: new Date(),
        version: '1.0',
        scope: systemScope,
        coverage,
        elements,
        summary,
        privacyRisk,
        complianceGaps,
        recommendations,
        validated: false
      };

      this.dataInventory.set(inventoryId, inventory);

      const duration = Date.now() - startTime;
      logger.info('Data discovery completed', {
        inventoryId,
        elementsFound: elements.length,
        duration,
        privacyRisk,
        complianceGaps: complianceGaps.length
      });

      // Log privacy event
      await securityLogService.logSecurityEvent({
        eventType: 'data_discovery_completed',
        severity: privacyRisk === 'CRITICAL' ? 'HIGH' : 'LOW',
        category: 'data_access',
        ipAddress: 'localhost',
        success: true,
        details: {
          inventoryId,
          elementsFound: elements.length,
          privacyRisk,
          complianceGaps: complianceGaps.length
        },
        riskScore: privacyRisk === 'CRITICAL' ? 80 : privacyRisk === 'HIGH' ? 60 : 20,
        tags: ['data_discovery', 'privacy', 'classification'],
        compliance: {
          pii: true,
          gdpr: true,
          pci: false,
          hipaa: elements.some(e => e.regulations.includes(PrivacyRegulation.HIPAA))
        }
      });

      return inventoryId;

    } catch (error) {
      logger.error('Data discovery failed', {
        inventoryId,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  private getDefaultScanScope(): string[] {
    return [
      'database:users',
      'database:orders', 
      'database:payments',
      'database:stores',
      'database:products',
      'logs:application',
      'logs:security',
      'cache:redis',
      'files:uploads'
    ];
  }

  private async scanSystem(system: string): Promise<DataElement[]> {
    const elements: DataElement[] = [];

    if (system.startsWith('database:')) {
      const tableName = system.split(':')[1];
      const tableElements = await this.scanDatabaseTable(tableName);
      elements.push(...tableElements);
    } else if (system.startsWith('logs:')) {
      const logType = system.split(':')[1];
      const logElements = await this.scanLogFiles(logType);
      elements.push(...logElements);
    } else if (system.startsWith('cache:')) {
      const cacheType = system.split(':')[1];
      const cacheElements = await this.scanCache(cacheType);
      elements.push(...cacheElements);
    } else if (system.startsWith('files:')) {
      const fileType = system.split(':')[1];
      const fileElements = await this.scanFiles(fileType);
      elements.push(...fileElements);
    }

    return elements;
  }

  private async scanDatabaseTable(tableName: string): Promise<DataElement[]> {
    const elements: DataElement[] = [];

    // Simulate database schema scanning
    const tableSchemas = {
      users: ['id', 'email', 'first_name', 'last_name', 'phone', 'address', 'created_at'],
      orders: ['id', 'user_id', 'total_amount', 'currency', 'payment_method', 'created_at'],
      payments: ['id', 'order_id', 'card_number', 'card_holder', 'amount', 'processed_at'],
      stores: ['id', 'name', 'owner_email', 'phone', 'address', 'tax_id'],
      products: ['id', 'name', 'description', 'price', 'category', 'store_id']
    };

    const fields = tableSchemas[tableName as keyof typeof tableSchemas] || [];

    for (const fieldName of fields) {
      const element = await this.classifyField(tableName, fieldName);
      if (element) {
        elements.push(element);
      }
    }

    return elements;
  }

  private async scanLogFiles(logType: string): Promise<DataElement[]> {
    // Scan log files for PII patterns
    const elements: DataElement[] = [];

    // Simulate finding PII in logs
    if (logType === 'application') {
      elements.push(await this.createDataElement('user_ip', undefined, {
        classification: DataClassification.INTERNAL,
        category: DataCategory.PII_INDIRECT,
        isPII: true,
        regulations: [PrivacyRegulation.GDPR],
        confidence: 0.9
      }));
    }

    return elements;
  }

  private async scanCache(_cacheType: string): Promise<DataElement[]> {
    // Scan cache for sensitive data
    return [];
  }

  private async scanFiles(_fileType: string): Promise<DataElement[]> {
    // Scan files for embedded PII
    return [];
  }

  private async classifyField(tableName: string, fieldName: string): Promise<DataElement | null> {
    // Check field name patterns
    for (const rule of this.classificationRules.values()) {
      if (rule.pattern.test(fieldName)) {
        return await this.createDataElement(fieldName, tableName, {
          classification: rule.classification,
          category: rule.category,
          isPII: rule.isPII,
          regulations: rule.regulations,
          confidence: 0.95
        });
      }
    }

    // Default classification for unmatched fields
    return await this.createDataElement(fieldName, tableName, {
      classification: DataClassification.INTERNAL,
      category: DataCategory.PUBLIC_METADATA,
      isPII: false,
      regulations: [],
      confidence: 0.5
    });
  }

  private async createDataElement(
    fieldName: string,
    tableName: string | undefined,
    properties: {
      classification: DataClassification;
      category: DataCategory;
      isPII: boolean;
      regulations: PrivacyRegulation[];
      confidence: number;
    }
  ): Promise<DataElement> {
    const element: DataElement = {
      id: crypto.randomUUID(),
      fieldName,
      tableName,
      classification: properties.classification,
      category: properties.category,
      isPII: properties.isPII,
      isSensitive: properties.classification === DataClassification.RESTRICTED || 
                   properties.classification === DataClassification.TOP_SECRET,
      isEncrypted: false, // Would check actual encryption status
      regulations: properties.regulations,
      retentionPeriod: this.getDefaultRetentionPeriod(properties.category),
      minimumAge: this.getMinimumAge(properties.category),
      purpose: this.getDefaultPurposes(properties.category),
      legalBasis: this.getDefaultLegalBasis(properties.category),
      dataSubject: 'customer',
      encryptionRequired: properties.classification === DataClassification.CONFIDENTIAL || properties.classification === DataClassification.RESTRICTED || properties.classification === DataClassification.TOP_SECRET,
      accessControls: this.getDefaultAccessControls(properties.classification),
      auditRequired: properties.isPII,
      discoveredAt: new Date(),
      lastScanned: new Date(),
      confidence: properties.confidence,
      canBeMinimized: properties.isPII,
      minimizationStrategy: this.getDefaultMinimizationStrategy(properties.category),
      minimizationApplied: false,
      allowCrossBorderTransfer: !properties.isPII,
      approvedCountries: properties.isPII ? [] : ['US', 'CA', 'EU'],
      adequacyDecisions: properties.isPII ? [] : ['EU-US Privacy Shield']
    };

    return element;
  }

  private getDefaultRetentionPeriod(category: DataCategory): number {
    const retentionPolicies = {
      [DataCategory.PII_DIRECT]: 2555,        // 7 years
      [DataCategory.PII_INDIRECT]: 1095,      // 3 years
      [DataCategory.PII_SENSITIVE]: 2555,     // 7 years
      [DataCategory.FINANCIAL_ACCOUNT]: 2555, // 7 years
      [DataCategory.FINANCIAL_TRANSACTION]: 2555, // 7 years
      [DataCategory.SYSTEM_CREDENTIALS]: 90,  // 90 days
      [DataCategory.SYSTEM_LOGS]: 365,        // 1 year
      [DataCategory.PUBLIC_CONTENT]: 1095     // 3 years
    };

    return retentionPolicies[category] || 1095; // Default 3 years
  }

  private getMinimumAge(category: DataCategory): number {
    // GDPR requires 16+ for most processing, 13+ with parental consent
    return category.includes('PII') ? 16 : 0;
  }

  private getDefaultPurposes(category: DataCategory): string[] {
    const purposeMap = {
      [DataCategory.PII_DIRECT]: ['user_account', 'customer_service', 'legal_compliance'],
      [DataCategory.FINANCIAL_TRANSACTION]: ['payment_processing', 'fraud_prevention', 'accounting'],
      [DataCategory.SYSTEM_LOGS]: ['security_monitoring', 'performance_optimization'],
      [DataCategory.PUBLIC_CONTENT]: ['service_provision', 'content_moderation']
    };

    return purposeMap[category] || ['business_operations'];
  }

  private getDefaultLegalBasis(category: DataCategory): string[] {
    const legalBasisMap = {
      [DataCategory.PII_DIRECT]: ['contract', 'legitimate_interest'],
      [DataCategory.FINANCIAL_TRANSACTION]: ['contract', 'legal_obligation'],
      [DataCategory.SYSTEM_LOGS]: ['legitimate_interest', 'security'],
      [DataCategory.PUBLIC_CONTENT]: ['consent', 'legitimate_interest']
    };

    return legalBasisMap[category] || ['legitimate_interest'];
  }

  private getDefaultAccessControls(classification: DataClassification): string[] {
    const accessControlMap = {
      [DataClassification.PUBLIC]: ['all_users'],
      [DataClassification.INTERNAL]: ['employees'],
      [DataClassification.CONFIDENTIAL]: ['authorized_personnel'],
      [DataClassification.RESTRICTED]: ['senior_staff', 'data_protection_officer'],
      [DataClassification.TOP_SECRET]: ['c_level', 'security_team']
    };

    return accessControlMap[classification] || ['authorized_personnel'];
  }

  private getDefaultMinimizationStrategy(category: DataCategory): 'hash' | 'tokenize' | 'pseudonymize' | 'remove' | undefined {
    const strategyMap: Record<DataCategory, 'hash' | 'tokenize' | 'pseudonymize' | 'remove'> = {
      [DataCategory.PII_DIRECT]: 'pseudonymize',
      [DataCategory.PII_INDIRECT]: 'hash',
      [DataCategory.PII_SENSITIVE]: 'remove',
      [DataCategory.FINANCIAL_ACCOUNT]: 'tokenize',
      [DataCategory.FINANCIAL_TRANSACTION]: 'hash',
      [DataCategory.FINANCIAL_CREDIT]: 'pseudonymize',
      [DataCategory.BUSINESS_CONFIDENTIAL]: 'pseudonymize',
      [DataCategory.BUSINESS_PROPRIETARY]: 'remove',
      [DataCategory.BUSINESS_OPERATIONAL]: 'hash',
      [DataCategory.SYSTEM_CREDENTIALS]: 'remove',
      [DataCategory.SYSTEM_LOGS]: 'hash',
      [DataCategory.SYSTEM_METRICS]: 'hash',
      [DataCategory.HEALTH_RECORD]: 'pseudonymize',
      [DataCategory.HEALTH_BIOMETRIC]: 'remove',
      [DataCategory.LEGAL_CONTRACT]: 'pseudonymize',
      [DataCategory.LEGAL_COMPLIANCE]: 'hash',
      [DataCategory.PUBLIC_CONTENT]: 'hash',
      [DataCategory.PUBLIC_METADATA]: 'hash'
    };

    return strategyMap[category];
  }

  private calculateCoverage(scope: string[]): number {
    // Calculate what percentage of the system was scanned
    const totalSystems = this.getDefaultScanScope().length;
    return (scope.length / totalSystems) * 100;
  }

  private generateSummary(elements: DataElement[]): DataInventory['summary'] {
    const summary = {
      totalElements: elements.length,
      byClassification: {} as Record<DataClassification, number>,
      byCategory: {} as Record<DataCategory, number>,
      byRegulation: {} as Record<PrivacyRegulation, number>
    };

    // Initialize counters
    Object.values(DataClassification).forEach(c => summary.byClassification[c] = 0);
    Object.values(DataCategory).forEach(c => summary.byCategory[c] = 0);
    Object.values(PrivacyRegulation).forEach(r => summary.byRegulation[r] = 0);

    // Count elements
    elements.forEach(element => {
      summary.byClassification[element.classification]++;
      summary.byCategory[element.category]++;
      element.regulations.forEach(reg => {
        summary.byRegulation[reg]++;
      });
    });

    return summary;
  }

  private assessPrivacyRisk(elements: DataElement[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const sensitiveCount = elements.filter(e => e.isSensitive).length;
    const piiCount = elements.filter(e => e.isPII).length;
    const unencryptedSensitive = elements.filter(e => e.isSensitive && !e.isEncrypted).length;

    if (unencryptedSensitive > 0 || sensitiveCount > 20) {
      return 'CRITICAL';
    } else if (piiCount > 50 || sensitiveCount > 10) {
      return 'HIGH';
    } else if (piiCount > 20 || sensitiveCount > 5) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private async identifyComplianceGaps(elements: DataElement[]): Promise<string[]> {
    const gaps: string[] = [];

    // Check for unencrypted PII
    const unencryptedPII = elements.filter(e => e.isPII && !e.isEncrypted);
    if (unencryptedPII.length > 0) {
      gaps.push(`${unencryptedPII.length} PII fields are not encrypted`);
    }

    // Check for excessive retention
    const excessiveRetention = elements.filter(e => e.retentionPeriod > 2555); // >7 years
    if (excessiveRetention.length > 0) {
      gaps.push(`${excessiveRetention.length} fields have excessive retention periods`);
    }

    // Check for missing audit requirements
    const missingAudit = elements.filter(e => e.isPII && !e.auditRequired);
    if (missingAudit.length > 0) {
      gaps.push(`${missingAudit.length} PII fields lack audit requirements`);
    }

    // Check for cross-border transfer issues
    const crossBorderIssues = elements.filter(e => e.isPII && e.allowCrossBorderTransfer);
    if (crossBorderIssues.length > 0) {
      gaps.push(`${crossBorderIssues.length} PII fields allow unrestricted cross-border transfer`);
    }

    return gaps;
  }

  private generateRecommendations(elements: DataElement[], gaps: string[]): string[] {
    const recommendations: string[] = [];

    if (gaps.some(g => g.includes('not encrypted'))) {
      recommendations.push('Implement field-level encryption for all PII data');
    }

    if (gaps.some(g => g.includes('excessive retention'))) {
      recommendations.push('Review and reduce data retention periods to comply with regulations');
    }

    if (gaps.some(g => g.includes('audit requirements'))) {
      recommendations.push('Enable audit logging for all PII data access');
    }

    if (gaps.some(g => g.includes('cross-border transfer'))) {
      recommendations.push('Implement cross-border transfer controls and adequacy decisions');
    }

    const piiCount = elements.filter(e => e.isPII).length;
    if (piiCount > 100) {
      recommendations.push('Consider PII minimization strategies to reduce privacy risk');
    }

    const sensitiveCount = elements.filter(e => e.isSensitive).length;
    if (sensitiveCount > 20) {
      recommendations.push('Enhance access controls for sensitive data elements');
    }

    return recommendations;
  }

  /**
   * Apply PII minimization rules
   */
  async applyPIIMinimization(inventoryId?: string): Promise<{
    applied: number;
    failed: number;
    details: string[];
  }> {
    const results = {
      applied: 0,
      failed: 0,
      details: [] as string[]
    };

    try {
      const elements = inventoryId 
        ? this.dataInventory.get(inventoryId)?.elements || []
        : Array.from(this.dataInventory.values()).flatMap(inv => inv.elements);

      for (const element of elements) {
        if (!element.canBeMinimized || element.minimizationApplied) {
          continue;
        }

        const applicableRules = Array.from(this.minimizationRules.values())
          .filter(rule => this.isRuleApplicable(rule, element))
          .sort((a, b) => b.priority - a.priority);

        for (const rule of applicableRules) {
          try {
            await this.applyMinimizationRule(rule, element);
            element.minimizationApplied = true;
            results.applied++;
            results.details.push(`Applied ${rule.strategy} to ${element.fieldName}`);
            break; // Apply only first matching rule
          } catch (error) {
            results.failed++;
            results.details.push(`Failed to apply ${rule.strategy} to ${element.fieldName}: ${getErrorMessage(error)}`);
          }
        }
      }

      logger.info('PII minimization completed', {
        applied: results.applied,
        failed: results.failed
      });

      // Log minimization event
      await securityLogService.logSecurityEvent({
        eventType: 'pii_minimization_applied',
        severity: 'LOW',
        category: 'data_access',
        ipAddress: 'localhost',
        success: results.failed === 0,
        details: {
          applied: results.applied,
          failed: results.failed,
          inventoryId
        },
        riskScore: 10,
        tags: ['pii_minimization', 'privacy', 'data_protection'],
        compliance: {
          pii: true,
          gdpr: true,
          pci: false,
          hipaa: false
        }
      });

      return results;

    } catch (error) {
      logger.error('PII minimization failed:', error);
      throw error;
    }
  }

  private isRuleApplicable(rule: PIIMinimizationRule, element: DataElement): boolean {
    if (!rule.enabled) return false;

    // Check field pattern
    if (!rule.fieldPattern.test(element.fieldName)) return false;

    // Check data category
    if (rule.dataCategory.length > 0 && !rule.dataCategory.includes(element.category)) {
      return false;
    }

    // Check classification
    if (rule.classification.length > 0 && !rule.classification.includes(element.classification)) {
      return false;
    }

    // Check age condition
    if (rule.conditions.age) {
      const ageInDays = (Date.now() - element.discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < rule.conditions.age) return false;
    }

    // Check purpose condition
    if (rule.conditions.purpose && rule.conditions.purpose.length > 0) {
      const hasMatchingPurpose = rule.conditions.purpose.some(purpose => 
        element.purpose.includes(purpose)
      );
      if (!hasMatchingPurpose) return false;
    }

    return true;
  }

  private async applyMinimizationRule(rule: PIIMinimizationRule, element: DataElement): Promise<void> {
    switch (rule.strategy) {
      case 'hash':
        await this.hashData(element);
        break;
      case 'tokenize':
        await this.tokenizeData(element, rule.preserveFormat);
        break;
      case 'pseudonymize':
        await this.pseudonymizeData(element);
        break;
      case 'encrypt':
        await this.encryptData(element);
        break;
      case 'remove':
        await this.removeData(element);
        break;
      default:
        throw new Error(`Unknown minimization strategy: ${rule.strategy}`);
    }

    logger.debug('Minimization rule applied', {
      rule: rule.name,
      strategy: rule.strategy,
      field: element.fieldName,
      table: element.tableName
    });
  }

  private async hashData(element: DataElement): Promise<void> {
    // Implementation would hash the actual data
    // This is a placeholder for the actual implementation
    logger.debug(`Hashing data for ${element.fieldName}`);
  }

  private async tokenizeData(element: DataElement, preserveFormat: boolean): Promise<void> {
    // Implementation would tokenize the actual data
    logger.debug(`Tokenizing data for ${element.fieldName}`, { preserveFormat });
  }

  private async pseudonymizeData(element: DataElement): Promise<void> {
    // Implementation would pseudonymize the actual data
    logger.debug(`Pseudonymizing data for ${element.fieldName}`);
  }

  private async encryptData(element: DataElement): Promise<void> {
    // Implementation would encrypt the actual data
    logger.debug(`Encrypting data for ${element.fieldName}`);
  }

  private async removeData(element: DataElement): Promise<void> {
    // Implementation would remove the actual data
    logger.debug(`Removing data for ${element.fieldName}`);
  }

  /**
   * Handle data subject request
   */
  async handleDataSubjectRequest(request: Omit<DataSubjectRequest, 'id' | 'requestedAt' | 'status' | 'auditTrail'>): Promise<string> {
    const requestId = crypto.randomUUID();
    
    const dsrRequest: DataSubjectRequest = {
      id: requestId,
      requestedAt: new Date(),
      status: 'pending',
      auditTrail: [],
      ...request
    };

    // Add initial audit entry
    dsrRequest.auditTrail.push({
      timestamp: new Date(),
      action: 'request_received',
      user: 'system',
      details: {
        type: request.type,
        urgency: request.urgency
      }
    });

    this.dataSubjectRequests.set(requestId, dsrRequest);

    logger.info('Data subject request received', {
      requestId,
      type: request.type,
      regulation: request.regulation,
      urgency: request.urgency
    });

    // Log privacy event
    await securityLogService.logSecurityEvent({
      eventType: 'data_subject_request_received',
      severity: request.urgency === 'urgent' ? 'HIGH' : 'MEDIUM',
      category: 'data_access',
      ipAddress: 'localhost',
      success: true,
      details: {
        requestId,
        type: request.type,
        subjectEmail: request.subjectEmail,
        regulation: request.regulation
      },
      riskScore: request.urgency === 'urgent' ? 60 : 30,
      tags: ['data_subject_request', 'privacy', request.type],
      compliance: {
        pii: true,
        gdpr: request.regulation === PrivacyRegulation.GDPR,
        pci: false,
        hipaa: request.regulation === PrivacyRegulation.HIPAA
      }
    });

    // Auto-assign based on request type
    if (request.type === 'erasure' && request.urgency === 'urgent') {
      // High priority erasure requests
      await this.assignRequest(requestId, 'data_protection_officer');
    }

    return requestId;
  }

  private async assignRequest(requestId: string, assignee: string): Promise<void> {
    const request = this.dataSubjectRequests.get(requestId);
    if (!request) return;

    request.assignedTo = assignee;
    request.auditTrail.push({
      timestamp: new Date(),
      action: 'request_assigned',
      user: 'system',
      details: { assignee }
    });

    logger.info('Data subject request assigned', { requestId, assignee });
  }

  private startAutomatedScanning(): void {
    // Schedule daily data discovery
    const dailyScan = setInterval(() => {
      this.performDataDiscovery().catch(error => {
        logger.error('Scheduled data discovery failed:', error);
      });
    }, 24 * 60 * 60 * 1000); // Daily

    // Schedule weekly PII minimization
    const weeklyMinimization = setInterval(() => {
      this.applyPIIMinimization().catch(error => {
        logger.error('Scheduled PII minimization failed:', error);
      });
    }, 7 * 24 * 60 * 60 * 1000); // Weekly

    this.scanScheduler.push(dailyScan, weeklyMinimization);

    logger.info('Automated data classification scanning started');
  }

  private getEnabledRegulations(): PrivacyRegulation[] {
    // Return enabled privacy regulations based on business requirements
    return [
      PrivacyRegulation.GDPR,
      PrivacyRegulation.CCPA,
      PrivacyRegulation.PIPEDA
    ];
  }

  /**
   * Get data classification statistics
   */
  getStats(): {
    inventoryCount: number;
    totalElements: number;
    piiElements: number;
    sensitiveElements: number;
    minimizationRules: number;
    pendingRequests: number;
    complianceScore: number;
  } {
    const allElements = Array.from(this.dataInventory.values()).flatMap(inv => inv.elements);
    const piiElements = allElements.filter(e => e.isPII).length;
    const sensitiveElements = allElements.filter(e => e.isSensitive).length;
    const pendingRequests = Array.from(this.dataSubjectRequests.values())
      .filter(req => req.status === 'pending').length;

    // Calculate compliance score
    const encryptedPII = allElements.filter(e => e.isPII && e.isEncrypted).length;
    const complianceScore = piiElements > 0 ? (encryptedPII / piiElements) * 100 : 100;

    return {
      inventoryCount: this.dataInventory.size,
      totalElements: allElements.length,
      piiElements,
      sensitiveElements,
      minimizationRules: this.minimizationRules.size,
      pendingRequests,
      complianceScore
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
    
    if (stats.complianceScore < 95) {
      status = 'warning'; // Compliance issues
    }
    
    if (stats.pendingRequests > 10) {
      status = 'degraded'; // Too many pending requests
    }

    const unencryptedPII = stats.piiElements - (stats.piiElements * stats.complianceScore / 100);
    if (unencryptedPII > 5) {
      status = 'critical'; // Too much unencrypted PII
    }

    return {
      status,
      stats: {
        ...stats,
        unencryptedPII: Math.round(unencryptedPII)
      }
    };
  }
}

// Export singleton instance
export const dataClassificationService = DataClassificationService.getInstance();
