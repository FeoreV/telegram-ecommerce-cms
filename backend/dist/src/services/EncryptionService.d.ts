export interface EncryptionResult {
    ciphertext: string;
    iv: string;
    tag: string;
}
export interface DecryptionInput {
    ciphertext: string;
    iv: string;
    tag: string;
}
export declare class EncryptionService {
    private static instance;
    private useVaultTransit;
    private transitKeyName;
    private constructor();
    static getInstance(): EncryptionService;
    encryptData(plaintext: string, context?: string): Promise<string>;
    decryptData(ciphertext: string, context?: string): Promise<string>;
    private encryptWithVault;
    private decryptWithVault;
    private encryptWithLocal;
    private decryptWithLocal;
    getEncryptionSecrets(): {
        masterKey: string;
        dataEncryptionKey: string;
    };
    getDataKey(keyId: string): Promise<string | null>;
    generateDataKey(keyId: string, keySize?: number): Promise<string>;
    encryptPII(data: Record<string, any>): Promise<Record<string, any>>;
    decryptPII(data: Record<string, any>): Promise<Record<string, any>>;
    hashPassword(password: string): string;
    verifyPassword(password: string, hashedPassword: string): boolean;
    generateSecureToken(length?: number): string;
    generateHMAC(data: string, secret?: string): string;
    verifyHMAC(data: string, signature: string, secret?: string): boolean;
    encryptFile(filePath: string, outputPath: string): Promise<void>;
    decryptFile(filePath: string, outputPath: string): Promise<void>;
}
export declare const encryptionService: EncryptionService;
//# sourceMappingURL=EncryptionService.d.ts.map