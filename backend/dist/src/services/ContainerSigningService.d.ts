export interface SigningConfig {
    enableSigning: boolean;
    signingTool: 'cosign' | 'notary' | 'docker-content-trust';
    keyProvider: 'file' | 'vault' | 'kms' | 'pkcs11';
    registryUrl: string;
    cosignPrivateKey?: string;
    cosignPublicKey?: string;
    cosignPassword?: string;
    notaryServer?: string;
    notaryRootKey?: string;
    notaryTargetKey?: string;
    enableAttestation: boolean;
    attestationTypes: string[];
    builderImage: string;
    enableVerification: boolean;
    trustedKeys: string[];
    policyFile?: string;
}
export interface BuildAttestation {
    type: string;
    statement: {
        _type: string;
        subject: Subject[];
        predicateType: string;
        predicate: any;
    };
    signature?: string;
}
export interface Subject {
    name: string;
    digest: {
        [algorithm: string]: string;
    };
}
export interface SLSAProvenance {
    buildType: string;
    builder: {
        id: string;
        version?: {
            [key: string]: string;
        };
    };
    invocation: {
        configSource: {
            uri: string;
            digest: {
                [algorithm: string]: string;
            };
            entryPoint?: string;
        };
        parameters?: {
            [key: string]: any;
        };
        environment?: {
            [key: string]: any;
        };
    };
    buildConfig?: {
        [key: string]: any;
    };
    metadata: {
        buildInvocationId: string;
        buildStartedOn: string;
        buildFinishedOn: string;
        completeness: {
            parameters: boolean;
            environment: boolean;
            materials: boolean;
        };
        reproducible: boolean;
    };
    materials: Material[];
}
export interface Material {
    uri: string;
    digest: {
        [algorithm: string]: string;
    };
}
export interface ContainerSignature {
    imageRef: string;
    digest: string;
    signature: string;
    certificate?: string;
    bundle?: string;
    timestamp: Date;
    signerIdentity: string;
    tool: string;
    attestations: BuildAttestation[];
}
export declare class ContainerSigningService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ContainerSigningService;
    signImage(imageRef: string, buildContext?: any): Promise<ContainerSignature>;
    private signWithCosign;
    private signWithNotary;
    private signWithDCT;
    private generateAttestations;
    private generateSLSAProvenance;
    private generateSBOMAttestation;
    private generateVulnerabilityScanAttestation;
    private signAttestationsWithCosign;
    verifySignature(imageRef: string): Promise<{
        verified: boolean;
        signatures: any[];
        attestations: any[];
        errors: string[];
    }>;
    private verifyCosignSignature;
    private verifyNotarySignature;
    private verifyDCTSignature;
    private getImageDigest;
    private extractDigestFromRef;
    private ensureCosignAvailable;
    generateSigningPolicy(): Promise<{
        version: string;
        policy: any;
    }>;
    healthCheck(): Promise<{
        status: string;
        signingEnabled: boolean;
        verificationEnabled: boolean;
        tool: string;
        capabilities: string[];
    }>;
}
export declare const containerSigningService: ContainerSigningService;
//# sourceMappingURL=ContainerSigningService.d.ts.map