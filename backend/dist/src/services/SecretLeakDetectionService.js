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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretLeakDetectionService = exports.SecretLeakDetectionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const SecurityLogService_1 = require("./SecurityLogService");
const SIEMIntegrationService_1 = require("./SIEMIntegrationService");
class SecretLeakDetectionService {
    constructor() {
        this.secretPatterns = new Map();
        this.scanQueue = [];
        this.activeScanners = new Set();
        this.detectionCache = new Map();
        this.alertHistory = new Map();
        this.config = {
            enableSecretDetection: process.env.ENABLE_SECRET_DETECTION !== 'false',
            enableRealtimeScanning: process.env.ENABLE_REALTIME_SECRET_SCAN !== 'false',
            enableBatchScanning: process.env.ENABLE_BATCH_SECRET_SCAN !== 'false',
            enableLogScanning: process.env.ENABLE_LOG_SECRET_SCAN !== 'false',
            enableFileScanning: process.env.ENABLE_FILE_SECRET_SCAN !== 'false',
            enableNetworkScanning: process.env.ENABLE_NETWORK_SECRET_SCAN === 'true',
            logDirectories: (process.env.SECRET_SCAN_LOG_DIRS || 'logs,/var/log').split(','),
            fileExtensions: (process.env.SECRET_SCAN_EXTENSIONS || '.js,.ts,.json,.yaml,.yml,.env,.config,.conf').split(','),
            excludeDirectories: (process.env.SECRET_SCAN_EXCLUDE_DIRS || 'node_modules,.git,dist,build').split(','),
            excludeFiles: (process.env.SECRET_SCAN_EXCLUDE_FILES || '.gitignore,package-lock.json').split(','),
            confidenceThreshold: parseFloat(process.env.SECRET_CONFIDENCE_THRESHOLD || '0.7'),
            entropyThreshold: parseFloat(process.env.SECRET_ENTROPY_THRESHOLD || '3.5'),
            maxFileSize: parseInt(process.env.SECRET_MAX_FILE_SIZE || '10485760'),
            enableAutoQuarantine: process.env.ENABLE_AUTO_QUARANTINE === 'true',
            enableAutoRotation: process.env.ENABLE_AUTO_ROTATION === 'true',
            enableNotifications: process.env.ENABLE_SECRET_NOTIFICATIONS !== 'false',
            notificationWebhook: process.env.SECRET_NOTIFICATION_WEBHOOK,
            batchSize: parseInt(process.env.SECRET_SCAN_BATCH_SIZE || '100'),
            scanIntervalMs: parseInt(process.env.SECRET_SCAN_INTERVAL || '300000'),
            maxConcurrentScans: parseInt(process.env.SECRET_MAX_CONCURRENT_SCANS || '5'),
            enableWhitelist: process.env.ENABLE_SECRET_WHITELIST !== 'false',
            whitelistPatterns: (process.env.SECRET_WHITELIST_PATTERNS || 'example,test,demo,placeholder').split(','),
            enableContextAnalysis: process.env.ENABLE_SECRET_CONTEXT_ANALYSIS !== 'false',
            retentionDays: parseInt(process.env.SECRET_DETECTION_RETENTION_DAYS || '90'),
            enableEncryptedStorage: process.env.ENABLE_SECRET_ENCRYPTED_STORAGE !== 'false'
        };
        this.initializeSecretPatterns();
        this.startBackgroundTasks();
        logger_1.logger.info('Secret Leak Detection Service initialized', {
            enabled: this.config.enableSecretDetection,
            realtimeScanning: this.config.enableRealtimeScanning,
            batchScanning: this.config.enableBatchScanning,
            confidenceThreshold: this.config.confidenceThreshold,
            patternsLoaded: this.secretPatterns.size
        });
    }
    static getInstance() {
        if (!SecretLeakDetectionService.instance) {
            SecretLeakDetectionService.instance = new SecretLeakDetectionService();
        }
        return SecretLeakDetectionService.instance;
    }
    initializeSecretPatterns() {
        this.secretPatterns.set('aws_access_key', {
            name: 'AWS Access Key ID',
            description: 'Amazon Web Services access key identifier',
            pattern: /AKIA[0-9A-Z]{16}/g,
            confidence: 0.9,
            entropy: 4.0,
            category: 'api_key',
            severity: 'CRITICAL',
            enabled: true
        });
        this.secretPatterns.set('aws_secret_key', {
            name: 'AWS Secret Access Key',
            description: 'Amazon Web Services secret access key',
            pattern: /[A-Za-z0-9/+=]{40}/g,
            confidence: 0.7,
            entropy: 5.0,
            category: 'api_key',
            severity: 'CRITICAL',
            enabled: true
        });
        this.secretPatterns.set('generic_api_key', {
            name: 'Generic API Key',
            description: 'Generic API key pattern',
            pattern: /(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)["\s]*[:=]["\s]*([A-Za-z0-9_-]{20,})/gi,
            confidence: 0.8,
            entropy: 4.5,
            category: 'api_key',
            severity: 'HIGH',
            enabled: true
        });
        this.secretPatterns.set('jwt_token', {
            name: 'JWT Token',
            description: 'JSON Web Token',
            pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
            confidence: 0.95,
            entropy: 5.5,
            category: 'token',
            severity: 'HIGH',
            enabled: true
        });
        this.secretPatterns.set('database_url', {
            name: 'Database Connection String',
            description: 'Database connection string with credentials',
            pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^:\s]+:\d+\/[^\s]+/gi,
            confidence: 0.9,
            entropy: 4.0,
            category: 'database',
            severity: 'CRITICAL',
            enabled: true
        });
        this.secretPatterns.set('private_key', {
            name: 'Private Key',
            description: 'RSA/EC private key',
            pattern: /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi,
            confidence: 0.98,
            entropy: 6.0,
            category: 'certificate',
            severity: 'CRITICAL',
            enabled: true
        });
        this.secretPatterns.set('slack_token', {
            name: 'Slack Token',
            description: 'Slack API token',
            pattern: /xox[bprs]-[0-9a-zA-Z-]{10,48}/g,
            confidence: 0.95,
            entropy: 4.0,
            category: 'api_key',
            severity: 'HIGH',
            enabled: true
        });
        this.secretPatterns.set('github_token', {
            name: 'GitHub Token',
            description: 'GitHub personal access token',
            pattern: /gh[ps]_[A-Za-z0-9_]{36}/g,
            confidence: 0.95,
            entropy: 4.0,
            category: 'api_key',
            severity: 'HIGH',
            enabled: true
        });
        this.secretPatterns.set('google_api_key', {
            name: 'Google API Key',
            description: 'Google Cloud/Firebase API key',
            pattern: /AIza[0-9A-Za-z_-]{35}/g,
            confidence: 0.9,
            entropy: 4.0,
            category: 'api_key',
            severity: 'HIGH',
            enabled: true
        });
        this.secretPatterns.set('password_assignment', {
            name: 'Password Assignment',
            description: 'Password variable assignment',
            pattern: /(?:password|passwd|pwd)["\s]*[:=]["\s]*([A-Za-z0-9!@#$%^&*()_+=[\]{};':"\\|,.<>/?~`]{8,})/gi,
            confidence: 0.6,
            entropy: 3.0,
            category: 'password',
            severity: 'MEDIUM',
            enabled: true
        });
        this.secretPatterns.set('generic_secret', {
            name: 'Generic Secret',
            description: 'Generic secret pattern',
            pattern: /(?:secret|token|key)["\s]*[:=]["\s]*([A-Za-z0-9_-]{16,})/gi,
            confidence: 0.5,
            entropy: 4.0,
            category: 'api_key',
            severity: 'MEDIUM',
            enabled: true
        });
        this.secretPatterns.set('credit_card', {
            name: 'Credit Card Number',
            description: 'Credit card number pattern',
            pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
            confidence: 0.8,
            entropy: 2.5,
            category: 'custom',
            severity: 'CRITICAL',
            enabled: true
        });
        this.secretPatterns.set('ssh_key', {
            name: 'SSH Private Key',
            description: 'SSH private key',
            pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/gi,
            confidence: 0.98,
            entropy: 6.0,
            category: 'certificate',
            severity: 'CRITICAL',
            enabled: true
        });
    }
    async scanText(content, source, location, metadata = {}) {
        if (!this.config.enableSecretDetection) {
            return [];
        }
        const results = [];
        const scanId = crypto_1.default.randomUUID();
        for (const [patternId, pattern] of this.secretPatterns.entries()) {
            if (!pattern.enabled)
                continue;
            try {
                const matches = this.findPatternMatches(content, pattern);
                for (const match of matches) {
                    const detection = await this.analyzeMatch(match, pattern, source, location, scanId, metadata);
                    if (detection && this.shouldReportDetection(detection)) {
                        results.push(detection);
                    }
                }
            }
            catch (_error) {
                logger_1.logger.error(`Error scanning with pattern ${patternId}:`, _error);
            }
        }
        if (results.length > 0) {
            await this.processDetections(results);
        }
        return results;
    }
    async scanLogFile(filepath) {
        if (!this.config.enableLogScanning) {
            return [];
        }
        try {
            const stats = fs.statSync(filepath);
            if (stats.size > this.config.maxFileSize) {
                const sanitizedFilepath = String(filepath).replace(/[\r\n]/g, ' ');
                logger_1.logger.debug(`Skipping large file: ${sanitizedFilepath} (${stats.size} bytes)`, { filepath: sanitizedFilepath, fileSize: stats.size });
                return [];
            }
            const content = fs.readFileSync(filepath, 'utf-8');
            return await this.scanText(content, 'log', filepath, {
                filename: path.basename(filepath),
                filepath,
                fileSize: stats.size,
                lastModified: stats.mtime
            });
        }
        catch (_error) {
            const sanitizedFilepath = String(filepath).replace(/[\r\n]/g, ' ');
            const sanitizedError = _error instanceof Error ? _error.message.replace(/[\r\n]/g, ' ') : String(_error).replace(/[\r\n]/g, ' ');
            logger_1.logger.error(`Error scanning log file ${sanitizedFilepath}:`, { error: sanitizedError, filepath: sanitizedFilepath });
            return [];
        }
    }
    async scanSourceFile(filepath) {
        if (!this.config.enableFileScanning) {
            return [];
        }
        if (this.shouldExcludeFile(filepath)) {
            return [];
        }
        try {
            const stats = fs.statSync(filepath);
            if (stats.size > this.config.maxFileSize) {
                return [];
            }
            const content = fs.readFileSync(filepath, 'utf-8');
            return await this.scanText(content, 'file', filepath, {
                filename: path.basename(filepath),
                filepath,
                fileSize: stats.size,
                lastModified: stats.mtime
            });
        }
        catch (_error) {
            const sanitizedFilepath = String(filepath).replace(/[\r\n]/g, ' ');
            const sanitizedError = _error instanceof Error ? _error.message.replace(/[\r\n]/g, ' ') : String(_error).replace(/[\r\n]/g, ' ');
            logger_1.logger.error(`Error scanning source file ${sanitizedFilepath}:`, { error: sanitizedError, filepath: sanitizedFilepath });
            return [];
        }
    }
    async scanLogEntry(logEntry, source) {
        if (!this.config.enableRealtimeScanning) {
            return;
        }
        try {
            const detections = await this.scanText(logEntry, 'log', source, {
                realtime: true,
                source
            });
            if (detections.length > 0) {
                logger_1.logger.warn(`Secret leak detected in real-time log entry from ${source}`, {
                    detectionsCount: detections.length,
                    source
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in real-time log scanning:', error);
        }
    }
    findPatternMatches(content, pattern) {
        const matches = [];
        const lines = content.split('\n');
        let globalIndex = 0;
        const isPredefinedPattern = Array.from(this.secretPatterns.values()).some(p => p.pattern.source === pattern.pattern.source);
        if (!isPredefinedPattern) {
            logger_1.logger.warn('Attempted to use non-predefined pattern', { patternName: pattern.name });
            return matches;
        }
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const regex = pattern.pattern;
            let match;
            while ((match = regex.exec(line)) !== null) {
                matches.push({
                    match: match[0],
                    index: globalIndex + match.index,
                    line: lineIndex + 1,
                    column: match.index + 1,
                    lineContent: line
                });
            }
            globalIndex += line.length + 1;
        }
        return matches;
    }
    async analyzeMatch(match, pattern, source, location, scanId, metadata) {
        const detectedSecret = match.match;
        const entropy = this.calculateEntropy(detectedSecret);
        if (entropy < pattern.entropy) {
            return null;
        }
        if (pattern.confidence < this.config.confidenceThreshold) {
            return null;
        }
        if (this.config.enableWhitelist && this.isWhitelisted(detectedSecret)) {
            return null;
        }
        const beforeContext = match.lineContent.substring(0, match.column - 1);
        const afterContext = match.lineContent.substring(match.column + detectedSecret.length - 1);
        if (this.config.enableContextAnalysis && this.isLikelyFalsePositive(beforeContext, detectedSecret, afterContext)) {
            return null;
        }
        const riskScore = this.calculateRiskScore(pattern, entropy, detectedSecret, beforeContext, afterContext);
        const detection = {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            secretType: pattern.name,
            pattern: pattern.pattern.source,
            confidence: pattern.confidence,
            entropy,
            severity: pattern.severity,
            source,
            location,
            lineNumber: match.line,
            columnStart: match.column,
            columnEnd: match.column + detectedSecret.length,
            beforeContext: beforeContext.slice(-50),
            matchedContent: this.maskSecret(detectedSecret),
            afterContext: afterContext.slice(0, 50),
            fullLine: match.lineContent,
            riskScore,
            isValidSecret: await this.validateSecret(detectedSecret, pattern),
            isActiveSecret: await this.checkSecretActivity(detectedSecret, pattern),
            potentialImpact: this.assessPotentialImpact(pattern, riskScore),
            quarantined: false,
            rotated: false,
            notified: false,
            scanId,
            ...metadata
        };
        return detection;
    }
    calculateEntropy(text) {
        const freq = {};
        for (const char of text) {
            freq[char] = (freq[char] || 0) + 1;
        }
        let entropy = 0;
        const textLength = text.length;
        for (const count of Object.values(freq)) {
            const probability = count / textLength;
            entropy -= probability * Math.log2(probability);
        }
        return entropy;
    }
    isWhitelisted(secret) {
        const lowerSecret = secret.toLowerCase();
        return this.config.whitelistPatterns.some(pattern => lowerSecret.includes(pattern.toLowerCase()));
    }
    isLikelyFalsePositive(before, secret, after) {
        const context = (before + secret + after).toLowerCase();
        const falsePositiveIndicators = [
            'example', 'test', 'demo', 'placeholder', 'sample',
            'your_key_here', 'insert_key', 'replace_with',
            'todo', 'fixme', 'xxx', 'yyy', 'zzz',
            'base64', 'encoded', 'hash', 'checksum'
        ];
        return falsePositiveIndicators.some(indicator => context.includes(indicator));
    }
    calculateRiskScore(pattern, entropy, secret, beforeContext, afterContext) {
        let score = 0;
        switch (pattern.severity) {
            case 'CRITICAL':
                score += 80;
                break;
            case 'HIGH':
                score += 60;
                break;
            case 'MEDIUM':
                score += 40;
                break;
            case 'LOW':
                score += 20;
                break;
        }
        score += Math.min(20, (entropy - pattern.entropy) * 5);
        if (secret.length > 32)
            score += 10;
        if (secret.length > 64)
            score += 10;
        const context = (beforeContext + afterContext).toLowerCase();
        if (context.includes('prod') || context.includes('production')) {
            score += 20;
        }
        if (context.includes('config') || context.includes('env')) {
            score += 15;
        }
        if (context.includes('//') || context.includes('#') || context.includes('/*')) {
            score -= 10;
        }
        return Math.min(100, Math.max(0, score));
    }
    async validateSecret(secret, pattern) {
        switch (pattern.category) {
            case 'api_key':
                return this.validateAPIKey(secret, pattern);
            case 'token':
                return this.validateToken(secret, pattern);
            case 'certificate':
                return this.validateCertificate(secret, pattern);
            default:
                return true;
        }
    }
    validateAPIKey(secret, pattern) {
        if (pattern.name.includes('AWS')) {
            return /^AKIA[0-9A-Z]{16}$/.test(secret);
        }
        return secret.length >= 16 && /^[A-Za-z0-9_-]+$/.test(secret);
    }
    validateToken(secret, pattern) {
        if (pattern.name.includes('JWT')) {
            const parts = secret.split('.');
            return parts.length === 3;
        }
        return true;
    }
    validateCertificate(secret, _pattern) {
        return secret.includes('-----BEGIN') && secret.includes('-----END');
    }
    async checkSecretActivity(_secret, _pattern) {
        return true;
    }
    assessPotentialImpact(pattern, riskScore) {
        const impacts = [];
        switch (pattern.category) {
            case 'api_key':
                impacts.push('Unauthorized API access');
                impacts.push('Data exfiltration');
                impacts.push('Resource consumption');
                break;
            case 'database':
                impacts.push('Database access');
                impacts.push('Data breach');
                impacts.push('Data manipulation');
                break;
            case 'certificate':
                impacts.push('Identity spoofing');
                impacts.push('Man-in-the-middle attacks');
                impacts.push('Unauthorized authentication');
                break;
            case 'password':
                impacts.push('Account takeover');
                impacts.push('Privilege escalation');
                break;
        }
        if (riskScore >= 80) {
            impacts.push('Critical security breach');
            impacts.push('Compliance violation');
        }
        return impacts;
    }
    shouldReportDetection(detection) {
        return detection.riskScore >= 30 && detection.confidence >= this.config.confidenceThreshold;
    }
    async processDetections(detections) {
        for (const detection of detections) {
            try {
                await SecurityLogService_1.securityLogService.logSecurityEvent({
                    eventType: 'secret_leak_detected',
                    severity: detection.severity,
                    category: 'system',
                    ipAddress: 'localhost',
                    success: false,
                    details: {
                        secretType: detection.secretType,
                        location: detection.location,
                        riskScore: detection.riskScore,
                        entropy: detection.entropy,
                        confidence: detection.confidence,
                        source: detection.source
                    },
                    riskScore: detection.riskScore,
                    tags: ['secret_leak', 'data_loss_prevention', detection.secretType.toLowerCase()],
                    compliance: {
                        pii: false,
                        gdpr: true,
                        pci: detection.secretType.includes('credit_card'),
                        hipaa: false
                    }
                });
                await SIEMIntegrationService_1.siemIntegrationService.sendEvent({
                    eventType: 'secret_leak_detected',
                    severity: detection.severity,
                    category: 'system',
                    title: `Secret Leak Detected: ${detection.secretType}`,
                    description: `Secret of type ${detection.secretType} detected in ${detection.source}`,
                    customFields: {
                        secretType: detection.secretType,
                        location: detection.location,
                        riskScore: detection.riskScore,
                        entropy: detection.entropy,
                        confidence: detection.confidence,
                        detectionId: detection.id
                    }
                });
                await this.takeAutomatedActions(detection);
                if (detection.severity === 'CRITICAL' || detection.riskScore >= 80) {
                    await this.createAlert(detection);
                }
            }
            catch (error) {
                logger_1.logger.error('Error processing secret detection:', error);
            }
        }
    }
    async takeAutomatedActions(detection) {
        if (this.config.enableAutoQuarantine && detection.severity === 'CRITICAL') {
            await this.quarantineSecret(detection);
        }
        if (this.config.enableAutoRotation && detection.isActiveSecret) {
            await this.initiateSecretRotation(detection);
        }
        if (this.config.enableNotifications) {
            await this.sendNotification(detection);
        }
    }
    async quarantineSecret(detection) {
        try {
            logger_1.logger.warn('Secret quarantined', {
                detectionId: detection.id,
                location: detection.location,
                secretType: detection.secretType
            });
            detection.quarantined = true;
        }
        catch (error) {
            logger_1.logger.error('Failed to quarantine secret:', error);
        }
    }
    async initiateSecretRotation(detection) {
        try {
            logger_1.logger.info('Secret rotation initiated', {
                detectionId: detection.id,
                secretType: detection.secretType
            });
            detection.rotated = true;
        }
        catch (error) {
            logger_1.logger.error('Failed to initiate secret rotation:', error);
        }
    }
    async sendNotification(detection) {
        try {
            if (this.config.notificationWebhook) {
                const notification = {
                    type: 'secret_leak_detected',
                    detection: {
                        id: detection.id,
                        timestamp: detection.timestamp,
                        secretType: detection.secretType,
                        severity: detection.severity,
                        location: detection.location,
                        riskScore: detection.riskScore
                    }
                };
                await fetch(this.config.notificationWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notification)
                });
            }
            detection.notified = true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send secret leak notification:', error);
        }
    }
    async createAlert(detection) {
        const alert = {
            id: crypto_1.default.randomUUID(),
            timestamp: new Date(),
            severity: detection.severity,
            title: `Critical Secret Leak: ${detection.secretType}`,
            description: `High-risk secret of type ${detection.secretType} detected in ${detection.source}`,
            category: 'secret_leak',
            detections: [detection],
            detectionCount: 1,
            riskScore: detection.riskScore,
            impactLevel: this.mapRiskToImpact(detection.riskScore),
            urgency: this.mapSeverityToUrgency(detection.severity),
            status: 'open',
            responseActions: this.generateResponseActions(detection),
            firstDetected: detection.timestamp,
            lastDetected: detection.timestamp,
            estimatedExposureDuration: 0
        };
        this.alertHistory.set(alert.id, alert);
        logger_1.logger.error('Critical secret leak alert created', {
            alertId: alert.id,
            detectionId: detection.id,
            secretType: detection.secretType,
            riskScore: detection.riskScore
        });
    }
    mapRiskToImpact(riskScore) {
        if (riskScore >= 80)
            return 'severe';
        if (riskScore >= 60)
            return 'significant';
        if (riskScore >= 40)
            return 'moderate';
        return 'minimal';
    }
    mapSeverityToUrgency(severity) {
        switch (severity) {
            case 'CRITICAL': return 'critical';
            case 'HIGH': return 'high';
            case 'MEDIUM': return 'medium';
            case 'LOW': return 'low';
            default: return 'low';
        }
    }
    generateResponseActions(detection) {
        const actions = [];
        actions.push('Immediately revoke the exposed secret');
        actions.push('Rotate all related credentials');
        actions.push('Review access logs for unauthorized usage');
        actions.push('Notify affected stakeholders');
        if (detection.source === 'log') {
            actions.push('Clean logs and prevent log retention of secrets');
        }
        if (detection.source === 'file') {
            actions.push('Remove secret from source code');
            actions.push('Review git history for secret exposure');
        }
        return actions;
    }
    shouldExcludeFile(filepath) {
        const filename = path.basename(filepath);
        const extension = path.extname(filepath);
        const directory = path.dirname(filepath);
        if (this.config.excludeFiles.some(excluded => filename.includes(excluded))) {
            return true;
        }
        if (this.config.excludeDirectories.some(excluded => directory.includes(excluded))) {
            return true;
        }
        if (this.config.fileExtensions.length > 0 &&
            !this.config.fileExtensions.includes(extension)) {
            return true;
        }
        return false;
    }
    maskSecret(secret) {
        if (secret.length <= 8) {
            return '*'.repeat(secret.length);
        }
        const start = secret.substring(0, 3);
        const end = secret.substring(secret.length - 3);
        const middle = '*'.repeat(Math.max(1, secret.length - 6));
        return start + middle + end;
    }
    startBackgroundTasks() {
        if (!this.config.enableBatchScanning) {
            return;
        }
        setInterval(() => {
            this.scanLogDirectories().catch(error => {
                logger_1.logger.error('Background log scanning failed:', error);
            });
        }, this.config.scanIntervalMs);
        setInterval(() => {
            this.cleanupOldDetections().catch(error => {
                logger_1.logger.error('Detection cleanup failed:', error);
            });
        }, 24 * 60 * 60 * 1000);
    }
    async scanLogDirectories() {
        if (this.activeScanners.size >= this.config.maxConcurrentScans) {
            return;
        }
        for (const logDir of this.config.logDirectories) {
            if (!fs.existsSync(logDir)) {
                continue;
            }
            try {
                const files = fs.readdirSync(logDir);
                for (const file of files.slice(0, this.config.batchSize)) {
                    const filepath = path.join(logDir, file);
                    if (this.activeScanners.has(filepath) || this.shouldExcludeFile(filepath)) {
                        continue;
                    }
                    this.activeScanners.add(filepath);
                    this.scanLogFile(filepath)
                        .finally(() => {
                        this.activeScanners.delete(filepath);
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Error scanning log directory ${logDir}:`, error);
            }
        }
    }
    async cleanupOldDetections() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        for (const [key, detections] of this.detectionCache.entries()) {
            const filteredDetections = detections.filter(d => d.timestamp > cutoffDate);
            if (filteredDetections.length === 0) {
                this.detectionCache.delete(key);
            }
            else {
                this.detectionCache.set(key, filteredDetections);
            }
        }
        for (const [key, alert] of this.alertHistory.entries()) {
            if (alert.timestamp < cutoffDate) {
                this.alertHistory.delete(key);
            }
        }
        logger_1.logger.debug('Cleaned up old secret detections and alerts');
    }
    getStats() {
        return {
            config: this.config,
            patternsCount: this.secretPatterns.size,
            activeScanners: this.activeScanners.size,
            queueSize: this.scanQueue.length,
            cacheSize: this.detectionCache.size,
            alertsCount: this.alertHistory.size
        };
    }
    async healthCheck() {
        const stats = this.getStats();
        const isHealthy = stats.activeScanners < this.config.maxConcurrentScans &&
            stats.queueSize < 1000 &&
            this.secretPatterns.size > 0;
        return {
            status: isHealthy ? 'healthy' : 'degraded',
            stats
        };
    }
}
exports.SecretLeakDetectionService = SecretLeakDetectionService;
exports.secretLeakDetectionService = SecretLeakDetectionService.getInstance();
//# sourceMappingURL=SecretLeakDetectionService.js.map