import { Request, Response, NextFunction } from 'express';
import { PeerCertificate } from 'tls';
export interface MTLSRequest extends Request {
    clientCertificate?: PeerCertificate;
    mtlsVerified?: boolean;
    serviceIdentity?: string;
}
export interface ServiceIdentity {
    commonName: string;
    organization: string;
    organizationalUnit: string;
    fingerprint: string;
    validFrom: Date;
    validTo: Date;
}
declare class MTLSValidator {
    private static instance;
    private trustedServices;
    private certificateRevocationList;
    private constructor();
    static getInstance(): MTLSValidator;
    private loadTrustedServices;
    validateClientCertificate(cert: PeerCertificate): {
        valid: boolean;
        identity?: ServiceIdentity;
        reason?: string;
    };
    addTrustedService(identity: ServiceIdentity): void;
    revokeCertificate(fingerprint: string, reason: string): void;
    getTrustedServices(): ServiceIdentity[];
    getCertificateRevocationList(): string[];
}
declare const mtlsValidator: MTLSValidator;
export declare const mtlsAuthMiddleware: (req: MTLSRequest, res: Response, next: NextFunction) => Response | void;
export declare const mtlsLoggingMiddleware: (req: MTLSRequest, res: Response, next: NextFunction) => void;
export declare const requireServiceIdentity: (allowedServices: string[]) => (req: MTLSRequest, res: Response, next: NextFunction) => Response | void;
export declare const mtlsHealthCheck: (req: Request, res: Response) => Promise<void>;
export { mtlsValidator };
//# sourceMappingURL=mtlsMiddleware.d.ts.map