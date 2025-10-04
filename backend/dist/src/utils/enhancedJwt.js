"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedJWTService = exports.EnhancedJWTService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const loggerEnhanced_1 = require("./loggerEnhanced");
const SecretManager_1 = require("./SecretManager");
class EnhancedJWTService {
    constructor() {
        this.activeKeys = new Map();
        this.currentKeyId = '';
        this.rotationInterval = null;
        this.initializeKeys();
        this.startKeyRotation();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new EnhancedJWTService();
        }
        return this.instance;
    }
    async initializeKeys() {
        try {
            const jwtSecrets = SecretManager_1.secretManager.getJWTSecrets();
            const keyId = this.generateKeyId();
            const keyPair = {
                id: keyId,
                secret: jwtSecrets.secret,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                isActive: true
            };
            this.activeKeys.set(keyId, keyPair);
            this.currentKeyId = keyId;
            loggerEnhanced_1.logger.info('Enhanced JWT service initialized', {
                keyId: keyId.substring(0, 8) + '...',
                totalKeys: this.activeKeys.size
            });
        }
        catch (error) {
            loggerEnhanced_1.logger.error('Failed to initialize JWT keys:', error);
            throw error;
        }
    }
    generateKeyId() {
        const timestamp = Date.now().toString(36);
        const random = crypto_1.default.randomBytes(4).toString('hex');
        return `${timestamp}_${random}`;
    }
    async createNewKeyPair() {
        try {
            const newSecret = crypto_1.default.randomBytes(64).toString('hex');
            const keyId = this.generateKeyId();
            const keyPair = {
                id: keyId,
                secret: newSecret,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                isActive: true
            };
            try {
                await SecretManager_1.secretManager.rotateSecrets();
            }
            catch (error) {
                loggerEnhanced_1.logger.warn('Could not rotate secrets in vault:', error);
            }
            return keyPair;
        }
        catch (error) {
            loggerEnhanced_1.logger.error('Failed to create new key pair:', error);
            throw error;
        }
    }
    startKeyRotation() {
        const rotationInterval = 24 * 60 * 60 * 1000;
        this.rotationInterval = setInterval(async () => {
            try {
                await this.rotateKeys();
            }
            catch (error) {
                loggerEnhanced_1.logger.error('Key rotation failed:', error);
            }
        }, rotationInterval);
        loggerEnhanced_1.logger.info('JWT key rotation started', {
            intervalHours: 24
        });
    }
    async rotateKeys() {
        try {
            loggerEnhanced_1.logger.info('Starting JWT key rotation');
            const newKeyPair = await this.createNewKeyPair();
            this.activeKeys.set(newKeyPair.id, newKeyPair);
            const oldKeyId = this.currentKeyId;
            this.currentKeyId = newKeyPair.id;
            for (const [keyId, keyPair] of this.activeKeys.entries()) {
                if (keyId !== newKeyPair.id) {
                    keyPair.isActive = false;
                }
            }
            const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            for (const [keyId, keyPair] of this.activeKeys.entries()) {
                if (keyPair.createdAt < cutoffDate) {
                    this.activeKeys.delete(keyId);
                }
            }
            loggerEnhanced_1.logger.info('JWT key rotation completed', {
                newKeyId: newKeyPair.id.substring(0, 8) + '...',
                oldKeyId: oldKeyId.substring(0, 8) + '...',
                totalActiveKeys: this.activeKeys.size
            });
        }
        catch (error) {
            loggerEnhanced_1.logger.error('JWT key rotation failed:', error);
            throw error;
        }
    }
    generateAccessToken(payload) {
        try {
            const currentKey = this.activeKeys.get(this.currentKeyId);
            if (!currentKey || !currentKey.isActive) {
                throw new Error('No active JWT key available');
            }
            const now = Math.floor(Date.now() / 1000);
            const tokenPayload = {
                ...payload,
                iat: now,
                exp: now + (15 * 60),
                iss: 'botrt-ecommerce',
                aud: 'botrt-users',
                kid: currentKey.id
            };
            const token = jsonwebtoken_1.default.sign(tokenPayload, currentKey.secret, {
                algorithm: 'HS256',
                header: {
                    alg: 'HS256',
                    kid: currentKey.id
                }
            });
            loggerEnhanced_1.logger.debug('Access token generated', {
                userId: payload.userId,
                role: payload.role,
                expiresIn: '15m'
            });
            return token;
        }
        catch (error) {
            loggerEnhanced_1.logger.error('Failed to generate access token:', error);
            throw error;
        }
    }
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || typeof decoded === 'string') {
                throw new Error('Invalid token format');
            }
            const keyId = decoded.header.kid;
            if (!keyId) {
                throw new Error('Token missing key ID');
            }
            const keyPair = this.activeKeys.get(keyId);
            if (!keyPair) {
                throw new Error('Unknown key ID');
            }
            const payload = jsonwebtoken_1.default.verify(token, keyPair.secret, {
                algorithms: ['HS256'],
                issuer: 'botrt-ecommerce',
                audience: 'botrt-users'
            });
            loggerEnhanced_1.logger.debug('Token verified successfully', {
                userId: payload.userId,
                role: payload.role,
                keyId: keyId.substring(0, 8) + '...',
                sessionId: payload.sessionId?.substring(0, 8) + '...'
            });
            return payload;
        }
        catch (error) {
            loggerEnhanced_1.logger.warn('Token verification failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                hasToken: !!token,
                tokenLength: token?.length
            });
            throw error;
        }
    }
    getKeyInfo() {
        const activeKeyCount = Array.from(this.activeKeys.values())
            .filter(key => key.isActive).length;
        const oldestKey = Array.from(this.activeKeys.values())
            .reduce((oldest, current) => current.createdAt < oldest.createdAt ? current : oldest);
        return {
            currentKeyId: this.currentKeyId.substring(0, 8) + '...',
            totalKeys: this.activeKeys.size,
            activeKeys: activeKeyCount,
            oldestKeyAge: Date.now() - oldestKey.createdAt.getTime()
        };
    }
    async forceKeyRotation() {
        loggerEnhanced_1.logger.warn('Forcing JWT key rotation');
        await this.rotateKeys();
    }
    destroy() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
        this.activeKeys.clear();
        loggerEnhanced_1.logger.info('Enhanced JWT service destroyed');
    }
}
exports.EnhancedJWTService = EnhancedJWTService;
exports.enhancedJWTService = EnhancedJWTService.getInstance();
//# sourceMappingURL=enhancedJwt.js.map