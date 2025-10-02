export interface ApplicationSecrets {
    jwt: {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    database: {
        url: string;
        username?: string;
        password?: string;
    };
    telegram: {
        botToken: string;
        webhookSecret?: string;
    };
    admin: {
        defaultPassword: string;
        cookieSecret: string;
        sessionSecret: string;
    };
    smtp: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        password?: string;
        from?: string;
    };
    encryption: {
        masterKey: string;
        dataEncryptionKey: string;
    };
    redis: {
        url?: string;
        password?: string;
    };
}
export declare class SecretManager {
    private static instance;
    private secrets;
    private useVault;
    private constructor();
    static getInstance(): SecretManager;
    initialize(): Promise<void>;
    private loadSecretsFromVault;
    private loadSecretsFromEnv;
    private validateSecrets;
    private validateSecretStrength;
    private getNestedValue;
    private generateKey;
    getSecrets(): ApplicationSecrets;
    getJWTSecrets(): {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    getDatabaseSecrets(): {
        url: string;
        username?: string;
        password?: string;
    };
    getTelegramSecrets(): {
        botToken: string;
        webhookSecret?: string;
    };
    getAdminSecrets(): {
        defaultPassword: string;
        cookieSecret: string;
        sessionSecret: string;
    };
    getSMTPSecrets(): {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        password?: string;
        from?: string;
    };
    getEncryptionSecrets(): {
        masterKey: string;
        dataEncryptionKey: string;
    };
    getRedisSecrets(): {
        url?: string;
        password?: string;
    };
    rotateSecrets(): Promise<void>;
}
export declare const secretManager: SecretManager;
//# sourceMappingURL=SecretManager.d.ts.map