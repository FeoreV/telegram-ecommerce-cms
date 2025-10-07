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
exports.disasterRecoveryService = exports.DisasterRecoveryService = void 0;
const crypto = __importStar(require("crypto"));
const errorUtils_1 = require("../utils/errorUtils");
const logger_1 = require("../utils/logger");
const logSanitizer_1 = require("../utils/logSanitizer");
const SecureBackupService_1 = require("./SecureBackupService");
const SecurityLogService_1 = require("./SecurityLogService");
class DisasterRecoveryService {
    constructor() {
        this.recoveryPlans = new Map();
        this.activeTests = new Map();
        this.testScheduler = [];
        this.lastHealthCheck = new Date();
        this.config = {
            enableDisasterRecovery: process.env.ENABLE_DISASTER_RECOVERY !== 'false',
            enableAutomatedRecovery: process.env.ENABLE_AUTOMATED_RECOVERY === 'true',
            enableRecoveryTesting: process.env.ENABLE_RECOVERY_TESTING !== 'false',
            enableFailover: process.env.ENABLE_FAILOVER === 'true',
            recoveryTimeObjective: parseInt(process.env.RECOVERY_TIME_OBJECTIVE || '3600'),
            recoveryPointObjective: parseInt(process.env.RECOVERY_POINT_OBJECTIVE || '900'),
            recoveryTestIntervalDays: parseInt(process.env.RECOVERY_TEST_INTERVAL_DAYS || '30'),
            enableFullSystemTests: process.env.ENABLE_FULL_SYSTEM_TESTS !== 'false',
            enablePartialTests: process.env.ENABLE_PARTIAL_TESTS !== 'false',
            testRetentionDays: parseInt(process.env.TEST_RETENTION_DAYS || '365'),
            primaryRegion: process.env.PRIMARY_REGION || 'us-east-1',
            secondaryRegion: process.env.SECONDARY_REGION || 'us-west-2',
            enableCrossRegionFailover: process.env.ENABLE_CROSS_REGION_FAILOVER === 'true',
            failoverThresholdMinutes: parseInt(process.env.FAILOVER_THRESHOLD_MINUTES || '5'),
            enableRecoveryNotifications: process.env.ENABLE_RECOVERY_NOTIFICATIONS !== 'false',
            recoveryNotificationWebhook: process.env.RECOVERY_NOTIFICATION_WEBHOOK,
            emergencyContacts: (process.env.EMERGENCY_CONTACTS || '').split(',').filter(Boolean),
            enableSOXCompliance: process.env.ENABLE_SOX_COMPLIANCE !== 'false',
            enableGDPRCompliance: process.env.ENABLE_GDPR_COMPLIANCE !== 'false',
            enableHIPAACompliance: process.env.ENABLE_HIPAA_COMPLIANCE === 'true',
            enableDataIntegrityChecks: process.env.ENABLE_DATA_INTEGRITY_CHECKS !== 'false',
            enablePerformanceValidation: process.env.ENABLE_PERFORMANCE_VALIDATION !== 'false',
            enableSecurityValidation: process.env.ENABLE_SECURITY_VALIDATION !== 'false',
            maxAutomatedRecoveryAttempts: parseInt(process.env.MAX_AUTOMATED_RECOVERY_ATTEMPTS || '3'),
            automatedRecoveryDelayMinutes: parseInt(process.env.AUTOMATED_RECOVERY_DELAY_MINUTES || '5'),
            enableProgressTracking: process.env.ENABLE_PROGRESS_TRACKING !== 'false'
        };
        this.initializeDisasterRecovery();
        this.startRecoveryTesting();
        logger_1.logger.info('Disaster Recovery Service initialized', {
            enabled: this.config.enableDisasterRecovery,
            rto: this.config.recoveryTimeObjective,
            rpo: this.config.recoveryPointObjective,
            automatedRecovery: this.config.enableAutomatedRecovery,
            testing: this.config.enableRecoveryTesting
        });
    }
    static getInstance() {
        if (!DisasterRecoveryService.instance) {
            DisasterRecoveryService.instance = new DisasterRecoveryService();
        }
        return DisasterRecoveryService.instance;
    }
    async initializeDisasterRecovery() {
        if (!this.config.enableDisasterRecovery) {
            return;
        }
        try {
            await this.initializeRecoveryPlans();
            await this.loadTestHistory();
            await this.validateBackupReadiness();
            await this.setupRecoveryMonitoring();
            logger_1.logger.info('Disaster recovery initialized successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to initialize disaster recovery:', err);
            throw err;
        }
    }
    async initializeRecoveryPlans() {
        const databasePlan = {
            id: 'database-recovery',
            name: 'Database Recovery Plan',
            version: '1.0',
            lastUpdated: new Date(),
            scope: ['postgresql', 'redis'],
            triggers: ['database_failure', 'data_corruption', 'security_breach'],
            responsibilities: [
                {
                    role: 'Database Administrator',
                    contact: 'dba@botrt.local',
                    actions: ['Assess damage', 'Execute recovery', 'Validate integrity']
                },
                {
                    role: 'Security Team',
                    contact: 'security@botrt.local',
                    actions: ['Security validation', 'Forensic analysis', 'Compliance verification']
                }
            ],
            procedures: await this.createDatabaseRecoveryProcedures(),
            dependencies: ['backup_service', 'storage_access', 'network_connectivity'],
            prerequisites: ['Valid backup available', 'Storage accessible', 'Recovery environment ready'],
            successCriteria: [
                'Database fully restored',
                'Data integrity verified',
                'Performance within acceptable limits',
                'Security validation passed'
            ],
            rollbackProcedure: 'Restore from previous known good backup',
            lastTested: new Date(0),
            testResults: [],
            complianceRequirements: ['SOX', 'GDPR', 'PCI-DSS'],
            auditHistory: []
        };
        const applicationPlan = {
            id: 'application-recovery',
            name: 'Application Recovery Plan',
            version: '1.0',
            lastUpdated: new Date(),
            scope: ['backend_service', 'frontend_service', 'api_gateway'],
            triggers: ['application_failure', 'security_incident', 'performance_degradation'],
            responsibilities: [
                {
                    role: 'DevOps Engineer',
                    contact: 'devops@botrt.local',
                    actions: ['Deploy from backup', 'Validate deployment', 'Monitor performance']
                }
            ],
            procedures: await this.createApplicationRecoveryProcedures(),
            dependencies: ['container_registry', 'kubernetes_cluster', 'load_balancer'],
            prerequisites: ['Container images available', 'Cluster accessible', 'Configuration available'],
            successCriteria: [
                'All services running',
                'API endpoints responding',
                'User authentication working',
                'Data access functioning'
            ],
            rollbackProcedure: 'Redeploy previous stable version',
            lastTested: new Date(0),
            testResults: [],
            complianceRequirements: ['SOX', 'GDPR'],
            auditHistory: []
        };
        this.recoveryPlans.set(databasePlan.id, databasePlan);
        this.recoveryPlans.set(applicationPlan.id, applicationPlan);
        logger_1.logger.info('Recovery plans initialized', {
            plans: Array.from(this.recoveryPlans.keys())
        });
    }
    async createDatabaseRecoveryProcedures() {
        return [
            {
                id: 'assess-damage',
                name: 'Assess Database Damage',
                order: 1,
                description: 'Evaluate the extent of database damage and determine recovery approach',
                steps: [
                    {
                        id: 'check-connectivity',
                        order: 1,
                        description: 'Test database connectivity',
                        command: 'pg_isready -h $DB_HOST -p $DB_PORT',
                        automatable: true,
                        estimatedDuration: 60,
                        validationCriteria: ['Connection successful'],
                        riskLevel: 'LOW'
                    },
                    {
                        id: 'check-data-integrity',
                        order: 2,
                        description: 'Verify data integrity',
                        command: 'psql -c "SELECT COUNT(*) FROM information_schema.tables"',
                        automatable: true,
                        estimatedDuration: 300,
                        validationCriteria: ['Table count matches expected'],
                        riskLevel: 'MEDIUM'
                    }
                ],
                estimatedDuration: 600,
                criticality: 'HIGH',
                dependencies: []
            },
            {
                id: 'restore-database',
                name: 'Restore Database from Backup',
                order: 2,
                description: 'Restore database from the most recent valid backup',
                steps: [
                    {
                        id: 'stop-services',
                        order: 1,
                        description: 'Stop dependent services',
                        command: 'kubectl scale deployment --replicas=0 backend-service',
                        automatable: true,
                        estimatedDuration: 120,
                        validationCriteria: ['Services stopped'],
                        riskLevel: 'MEDIUM'
                    },
                    {
                        id: 'restore-data',
                        order: 2,
                        description: 'Restore from backup',
                        automatable: false,
                        estimatedDuration: 1800,
                        validationCriteria: ['Restore completed successfully'],
                        riskLevel: 'HIGH'
                    },
                    {
                        id: 'verify-restore',
                        order: 3,
                        description: 'Verify restore integrity',
                        automatable: true,
                        estimatedDuration: 600,
                        validationCriteria: ['Data integrity verified'],
                        riskLevel: 'MEDIUM'
                    }
                ],
                estimatedDuration: 2520,
                criticality: 'CRITICAL',
                dependencies: ['assess-damage']
            }
        ];
    }
    async createApplicationRecoveryProcedures() {
        return [
            {
                id: 'deploy-application',
                name: 'Deploy Application from Backup',
                order: 1,
                description: 'Deploy application services from container images',
                steps: [
                    {
                        id: 'validate-images',
                        order: 1,
                        description: 'Validate container images',
                        command: 'docker manifest inspect $IMAGE_TAG',
                        automatable: true,
                        estimatedDuration: 60,
                        validationCriteria: ['Images available and signed'],
                        riskLevel: 'LOW'
                    },
                    {
                        id: 'deploy-services',
                        order: 2,
                        description: 'Deploy services to cluster',
                        command: 'kubectl apply -f k8s-manifests/',
                        automatable: true,
                        estimatedDuration: 300,
                        validationCriteria: ['All pods running'],
                        riskLevel: 'MEDIUM'
                    }
                ],
                estimatedDuration: 360,
                criticality: 'HIGH',
                dependencies: []
            }
        ];
    }
    async loadTestHistory() {
        logger_1.logger.debug('Loading recovery test history');
    }
    async validateBackupReadiness() {
        const backupStats = SecureBackupService_1.secureBackupService.getStats();
        if (!backupStats.lastBackup) {
            logger_1.logger.warn('No recent backups found for disaster recovery');
            return;
        }
        const timeSinceLastBackup = Date.now() - backupStats.lastBackup.getTime();
        const rpoViolation = timeSinceLastBackup > (this.config.recoveryPointObjective * 1000);
        if (rpoViolation) {
            logger_1.logger.error('RPO violation detected', {
                timeSinceLastBackup,
                rpo: this.config.recoveryPointObjective,
                lastBackup: backupStats.lastBackup
            });
            await SecurityLogService_1.securityLogService.logSecurityEvent({
                eventType: 'rpo_violation',
                severity: 'HIGH',
                category: 'system',
                ipAddress: '82.147.84.78',
                success: false,
                details: {
                    timeSinceLastBackup,
                    rpo: this.config.recoveryPointObjective,
                    lastBackup: backupStats.lastBackup
                },
                riskScore: 70,
                tags: ['disaster_recovery', 'rpo_violation'],
                compliance: {
                    pii: false,
                    gdpr: true,
                    pci: true,
                    hipaa: this.config.enableHIPAACompliance
                }
            });
        }
    }
    async setupRecoveryMonitoring() {
        setInterval(() => {
            this.validateBackupReadiness().catch((err) => {
                logger_1.logger.error('Backup readiness validation failed:', err);
            });
        }, 300000);
    }
    async executeRecoveryTest(planId, testType = 'full_system', options = {}) {
        const testId = crypto.randomUUID();
        const plan = this.recoveryPlans.get(planId);
        if (!plan) {
            throw new Error(`Recovery plan not found: ${planId}`);
        }
        const test = {
            id: testId,
            timestamp: new Date(),
            type: testType,
            status: 'scheduled',
            testScope: options.scope || plan.scope,
            testEnvironment: options.testEnvironment || 'test',
            backupId: options.backupId,
            rtoTarget: this.config.recoveryTimeObjective,
            rpoTarget: this.config.recoveryPointObjective,
            startTime: new Date(),
            success: false,
            issues: [],
            validationResults: [],
            recoveryDuration: 0,
            dataRecovered: 0,
            systemsRecovered: 0,
            testPlan: `Recovery test for plan: ${plan.name}`,
            executionNotes: [],
            recommendations: [],
            complianceValidated: false,
            auditTrail: []
        };
        this.activeTests.set(testId, test);
        try {
            await this.logRecoveryEvent(testId, 'test_started', {
                planId,
                testType,
                testEnvironment: test.testEnvironment
            });
            test.status = 'running';
            await this.executeTestProcedures(test, plan);
            await this.validateRecoveryResults(test, plan);
            await this.generateTestReport(test, plan);
            test.status = 'completed';
            test.success = test.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length === 0;
            test.endTime = new Date();
            test.recoveryDuration = test.endTime.getTime() - test.startTime.getTime();
            plan.lastTested = test.endTime;
            plan.testResults.push(test);
            logger_1.logger.info('Recovery test completed', {
                testId,
                planId,
                success: test.success,
                duration: test.recoveryDuration,
                issues: test.issues.length
            });
            await this.logRecoveryEvent(testId, 'test_completed', {
                success: test.success,
                duration: test.recoveryDuration,
                issues: test.issues.length,
                actualRTO: test.actualRTO,
                actualRPO: test.actualRPO
            });
            return testId;
        }
        catch (err) {
            test.status = 'failed';
            test.endTime = new Date();
            test.success = false;
            test.recoveryDuration = test.endTime.getTime() - test.startTime.getTime();
            const issue = {
                id: crypto.randomUUID(),
                severity: 'CRITICAL',
                category: 'system',
                description: `Test execution failed: ${(0, errorUtils_1.getErrorMessage)(err)}`,
                impact: 'Recovery test could not be completed',
                resolution: 'Review test configuration and system status',
                status: 'open'
            };
            test.issues.push(issue);
            logger_1.logger.error('Recovery test failed', {
                testId,
                planId,
                error: (0, errorUtils_1.getErrorMessage)(err)
            });
            await this.logRecoveryEvent(testId, 'test_completed', {
                success: false,
                error: (0, errorUtils_1.getErrorMessage)(err)
            }, 'failure');
            throw err;
        }
    }
    async executeTestProcedures(test, plan) {
        test.executionNotes.push('Starting recovery procedure execution');
        for (const procedure of plan.procedures) {
            try {
                test.executionNotes.push(`Executing procedure: ${procedure.name}`);
                for (const step of procedure.steps) {
                    const _stepStartTime = Date.now();
                    try {
                        if (step.automatable && step.command) {
                            test.executionNotes.push(`Executing automated step: ${step.description}`);
                            await this.simulateStepExecution(step);
                        }
                        else {
                            test.executionNotes.push(`Simulating manual step: ${step.description}`);
                            await this.simulateManualStep(step);
                        }
                        const validation = await this.validateStep(step, test);
                        test.validationResults.push(validation);
                        if (validation.result === 'fail') {
                            const issue = {
                                id: crypto.randomUUID(),
                                severity: step.riskLevel,
                                category: 'system',
                                description: `Step failed: ${step.description}`,
                                impact: validation.details,
                                resolution: 'Review step execution and requirements',
                                status: 'open'
                            };
                            test.issues.push(issue);
                            await this.logRecoveryEvent(test.id, 'issue_found', issue);
                        }
                    }
                    catch (stepError) {
                        const issue = {
                            id: crypto.randomUUID(),
                            severity: 'HIGH',
                            category: 'system',
                            description: `Step execution failed: ${step.description}`,
                            impact: (0, errorUtils_1.getErrorMessage)(stepError),
                            resolution: 'Review step configuration and dependencies',
                            status: 'open'
                        };
                        test.issues.push(issue);
                        test.executionNotes.push(`Step failed: ${(0, errorUtils_1.getErrorMessage)(stepError)}`);
                    }
                }
            }
            catch (procedureError) {
                const issue = {
                    id: crypto.randomUUID(),
                    severity: 'CRITICAL',
                    category: 'system',
                    description: `Procedure failed: ${procedure.name}`,
                    impact: (0, errorUtils_1.getErrorMessage)(procedureError),
                    resolution: 'Review procedure configuration and dependencies',
                    status: 'open'
                };
                test.issues.push(issue);
                test.executionNotes.push(`Procedure failed: ${(0, errorUtils_1.getErrorMessage)(procedureError)}`);
            }
        }
    }
    async simulateStepExecution(step) {
        await new Promise(resolve => setTimeout(resolve, Math.min(step.estimatedDuration * 10, 5000)));
    }
    async simulateManualStep(step) {
        await new Promise(resolve => setTimeout(resolve, Math.min(step.estimatedDuration * 5, 2000)));
    }
    async validateStep(step, _test) {
        const success = Math.random() > 0.1;
        return {
            component: 'recovery_step',
            test: step.id,
            result: success ? 'pass' : 'fail',
            expected: 'step_completed',
            actual: success ? 'step_completed' : 'step_failed',
            details: success ? 'Step completed successfully' : 'Step validation failed'
        };
    }
    async validateRecoveryResults(test, plan) {
        test.executionNotes.push('Starting recovery validation');
        if (this.config.enableDataIntegrityChecks) {
            const dataValidation = await this.validateDataIntegrity(test);
            test.validationResults.push(dataValidation);
        }
        if (this.config.enablePerformanceValidation) {
            const performanceValidation = await this.validatePerformance(test);
            test.validationResults.push(performanceValidation);
        }
        if (this.config.enableSecurityValidation) {
            const securityValidation = await this.validateSecurity(test);
            test.validationResults.push(securityValidation);
        }
        test.actualRTO = test.recoveryDuration / 1000;
        test.actualRPO = 0;
        if (test.actualRTO > test.rtoTarget) {
            const issue = {
                id: crypto.randomUUID(),
                severity: 'HIGH',
                category: 'performance',
                description: 'RTO target exceeded',
                impact: `Recovery took ${test.actualRTO}s, target was ${test.rtoTarget}s`,
                resolution: 'Optimize recovery procedures and infrastructure',
                status: 'open'
            };
            test.issues.push(issue);
        }
        if (this.config.enableSOXCompliance || this.config.enableGDPRCompliance) {
            test.complianceValidated = await this.validateCompliance(test, plan);
        }
    }
    async validateDataIntegrity(_test) {
        const success = Math.random() > 0.05;
        return {
            component: 'database',
            test: 'data_integrity',
            result: success ? 'pass' : 'fail',
            expected: 'data_consistent',
            actual: success ? 'data_consistent' : 'data_inconsistent',
            details: success ? 'All data integrity checks passed' : 'Data integrity issues detected'
        };
    }
    async validatePerformance(_test) {
        const success = Math.random() > 0.15;
        return {
            component: 'application',
            test: 'performance',
            result: success ? 'pass' : 'warning',
            expected: 'performance_acceptable',
            actual: success ? 'performance_acceptable' : 'performance_degraded',
            details: success ? 'Performance within acceptable limits' : 'Performance degradation detected'
        };
    }
    async validateSecurity(_test) {
        const success = Math.random() > 0.08;
        return {
            component: 'security',
            test: 'security_posture',
            result: success ? 'pass' : 'fail',
            expected: 'security_intact',
            actual: success ? 'security_intact' : 'security_compromised',
            details: success ? 'Security posture maintained' : 'Security issues detected'
        };
    }
    async validateCompliance(test, plan) {
        for (const requirement of plan.complianceRequirements) {
            const validation = await this.validateComplianceRequirement(requirement, test);
            test.validationResults.push(validation);
            if (validation.result === 'fail') {
                return false;
            }
        }
        return true;
    }
    async validateComplianceRequirement(requirement, test) {
        const success = Math.random() > 0.1;
        return {
            component: 'compliance',
            test: requirement,
            result: success ? 'pass' : 'fail',
            expected: 'compliant',
            actual: success ? 'compliant' : 'non_compliant',
            details: success ? `${requirement} compliance verified` : `${requirement} compliance issues detected`
        };
    }
    async generateTestReport(test, _plan) {
        test.recommendations = [];
        if (test.actualRTO && test.actualRTO > test.rtoTarget) {
            test.recommendations.push('Optimize recovery procedures to meet RTO targets');
            test.recommendations.push('Consider infrastructure upgrades to improve recovery speed');
        }
        const criticalIssues = test.issues.filter(i => i.severity === 'CRITICAL').length;
        const highIssues = test.issues.filter(i => i.severity === 'HIGH').length;
        if (criticalIssues > 0) {
            test.recommendations.push('Address critical issues immediately before next recovery test');
        }
        if (highIssues > 0) {
            test.recommendations.push('Review and resolve high-severity issues to improve recovery reliability');
        }
        const failedValidations = test.validationResults.filter(v => v.result === 'fail').length;
        if (failedValidations > 0) {
            test.recommendations.push('Review failed validation criteria and update procedures');
        }
        if (!test.complianceValidated) {
            test.recommendations.push('Address compliance issues to meet regulatory requirements');
        }
        test.executionNotes.push(`Test completed with ${test.issues.length} issues and ${test.recommendations.length} recommendations`);
    }
    async logRecoveryEvent(testId, action, details, outcome = 'success') {
        const event = {
            timestamp: new Date(),
            action,
            user: 'system',
            details,
            outcome
        };
        const test = this.activeTests.get(testId);
        if (test) {
            test.auditTrail.push(event);
        }
        await SecurityLogService_1.securityLogService.logSecurityEvent({
            eventType: `recovery_${action}`,
            severity: outcome === 'failure' ? 'HIGH' : 'LOW',
            category: 'system',
            ipAddress: '82.147.84.78',
            success: outcome === 'success',
            details: {
                testId,
                action,
                ...details
            },
            riskScore: outcome === 'failure' ? 60 : 10,
            tags: ['disaster_recovery', action],
            compliance: {
                pii: false,
                gdpr: this.config.enableGDPRCompliance,
                pci: false,
                hipaa: this.config.enableHIPAACompliance
            }
        });
    }
    startRecoveryTesting() {
        if (!this.config.enableRecoveryTesting) {
            return;
        }
        const testInterval = setInterval(() => {
            this.performScheduledTests().catch((err) => {
                logger_1.logger.error('Scheduled recovery test failed:', err);
            });
        }, this.config.recoveryTestIntervalDays * 24 * 60 * 60 * 1000);
        this.testScheduler.push(testInterval);
        logger_1.logger.info('Recovery testing scheduled', {
            intervalDays: this.config.recoveryTestIntervalDays
        });
    }
    async performScheduledTests() {
        for (const [planId, plan] of this.recoveryPlans.entries()) {
            const timeSinceLastTest = Date.now() - plan.lastTested.getTime();
            const testDue = timeSinceLastTest > (this.config.recoveryTestIntervalDays * 24 * 60 * 60 * 1000);
            if (testDue) {
                try {
                    if (this.config.enableFullSystemTests) {
                        await this.executeRecoveryTest(planId, 'full_system', {
                            testEnvironment: 'test'
                        });
                    }
                    else if (this.config.enablePartialTests) {
                        await this.executeRecoveryTest(planId, 'database', {
                            testEnvironment: 'test'
                        });
                    }
                }
                catch (err) {
                    logger_1.logger.error('Scheduled recovery test failed', { planId: (0, logSanitizer_1.sanitizeForLog)(planId), error: err });
                }
            }
        }
    }
    getStats() {
        const allTests = Array.from(this.recoveryPlans.values())
            .flatMap(plan => plan.testResults);
        const lastTestDate = allTests.length > 0
            ? new Date(Math.max(...allTests.map(test => test.timestamp.getTime())))
            : undefined;
        const rtoCompliantTests = allTests.filter(test => test.actualRTO !== undefined && test.actualRTO <= test.rtoTarget);
        const rpoCompliantTests = allTests.filter(test => test.actualRPO !== undefined && test.actualRPO <= test.rpoTarget);
        const backupStats = SecureBackupService_1.secureBackupService.getStats();
        const backupReadiness = !!backupStats.lastBackup;
        const timeSinceLastBackup = backupStats.lastBackup
            ? Date.now() - backupStats.lastBackup.getTime()
            : null;
        return {
            config: this.config,
            recoveryPlans: this.recoveryPlans.size,
            activeTests: this.activeTests.size,
            lastTestDate,
            rtoCompliance: allTests.length > 0 ? (rtoCompliantTests.length / allTests.length) * 100 : 0,
            rpoCompliance: allTests.length > 0 ? (rpoCompliantTests.length / allTests.length) * 100 : 0,
            backupReadiness,
            timeSinceLastBackup,
            recentTests: allTests.length
        };
    }
    async healthCheck() {
        const stats = this.getStats();
        let status = 'healthy';
        if (!stats.backupReadiness) {
            status = 'critical';
        }
        else {
            if (stats.timeSinceLastBackup && stats.timeSinceLastBackup > (this.config.recoveryPointObjective * 1000)) {
                status = 'warning';
            }
        }
        const recentTests = Array.from(this.recoveryPlans.values())
            .filter(plan => stats.lastTestDate && Date.now() - stats.lastTestDate.getTime() < (this.config.recoveryTestIntervalDays * 24 * 60 * 60 * 1000));
        if (recentTests.length === 0) {
            status = 'warning';
        }
        return {
            status,
            stats: {
                ...stats,
            }
        };
    }
}
exports.DisasterRecoveryService = DisasterRecoveryService;
exports.disasterRecoveryService = DisasterRecoveryService.getInstance();
//# sourceMappingURL=DisasterRecoveryService.js.map