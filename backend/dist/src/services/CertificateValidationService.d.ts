export interface CertificateInfo {
    subject: {
        commonName: string;
        organization: string;
        organizationalUnit: string;
        country: string;
        state: string;
        locality: string;
    };
    issuer: {
        commonName: string;
        organization: string;
    };
    fingerprint: string;
    sha256Fingerprint: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
    keyUsage: string[];
    extendedKeyUsage: string[];
    subjectAltNames: string[];
    isCA: boolean;
    pathLength?: number;
}
export interface ValidationResult {
    valid: boolean;
    reason?: string;
    warnings: string[];
    certificateInfo?: CertificateInfo;
}
export declare class CertificateValidationService {
    private static instance;
    private trustedCACertificates;
    private pinnedCertificates;
    private certificateRevocationList;
    private constructor();
    static getInstance(): CertificateValidationService;
    private loadTrustedCAs;
    private loadPinnedCertificates;
    private loadCertificateRevocationList;
    validateCertificate(certificatePem: string, hostname?: string, options?: {
        checkRevocation?: boolean;
        checkPinning?: boolean;
        checkExpiry?: boolean;
        allowSelfSigned?: boolean;
    }): ValidationResult;
    private parseCertificate;
    private validateCertificateChain;
    private validateKeyUsage;
    private validateHostname;
    pinCertificate(hostname: string, certificatePem: string): void;
    revokeCertificate(fingerprint: string, reason: string): void;
    getCertificateInfo(certificatePem: string): CertificateInfo;
    checkExpirationWarnings(): Array<{
        hostname: string;
        fingerprint: string;
        expiresAt: Date;
        daysLeft: number;
    }>;
    generateSPIFFEID(serviceName: string, namespace?: string): string;
    validateSPIFFEID(certInfo: CertificateInfo, expectedServiceName: string): boolean;
    healthCheck(): Promise<{
        status: string;
        trustedCAs: number;
        pinnedCertificates: number;
        revokedCertificates: number;
        expiringCertificates: number;
    }>;
    getConfiguration(): {
        trustedCAs: string[];
        pinnedCertificates: Record<string, string>;
        revokedCertificates: string[];
    };
}
export declare const certificateValidationService: CertificateValidationService;
//# sourceMappingURL=CertificateValidationService.d.ts.map