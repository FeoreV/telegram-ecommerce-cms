import { logger } from '../utils/logger';
import { secretManager } from '../utils/SecretManager';
import { SIEMIntegrationService } from './SIEMIntegrationService';
import { egressGuardService } from './EgressGuardService';
import { cacheShredderService } from './CacheShredderService';

export class CompromiseResponseService {
  private static instance: CompromiseResponseService;
  private killSwitchActive: boolean = false;
  private quarantineActive: boolean = false;

  private constructor() {}

  public static getInstance(): CompromiseResponseService {
    if (!CompromiseResponseService.instance) {
      CompromiseResponseService.instance = new CompromiseResponseService();
    }
    return CompromiseResponseService.instance;
  }

  public async initialize(): Promise<void> {
    await egressGuardService.initialize();
    await cacheShredderService.initialize();
    logger.info('CompromiseResponse initialized');
  }

  public isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  public isQuarantineActive(): boolean {
    return this.quarantineActive;
  }

  public async activateKillSwitch(reason: string): Promise<void> {
    if (this.killSwitchActive) return;
    this.killSwitchActive = true;

    // Zeroize secrets in memory
    await this.zeroizeSecrets();

    // Shred caches and temp artifacts
    await cacheShredderService.shredAll();

    // Block all outbound egress immediately
    egressGuardService.enable();
    process.env.EGRESS_ALLOWED_HOSTS = '';

    // Alert SIEM
    await this.alertSIEM('kill_switch_activated', reason);

    logger.error('KILL-SWITCH ACTIVATED: All operations restricted', { reason });
  }

  public async deactivateKillSwitch(): Promise<void> {
    if (!this.killSwitchActive) return;
    this.killSwitchActive = false;
    await this.alertSIEM('kill_switch_deactivated', 'Manual deactivation');
    logger.warn('Kill-switch deactivated');
  }

  public async activateQuarantine(reason: string): Promise<void> {
    if (this.quarantineActive) return;
    this.quarantineActive = true;

    // Revoke sessions (best-effort; actual implementation depends on session store)
    try {
      // Emit signal for other services to revoke sessions
      process.emitWarning('SECURITY_QUARANTINE_ACTIVE');
    } catch (error) {
      // Process warning emission failed, but we continue with quarantine
    }

    // Disable webhooks via env flag (routes should check this flag)
    process.env.WEBHOOKS_DISABLED = 'true';

    // Strengthen egress: deny by default
    egressGuardService.enable();
    process.env.EGRESS_ALLOWED_HOSTS = '';

    // Shred caches to remove any sensitive leftovers
    await cacheShredderService.shredAll();

    await this.alertSIEM('quarantine_activated', reason);
    logger.error('QUARANTINE MODE ACTIVATED', { reason });
  }

  public async deactivateQuarantine(): Promise<void> {
    if (!this.quarantineActive) return;
    this.quarantineActive = false;
    process.env.WEBHOOKS_DISABLED = 'false';
    await this.alertSIEM('quarantine_deactivated', 'Manual deactivation');
    logger.warn('Quarantine mode deactivated');
  }

  private async zeroizeSecrets(): Promise<void> {
    try {
      // Attempt to rotate and clear sensitive material
      if (process.env.USE_VAULT === 'true') {
        try {
          await secretManager.rotateSecrets();
        } catch (e) {
          logger.warn('Secret rotation failed during zeroization', { error: (e as any)?.message });
        }
      }

      // Overwrite process env copies where possible
      const keys = [
        'JWT_SECRET','JWT_REFRESH_SECRET','DATABASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET',
        'ADMIN_DEFAULT_PASSWORD','ADMIN_COOKIE_SECRET','ADMIN_SESSION_SECRET','SMTP_PASS','ENCRYPTION_MASTER_KEY',
        'DATA_ENCRYPTION_KEY','REDIS_PASSWORD'
      ];
      for (const k of keys) {
        if (process.env[k]) process.env[k] = 'ZEROIZED';
      }

      await this.alertSIEM('secrets_zeroized', 'Secrets have been zeroized in memory');
      logger.warn('Secrets zeroized in memory');
    } catch (error: any) {
      logger.error('Zeroize secrets failed', { error: error?.message });
    }
  }

  private async alertSIEM(eventType: string, reason: string): Promise<void> {
    try {
      const siem = SIEMIntegrationService.getInstance();
      await siem.sendEvent({
        eventType,
        severity: 'CRITICAL' as any,
        category: 'THREAT_DETECTION' as any,
        timestamp: new Date(),
        source: 'compromise_response',
        title: `Security Compromise: ${eventType}`,
        description: reason,
        rawEvent: { reason }
      });
    } catch (error) {
      logger.warn('Failed to send SIEM alert for compromise event');
    }
  }
}

export const compromiseResponseService = CompromiseResponseService.getInstance();


