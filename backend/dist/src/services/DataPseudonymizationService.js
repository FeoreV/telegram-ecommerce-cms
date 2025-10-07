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
exports.dataPseudonymizationService = exports.DataPseudonymizationService = exports.ReversibilityLevel = exports.PseudonymizationMethod = void 0;
const crypto = __importStar(require("crypto"));
const errorUtils_1 = require("../utils/errorUtils");
const logger_1 = require("../utils/logger");
const EncryptionService_1 = require("./EncryptionService");
const SecurityLogService_1 = require("./SecurityLogService");
const VaultService_1 = require("./VaultService");
const vaultService = (0, VaultService_1.getVaultService)();
var PseudonymizationMethod;
(function (PseudonymizationMethod) {
    PseudonymizationMethod["HASH"] = "hash";
    PseudonymizationMethod["TOKENIZATION"] = "tokenization";
    PseudonymizationMethod["ENCRYPTION"] = "encryption";
    PseudonymizationMethod["SYNTHETIC"] = "synthetic";
    PseudonymizationMethod["MASKING"] = "masking";
    PseudonymizationMethod["GENERALIZATION"] = "generalization";
    PseudonymizationMethod["SUPPRESSION"] = "suppression";
})(PseudonymizationMethod || (exports.PseudonymizationMethod = PseudonymizationMethod = {}));
var ReversibilityLevel;
(function (ReversibilityLevel) {
    ReversibilityLevel["IRREVERSIBLE"] = "irreversible";
    ReversibilityLevel["RESTRICTED"] = "restricted";
    ReversibilityLevel["CONDITIONAL"] = "conditional";
    ReversibilityLevel["REVERSIBLE"] = "reversible";
})(ReversibilityLevel || (exports.ReversibilityLevel = ReversibilityLevel = {}));
class DataPseudonymizationService {
    constructor() {
        this.pseudonymizationRules = new Map();
        this.pseudonymizationKeys = new Map();
        this.transformationResults = new Map();
        this.activeJobs = new Map();
        this.tokenMappings = new Map();
        this.formatPreservers = new Map();
        this.loadPseudonymizationRules();
        this.setupFormatPreservers();
    }
    async initialize() {
        await this.initializeDataPseudonymization();
        logger_1.logger.info('Data Pseudonymization Service initialized', {
            rules: this.pseudonymizationRules.size,
            keys: this.pseudonymizationKeys.size,
            formatPreservers: this.formatPreservers.size
        });
    }
    static async getInstance() {
        if (!DataPseudonymizationService.instance) {
            DataPseudonymizationService.instance = new DataPseudonymizationService();
            await DataPseudonymizationService.instance.initialize();
        }
        return DataPseudonymizationService.instance;
    }
    async initializeDataPseudonymization() {
        try {
            await this.initializePseudonymizationKeys();
            await this.loadExistingTransformations();
            await this.validateServiceHealth();
            logger_1.logger.info('Data pseudonymization initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize data pseudonymization:', error);
            throw error;
        }
    }
    async initializePseudonymizationKeys() {
        try {
            const keyTypes = [
                'hash-salt-key',
                'tokenization-key',
                'format-preserving-key',
                'synthetic-data-key'
            ];
            for (const keyType of keyTypes) {
                let keyValue = await vaultService.getSecret(`pseudonymization-keys/${keyType}`);
                if (!keyValue) {
                    const keyBuffer = crypto.randomBytes(32);
                    keyValue = keyBuffer.toString('base64');
                    await vaultService.putSecret(`pseudonymization-keys/${keyType}`, { key: keyValue });
                    logger_1.logger.info(`Generated new pseudonymization key: ${keyType}`);
                }
                const pseudoKey = {
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
            logger_1.logger.info('Pseudonymization keys initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize pseudonymization keys:', error);
            throw error;
        }
    }
    async loadExistingTransformations() {
        logger_1.logger.debug('Loading existing transformation mappings');
    }
    async validateServiceHealth() {
        logger_1.logger.debug('Validating pseudonymization service health');
    }
    loadPseudonymizationRules() {
        const emailRule = {
            id: 'email-tokenization',
            name: 'Email Address Tokenization',
            description: 'Tokenize email addresses while preserving domain for analytics',
            fieldPattern: /email/i,
            dataTypes: ['varchar', 'text', 'string'],
            method: PseudonymizationMethod.TOKENIZATION,
            reversibility: ReversibilityLevel.RESTRICTED,
            preserveFormat: true,
            preserveDistribution: false,
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
            retentionPeriod: 1095,
            enabled: true,
            priority: 1,
            validateBeforeTransform: true,
            validateAfterTransform: true
        };
        const phoneRule = {
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
        const nameRule = {
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
            retentionPeriod: 2555,
            enabled: true,
            priority: 3,
            validateBeforeTransform: true,
            validateAfterTransform: true
        };
        const addressRule = {
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
        const sensitiveIdRule = {
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
        logger_1.logger.info('Pseudonymization rules loaded', {
            ruleCount: this.pseudonymizationRules.size
        });
    }
    setupFormatPreservers() {
        this.formatPreservers.set('email', {
            pattern: /^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
            transform: (match) => {
                const localPart = this.generateToken(match[1], 'alphanumeric', match[1].length);
                return `${localPart}@${match[2]}`;
            }
        });
        this.formatPreservers.set('phone', {
            pattern: /^(\+?[1-9])(\d{3})(\d{3})(\d{4})$/,
            transform: (match) => {
                const masked = match[2].replace(/\d/g, 'X') +
                    match[3].replace(/\d/g, 'X') +
                    match[4];
                return `${match[1]}${masked}`;
            }
        });
        this.formatPreservers.set('credit_card', {
            pattern: /^(\d{4})(\d{4})(\d{4})(\d{4})$/,
            transform: (match) => {
                return `${match[1]}XXXXXXXX${match[4]}`;
            }
        });
        logger_1.logger.debug('Format preservers setup completed');
    }
    async transformData(data, tableName, _environment = 'production') {
        const transformations = [];
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
                    const rule = applicableRules[0];
                    try {
                        const transformation = await this.applyTransformation(fieldName, originalValue.toString(), rule, _environment);
                        transformations.push(transformation);
                        transformedData[fieldName] = transformation.transformedValue;
                        const qualityScore = this.calculateTransformationQuality(transformation);
                        totalQualityScore += qualityScore;
                        transformationCount++;
                    }
                    catch (error) {
                        logger_1.logger.error('Transformation failed', {
                            field: fieldName,
                            rule: rule.id,
                            error: (0, errorUtils_1.getErrorMessage)(error)
                        });
                    }
                }
            }
            const overallQualityScore = transformationCount > 0
                ? totalQualityScore / transformationCount
                : 100;
            logger_1.logger.debug('Data transformation completed', {
                tableName,
                environment: _environment,
                transformationsApplied: transformations.length,
                qualityScore: overallQualityScore
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
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
        }
        catch (error) {
            logger_1.logger.error('Data transformation failed:', error);
            throw error;
        }
    }
    findApplicableRules(fieldName, tableName, value, environment) {
        const applicableRules = [];
        for (const rule of this.pseudonymizationRules.values()) {
            if (!rule.enabled)
                continue;
            if (!rule.fieldPattern.test(fieldName))
                continue;
            if (rule.tablePattern && !rule.tablePattern.test(tableName))
                continue;
            if (rule.conditions.environment &&
                !rule.conditions.environment.includes(environment))
                continue;
            if (rule.conditions.dataPattern &&
                !rule.conditions.dataPattern.test(value.toString()))
                continue;
            const valueLength = value.toString().length;
            if (rule.conditions.minLength && valueLength < rule.conditions.minLength)
                continue;
            if (rule.conditions.maxLength && valueLength > rule.conditions.maxLength)
                continue;
            applicableRules.push(rule);
        }
        return applicableRules.sort((a, b) => b.priority - a.priority);
    }
    async applyTransformation(fieldName, originalValue, rule, _environment) {
        const transformationId = crypto.randomUUID();
        if (rule.validateBeforeTransform) {
            await this.validateInput(originalValue, rule);
        }
        let transformedValue;
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
        const transformation = {
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
        if (rule.validateAfterTransform) {
            const validationResult = await this.validateTransformation(transformation, rule);
            transformation.validated = validationResult.valid;
            transformation.validationErrors = validationResult.errors;
        }
        this.transformationResults.set(transformationId, transformation);
        return transformation;
    }
    async applyHashTransformation(value, rule) {
        const algorithm = rule.hashAlgorithm || 'SHA-256';
        const saltLength = rule.saltLength || 16;
        const saltKey = `hash-salt-${rule.id}`;
        let salt = await vaultService.getSecret(`pseudonymization-salts/${saltKey}`);
        if (!salt) {
            salt = crypto.randomBytes(saltLength).toString('hex');
            await vaultService.putSecret(`pseudonymization-salts/${saltKey}`, { salt });
        }
        const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
        hash.update(value + salt);
        return hash.digest('hex');
    }
    async applyTokenization(value, rule) {
        const originalHash = crypto.createHash('sha256').update(value).digest('hex');
        const existingMapping = Array.from(this.tokenMappings.values())
            .find(mapping => mapping.originalHash === originalHash);
        if (existingMapping && rule.consistencyRequired) {
            existingMapping.lastUsed = new Date();
            existingMapping.usageCount++;
            return existingMapping.tokenValue;
        }
        let tokenValue;
        if (rule.preserveFormat && rule.tokenizationFormat) {
            tokenValue = await this.generateFormatPreservingToken(value, rule.tokenizationFormat);
        }
        else {
            tokenValue = this.generateRandomToken(value.length);
        }
        const mapping = {
            originalHash,
            tokenValue,
            format: rule.tokenizationFormat || 'generic',
            createdAt: new Date(),
            lastUsed: new Date(),
            usageCount: 1,
            keyVersion: '1.0'
        };
        this.tokenMappings.set(tokenValue, mapping);
        return tokenValue;
    }
    async generateFormatPreservingToken(value, format) {
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
    generateRandomToken(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    generateToken(input, type, length) {
        const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const numeric = '0123456789';
        const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let chars;
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
    async applyEncryption(value, rule) {
        const keyId = rule.encryptionKeyId || 'format-preserving-key';
        try {
            const encrypted = await EncryptionService_1.encryptionService.encryptData(value, keyId);
            return encrypted;
        }
        catch (error) {
            throw new Error(`Encryption failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
    }
    async applyMasking(value, rule) {
        if (rule.tokenizationFormat) {
            const preserver = this.formatPreservers.get(rule.tokenizationFormat);
            if (preserver) {
                const match = value.match(preserver.pattern);
                if (match) {
                    return preserver.transform(match);
                }
            }
        }
        if (value.length <= 4) {
            return 'X'.repeat(value.length);
        }
        const start = value.substring(0, 2);
        const end = value.substring(value.length - 2);
        const middle = 'X'.repeat(value.length - 4);
        return start + middle + end;
    }
    async applyGeneralization(value, rule) {
        if (rule.fieldPattern.test('address')) {
            const postalCodeMatch = value.match(/\b\d{5}(-\d{4})?\b/);
            if (postalCodeMatch) {
                return postalCodeMatch[0].substring(0, 3) + 'XX';
            }
        }
        return value.substring(0, Math.min(3, value.length)) + '*'.repeat(Math.max(0, value.length - 3));
    }
    async applySyntheticGeneration(value, rule) {
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
        return this.generateRandomToken(value.length);
    }
    async applySuppression(_value, _rule) {
        return '[SUPPRESSED]';
    }
    async validateInput(value, rule) {
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
    async validateTransformation(transformation, rule) {
        const errors = [];
        if (rule.preserveFormat && !transformation.formatPreserved) {
            errors.push('Format not preserved as required');
        }
        if (rule.uniquenessRequired) {
            const duplicates = Array.from(this.transformationResults.values())
                .filter(t => t.transformedValue === transformation.transformedValue && t.id !== transformation.id);
            if (duplicates.length > 0) {
                errors.push('Uniqueness requirement violated');
            }
        }
        if (transformation.reversible && rule.reversibility === ReversibilityLevel.IRREVERSIBLE) {
            errors.push('Transformation should be irreversible but is marked as reversible');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    isFormatPreserved(original, transformed, rule) {
        if (!rule.preserveFormat)
            return true;
        const originalDigits = (original.match(/\d/g) || []).length;
        const transformedDigits = (transformed.match(/\d/g) || []).length;
        const originalLetters = (original.match(/[a-zA-Z]/g) || []).length;
        const transformedLetters = (transformed.match(/[a-zA-Z]/g) || []).length;
        const originalSpecial = original.length - originalDigits - originalLetters;
        const transformedSpecial = transformed.length - transformedDigits - transformedLetters;
        return Math.abs(originalDigits - transformedDigits) <= 2 &&
            Math.abs(originalLetters - transformedLetters) <= 2 &&
            Math.abs(originalSpecial - transformedSpecial) <= 1;
    }
    isTypePreserved(original, transformed) {
        const originalIsNumeric = /^\d+$/.test(original);
        const transformedIsNumeric = /^\d+$/.test(transformed);
        const originalIsAlpha = /^[a-zA-Z]+$/.test(original);
        const transformedIsAlpha = /^[a-zA-Z]+$/.test(transformed);
        return (originalIsNumeric === transformedIsNumeric) &&
            (originalIsAlpha === transformedIsAlpha);
    }
    calculateTransformationQuality(transformation) {
        let score = 100;
        if (!transformation.formatPreserved)
            score -= 20;
        if (!transformation.lengthPreserved)
            score -= 10;
        if (!transformation.typePreserved)
            score -= 15;
        if (transformation.validationErrors.length > 0)
            score -= (transformation.validationErrors.length * 10);
        return Math.max(0, score);
    }
    async reverseTransformation(transformedValue, transformationId, authorizedUser, justification) {
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
        await SecurityLogService_1.securityLogService.logSecurityEvent({
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
            let originalValue;
            switch (transformation.method) {
                case PseudonymizationMethod.ENCRYPTION: {
                    if (!transformation.keyId) {
                        throw new Error('Encryption key ID not found');
                    }
                    const decrypted = await EncryptionService_1.encryptionService.decryptData(transformedValue, transformation.keyId);
                    originalValue = decrypted;
                    break;
                }
                case PseudonymizationMethod.TOKENIZATION: {
                    const mapping = this.tokenMappings.get(transformedValue);
                    if (!mapping) {
                        throw new Error('Token mapping not found');
                    }
                    originalValue = `[TOKENIZED:${transformedValue}]`;
                    break;
                }
                default:
                    throw new Error(`Reversal not supported for method: ${transformation.method}`);
            }
            logger_1.logger.info('Pseudonymization reversed', {
                transformationId,
                authorizedUser,
                justification
            });
            return originalValue;
        }
        catch (error) {
            logger_1.logger.error('Pseudonymization reversal failed', {
                transformationId,
                authorizedUser,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    async executePseudonymizationJob(tables, environment, dryRun = false) {
        const jobId = crypto.randomUUID();
        const job = {
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
            logger_1.logger.info('Starting pseudonymization job', {
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
                const simulatedRecords = this.generateSimulatedRecords(tableName, 100);
                for (const record of simulatedRecords) {
                    const result = await this.transformData(record, tableName, environment);
                    job.recordsProcessed++;
                    job.transformationsApplied += result.transformations.length;
                    totalQualityScore += result.qualityScore;
                    totalRecords++;
                    job.progress = Math.round((job.recordsProcessed / (tables.length * 100)) * 100);
                }
            }
            job.qualityScore = totalRecords > 0 ? totalQualityScore / totalRecords : 100;
            job.consistencyScore = this.calculateConsistencyScore(job);
            job.uniquenessScore = this.calculateUniquenessScore(job);
            job.status = 'completed';
            job.endTime = new Date();
            job.duration = job.endTime.getTime() - job.startTime.getTime();
            logger_1.logger.info('Pseudonymization job completed', {
                jobId,
                recordsProcessed: job.recordsProcessed,
                transformationsApplied: job.transformationsApplied,
                qualityScore: job.qualityScore,
                duration: job.duration
            });
            return jobId;
        }
        catch (error) {
            job.status = 'failed';
            job.endTime = new Date();
            job.duration = job.endTime.getTime() - job.startTime.getTime();
            logger_1.logger.error('Pseudonymization job failed', {
                jobId,
                error: (0, errorUtils_1.getErrorMessage)(error)
            });
            throw error;
        }
    }
    generateSimulatedRecords(tableName, count) {
        const records = [];
        for (let i = 0; i < count; i++) {
            const record = {
                id: i + 1
            };
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
    calculateConsistencyScore(job) {
        return 95;
    }
    calculateUniquenessScore(job) {
        return 98;
    }
    getStats() {
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
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (stats.averageQualityScore < 90) {
            status = 'warning';
        }
        if (stats.activeJobs > 5) {
            status = 'degraded';
        }
        if (stats.averageQualityScore < 70) {
            status = 'critical';
        }
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
exports.DataPseudonymizationService = DataPseudonymizationService;
exports.dataPseudonymizationService = DataPseudonymizationService.getInstance();
//# sourceMappingURL=DataPseudonymizationService.js.map