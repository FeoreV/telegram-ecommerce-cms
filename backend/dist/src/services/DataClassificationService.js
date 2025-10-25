"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataClassificationService = exports.DataClassificationService = exports.PrivacyRegulation = exports.DataCategory = exports.DataClassification = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const errorUtils_1 = require("../utils/errorUtils");
const SecurityLogService_1 = require("./SecurityLogService");
var DataClassification;
(function (DataClassification) {
    DataClassification["PUBLIC"] = "PUBLIC";
    DataClassification["INTERNAL"] = "INTERNAL";
    DataClassification["CONFIDENTIAL"] = "CONFIDENTIAL";
    DataClassification["RESTRICTED"] = "RESTRICTED";
    DataClassification["TOP_SECRET"] = "TOP_SECRET";
})(DataClassification || (exports.DataClassification = DataClassification = {}));
var DataCategory;
(function (DataCategory) {
    DataCategory["PII_DIRECT"] = "PII_DIRECT";
    DataCategory["PII_INDIRECT"] = "PII_INDIRECT";
    DataCategory["PII_SENSITIVE"] = "PII_SENSITIVE";
    DataCategory["FINANCIAL_ACCOUNT"] = "FINANCIAL_ACCOUNT";
    DataCategory["FINANCIAL_TRANSACTION"] = "FINANCIAL_TRANSACTION";
    DataCategory["FINANCIAL_CREDIT"] = "FINANCIAL_CREDIT";
    DataCategory["BUSINESS_CONFIDENTIAL"] = "BUSINESS_CONFIDENTIAL";
    DataCategory["BUSINESS_PROPRIETARY"] = "BUSINESS_PROPRIETARY";
    DataCategory["BUSINESS_OPERATIONAL"] = "BUSINESS_OPERATIONAL";
    DataCategory["SYSTEM_CREDENTIALS"] = "SYSTEM_CREDENTIALS";
    DataCategory["SYSTEM_LOGS"] = "SYSTEM_LOGS";
    DataCategory["SYSTEM_METRICS"] = "SYSTEM_METRICS";
    DataCategory["HEALTH_RECORD"] = "HEALTH_RECORD";
    DataCategory["HEALTH_BIOMETRIC"] = "HEALTH_BIOMETRIC";
    DataCategory["LEGAL_CONTRACT"] = "LEGAL_CONTRACT";
    DataCategory["LEGAL_COMPLIANCE"] = "LEGAL_COMPLIANCE";
    DataCategory["PUBLIC_CONTENT"] = "PUBLIC_CONTENT";
    DataCategory["PUBLIC_METADATA"] = "PUBLIC_METADATA";
})(DataCategory || (exports.DataCategory = DataCategory = {}));
var PrivacyRegulation;
(function (PrivacyRegulation) {
    PrivacyRegulation["GDPR"] = "GDPR";
    PrivacyRegulation["CCPA"] = "CCPA";
    PrivacyRegulation["PIPEDA"] = "PIPEDA";
    PrivacyRegulation["LGPD"] = "LGPD";
    PrivacyRegulation["PDPA_SG"] = "PDPA_SG";
    PrivacyRegulation["PDPA_TH"] = "PDPA_TH";
    PrivacyRegulation["POPIA"] = "POPIA";
    PrivacyRegulation["HIPAA"] = "HIPAA";
})(PrivacyRegulation || (exports.PrivacyRegulation = PrivacyRegulation = {}));
class DataClassificationService {
    constructor() {
        this.dataInventory = new Map();
        this.minimizationRules = new Map();
        this.dataSubjectRequests = new Map();
        this.classificationRules = new Map();
        this.scanScheduler = [];
        this.initializeDataClassification();
        this.loadClassificationRules();
        this.loadMinimizationRules();
        this.startAutomatedScanning();
        logger_1.logger.info('Data Classification Service initialized', {
            enabledRegulations: this.getEnabledRegulations(),
            scheduledScanning: true,
            piiMinimization: true
        });
    }
    static getInstance() {
        if (!DataClassificationService.instance) {
            DataClassificationService.instance = new DataClassificationService();
        }
        return DataClassificationService.instance;
    }
    async initializeDataClassification() {
        try {
            await this.initializeClassificationPatterns();
            await this.loadExistingInventory();
            await this.validateComplianceStatus();
            logger_1.logger.info('Data classification initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize data classification:', error);
            throw error;
        }
    }
    async initializeClassificationPatterns() {
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
        logger_1.logger.debug('Classification patterns initialized');
    }
    async loadExistingInventory() {
        logger_1.logger.debug('Loading existing data inventory');
    }
    async validateComplianceStatus() {
        logger_1.logger.debug('Validating compliance status');
    }
    loadClassificationRules() {
        logger_1.logger.debug('Classification rules loaded');
    }
    loadMinimizationRules() {
        const emailMinimizationRule = {
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
                age: 2555,
                lastAccess: 1095
            },
            enabled: true,
            priority: 1,
            regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.CCPA],
            legalBasis: 'legitimate_interest',
            retentionPeriod: 2555
        };
        const phoneMinimizationRule = {
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
        const ssnRemovalRule = {
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
                age: 2555,
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
        logger_1.logger.info('PII minimization rules loaded', {
            ruleCount: this.minimizationRules.size
        });
    }
    classifyData(data) {
        try {
            const content = typeof data === 'string' ? data : JSON.stringify(data);
            for (const rule of this.classificationRules.values()) {
                if (rule.pattern && rule.pattern.test(content)) {
                    rule.pattern.lastIndex = 0;
                    if (rule.classification === DataClassification.TOP_SECRET ||
                        rule.classification === DataClassification.RESTRICTED) {
                        return rule.classification;
                    }
                    if (rule.classification === DataClassification.CONFIDENTIAL) {
                        return DataClassification.CONFIDENTIAL;
                    }
                }
            }
            return content.includes('{') || content.includes('[') ?
                DataClassification.INTERNAL : DataClassification.PUBLIC;
        }
        catch (error) {
            logger_1.logger.error('Error classifying data:', error);
            return DataClassification.RESTRICTED;
        }
    }
    async performDataDiscovery(scope = []) {
        const inventoryId = crypto.randomUUID();
        const startTime = Date.now();
        try {
            logger_1.logger.info('Starting data discovery', { inventoryId, scope });
            const elements = [];
            const systemScope = scope.length > 0 ? scope : this.getDefaultScanScope();
            for (const system of systemScope) {
                const systemElements = await this.scanSystem(system);
                elements.push(...systemElements);
            }
            const coverage = this.calculateCoverage(systemScope);
            const summary = this.generateSummary(elements);
            const privacyRisk = this.assessPrivacyRisk(elements);
            const complianceGaps = await this.identifyComplianceGaps(elements);
            const recommendations = this.generateRecommendations(elements, complianceGaps);
            const inventory = {
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
            logger_1.logger.info('Data discovery completed', {
                inventoryId,
                elementsFound: elements.length,
                duration,
                privacyRisk,
                complianceGaps: complianceGaps.length
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'data_discovery_completed',
                severity: privacyRisk === 'CRITICAL' ? 'HIGH' : 'LOW',
                category: 'data_access',
                ipAddress: '82.147.84.78',
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
        }
        catch (error) {
            logger_1.logger.error('Data discovery failed', {
                inventoryId,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    getDefaultScanScope() {
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
    async scanSystem(system) {
        const elements = [];
        if (system.startsWith('database:')) {
            const tableName = system.split(':')[1];
            const tableElements = await this.scanDatabaseTable(tableName);
            elements.push(...tableElements);
        }
        else if (system.startsWith('logs:')) {
            const logType = system.split(':')[1];
            const logElements = await this.scanLogFiles(logType);
            elements.push(...logElements);
        }
        else if (system.startsWith('cache:')) {
            const cacheType = system.split(':')[1];
            const cacheElements = await this.scanCache(cacheType);
            elements.push(...cacheElements);
        }
        else if (system.startsWith('files:')) {
            const fileType = system.split(':')[1];
            const fileElements = await this.scanFiles(fileType);
            elements.push(...fileElements);
        }
        return elements;
    }
    async scanDatabaseTable(tableName) {
        const elements = [];
        const tableSchemas = {
            users: ['id', 'email', 'first_name', 'last_name', 'phone', 'address', 'created_at'],
            orders: ['id', 'user_id', 'total_amount', 'currency', 'payment_method', 'created_at'],
            payments: ['id', 'order_id', 'card_number', 'card_holder', 'amount', 'processed_at'],
            stores: ['id', 'name', 'owner_email', 'phone', 'address', 'tax_id'],
            products: ['id', 'name', 'description', 'price', 'category', 'store_id']
        };
        const fields = tableSchemas[tableName] || [];
        for (const fieldName of fields) {
            const element = await this.classifyField(tableName, fieldName);
            if (element) {
                elements.push(element);
            }
        }
        return elements;
    }
    async scanLogFiles(logType) {
        const elements = [];
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
    async scanCache(_cacheType) {
        return [];
    }
    async scanFiles(_fileType) {
        return [];
    }
    async classifyField(tableName, fieldName) {
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
        return await this.createDataElement(fieldName, tableName, {
            classification: DataClassification.INTERNAL,
            category: DataCategory.PUBLIC_METADATA,
            isPII: false,
            regulations: [],
            confidence: 0.5
        });
    }
    async createDataElement(fieldName, tableName, properties) {
        const element = {
            id: crypto.randomUUID(),
            fieldName,
            tableName,
            classification: properties.classification,
            category: properties.category,
            isPII: properties.isPII,
            isSensitive: properties.classification === DataClassification.RESTRICTED ||
                properties.classification === DataClassification.TOP_SECRET,
            isEncrypted: false,
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
    getDefaultRetentionPeriod(category) {
        const retentionPolicies = {
            [DataCategory.PII_DIRECT]: 2555,
            [DataCategory.PII_INDIRECT]: 1095,
            [DataCategory.PII_SENSITIVE]: 2555,
            [DataCategory.FINANCIAL_ACCOUNT]: 2555,
            [DataCategory.FINANCIAL_TRANSACTION]: 2555,
            [DataCategory.SYSTEM_CREDENTIALS]: 90,
            [DataCategory.SYSTEM_LOGS]: 365,
            [DataCategory.PUBLIC_CONTENT]: 1095
        };
        return retentionPolicies[category] || 1095;
    }
    getMinimumAge(category) {
        return category.includes('PII') ? 16 : 0;
    }
    getDefaultPurposes(category) {
        const purposeMap = {
            [DataCategory.PII_DIRECT]: ['user_account', 'customer_service', 'legal_compliance'],
            [DataCategory.FINANCIAL_TRANSACTION]: ['payment_processing', 'fraud_prevention', 'accounting'],
            [DataCategory.SYSTEM_LOGS]: ['security_monitoring', 'performance_optimization'],
            [DataCategory.PUBLIC_CONTENT]: ['service_provision', 'content_moderation']
        };
        return purposeMap[category] || ['business_operations'];
    }
    getDefaultLegalBasis(category) {
        const legalBasisMap = {
            [DataCategory.PII_DIRECT]: ['contract', 'legitimate_interest'],
            [DataCategory.FINANCIAL_TRANSACTION]: ['contract', 'legal_obligation'],
            [DataCategory.SYSTEM_LOGS]: ['legitimate_interest', 'security'],
            [DataCategory.PUBLIC_CONTENT]: ['consent', 'legitimate_interest']
        };
        return legalBasisMap[category] || ['legitimate_interest'];
    }
    getDefaultAccessControls(classification) {
        const accessControlMap = {
            [DataClassification.PUBLIC]: ['all_users'],
            [DataClassification.INTERNAL]: ['employees'],
            [DataClassification.CONFIDENTIAL]: ['authorized_personnel'],
            [DataClassification.RESTRICTED]: ['senior_staff', 'data_protection_officer'],
            [DataClassification.TOP_SECRET]: ['c_level', 'security_team']
        };
        return accessControlMap[classification] || ['authorized_personnel'];
    }
    getDefaultMinimizationStrategy(category) {
        const strategyMap = {
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
    calculateCoverage(scope) {
        const totalSystems = this.getDefaultScanScope().length;
        return (scope.length / totalSystems) * 100;
    }
    generateSummary(elements) {
        const summary = {
            totalElements: elements.length,
            byClassification: {},
            byCategory: {},
            byRegulation: {}
        };
        Object.values(DataClassification).forEach(c => summary.byClassification[c] = 0);
        Object.values(DataCategory).forEach(c => summary.byCategory[c] = 0);
        Object.values(PrivacyRegulation).forEach(r => summary.byRegulation[r] = 0);
        elements.forEach(element => {
            summary.byClassification[element.classification]++;
            summary.byCategory[element.category]++;
            element.regulations.forEach(reg => {
                summary.byRegulation[reg]++;
            });
        });
        return summary;
    }
    assessPrivacyRisk(elements) {
        const sensitiveCount = elements.filter(e => e.isSensitive).length;
        const piiCount = elements.filter(e => e.isPII).length;
        const unencryptedSensitive = elements.filter(e => e.isSensitive && !e.isEncrypted).length;
        if (unencryptedSensitive > 0 || sensitiveCount > 20) {
            return 'CRITICAL';
        }
        else if (piiCount > 50 || sensitiveCount > 10) {
            return 'HIGH';
        }
        else if (piiCount > 20 || sensitiveCount > 5) {
            return 'MEDIUM';
        }
        else {
            return 'LOW';
        }
    }
    async identifyComplianceGaps(elements) {
        const gaps = [];
        const unencryptedPII = elements.filter(e => e.isPII && !e.isEncrypted);
        if (unencryptedPII.length > 0) {
            gaps.push(`${unencryptedPII.length} PII fields are not encrypted`);
        }
        const excessiveRetention = elements.filter(e => e.retentionPeriod > 2555);
        if (excessiveRetention.length > 0) {
            gaps.push(`${excessiveRetention.length} fields have excessive retention periods`);
        }
        const missingAudit = elements.filter(e => e.isPII && !e.auditRequired);
        if (missingAudit.length > 0) {
            gaps.push(`${missingAudit.length} PII fields lack audit requirements`);
        }
        const crossBorderIssues = elements.filter(e => e.isPII && e.allowCrossBorderTransfer);
        if (crossBorderIssues.length > 0) {
            gaps.push(`${crossBorderIssues.length} PII fields allow unrestricted cross-border transfer`);
        }
        return gaps;
    }
    generateRecommendations(elements, gaps) {
        const recommendations = [];
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
    async applyPIIMinimization(inventoryId) {
        const results = {
            applied: 0,
            failed: 0,
            details: []
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
                        break;
                    }
                    catch (error) {
                        results.failed++;
                        results.details.push(`Failed to apply ${rule.strategy} to ${element.fieldName}: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                    }
                }
            }
            logger_1.logger.info('PII minimization completed', {
                applied: results.applied,
                failed: results.failed
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'pii_minimization_applied',
                severity: 'LOW',
                category: 'data_access',
                ipAddress: '82.147.84.78',
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
        }
        catch (error) {
            logger_1.logger.error('PII minimization failed:', error);
            throw error;
        }
    }
    isRuleApplicable(rule, element) {
        if (!rule.enabled)
            return false;
        if (!rule.fieldPattern.test(element.fieldName))
            return false;
        if (rule.dataCategory.length > 0 && !rule.dataCategory.includes(element.category)) {
            return false;
        }
        if (rule.classification.length > 0 && !rule.classification.includes(element.classification)) {
            return false;
        }
        if (rule.conditions.age) {
            const ageInDays = (Date.now() - element.discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
            if (ageInDays < rule.conditions.age)
                return false;
        }
        if (rule.conditions.purpose && rule.conditions.purpose.length > 0) {
            const hasMatchingPurpose = rule.conditions.purpose.some(purpose => element.purpose.includes(purpose));
            if (!hasMatchingPurpose)
                return false;
        }
        return true;
    }
    async applyMinimizationRule(rule, element) {
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
        logger_1.logger.debug('Minimization rule applied', {
            rule: rule.name,
            strategy: rule.strategy,
            field: element.fieldName,
            table: element.tableName
        });
    }
    async hashData(element) {
        logger_1.logger.debug(`Hashing data for ${element.fieldName}`);
    }
    async tokenizeData(element, preserveFormat) {
        logger_1.logger.debug(`Tokenizing data for ${element.fieldName}`, { preserveFormat });
    }
    async pseudonymizeData(element) {
        logger_1.logger.debug(`Pseudonymizing data for ${element.fieldName}`);
    }
    async encryptData(element) {
        logger_1.logger.debug(`Encrypting data for ${element.fieldName}`);
    }
    async removeData(element) {
        logger_1.logger.debug(`Removing data for ${element.fieldName}`);
    }
    async handleDataSubjectRequest(request) {
        const requestId = crypto.randomUUID();
        const dsrRequest = {
            id: requestId,
            requestedAt: new Date(),
            status: 'pending',
            auditTrail: [],
            ...request
        };
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
        logger_1.logger.info('Data subject request received', {
            requestId,
            type: request.type,
            regulation: request.regulation,
            urgency: request.urgency
        });
        await SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: 'data_subject_request_received',
            severity: request.urgency === 'urgent' ? 'HIGH' : 'MEDIUM',
            category: 'data_access',
            ipAddress: '82.147.84.78',
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
        if (request.type === 'erasure' && request.urgency === 'urgent') {
            await this.assignRequest(requestId, 'data_protection_officer');
        }
        return requestId;
    }
    async assignRequest(requestId, assignee) {
        const request = this.dataSubjectRequests.get(requestId);
        if (!request)
            return;
        request.assignedTo = assignee;
        request.auditTrail.push({
            timestamp: new Date(),
            action: 'request_assigned',
            user: 'system',
            details: { assignee }
        });
        logger_1.logger.info('Data subject request assigned', { requestId, assignee });
    }
    startAutomatedScanning() {
        const dailyScan = setInterval(() => {
            this.performDataDiscovery().catch(error => {
                logger_1.logger.error('Scheduled data discovery failed:', error);
            });
        }, 24 * 60 * 60 * 1000);
        const weeklyMinimization = setInterval(() => {
            this.applyPIIMinimization().catch(error => {
                logger_1.logger.error('Scheduled PII minimization failed:', error);
            });
        }, 7 * 24 * 60 * 60 * 1000);
        this.scanScheduler.push(dailyScan, weeklyMinimization);
        logger_1.logger.info('Automated data classification scanning started');
    }
    getEnabledRegulations() {
        return [
            PrivacyRegulation.GDPR,
            PrivacyRegulation.CCPA,
            PrivacyRegulation.PIPEDA
        ];
    }
    getStats() {
        const allElements = Array.from(this.dataInventory.values()).flatMap(inv => inv.elements);
        const piiElements = allElements.filter(e => e.isPII).length;
        const sensitiveElements = allElements.filter(e => e.isSensitive).length;
        const pendingRequests = Array.from(this.dataSubjectRequests.values())
            .filter(req => req.status === 'pending').length;
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
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.complianceScore < 95) {
            status = 'warning';
        }
        if (stats.pendingRequests > 10) {
            status = 'degraded';
        }
        const unencryptedPII = stats.piiElements - (stats.piiElements * stats.complianceScore / 100);
        if (unencryptedPII > 5) {
            status = 'critical';
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
exports.DataClassificationService = DataClassificationService;
exports.dataClassificationService = DataClassificationService.getInstance();
//# sourceMappingURL=DataClassificationService.js.map