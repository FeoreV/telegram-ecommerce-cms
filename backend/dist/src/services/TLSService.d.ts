import https from 'https';
import tls from 'tls';
export interface TLSConfig {
    enabled: boolean;
    certPath: string;
    keyPath: string;
    caPath: string;
    clientCertPath?: string;
    clientKeyPath?: string;
    rejectUnauthorized: boolean;
    minVersion: string;
    maxVersion: string;
    ciphers: string;
    honorCipherOrder: boolean;
    dhparam?: string;
    certificatesLoaded: number;
}
export interface TLSHealthConfig {
    minVersion: string;
    maxVersion: string;
    rejectUnauthorized: boolean;
    certificatesLoaded: number;
}
export interface MTLSClientOptions {
    host: string;
    port: number;
    cert: Buffer;
    key: Buffer;
    ca: Buffer;
    rejectUnauthorized: boolean;
    servername?: string;
}
export declare class TLSService {
    private static instance;
    private config;
    private certificates;
    private constructor();
    static getInstance(): TLSService;
    private loadTLSConfig;
    private initializeCertificates;
    private loadServerCertificates;
    private loadClientCertificates;
    getServerOptions(): https.ServerOptions;
    getClientOptions(host: string, port: number, servername?: string): MTLSClientOptions;
    createSecureContext(certPath: string, keyPath: string, caPath?: string): tls.SecureContext;
    validateCertificateChain(certPath: string, caPath: string): boolean;
    getCertificateExpiration(certPath: string): Date | null;
    checkCertificateExpiration(): Promise<{
        cert: string;
        expiresAt: Date;
        daysLeft: number;
    }[]>;
    reloadCertificates(): Promise<void>;
    getDatabaseTLSConfig(): {
        ssl: {
            ca: Buffer;
            rejectUnauthorized: boolean;
            minVersion?: string;
            maxVersion?: string;
            cert?: Buffer;
            key?: Buffer;
        };
    } | {
        ssl: false;
    };
    getRedisTLSConfig(): {
        tls: {
            ca: Buffer;
            rejectUnauthorized: boolean;
            minVersion?: string;
            maxVersion?: string;
            cert?: Buffer;
            key?: Buffer;
        };
    } | null;
    createSecureHttpClient(): https.Agent;
    healthCheck(): Promise<{
        status: string;
        certificates: {
            cert: string;
            expiresAt: Date;
            daysLeft: number;
        }[];
        config: TLSHealthConfig;
    }>;
    getConfig(): TLSConfig;
    isEnabled(): boolean;
}
export declare const tlsService: TLSService;
//# sourceMappingURL=TLSService.d.ts.map