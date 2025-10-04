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
exports.secretManager = exports.SecretManager = void 0;
const crypto = __importStar(require("crypto"));
const VaultService_1 = require("../services/VaultService");
const logger_1 = require("./logger");
class SecretManager {
    constructor() {
        this.secrets = null;
        this.useVault = process.env.USE_VAULT === 'true';
    }
    static getInstance() {
        if (!SecretManager.instance) {
            SecretManager.instance = new SecretManager();
        }
        return SecretManager.instance;
    }
    async initialize() {
        if (this.useVault) {
            await this.loadSecretsFromVault();
        }
        else {
            this.loadSecretsFromEnv();
        }
        this.validateSecrets();
    }
    async loadSecretsFromVault() {
        try {
            const vault = (0, VaultService_1.getVaultService)();
            const [jwtSecrets, dbSecrets, telegramSecrets, adminSecrets, smtpSecrets, encryptionSecrets, redisSecrets] = await Promise.all([
                vault.getSecret('app/jwt'),
                vault.getSecret('app/database'),
                vault.getSecret('app/telegram'),
                vault.getSecret('app/admin'),
                vault.getSecret('app/smtp').catch(() => ({})),
                vault.getSecret('app/encryption'),
                vault.getSecret('app/redis').catch(() => ({})),
            ]);
            this.secrets = {
                jwt: {
                    secret: jwtSecrets.secret,
                    refreshSecret: jwtSecrets.refreshSecret,
                    expiresIn: jwtSecrets.expiresIn || '15m',
                    refreshExpiresIn: jwtSecrets.refreshExpiresIn || '7d',
                },
                database: {
                    url: dbSecrets.url,
                    username: dbSecrets.username,
                    password: dbSecrets.password,
                },
                telegram: {
                    botToken: telegramSecrets.botToken,
                    webhookSecret: telegramSecrets.webhookSecret,
                },
                admin: {
                    defaultPassword: adminSecrets.defaultPassword,
                    cookieSecret: adminSecrets.cookieSecret,
                    sessionSecret: adminSecrets.sessionSecret,
                },
                smtp: {
                    host: smtpSecrets.host,
                    port: smtpSecrets.port,
                    secure: smtpSecrets.secure,
                    user: smtpSecrets.user,
                    password: smtpSecrets.password,
                    from: smtpSecrets.from,
                },
                encryption: {
                    masterKey: encryptionSecrets.masterKey,
                    dataEncryptionKey: encryptionSecrets.dataEncryptionKey,
                },
                redis: {
                    url: redisSecrets.url,
                    password: redisSecrets.password,
                },
            };
            logger_1.logger.info('Successfully loaded secrets from Vault');
        }
        catch (error) {
            logger_1.logger.error('Failed to load secrets from Vault:', error);
            throw new Error('Failed to initialize secrets from Vault');
        }
    }
    loadSecretsFromEnv() {
        this.secrets = {
            jwt: {
                secret: process.env.JWT_SECRET || 'default-jwt-secret',
                refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
                expiresIn: process.env.JWT_EXPIRES_IN || '15m',
                refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
            },
            database: {
                url: process.env.DATABASE_URL || 'file:./dev.db',
            },
            telegram: {
                botToken: process.env.TELEGRAM_BOT_TOKEN || (process.env.NODE_ENV === 'development' ? 'dev-token' : ''),
                webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
            },
            admin: {
                defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || (() => {
                    logger_1.logger.warn('SECURITY WARNING: ADMIN_DEFAULT_PASSWORD not set - admin authentication will fail');
                    return '';
                })(),
                cookieSecret: process.env.ADMIN_COOKIE_SECRET || (() => {
                    logger_1.logger.warn('SECURITY WARNING: ADMIN_COOKIE_SECRET not set - generating random secret');
                    return crypto.randomBytes(32).toString('hex');
                })(),
                sessionSecret: process.env.ADMIN_SESSION_SECRET || (() => {
                    logger_1.logger.warn('SECURITY WARNING: ADMIN_SESSION_SECRET not set - generating random secret');
                    return crypto.randomBytes(32).toString('hex');
                })(),
            },
            smtp: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
                secure: process.env.SMTP_SECURE === 'true',
                user: process.env.SMTP_USER,
                password: process.env.SMTP_PASS,
                from: process.env.SMTP_FROM,
            },
            encryption: {
                masterKey: process.env.ENCRYPTION_MASTER_KEY || this.generateKey(),
                dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || this.generateKey(),
            },
            redis: {
                url: process.env.REDIS_URL,
                password: process.env.REDIS_PASSWORD,
            },
        };
        logger_1.logger.info('Loaded secrets from environment variables');
    }
    validateSecrets() {
        if (!this.secrets) {
            throw new Error('Secrets not initialized');
        }
        const isDevelopment = process.env.NODE_ENV === 'development';
        const requiredSecrets = [
            'jwt.secret',
            'jwt.refreshSecret',
            'database.url',
            'admin.defaultPassword',
            'admin.cookieSecret',
            'admin.sessionSecret',
            'encryption.masterKey',
            'encryption.dataEncryptionKey',
        ];
        if (!isDevelopment) {
            requiredSecrets.push('telegram.botToken');
        }
        for (const path of requiredSecrets) {
            const value = this.getNestedValue(this.secrets, path);
            if (!value) {
                throw new Error(`Required secret missing: ${path}`);
            }
        }
        this.validateSecretStrength();
    }
    validateSecretStrength() {
        if (!this.secrets) {
            logger_1.logger.error('No secrets available for validation');
            return;
        }
        const secrets = this.secrets;
        if (secrets.jwt.secret.length < 32) {
            logger_1.logger.warn('JWT secret is shorter than recommended (32 characters)');
        }
        if (secrets.jwt.refreshSecret.length < 32) {
            logger_1.logger.warn('JWT refresh secret is shorter than recommended (32 characters)');
        }
        if (secrets.jwt.secret === secrets.jwt.refreshSecret) {
            throw new Error('JWT secret and refresh secret must be different');
        }
        if (secrets.admin.cookieSecret.length < 32) {
            throw new Error('Admin cookie secret must be at least 32 characters');
        }
        if (secrets.admin.sessionSecret.length < 32) {
            throw new Error('Admin session secret must be at least 32 characters');
        }
        if (process.env.NODE_ENV === 'production') {
            const defaultSecrets = [
                'your-super-secret-jwt-key',
                'dev-jwt-secret',
                'change-me',
                'ChangeMe123!',
            ];
            const secretValues = [
                secrets.jwt.secret,
                secrets.jwt.refreshSecret,
                secrets.admin.defaultPassword,
            ];
            for (const secret of secretValues) {
                if (defaultSecrets.includes(secret)) {
                    throw new Error('Default secrets detected in production environment');
                }
            }
        }
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && typeof current === 'object' && current !== null
            ? current[key]
            : undefined, obj);
    }
    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    getSecrets() {
        if (!this.secrets) {
            throw new Error('Secrets not initialized. Call initialize() first.');
        }
        return this.secrets;
    }
    getJWTSecrets() {
        return this.getSecrets().jwt;
    }
    getDatabaseSecrets() {
        return this.getSecrets().database;
    }
    getTelegramSecrets() {
        return this.getSecrets().telegram;
    }
    getAdminSecrets() {
        return this.getSecrets().admin;
    }
    getSMTPSecrets() {
        return this.getSecrets().smtp;
    }
    getEncryptionSecrets() {
        return this.getSecrets().encryption;
    }
    getRedisSecrets() {
        return this.getSecrets().redis;
    }
    async rotateSecrets() {
        if (!this.useVault) {
            throw new Error('Secret rotation is only available with Vault');
        }
        await this.loadSecretsFromVault();
        logger_1.logger.info('Secrets rotated successfully');
    }
}
exports.SecretManager = SecretManager;
exports.secretManager = SecretManager.getInstance();
//# sourceMappingURL=SecretManager.js.map