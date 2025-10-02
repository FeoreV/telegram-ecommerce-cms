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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const VaultService_1 = require("./VaultService");
const SecretManager_1 = require("../utils/SecretManager");
const logger_1 = require("../utils/logger");
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
            const cipher = crypto_1.default.createCipher('aes-256-gcm', key);
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
            const decipher = crypto_1.default.createDecipher('aes-256-gcm', key);
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
            logger_1.logger.info(`Generated new data key: ${keyId}`);
            return newKey;
        }
        catch (err) {
            logger_1.logger.error(`Failed to generate data key ${keyId}:`, err);
            throw new Error(`Failed to generate data key: ${keyId}`);
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
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }
    verifyPassword(password, hashedPassword) {
        const [salt, hash] = hashedPassword.split(':');
        const verifyHash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
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
    async encryptFile(filePath, outputPath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs'))).then(m => m.promises);
        const content = await fs.readFile(filePath, 'utf8');
        const encrypted = await this.encryptData(content);
        await fs.writeFile(outputPath, encrypted, 'utf8');
    }
    async decryptFile(filePath, outputPath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs'))).then(m => m.promises);
        const encrypted = await fs.readFile(filePath, 'utf8');
        const decrypted = await this.decryptData(encrypted);
        await fs.writeFile(outputPath, decrypted, 'utf8');
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = EncryptionService.getInstance();
//# sourceMappingURL=EncryptionService.js.map