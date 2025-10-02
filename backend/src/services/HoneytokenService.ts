import crypto from 'crypto';
import { logger } from '../utils/logger';
import { SIEMIntegrationService } from './SIEMIntegrationService';
import { compromiseResponseService } from './CompromiseResponseService';

export interface HoneytokenConfig {
  enabled: boolean;
  autoQuarantine: boolean;
  tokenCount: number;
}

export class HoneytokenService {
  private static instance: HoneytokenService;
  private config: HoneytokenConfig;
  private tokens: Set<string> = new Set();

  private constructor() {
    this.config = {
      enabled: process.env.HONEYTOKENS_ENABLED !== 'false',
      autoQuarantine: process.env.HONEYTOKENS_AUTO_QUARANTINE !== 'false',
      tokenCount: parseInt(process.env.HONEYTOKENS_COUNT || '5', 10)
    };
  }

  public static getInstance(): HoneytokenService {
    if (!HoneytokenService.instance) {
      HoneytokenService.instance = new HoneytokenService();
    }
    return HoneytokenService.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('HoneytokenService disabled via env');
      return;
    }
    // Seed tokens if not provided
    const existing = (process.env.HONEYTOKENS || '').split(',').map(s => s.trim()).filter(Boolean);
    existing.forEach(t => this.tokens.add(t));

    while (this.tokens.size < this.config.tokenCount) {
      this.tokens.add(this.generateHoneytoken());
    }

    // Reflect tokens back to env for operational visibility (non-secret decoys)
    process.env.HONEYTOKENS = Array.from(this.tokens).join(',');
    logger.info('HoneytokenService initialized', { count: this.tokens.size });
  }

  public getTokens(): string[] {
    return Array.from(this.tokens);
  }

  public isHoneytoken(value?: string | null): boolean {
    if (!value) return false;
    for (const token of this.tokens) {
      if (value.includes(token)) return true;
    }
    return false;
  }

  public async triggerAlert(context: { source: string; sample?: string }): Promise<void> {
    logger.error('HONEYTOKEN ACCESSED', context);
    try {
      const siem = SIEMIntegrationService.getInstance();
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
    } catch (error) {
      // Intentionally empty
      logger.error('Failed to send SIEM event for honeytoken access:', error);
    }

    if (this.config.autoQuarantine) {
      await compromiseResponseService.activateQuarantine('honeytoken_access');
    }
  }

  private generateHoneytoken(): string {
    // Format resembling API key to entice attackers
    const prefix = 'htk_';
    const rand = crypto.randomBytes(24).toString('base64url');
    return prefix + rand;
  }
}

export const honeytokenService = HoneytokenService.getInstance();


