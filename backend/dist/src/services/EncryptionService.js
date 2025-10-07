"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const SecretManager_1 = require("../utils/SecretManager");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
const VaultService_1 = require("./VaultService");
class EncryptionService {
    constructor() {
        this.transitKeyName = 'telegram-ecommerce-key';
        this.useVaultTransit = process.env.USE_VAULT === 'true';
    }
    static getInstance() {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService();
        }
        return EncryptionService.instance;
    }
    async encryptData(plaintext, context) {
        if (this.useVaultTransit) {
            return this.encryptWithVault(plaintext);
        }
        else {
            return this.encryptWithLocal(plaintext);
        }
    }
    async decryptData(ciphertext, context) {
        if (this.useVaultTransit) {
            return this.decryptWithVault(ciphertext);
        }
        else {
            return this.decryptWithLocal(ciphertext);
        }
    }
    async encryptWithVault(plaintext) {
        try {
            const vault = (0, VaultService_1.getVaultService)();
            return await vault.encrypt(this.transitKeyName, plaintext);
        }
        catch (err) {
            logger_1.logger.error('Vault encryption failed:', err);
            throw new Error('Failed to encrypt data with Vault');
        }
    }
    async decryptWithVault(ciphertext) {
        try {
            const vault = (0, VaultService_1.getVaultService)();
            return await vault.decrypt(this.transitKeyName, ciphertext);
        }
        catch (err) {
            logger_1.logger.error('Vault decryption failed:', err);
            throw new Error('Failed to decrypt data with Vault');
        }
    }
    encryptWithLocal(plaintext) {
        try {
            const encryptionSecrets = SecretManager_1.secretManager.getEncryptionSecrets();
            const key = Buffer.from(encryptionSecrets.dataEncryptionKey, 'hex');
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
            let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
            ciphertext += cipher.final('hex');
            const tag = cipher.getAuthTag();
            const result = {
                ciphertext,
                iv: iv.toString('hex'),
                tag: tag.toString('hex')
            };
            return Buffer.from(JSON.stringify(result)).toString('base64');
        }
        catch (err) {
            logger_1.logger.error('Local encryption failed:', err);
            throw new Error('Failed to encrypt data locally');
        }
    }
    decryptWithLocal(encryptedData) {
        try {
            const encryptionSecrets = SecretManager_1.secretManager.getEncryptionSecrets();
            const key = Buffer.from(encryptionSecrets.dataEncryptionKey, 'hex');
            const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
            const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
            let plaintext = decipher.update(data.ciphertext, 'hex', 'utf8');
            plaintext += decipher.final('utf8');
            return plaintext;
        }
        catch (err) {
            logger_1.logger.error('Local decryption failed:', err);
            throw new Error('Failed to decrypt data locally');
        }
    }
    getEncryptionSecrets() {
        return SecretManager_1.secretManager.getEncryptionSecrets();
    }
    async getDataKey(keyId) {
        try {
            if (this.useVaultTransit) {
                const vault = (0, VaultService_1.getVaultService)();
                const secret = await vault.getSecret(`data-keys/${keyId}`);
                return secret.key || null;
            }
            else {
                const secrets = this.getEncryptionSecrets();
                return secrets.dataEncryptionKey;
            }
        }
        catch (err) {
            logger_1.logger.error(`Failed to get data key ${keyId}:`, err);
            return null;
        }
    }
    async generateDataKey(keyId, keySize = 32) {
        try {
            const newKey = crypto_1.default.randomBytes(keySize).toString('hex');
            if (this.useVaultTransit) {
                const vault = (0, VaultService_1.getVaultService)();
                await vault.putSecret(`data-keys/${keyId}`, { key: newKey });
            }
            logger_1.logger.info(`Generated new data key: ${(0, sanitizer_1.sanitizeForLog)(keyId)}`);
            return newKey;
        }
        catch (err) {
            logger_1.logger.error(`Failed to generate data key ${(0, sanitizer_1.sanitizeForLog)(keyId)}:`, err);
            throw new Error(`Failed to generate data key: ${(0, sanitizer_1.sanitizeForLog)(keyId)}`);
        }
    }
    async encryptPII(data) {
        const piiFields = ['email', 'phone', 'firstName', 'lastName', 'customerInfo'];
        const encrypted = { ...data };
        for (const field of piiFields) {
            if (encrypted[field] && typeof encrypted[field] === 'string') {
                encrypted[field] = await this.encryptData(encrypted[field]);
            }
        }
        return encrypted;
    }
    async decryptPII(data) {
        const piiFields = ['email', 'phone', 'firstName', 'lastName', 'customerInfo'];
        const decrypted = { ...data };
        for (const field of piiFields) {
            if (decrypted[field] && typeof decrypted[field] === 'string') {
                try {
                    decrypted[field] = await this.decryptData(decrypted[field]);
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to decrypt field ${field}, assuming unencrypted data`);
                }
            }
        }
        return decrypted;
    }
    hashPassword(password) {
        logger_1.logger.warn('SECURITY WARNING: EncryptionService.hashPassword() is deprecated! Use SecureAuthSystem.hashPassword()');
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }
    verifyPassword(password, hashedPassword) {
        logger_1.logger.warn('SECURITY WARNING: EncryptionService.verifyPassword() is deprecated! Use SecureAuthSystem.verifyPassword()');
        const [salt, hash] = hashedPassword.split(':');
        const verifyHash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        const hashBuffer = Buffer.from(hash, 'hex');
        const verifyHashBuffer = Buffer.from(verifyHash, 'hex');
        return hashBuffer.length === verifyHashBuffer.length &&
            crypto_1.default.timingSafeEqual(hashBuffer, verifyHashBuffer);
    }
    generateSecureToken(length = 32) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
    generateHMAC(data, secret) {
        const key = secret || SecretManager_1.secretManager.getEncryptionSecrets().masterKey;
        return crypto_1.default.createHmac('sha256', key).update(data).digest('hex');
    }
    verifyHMAC(data, signature, secret) {
        const key = secret || SecretManager_1.secretManager.getEncryptionSecrets().masterKey;
        const expectedSignature = crypto_1.default.createHmac('sha256', key).update(data).digest('hex');
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    validateFilePath(filePath) {
        const path = require('path');
        const resolvedPath = path.resolve(filePath);
        const allowedDir = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(allowedDir)) {
            throw new Error('Invalid file path: Path traversal detected');
        }
    }
    async encryptFile(filePath, outputPath) {
        this.validateFilePath(filePath);
        this.validateFilePath(outputPath);
        const fs = await import('fs').then(m => m.promises);
        const content = await fs.readFile(filePath, 'utf8');
        const encrypted = await this.encryptData(content);
        await fs.writeFile(outputPath, encrypted, 'utf8');
    }
    async decryptFile(filePath, outputPath) {
        this.validateFilePath(filePath);
        this.validateFilePath(outputPath);
        const fs = await import('fs').then(m => m.promises);
        const encrypted = await fs.readFile(filePath, 'utf8');
        const decrypted = await this.decryptData(encrypted);
        await fs.writeFile(outputPath, decrypted, 'utf8');
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = EncryptionService.getInstance();
//# sourceMappingURL=EncryptionService.js.map