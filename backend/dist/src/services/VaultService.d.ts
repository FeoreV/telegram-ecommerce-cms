export interface VaultConfig {
    address: string;
    roleId: string;
    secretId: string;
    namespace?: string;
}
export interface SecretData {
    [key: string]: any;
}
export interface VaultSecret {
    data: {
        data: SecretData;
        metadata: {
            created_time: string;
            version: number;
        };
    };
}
export declare class VaultService {
    private client;
    private token;
    private tokenExpiry;
    private config;
    constructor(config: VaultConfig);
    private authenticate;
    private ensureValidToken;
    getSecret(path: string): Promise<SecretData>;
    putSecret(path: string, data: SecretData): Promise<void>;
    deleteSecret(path: string): Promise<void>;
    listSecrets(path: string): Promise<string[]>;
    getDatabaseCredentials(role: string): Promise<{
        username: string;
        password: string;
    }>;
    encrypt(keyName: string, plaintext: string): Promise<string>;
    decrypt(keyName: string, ciphertext: string): Promise<string>;
    healthCheck(): Promise<boolean>;
}
export declare const getVaultService: () => VaultService;
export default VaultService;
//# sourceMappingURL=VaultService.d.ts.map