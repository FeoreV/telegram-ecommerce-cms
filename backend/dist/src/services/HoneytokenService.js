"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.honeytokenService = exports.HoneytokenService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const SIEMIntegrationService_1 = require("./SIEMIntegrationService");
const CompromiseResponseService_1 = require("./CompromiseResponseService");
class HoneytokenService {
    constructor() {
        this.tokens = new Set();
        this.config = {
            enabled: process.env.HONEYTOKENS_ENABLED !== 'false',
            autoQuarantine: process.env.HONEYTOKENS_AUTO_QUARANTINE !== 'false',
            tokenCount: parseInt(process.env.HONEYTOKENS_COUNT || '5', 10)
        };
    }
    static getInstance() {
        if (!HoneytokenService.instance) {
            HoneytokenService.instance = new HoneytokenService();
        }
        return HoneytokenService.instance;
    }
    async initialize() {
        if (!this.config.enabled) {
            logger_1.logger.warn('HoneytokenService disabled via env');
            return;
        }
        const existing = (process.env.HONEYTOKENS || '').split(',').map(s => s.trim()).filter(Boolean);
        existing.forEach(t => this.tokens.add(t));
        while (this.tokens.size < this.config.tokenCount) {
            this.tokens.add(this.generateHoneytoken());
        }
        process.env.HONEYTOKENS = Array.from(this.tokens).join(',');
        logger_1.logger.info('HoneytokenService initialized', { count: this.tokens.size });
    }
    getTokens() {
        return Array.from(this.tokens);
    }
    isHoneytoken(value) {
        if (!value)
            return false;
        for (const token of this.tokens) {
            if (value.includes(token))
                return true;
        }
        return false;
    }
    async triggerAlert(context) {
        logger_1.logger.error('HONEYTOKEN ACCESSED', context);
        try {
            const siem = SIEMIntegrationService_1.SIEMIntegrationService.getInstance();
            await siem.sendEvent({
                eventType: 'honeytoken_access',
                severity: 'CRITICAL',
                category: 'THREAT_DETECTION',
                timestamp: new Date(),
                source: 'honeytoken_service',
                title: 'Honeytoken Access Detected',
                description: 'Honeytoken accessed - possible security breach',
                rawEvent: context
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send SIEM event for honeytoken access:', error);
        }
        if (this.config.autoQuarantine) {
            await CompromiseResponseService_1.compromiseResponseService.activateQuarantine('honeytoken_access');
        }
    }
    generateHoneytoken() {
        const prefix = 'htk_';
        const rand = crypto_1.default.randomBytes(24).toString('base64url');
        return prefix + rand;
    }
}
exports.HoneytokenService = HoneytokenService;
exports.honeytokenService = HoneytokenService.getInstance();
//# sourceMappingURL=HoneytokenService.js.map