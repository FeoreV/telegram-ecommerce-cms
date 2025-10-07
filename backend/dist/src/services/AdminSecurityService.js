"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSecurityService = exports.AdminSecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const database_1 = require("../lib/database");
const logger_1 = require("../utils/logger");
const TenantCacheService_1 = require("./TenantCacheService");
class AdminSecurityService {
    constructor() {
        this.activeSessions = new Map();
        this.failedAttempts = new Map();
        this.auditEvents = [];
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
            sessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT || '3600'),
            adminSessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT_ADMIN || '1800'),
            maxFailedAttempts: parseInt(process.env.ADMIN_MAX_FAILED_ATTEMPTS || '3'),
            lockoutDuration: parseInt(process.env.ADMIN_LOCKOUT_DURATION || '900'),
            requirePasswordChange: parseInt(process.env.ADMIN_PASSWORD_CHANGE_DAYS || '90'),
            minPasswordStrength: parseInt(process.env.ADMIN_MIN_PASSWORD_STRENGTH || '80')
        };
        this.startCleanupTimer();
        logger_1.logger.info('Admin Security Service initialized', {
            ipAllowlistEnabled: this.config.enableIPAllowlist,
            mfaEnabled: this.config.enableMFA,
            sessionTrackingEnabled: this.config.enableSessionTracking,
            allowedIPs: this.config.allowedIPs.length,
            allowedCIDRs: this.config.allowedCIDRs.length
        });
    }
    static getInstance() {
        if (!AdminSecurityService.instance) {
            AdminSecurityService.instance = new AdminSecurityService();
        }
        return AdminSecurityService.instance;
    }
    parseIPList(ipString) {
        return ipString.split(',').map(ip => ip.trim()).filter(Boolean);
    }
    async checkIPAllowlist(ipAddress) {
        if (!this.config.enableIPAllowlist) {
            return { allowed: true, reason: 'IP allowlist disabled', bypassUsed: false };
        }
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
        if (this.config.allowedIPs.includes(ipAddress)) {
            return { allowed: true, reason: 'IP in allowlist', bypassUsed: false };
        }
        for (const cidr of this.config.allowedCIDRs) {
            if (this.isIPInCIDR(ipAddress, cidr)) {
                return { allowed: true, reason: `IP in CIDR range ${cidr}`, bypassUsed: false };
            }
        }
        return { allowed: false, reason: 'IP not in allowlist', bypassUsed: false };
    }
    isIPInCIDR(ip, cidr) {
        try {
            const [network, prefixLength] = cidr.split('/');
            const prefix = parseInt(prefixLength, 10);
            if (prefix < 0 || prefix > 32)
                return false;
            const ipInt = this.ipToInt(ip);
            const networkInt = this.ipToInt(network);
            const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
            return (ipInt & mask) === (networkInt & mask);
        }
        catch (error) {
            return false;
        }
    }
    ipToInt(ip) {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }
    async checkEmergencyBypass(ipAddress) {
        try {
            const bypassKey = await TenantCacheService_1.tenantCacheService.get('system', `emergency_bypass_${ipAddress}`, { namespace: 'admin_security' });
            return bypassKey || null;
        }
        catch (error) {
            return null;
        }
    }
    async generateEmergencyBypass(ipAddress, requestedBy, reason, duration = 3600) {
        const bypassToken = crypto_1.default.randomBytes(32).toString('hex');
        await TenantCacheService_1.tenantCacheService.set('system', `emergency_bypass_${ipAddress}`, bypassToken, { ttl: duration, namespace: 'admin_security' });
        await this.auditSecurityEvent({
            eventType: 'emergency_bypass_generated',
            userId: requestedBy,
            ipAddress,
            userAgent: '',
            success: true,
            details: { reason, duration },
            riskScore: 80,
            action: 'bypass_created'
        });
        logger_1.logger.warn('Emergency bypass generated', {
            ipAddress,
            requestedBy,
            reason,
            duration
        });
        return bypassToken;
    }
    async setupMFA(userId, serviceName = 'BotRT Admin') {
        try {
            const secret = speakeasy_1.default.generateSecret({
                name: `${serviceName} (${userId})`,
                issuer: serviceName,
                length: 32
            });
            const backupCodes = Array.from({ length: this.config.mfaBackupCodesCount }, () => crypto_1.default.randomBytes(4).toString('hex').toUpperCase());
            const qrCodeUrl = await qrcode_1.default.toDataURL(secret.otpauth_url);
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
        }
        catch (error) {
            logger_1.logger.error('MFA setup failed:', error);
            throw error;
        }
    }
    async verifyMFA(userId, token, isBackupCode = false) {
        try {
            const mfaData = await this.getMFASetup(userId);
            if (!mfaData) {
                return { verified: false };
            }
            if (isBackupCode) {
                const codeIndex = mfaData.backupCodes.indexOf(token.toUpperCase());
                if (codeIndex === -1) {
                    await this.auditSecurityEvent({
                        eventType: 'mfa_backup_code_failed',
                        userId,
                        ipAddress: 'system',
                        userAgent: '',
                        success: false,
                        details: { userId },
                        riskScore: 30,
                        action: 'mfa_verification_failed'
                    });
                    return { verified: false };
                }
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
            }
            else {
                const verified = speakeasy_1.default.totp.verify({
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
        }
        catch (error) {
            logger_1.logger.error('MFA verification failed:', error);
            return { verified: false };
        }
    }
    async completeMFASetup(userId, verificationToken) {
        try {
            const verificationResult = await this.verifyMFA(userId, verificationToken);
            if (verificationResult.verified) {
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
                    riskScore: -10,
                    action: 'mfa_enabled'
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('MFA setup completion failed:', error);
            return false;
        }
    }
    async createAdminSession(userId, role, ipAddress, userAgent, deviceFingerprint, mfaVerified = false) {
        try {
            if (await this.isUserLockedOut(userId)) {
                throw new Error('User account is locked due to failed login attempts');
            }
            await this.enforceSessionLimits(userId);
            const sessionId = this.generateSessionId();
            const now = new Date();
            const timeout = role === 'OWNER' ? this.config.adminSessionTimeout : this.config.sessionTimeout;
            const session = {
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
            await this.storeAdminSession(session);
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
            logger_1.logger.info('Admin session created', {
                sessionId,
                userId,
                role,
                ipAddress,
                mfaVerified,
                expiresAt: session.expiresAt
            });
            return session;
        }
        catch (error) {
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
            logger_1.logger.error('Admin session creation failed:', error);
            throw error;
        }
    }
    async validateAdminSession(sessionId, ipAddress, userAgent) {
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
            session.lastActivity = new Date();
            await this.storeAdminSession(session);
            return { valid: true, session };
        }
        catch (error) {
            logger_1.logger.error('Session validation failed:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }
    async terminateSession(sessionId, reason) {
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
                logger_1.logger.info('Admin session terminated', {
                    sessionId,
                    userId: session.userId,
                    reason
                });
            }
            this.activeSessions.delete(sessionId);
        }
        catch (error) {
            logger_1.logger.error('Session termination failed:', error);
        }
    }
    async recordFailedAttempt(userId, ipAddress) {
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
            logger_1.logger.warn('User account locked due to failed attempts', {
                userId,
                failedAttempts: attempts.count,
                lockedUntil: attempts.lockedUntil
            });
        }
        this.failedAttempts.set(userId, attempts);
    }
    async isUserLockedOut(userId) {
        const attempts = this.failedAttempts.get(userId);
        if (!attempts || !attempts.lockedUntil) {
            return false;
        }
        if (attempts.lockedUntil > new Date()) {
            return true;
        }
        this.failedAttempts.delete(userId);
        return false;
    }
    async enforceSessionLimits(userId) {
        const userSessions = Array.from(this.activeSessions.values())
            .filter(session => session.userId === userId && session.isActive);
        if (userSessions.length >= this.config.maxConcurrentSessions) {
            const oldestSession = userSessions.sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())[0];
            await this.terminateSession(oldestSession.sessionId, 'session_limit_exceeded');
        }
    }
    generateDeviceFingerprint(userAgent, ipAddress) {
        const data = {
            userAgent: userAgent.substring(0, 200),
            ipAddress: ipAddress.split('.').slice(0, 3).join('.') + '.0'
        };
        return crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 16);
    }
    generateSessionId() {
        return 'admin_' + crypto_1.default.randomBytes(32).toString('hex');
    }
    async getUserPermissions(userId, role) {
        const rolePermissions = {
            'OWNER': ['*'],
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
        return rolePermissions[role] || [];
    }
    async storeAdminSession(session) {
        this.activeSessions.set(session.sessionId, session);
        await TenantCacheService_1.tenantCacheService.set('system', `admin_session_${session.sessionId}`, session, {
            ttl: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
            namespace: 'admin_security'
        });
        const prisma = database_1.databaseService.getPrisma();
        await prisma.$executeRaw `
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
    async getAdminSession(sessionId) {
        const memorySession = this.activeSessions.get(sessionId);
        if (memorySession) {
            return memorySession;
        }
        const cachedSession = await TenantCacheService_1.tenantCacheService.get('system', `admin_session_${sessionId}`, { namespace: 'admin_security' });
        if (cachedSession) {
            this.activeSessions.set(sessionId, cachedSession);
            return cachedSession;
        }
        try {
            const prisma = database_1.databaseService.getPrisma();
            const result = await prisma.$queryRaw `
        SELECT * FROM admin_sessions WHERE session_id = ${sessionId}
      `;
            if (result.length === 0) {
                return null;
            }
            const row = result[0];
            const session = {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get admin session from database:', error);
            return null;
        }
    }
    async storeMFASetup(userId, mfaData) {
        await TenantCacheService_1.tenantCacheService.set('system', `mfa_setup_${userId}`, mfaData, { ttl: 86400, namespace: 'admin_security' });
    }
    async getMFASetup(userId) {
        return await TenantCacheService_1.tenantCacheService.get('system', `mfa_setup_${userId}`, { namespace: 'admin_security' });
    }
    async auditSecurityEvent(eventData) {
        const event = {
            id: crypto_1.default.randomBytes(16).toString('hex'),
            eventType: eventData.eventType,
            userId: eventData.userId,
            sessionId: eventData.sessionId,
            ipAddress: eventData.ipAddress,
            userAgent: eventData.userAgent,
            timestamp: new Date(),
            success: eventData.success,
            details: eventData.details || {},
            riskScore: eventData.riskScore || 0,
            action: eventData.action
        };
        this.auditEvents.push(event);
        if (this.auditEvents.length > 10000) {
            this.auditEvents.shift();
        }
        if (this.config.enableAuditLogging) {
            logger_1.logger.audit('Admin security event', (0, logger_1.toLogMetadata)(event));
        }
    }
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredData();
        }, 5 * 60 * 1000);
    }
    cleanupExpiredData() {
        const now = new Date();
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.expiresAt < now || !session.isActive) {
                this.activeSessions.delete(sessionId);
            }
        }
        for (const [userId, attempts] of this.failedAttempts.entries()) {
            if (attempts.lockedUntil && attempts.lockedUntil < now) {
                this.failedAttempts.delete(userId);
            }
        }
        const maxAge = 24 * 60 * 60 * 1000;
        this.auditEvents = this.auditEvents.filter(event => now.getTime() - event.timestamp.getTime() < maxAge);
    }
    getStats() {
        return {
            config: this.config,
            activeSessions: this.activeSessions.size,
            lockedUsers: Array.from(this.failedAttempts.values()).filter(a => a.lockedUntil && a.lockedUntil > new Date()).length,
            recentAuditEvents: this.auditEvents.length
        };
    }
    async healthCheck() {
        try {
            const stats = this.getStats();
            return {
                status: 'healthy',
                stats
            };
        }
        catch (error) {
            logger_1.logger.error('Admin security service health check failed:', error);
            return {
                status: 'error',
                stats: null
            };
        }
    }
}
exports.AdminSecurityService = AdminSecurityService;
exports.adminSecurityService = AdminSecurityService.getInstance();
//# sourceMappingURL=AdminSecurityService.js.map