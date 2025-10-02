"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compromiseResponseService = exports.CompromiseResponseService = void 0;
const logger_1 = require("../utils/logger");
const SecretManager_1 = require("../utils/SecretManager");
const SIEMIntegrationService_1 = require("./SIEMIntegrationService");
const EgressGuardService_1 = require("./EgressGuardService");
const CacheShredderService_1 = require("./CacheShredderService");
class CompromiseResponseService {
    constructor() {
        this.killSwitchActive = false;
        this.quarantineActive = false;
    }
    static getInstance() {
        if (!CompromiseResponseService.instance) {
            CompromiseResponseService.instance = new CompromiseResponseService();
        }
        return CompromiseResponseService.instance;
    }
    async initialize() {
        await EgressGuardService_1.egressGuardService.initialize();
        await CacheShredderService_1.cacheShredderService.initialize();
        logger_1.logger.info('CompromiseResponse initialized');
    }
    isKillSwitchActive() {
        return this.killSwitchActive;
    }
    isQuarantineActive() {
        return this.quarantineActive;
    }
    async activateKillSwitch(reason) {
        if (this.killSwitchActive)
            return;
        this.killSwitchActive = true;
        await this.zeroizeSecrets();
        await CacheShredderService_1.cacheShredderService.shredAll();
        EgressGuardService_1.egressGuardService.enable();
        process.env.EGRESS_ALLOWED_HOSTS = '';
        await this.alertSIEM('kill_switch_activated', reason);
        logger_1.logger.error('KILL-SWITCH ACTIVATED: All operations restricted', { reason });
    }
    async deactivateKillSwitch() {
        if (!this.killSwitchActive)
            return;
        this.killSwitchActive = false;
        await this.alertSIEM('kill_switch_deactivated', 'Manual deactivation');
        logger_1.logger.warn('Kill-switch deactivated');
    }
    async activateQuarantine(reason) {
        if (this.quarantineActive)
            return;
        this.quarantineActive = true;
        try {
            process.emitWarning('SECURITY_QUARANTINE_ACTIVE');
        }
        catch (error) {
        }
        process.env.WEBHOOKS_DISABLED = 'true';
        EgressGuardService_1.egressGuardService.enable();
        process.env.EGRESS_ALLOWED_HOSTS = '';
        await CacheShredderService_1.cacheShredderService.shredAll();
        await this.alertSIEM('quarantine_activated', reason);
        logger_1.logger.error('QUARANTINE MODE ACTIVATED', { reason });
    }
    async deactivateQuarantine() {
        if (!this.quarantineActive)
            return;
        this.quarantineActive = false;
        process.env.WEBHOOKS_DISABLED = 'false';
        await this.alertSIEM('quarantine_deactivated', 'Manual deactivation');
        logger_1.logger.warn('Quarantine mode deactivated');
    }
    async zeroizeSecrets() {
        try {
            if (process.env.USE_VAULT === 'true') {
                try {
                    await SecretManager_1.secretManager.rotateSecrets();
                }
                catch (e) {
                    logger_1.logger.warn('Secret rotation failed during zeroization', { error: e?.message });
                }
            }
            const keys = [
                'JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET',
                'ADMIN_DEFAULT_PASSWORD', 'ADMIN_COOKIE_SECRET', 'ADMIN_SESSION_SECRET', 'SMTP_PASS', 'ENCRYPTION_MASTER_KEY',
                'DATA_ENCRYPTION_KEY', 'REDIS_PASSWORD'
            ];
            for (const k of keys) {
                if (process.env[k])
                    process.env[k] = 'ZEROIZED';
            }
            await this.alertSIEM('secrets_zeroized', 'Secrets have been zeroized in memory');
            logger_1.logger.warn('Secrets zeroized in memory');
        }
        catch (error) {
            logger_1.logger.error('Zeroize secrets failed', { error: error?.message });
        }
    }
    async alertSIEM(eventType, reason) {
        try {
            const siem = SIEMIntegrationService_1.SIEMIntegrationService.getInstance();
            await siem.sendEvent({
                eventType,
                severity: 'CRITICAL',
                category: 'THREAT_DETECTION',
                timestamp: new Date(),
                source: 'compromise_response',
                title: `Security Compromise: ${eventType}`,
                description: reason,
                rawEvent: { reason }
            });
        }
        catch (error) {
            logger_1.logger.warn('Failed to send SIEM alert for compromise event');
        }
    }
}
exports.CompromiseResponseService = CompromiseResponseService;
exports.compromiseResponseService = CompromiseResponseService.getInstance();
//# sourceMappingURL=CompromiseResponseService.js.map