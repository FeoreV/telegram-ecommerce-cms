export interface SBOMComponent {
    name: string;
    version: string;
    type: 'npm' | 'docker' | 'system' | 'application';
    purl: string;
    licenses: string[];
    supplier?: string;
    author?: string;
    downloadLocation?: string;
    homepage?: string;
    description?: string;
    filesAnalyzed: boolean;
    verification: {
        hash: string;
        hashAlgorithm: string;
        signature?: string;
        signatureAlgorithm?: string;
    };
    vulnerabilities: Vulnerability[];
    dependencies: string[];
    externalRefs: ExternalReference[];
}
export interface Vulnerability {
    id: string;
    source: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    cvssScore?: number;
    cvssVector?: string;
    description: string;
    references: string[];
    fixedIn?: string;
    publishedDate: Date;
    lastModifiedDate: Date;
}
export interface ExternalReference {
    type: 'website' | 'vcs' | 'issue-tracker' | 'mailing-list' | 'social' | 'chat' | 'documentation' | 'support' | 'distribution' | 'license' | 'build-meta' | 'build-system' | 'release-notes' | 'security-contact' | 'model-card' | 'log' | 'configuration' | 'evidence' | 'formulation' | 'attestation' | 'threat-model' | 'adversarial-model' | 'risk-assessment' | 'vulnerability-assertion' | 'exploitability-statement' | 'pentest-report' | 'static-analysis-report' | 'dynamic-analysis-report' | 'runtime-analysis-report' | 'component-analysis-report' | 'maturity-report' | 'certification-report' | 'codified-infrastructure' | 'quality-metrics' | 'poam' | 'other';
    url: string;
    comment?: string;
    hashes?: {
        alg: string;
        content: string;
    }[];
}
export interface SBOM {
    bomFormat: 'CycloneDX';
    specVersion: string;
    serialNumber: string;
    version: number;
    metadata: {
        timestamp: Date;
        tools: Tool[];
        authors: Author[];
        component: SBOMComponent;
        manufacture?: Organization;
        supplier?: Organization;
        licenses?: License[];
        properties?: Property[];
    };
    components: SBOMComponent[];
    services?: Service[];
    externalReferences?: ExternalReference[];
    dependencies?: Dependency[];
    compositions?: Composition[];
    vulnerabilities?: Vulnerability[];
    signature?: {
        algorithm: string;
        keyId: string;
        value: string;
    };
}
export interface Tool {
    vendor: string;
    name: string;
    version: string;
    hashes?: {
        alg: string;
        content: string;
    }[];
    externalReferences?: ExternalReference[];
}
export interface Author {
    name: string;
    email?: string;
    phone?: string;
}
export interface Organization {
    name: string;
    url?: string[];
    contact?: Contact[];
}
export interface Contact {
    name?: string;
    email?: string;
    phone?: string;
}
export interface License {
    id?: string;
    name?: string;
    text?: {
        contentType: string;
        encoding: string;
        content: string;
    };
    url?: string;
}
export interface Property {
    name: string;
    value: string;
}
export interface Service {
    name: string;
    version?: string;
    description?: string;
    endpoints?: string[];
    authenticated?: boolean;
    x_trust_boundary?: boolean;
    data?: DataClassification[];
    licenses?: License[];
    externalReferences?: ExternalReference[];
}
export interface DataClassification {
    flow: 'inbound' | 'outbound' | 'bi-directional' | 'unknown';
    classification: string;
}
export interface Dependency {
    ref: string;
    dependsOn?: string[];
}
export interface Composition {
    aggregate: 'complete' | 'incomplete' | 'incomplete_first_party_only' | 'incomplete_third_party_only' | 'unknown';
    assemblies?: string[];
    dependencies?: string[];
}
export declare class SBOMService {
    private static instance;
    private vulnerabilityDatabases;
    private constructor();
    static getInstance(): SBOMService;
    private initializeVulnerabilityDatabases;
    generateSBOM(_projectPath: string, includeDevDependencies?: boolean, includeSystemPackages?: boolean): Promise<SBOM>;
    private readPackageJson;
    private generateMetadata;
    private analyzeNPMDependencies;
    private processNPMDependencies;
    private createNPMComponent;
    private extractLicenses;
    private generateNPMExternalRefs;
    private analyzeSystemPackages;
    private parseDpkgOutput;
    private parseRpmOutput;
    private parseApkOutput;
    private analyzeDockerDependencies;
    private extractDockerBaseImages;
    private createDockerComponent;
    private generateApplicationComponent;
    private analyzeServices;
    private generateDependenciesGraph;
    private analyzeVulnerabilities;
    private checkNPMVulnerabilities;
    private mapNPMSeverity;
    private checkSystemVulnerabilities;
    private checkDockerVulnerabilities;
    private signSBOM;
    exportSBOM(sbom: SBOM, outputPath: string): Promise<void>;
    validateSBOM(sbom: SBOM): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }>;
}
export declare const sbomService: SBOMService;
//# sourceMappingURL=SBOMService.d.ts.map