import crypto from 'crypto';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { databaseService } from '../lib/database';
import { logger, toLogMetadata } from '../utils/logger';
import { tenantCacheService } from './TenantCacheService';

export interface AdminSecurityConfig {
  enableIPAllowlist: boolean;
  enableMFA: boolean;
  enableSessionTracking: boolean;
  enableAuditLogging: boolean;
  enableDeviceBinding: boolean;

  // IP allowlist settings
  allowedIPs: string[];
  allowedCIDRs: string[];
  emergencyBypassEnabled: boolean;

  // MFA settings
  mfaRequired: boolean;
  mfaBackupCodesCount: number;
  mfaTokenWindow: number;

  // Session settings
  maxConcurrentSessions: number;
  sessionTimeout: number;
  adminSessionTimeout: number;

  // Security settings
  maxFailedAttempts: number;
  lockoutDuration: number;
  requirePasswordChange: number; // days
  minPasswordStrength: number;
}

export interface AdminSession {
  sessionId: string;
  userId: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  mfaVerified: boolean;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface MFASetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  verified: boolean;
}

export interface SecurityAuditEvent {
  id: string;
  eventType: string;
  userId: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  details: Record<string, any>;
  riskScore: number;
  action: string;
}

export class AdminSecurityService {
  private static instance: AdminSecurityService;
  private config: AdminSecurityConfig;
  private activeSessions: Map<string, AdminSession> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();
  private auditEvents: SecurityAuditEvent[] = [];

  private constructor() {
    this.config = {
      enableIPAllowlist: process.env.ENABLE_ADMIN_IP_ALLOWLIST !== 'false',
      enableMFA: process.env.ENABLE_ADMIN_MFA !== 'false',
      enableSessionTracking: process.env.ENABLE_ADMIN_SESSION_TRACKING !== 'false',
      enableAuditLogging: process.env.ENABLE_ADMIN_AUDIT_LOGGING !== 'false',
      enableDeviceBinding: process.env.ENABLE_ADMIN_DEVICE_BINDING !== 'false',

      allowedIPs: this.parseIPList(process.env.ADMIN_ALLOWED_IPS || ''),
      allowedCIDRs: this.parseIPList(process.env.ADMIN_ALLOWED_CIDRS || ''),
      emergencyBypassEnabled: process.env.ADMIN_EMERGENCY_BYPASS === 'true',

      mfaRequired: process.env.ADMIN_MFA_REQUIRED !== 'false',
      mfaBackupCodesCount: parseInt(process.env.ADMIN_MFA_BACKUP_CODES || '10'),
      mfaTokenWindow: parseInt(process.env.ADMIN_MFA_TOKEN_WINDOW || '1'),

      maxConcurrentSessions: parseInt(process.env.ADMIN_MAX_CONCURRENT_SESSIONS || '3'),
      sessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT || '3600'), // 1 hour
      adminSessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT_ADMIN || '1800'), // 30 minutes

      maxFailedAttempts: parseInt(process.env.ADMIN_MAX_FAILED_ATTEMPTS || '3'),
      lockoutDuration: parseInt(process.env.ADMIN_LOCKOUT_DURATION || '900'), // 15 minutes
      requirePasswordChange: parseInt(process.env.ADMIN_PASSWORD_CHANGE_DAYS || '90'),
      minPasswordStrength: parseInt(process.env.ADMIN_MIN_PASSWORD_STRENGTH || '80')
    };

    this.startCleanupTimer();

    logger.info('Admin Security Service initialized', {
      ipAllowlistEnabled: this.config.enableIPAllowlist,
      mfaEnabled: this.config.enableMFA,
      sessionTrackingEnabled: this.config.enableSessionTracking,
      allowedIPs: this.config.allowedIPs.length,
      allowedCIDRs: this.config.allowedCIDRs.length
    });
  }

  public static getInstance(): AdminSecurityService {
    if (!AdminSecurityService.instance) {
      AdminSecurityService.instance = new AdminSecurityService();
    }
    return AdminSecurityService.instance;
  }

  private parseIPList(ipString: string): string[] {
    return ipString.split(',').map(ip => ip.trim()).filter(Boolean);
  }

  /**
   * Check if IP address is allowed
   */
  async checkIPAllowlist(ipAddress: string): Promise<{
    allowed: boolean;
    reason: string;
    bypassUsed: boolean;
  }> {
    if (!this.config.enableIPAllowlist) {
      return { allowed: true, reason: 'IP allowlist disabled', bypassUsed: false };
    }

    // Check emergency bypass
    if (this.config.emergencyBypassEnabled) {
      const bypassKey = await this.checkEmergencyBypass(ipAddress);
      if (bypassKey) {
        await this.auditSecurityEvent({
          eventType: 'emergency_bypass_used',
          userId: 'system',
          ipAddress,
          userAgent: '',
          success: true,
          details: { bypassKey },
          riskScore: 50,
          action: 'bypass_granted'
        });

        return { allowed: true, reason: 'Emergency bypass used', bypassUsed: true };
      }
    }

    // Check exact IP matches
    if (this.config.allowedIPs.includes(ipAddress)) {
      return { allowed: true, reason: 'IP in allowlist', bypassUsed: false };
    }

    // Check CIDR ranges
    for (const cidr of this.config.allowedCIDRs) {
      if (this.isIPInCIDR(ipAddress, cidr)) {
        return { allowed: true, reason: `IP in CIDR range ${cidr}`, bypassUsed: false };
      }
    }

    return { allowed: false, reason: 'IP not in allowlist', bypassUsed: false };
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);

      if (prefix < 0 || prefix > 32) return false;

      const ipInt = this.ipToInt(ip);
      const networkInt = this.ipToInt(network);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;

      return (ipInt & mask) === (networkInt & mask);
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert IP address to integer
   */
  private ipToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Check emergency bypass token
   */
  private async checkEmergencyBypass(ipAddress: string): Promise<string | null> {
    try {
      // Check if there's a valid emergency bypass token for this IP
      const bypassKey = await tenantCacheService.get<string>(
        'system',
        `emergency_bypass_${ipAddress}`,
        { namespace: 'admin_security' }
      );

      return bypassKey || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate emergency bypass token
   */
  async generateEmergencyBypass(
    ipAddress: string,
    requestedBy: string,
    reason: string,
    duration: number = 3600 // 1 hour
  ): Promise<string> {
    const bypassToken = crypto.randomBytes(32).toString('hex');

    await tenantCacheService.set(
      'system',
      `emergency_bypass_${ipAddress}`,
      bypassToken,
      { ttl: duration, namespace: 'admin_security' }
    );

    await this.auditSecurityEvent({
      eventType: 'emergency_bypass_generated',
      userId: requestedBy,
      ipAddress,
      userAgent: '',
      success: true,
      // SECURITY FIX: CWE-522 - Do not log token fragments
      details: { reason, duration },
      riskScore: 80,
      action: 'bypass_created'
    });

    // SECURITY FIX: CWE-522 - Do not log token fragments
    logger.warn('Emergency bypass generated', {
      ipAddress,
      requestedBy,
      reason,
      duration
    });

    return bypassToken;
  }

  /**
   * Setup MFA for admin user
   */
  async setupMFA(userId: string, serviceName: string = 'BotRT Admin'): Promise<MFASetup> {
    try {
      const secret = speakeasy.generateSecret({
        name: `${serviceName} (${userId})`,
        issuer: serviceName,
        length: 32
      });

      // Generate backup codes
      const backupCodes = Array.from({ length: this.config.mfaBackupCodesCount }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store MFA setup (not yet verified)
      await this.storeMFASetup(userId, {
        secret: secret.base32,
        backupCodes,
        verified: false
      });

      await this.auditSecurityEvent({
        eventType: 'mfa_setup_initiated',
        userId,
        ipAddress: 'system',
        userAgent: '',
        success: true,
        details: { serviceName },
        riskScore: 0,
        action: 'mfa_setup'
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
        verified: false
      };

    } catch (error) {
      logger.error('MFA setup failed:', error);
      throw error;
    }
  }

  /**
   * Verify MFA token
   */
  async verifyMFA(
    userId: string,
    token: string,
    isBackupCode: boolean = false
  ): Promise<{
    verified: boolean;
    backupCodeUsed?: boolean;
    remainingBackupCodes?: number;
  }> {
    try {
      const mfaData = await this.getMFASetup(userId);

      if (!mfaData) {
        return { verified: false };
      }

      if (isBackupCode) {
        // Check backup code
        const codeIndex = mfaData.backupCodes.indexOf(token.toUpperCase());

        if (codeIndex === -1) {
          await this.auditSecurityEvent({
            eventType: 'mfa_backup_code_failed',
            userId,
            ipAddress: 'system',
            userAgent: '',
            success: false,
            // SECURITY FIX: CWE-522 - Do not log token fragments
            details: { userId },
            riskScore: 30,
            action: 'mfa_verification_failed'
          });

          return { verified: false };
        }

        // Remove used backup code
        mfaData.backupCodes.splice(codeIndex, 1);
        await this.storeMFASetup(userId, mfaData);

        await this.auditSecurityEvent({
          eventType: 'mfa_backup_code_used',
          userId,
          ipAddress: 'system',
          userAgent: '',
          success: true,
          details: { remainingCodes: mfaData.backupCodes.length },
          riskScore: 10,
          action: 'mfa_verified'
        });

        return {
          verified: true,
          backupCodeUsed: true,
          remainingBackupCodes: mfaData.backupCodes.length
        };
      } else {
        // Verify TOTP token
        const verified = speakeasy.totp.verify({
          secret: mfaData.secret,
          encoding: 'base32',
          token,
          window: this.config.mfaTokenWindow
        });

        await this.auditSecurityEvent({
          eventType: verified ? 'mfa_token_verified' : 'mfa_token_failed',
          userId,
          ipAddress: 'system',
          userAgent: '',
          success: verified,
          details: { tokenWindow: this.config.mfaTokenWindow },
          riskScore: verified ? 0 : 20,
          action: verified ? 'mfa_verified' : 'mfa_verification_failed'
        });

        return { verified };
      }

    } catch (error) {
      logger.error('MFA verification failed:', error);
      return { verified: false };
    }
  }

  /**
   * Complete MFA setup verification
   */
  async completeMFASetup(userId: string, verificationToken: string): Promise<boolean> {
    try {
      const verificationResult = await this.verifyMFA(userId, verificationToken);

      if (verificationResult.verified) {
        // Mark MFA as verified
        const mfaData = await this.getMFASetup(userId);
        if (mfaData) {
          mfaData.verified = true;
          await this.storeMFASetup(userId, mfaData);
        }

        await this.auditSecurityEvent({
          eventType: 'mfa_setup_completed',
          userId,
          ipAddress: 'system',
          userAgent: '',
          success: true,
          details: {},
          riskScore: -10, // Negative score for security improvement
          action: 'mfa_enabled'
        });

        return true;
      }

      return false;

    } catch (error) {
      logger.error('MFA setup completion failed:', error);
      return false;
    }
  }

  /**
   * Create admin session
   */
  async createAdminSession(
    userId: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    deviceFingerprint: string,
    mfaVerified: boolean = false
  ): Promise<AdminSession> {
    try {
      // Check if user is locked out
      if (await this.isUserLockedOut(userId)) {
        throw new Error('User account is locked due to failed login attempts');
      }

      // Check concurrent sessions limit
      await this.enforceSessionLimits(userId);

      const sessionId = this.generateSessionId();
      const now = new Date();
      const timeout = role === 'OWNER' ? this.config.adminSessionTimeout : this.config.sessionTimeout;

      const session: AdminSession = {
        sessionId,
        userId,
        role,
        ipAddress,
        userAgent,
        deviceFingerprint,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(now.getTime() + timeout * 1000),
        isActive: true,
        mfaVerified,
        permissions: await this.getUserPermissions(userId, role),
        metadata: {
          loginMethod: 'password',
          securityLevel: mfaVerified ? 'high' : 'medium'
        }
      };

      // Store session
      await this.storeAdminSession(session);

      // Clear failed attempts on successful login
      this.failedAttempts.delete(userId);

      await this.auditSecurityEvent({
        eventType: 'admin_session_created',
        userId,
        sessionId,
        ipAddress,
        userAgent,
        success: true,
        details: {
          role,
          mfaVerified,
          deviceFingerprint,
          sessionTimeout: timeout
        },
        riskScore: mfaVerified ? 0 : 20,
        action: 'login_success'
      });

      logger.info('Admin session created', {
        sessionId,
        userId,
        role,
        ipAddress,
        mfaVerified,
        expiresAt: session.expiresAt
      });

      return session;

    } catch (error) {
      await this.recordFailedAttempt(userId, ipAddress);

      await this.auditSecurityEvent({
        eventType: 'admin_session_creation_failed',
        userId,
        ipAddress,
        userAgent,
        success: false,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskScore: 50,
        action: 'login_failed'
      });

      logger.error('Admin session creation failed:', error);
      throw error;
    }
  }

  /**
   * Validate admin session
   */
  async validateAdminSession(
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    valid: boolean;
    session?: AdminSession;
    reason?: string;
  }> {
    try {
      const session = await this.getAdminSession(sessionId);

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      if (!session.isActive) {
        return { valid: false, reason: 'Session inactive' };
      }

      if (session.expiresAt < new Date()) {
        await this.terminateSession(sessionId, 'expired');
        return { valid: false, reason: 'Session expired' };
      }

      // Check device binding if enabled
      if (this.config.enableDeviceBinding) {
        if (session.deviceFingerprint !== this.generateDeviceFingerprint(userAgent, ipAddress)) {
          await this.terminateSession(sessionId, 'device_mismatch');

          await this.auditSecurityEvent({
            eventType: 'session_device_mismatch',
            userId: session.userId,
            sessionId,
            ipAddress,
            userAgent,
            success: false,
            details: {
              expectedFingerprint: session.deviceFingerprint,
              actualFingerprint: this.generateDeviceFingerprint(userAgent, ipAddress)
            },
            riskScore: 80,
            action: 'session_terminated'
          });

          return { valid: false, reason: 'Device fingerprint mismatch' };
        }
      }

      // Update last activity
      session.lastActivity = new Date();
      await this.storeAdminSession(session);

      return { valid: true, session };

    } catch (error) {
      logger.error('Session validation failed:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Terminate admin session
   */
  async terminateSession(sessionId: string, reason: string): Promise<void> {
    try {
      const session = await this.getAdminSession(sessionId);

      if (session) {
        session.isActive = false;
        await this.storeAdminSession(session);

        await this.auditSecurityEvent({
          eventType: 'admin_session_terminated',
          userId: session.userId,
          sessionId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          success: true,
          details: { reason },
          riskScore: reason === 'logout' ? 0 : 30,
          action: 'session_terminated'
        });

        logger.info('Admin session terminated', {
          sessionId,
          userId: session.userId,
          reason
        });
      }

      this.activeSessions.delete(sessionId);

    } catch (error) {
      logger.error('Session termination failed:', error);
    }
  }

  /**
   * Record failed login attempt
   */
  private async recordFailedAttempt(userId: string, ipAddress: string): Promise<void> {
    const now = new Date();
    const attempts = this.failedAttempts.get(userId) || { count: 0, lastAttempt: now };

    attempts.count++;
    attempts.lastAttempt = now;

    if (attempts.count >= this.config.maxFailedAttempts) {
      attempts.lockedUntil = new Date(now.getTime() + this.config.lockoutDuration * 1000);

      await this.auditSecurityEvent({
        eventType: 'user_account_locked',
        userId,
        ipAddress,
        userAgent: '',
        success: true,
        details: {
          failedAttempts: attempts.count,
          lockoutDuration: this.config.lockoutDuration,
          lockedUntil: attempts.lockedUntil
        },
        riskScore: 60,
        action: 'account_locked'
      });

      logger.warn('User account locked due to failed attempts', {
        userId,
        failedAttempts: attempts.count,
        lockedUntil: attempts.lockedUntil
      });
    }

    this.failedAttempts.set(userId, attempts);
  }

  /**
   * Check if user is locked out
   */
  private async isUserLockedOut(userId: string): Promise<boolean> {
    const attempts = this.failedAttempts.get(userId);

    if (!attempts || !attempts.lockedUntil) {
      return false;
    }

    if (attempts.lockedUntil > new Date()) {
      return true;
    }

    // Lock expired, clear the record
    this.failedAttempts.delete(userId);
    return false;
  }

  /**
   * Enforce session limits
   */
  private async enforceSessionLimits(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId && session.isActive);

    if (userSessions.length >= this.config.maxConcurrentSessions) {
      // Terminate oldest session
      const oldestSession = userSessions.sort((a, b) =>
        a.lastActivity.getTime() - b.lastActivity.getTime()
      )[0];

      await this.terminateSession(oldestSession.sessionId, 'session_limit_exceeded');
    }
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = {
      userAgent: userAgent.substring(0, 200), // Limit length
      ipAddress: ipAddress.split('.').slice(0, 3).join('.') + '.0' // Mask last octet
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return 'admin_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get user permissions
   */
  private async getUserPermissions(userId: string, role: string): Promise<string[]> {
    // This would typically fetch from database
    const rolePermissions = {
      'OWNER': ['*'], // All permissions
      'ADMIN': [
        'user.read', 'user.write',
        'store.read', 'store.write',
        'order.read', 'order.write',
        'product.read', 'product.write',
        'payment.read', 'payment.approve',
        'audit.read'
      ],
      'VENDOR': [
        'store.read',
        'product.read', 'product.write',
        'order.read'
      ]
    };

    return rolePermissions[role as keyof typeof rolePermissions] || [];
  }

  /**
   * Store admin session
   */
  private async storeAdminSession(session: AdminSession): Promise<void> {
    // Store in memory
    this.activeSessions.set(session.sessionId, session);

    // Store in cache
    await tenantCacheService.set(
      'system',
      `admin_session_${session.sessionId}`,
      session,
      {
        ttl: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        namespace: 'admin_security'
      }
    );

    // Store in database for persistence
    const prisma = databaseService.getPrisma();
    await prisma.$executeRaw`
      INSERT INTO admin_sessions (
        session_id, user_id, role, ip_address, user_agent,
        device_fingerprint, created_at, last_activity, expires_at,
        is_active, mfa_verified, permissions, metadata
      ) VALUES (
        ${session.sessionId},
        ${session.userId}::UUID,
        ${session.role},
        ${session.ipAddress}::INET,
        ${session.userAgent},
        ${session.deviceFingerprint},
        ${session.createdAt},
        ${session.lastActivity},
        ${session.expiresAt},
        ${session.isActive},
        ${session.mfaVerified},
        ${JSON.stringify(session.permissions)}::JSONB,
        ${JSON.stringify(session.metadata)}::JSONB
      )
      ON CONFLICT (session_id) DO UPDATE SET
        last_activity = EXCLUDED.last_activity,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata
    `;
  }

  /**
   * Get admin session
   */
  private async getAdminSession(sessionId: string): Promise<AdminSession | null> {
    // Check memory first
    const memorySession = this.activeSessions.get(sessionId);
    if (memorySession) {
      return memorySession;
    }

    // Check cache
    const cachedSession = await tenantCacheService.get<AdminSession>(
      'system',
      `admin_session_${sessionId}`,
      { namespace: 'admin_security' }
    );

    if (cachedSession) {
      this.activeSessions.set(sessionId, cachedSession);
      return cachedSession;
    }

    // Fallback to database
    try {
      const prisma = databaseService.getPrisma();
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM admin_sessions WHERE session_id = ${sessionId}
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      const session: AdminSession = {
        sessionId: row.session_id,
        userId: row.user_id,
        role: row.role,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        deviceFingerprint: row.device_fingerprint,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
        expiresAt: row.expires_at,
        isActive: row.is_active,
        mfaVerified: row.mfa_verified,
        permissions: row.permissions || [],
        metadata: row.metadata || {}
      };

      this.activeSessions.set(sessionId, session);
      return session;

    } catch (error) {
      logger.error('Failed to get admin session from database:', error);
      return null;
    }
  }

  /**
   * Store MFA setup
   */
  private async storeMFASetup(userId: string, mfaData: any): Promise<void> {
    await tenantCacheService.set(
      'system',
      `mfa_setup_${userId}`,
      mfaData,
      { ttl: 86400, namespace: 'admin_security' } // 24 hours
    );
  }

  /**
   * Get MFA setup
   */
  private async getMFASetup(userId: string): Promise<any> {
    return await tenantCacheService.get(
      'system',
      `mfa_setup_${userId}`,
      { namespace: 'admin_security' }
    );
  }

  /**
   * Audit security event
   */
  private async auditSecurityEvent(eventData: Partial<SecurityAuditEvent>): Promise<void> {
    const event: SecurityAuditEvent = {
      id: crypto.randomBytes(16).toString('hex'),
      eventType: eventData.eventType!,
      userId: eventData.userId!,
      sessionId: eventData.sessionId,
      ipAddress: eventData.ipAddress!,
      userAgent: eventData.userAgent!,
      timestamp: new Date(),
      success: eventData.success!,
      details: eventData.details || {},
      riskScore: eventData.riskScore || 0,
      action: eventData.action!
    };

    this.auditEvents.push(event);
    if (this.auditEvents.length > 10000) {
      this.auditEvents.shift(); // Remove oldest events
    }

    if (this.config.enableAuditLogging) {
      logger.audit('Admin security event', toLogMetadata(event));
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up expired data
   */
  private cleanupExpiredData(): void {
    const now = new Date();

    // Clean up expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now || !session.isActive) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Clean up expired lockouts
    for (const [userId, attempts] of this.failedAttempts.entries()) {
      if (attempts.lockedUntil && attempts.lockedUntil < now) {
        this.failedAttempts.delete(userId);
      }
    }

    // Clean up old audit events
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    this.auditEvents = this.auditEvents.filter(
      event => now.getTime() - event.timestamp.getTime() < maxAge
    );
  }

  /**
   * Get service statistics
   */
  getStats(): {
    config: AdminSecurityConfig;
    activeSessions: number;
    lockedUsers: number;
    recentAuditEvents: number;
  } {
    return {
      config: this.config,
      activeSessions: this.activeSessions.size,
      lockedUsers: Array.from(this.failedAttempts.values()).filter(a => a.lockedUntil && a.lockedUntil > new Date()).length,
      recentAuditEvents: this.auditEvents.length
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    stats: any;
  }> {
    try {
      const stats = this.getStats();

      return {
        status: 'healthy',
        stats
      };

    } catch (error) {
      logger.error('Admin security service health check failed:', error);
      return {
        status: 'error',
        stats: null
      };
    }
  }
}

// Export singleton instance
export const adminSecurityService = AdminSecurityService.getInstance();
