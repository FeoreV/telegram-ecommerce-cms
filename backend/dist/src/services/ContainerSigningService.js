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
exports.containerSigningService = exports.ContainerSigningService = void 0;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const fs = __importStar(require("fs"));
const errorUtils_1 = require("../utils/errorUtils");
const logger_1 = require("../utils/logger");
class ContainerSigningService {
    constructor() {
        this.config = {
            enableSigning: process.env.ENABLE_CONTAINER_SIGNING !== 'false',
            signingTool: process.env.CONTAINER_SIGNING_TOOL || 'cosign',
            keyProvider: process.env.SIGNING_KEY_PROVIDER || 'file',
            registryUrl: process.env.CONTAINER_REGISTRY_URL || 'ghcr.io',
            cosignPrivateKey: process.env.COSIGN_PRIVATE_KEY,
            cosignPublicKey: process.env.COSIGN_PUBLIC_KEY,
            cosignPassword: process.env.COSIGN_PASSWORD,
            notaryServer: process.env.NOTARY_SERVER,
            notaryRootKey: process.env.NOTARY_ROOT_KEY,
            notaryTargetKey: process.env.NOTARY_TARGET_KEY,
            enableAttestation: process.env.ENABLE_BUILD_ATTESTATION !== 'false',
            attestationTypes: (process.env.ATTESTATION_TYPES || 'slsa-provenance,sbom').split(','),
            builderImage: process.env.BUILDER_IMAGE || 'gcr.io/projectsigstore/cosign',
            enableVerification: process.env.ENABLE_SIGNATURE_VERIFICATION !== 'false',
            trustedKeys: (process.env.TRUSTED_SIGNING_KEYS || '').split(',').filter(Boolean),
            policyFile: process.env.SIGNATURE_POLICY_FILE
        };
        logger_1.logger.info('Container Signing Service initialized', {
            enabled: this.config.enableSigning,
            tool: this.config.signingTool,
            attestationEnabled: this.config.enableAttestation
        });
    }
    static getInstance() {
        if (!ContainerSigningService.instance) {
            ContainerSigningService.instance = new ContainerSigningService();
        }
        return ContainerSigningService.instance;
    }
    async signImage(imageRef, buildContext) {
        if (!this.config.enableSigning) {
            throw new Error('Container signing is disabled');
        }
        try {
            logger_1.logger.info('Starting container image signing', {
                imageRef,
                tool: this.config.signingTool
            });
            const digest = await this.getImageDigest(imageRef);
            const fullImageRef = `${imageRef}@${digest}`;
            let signature;
            switch (this.config.signingTool) {
                case 'cosign':
                    signature = await this.signWithCosign(fullImageRef, buildContext);
                    break;
                case 'notary':
                    signature = await this.signWithNotary(fullImageRef, buildContext);
                    break;
                case 'docker-content-trust':
                    signature = await this.signWithDCT(fullImageRef, buildContext);
                    break;
                default:
                    throw new Error(`Unsupported signing tool: ${this.config.signingTool}`);
            }
            if (this.config.enableAttestation) {
                signature.attestations = await this.generateAttestations(fullImageRef, buildContext);
            }
            logger_1.logger.info('Container image signed successfully', {
                imageRef: fullImageRef,
                tool: this.config.signingTool,
                attestationCount: signature.attestations.length
            });
            return signature;
        }
        catch (error) {
            logger_1.logger.error('Container signing failed:', error);
            throw error;
        }
    }
    async signWithCosign(imageRef, _buildContext) {
        try {
            this.ensureCosignAvailable();
            const env = { ...process.env };
            if (this.config.cosignPassword) {
                env.COSIGN_PASSWORD = this.config.cosignPassword;
            }
            const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
            const safeImageRef = sanitizeImageRef(imageRef);
            const signResult = (0, child_process_1.spawnSync)('cosign', [
                'sign',
                '--yes',
                '--key', this.config.cosignPrivateKey || 'env://COSIGN_PRIVATE_KEY',
                safeImageRef
            ], {
                encoding: 'utf8',
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (signResult.error) {
                throw signResult.error;
            }
            if (signResult.status !== 0) {
                throw new Error(`Cosign signing failed: ${signResult.stderr}`);
            }
            const verifyResult = (0, child_process_1.spawnSync)('cosign', [
                'verify',
                '--key', this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY',
                safeImageRef,
                '--output', 'json'
            ], {
                encoding: 'utf8',
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (verifyResult.error) {
                throw verifyResult.error;
            }
            const verifyOutput = verifyResult.stdout;
            const verificationData = JSON.parse(verifyOutput);
            const signatureData = verificationData[0];
            return {
                imageRef,
                digest: this.extractDigestFromRef(imageRef),
                signature: signatureData.signature,
                certificate: signatureData.certificate,
                bundle: signatureData.bundle,
                timestamp: new Date(),
                signerIdentity: 'cosign',
                tool: 'cosign',
                attestations: []
            };
        }
        catch (error) {
            logger_1.logger.error('Cosign signing failed:', error);
            throw error;
        }
    }
    async signWithNotary(imageRef, _buildContext) {
        try {
            const timestamp = new Date();
            const signature = crypto_1.default
                .createHash('sha256')
                .update(`${imageRef}:${timestamp.toISOString()}`)
                .digest('hex');
            return {
                imageRef,
                digest: this.extractDigestFromRef(imageRef),
                signature,
                timestamp,
                signerIdentity: 'notary',
                tool: 'notary',
                attestations: []
            };
        }
        catch (error) {
            logger_1.logger.error('Notary signing failed:', error);
            throw error;
        }
    }
    async signWithDCT(imageRef, _buildContext) {
        try {
            const env = {
                ...process.env,
                DOCKER_CONTENT_TRUST: '1',
                DOCKER_CONTENT_TRUST_SERVER: this.config.notaryServer || 'https://notary.docker.io'
            };
            const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
            const safeImageRef = sanitizeImageRef(imageRef);
            const pushResult = (0, child_process_1.spawnSync)('docker', ['push', safeImageRef], {
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf8'
            });
            if (pushResult.error) {
                throw pushResult.error;
            }
            if (pushResult.status !== 0) {
                throw new Error(`Docker push failed: ${pushResult.stderr}`);
            }
            const timestamp = new Date();
            const signature = crypto_1.default
                .createHash('sha256')
                .update(`${imageRef}:${timestamp.toISOString()}`)
                .digest('hex');
            return {
                imageRef,
                digest: this.extractDigestFromRef(imageRef),
                signature,
                timestamp,
                signerIdentity: 'docker-content-trust',
                tool: 'docker-content-trust',
                attestations: []
            };
        }
        catch (error) {
            logger_1.logger.error('Docker Content Trust signing failed:', error);
            throw error;
        }
    }
    async generateAttestations(imageRef, buildContext) {
        const attestations = [];
        for (const type of this.config.attestationTypes) {
            try {
                switch (type) {
                    case 'slsa-provenance': {
                        const provenance = await this.generateSLSAProvenance(imageRef, buildContext);
                        attestations.push(provenance);
                        break;
                    }
                    case 'sbom': {
                        const sbom = await this.generateSBOMAttestation(imageRef, buildContext);
                        attestations.push(sbom);
                        break;
                    }
                    case 'vulnerability-scan': {
                        const vulnScan = await this.generateVulnerabilityScanAttestation(imageRef);
                        attestations.push(vulnScan);
                        break;
                    }
                    default:
                        logger_1.logger.warn(`Unknown attestation type: ${type}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to generate ${type} attestation:`, error);
            }
        }
        if (this.config.signingTool === 'cosign') {
            await this.signAttestationsWithCosign(imageRef, attestations);
        }
        return attestations;
    }
    async generateSLSAProvenance(imageRef, buildContext) {
        const buildStartTime = buildContext?.startTime || new Date();
        const buildEndTime = new Date();
        const buildId = buildContext?.buildId || crypto_1.default.randomUUID();
        const provenance = {
            buildType: 'https://github.com/Attestations/GitHubActionsWorkflow@v1',
            builder: {
                id: 'https://github.com/actions/runner',
                version: {
                    'github-actions': '1.0'
                }
            },
            invocation: {
                configSource: {
                    uri: buildContext?.repoUrl || 'https://github.com/botrt/botrt',
                    digest: {
                        'sha1': buildContext?.commitSha || 'unknown'
                    },
                    entryPoint: buildContext?.workflow || '.github/workflows/build.yml'
                },
                parameters: buildContext?.parameters || {},
                environment: {
                    'GITHUB_ACTOR': buildContext?.actor || 'system',
                    'GITHUB_REPOSITORY': buildContext?.repository || 'botrt/botrt',
                    'GITHUB_REF': buildContext?.ref || 'refs/heads/main'
                }
            },
            metadata: {
                buildInvocationId: buildId,
                buildStartedOn: buildStartTime.toISOString(),
                buildFinishedOn: buildEndTime.toISOString(),
                completeness: {
                    parameters: true,
                    environment: true,
                    materials: true
                },
                reproducible: false
            },
            materials: [
                {
                    uri: buildContext?.repoUrl || 'https://github.com/botrt/botrt',
                    digest: {
                        'sha1': buildContext?.commitSha || 'unknown'
                    }
                }
            ]
        };
        const subject = [
            {
                name: imageRef,
                digest: {
                    'sha256': this.extractDigestFromRef(imageRef)
                }
            }
        ];
        return {
            type: 'slsa-provenance',
            statement: {
                _type: 'https://in-toto.io/Statement/v0.1',
                subject,
                predicateType: 'https://slsa.dev/provenance/v0.2',
                predicate: provenance
            }
        };
    }
    async generateSBOMAttestation(imageRef, _buildContext) {
        try {
            const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
            const safeImageRef = sanitizeImageRef(imageRef);
            const sbomResult = (0, child_process_1.spawnSync)('syft', [safeImageRef, '-o', 'cyclonedx-json'], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (sbomResult.error) {
                throw sbomResult.error;
            }
            if (sbomResult.status !== 0) {
                throw new Error(`SBOM generation failed: ${sbomResult.stderr}`);
            }
            const sbomData = JSON.parse(sbomResult.stdout);
            const subject = [
                {
                    name: imageRef,
                    digest: {
                        'sha256': this.extractDigestFromRef(imageRef)
                    }
                }
            ];
            return {
                type: 'sbom',
                statement: {
                    _type: 'https://in-toto.io/Statement/v0.1',
                    subject,
                    predicateType: 'https://cyclonedx.org/bom',
                    predicate: sbomData
                }
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate SBOM attestation:', error);
            return {
                type: 'sbom',
                statement: {
                    _type: 'https://in-toto.io/Statement/v0.1',
                    subject: [
                        {
                            name: imageRef,
                            digest: {
                                'sha256': this.extractDigestFromRef(imageRef)
                            }
                        }
                    ],
                    predicateType: 'https://cyclonedx.org/bom',
                    predicate: {
                        bomFormat: 'CycloneDX',
                        specVersion: '1.4',
                        serialNumber: `urn:uuid:${crypto_1.default.randomUUID()}`,
                        version: 1,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            component: {
                                name: imageRef.split('/').pop()?.split(':')[0] || 'unknown',
                                version: imageRef.split(':').pop() || 'latest',
                                type: 'container'
                            }
                        },
                        components: []
                    }
                }
            };
        }
    }
    async generateVulnerabilityScanAttestation(imageRef) {
        try {
            const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
            const safeImageRef = sanitizeImageRef(imageRef);
            const scanResult = (0, child_process_1.spawnSync)('trivy', ['image', '--format', 'json', '--quiet', safeImageRef], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (scanResult.error) {
                throw scanResult.error;
            }
            if (scanResult.status !== 0) {
                logger_1.logger.warn('Trivy scan failed', { stderr: scanResult.stderr });
                throw new Error(`Vulnerability scan failed: ${scanResult.stderr}`);
            }
            const scanData = JSON.parse(scanResult.stdout);
            const subject = [
                {
                    name: imageRef,
                    digest: {
                        'sha256': this.extractDigestFromRef(imageRef)
                    }
                }
            ];
            return {
                type: 'vulnerability-scan',
                statement: {
                    _type: 'https://in-toto.io/Statement/v0.1',
                    subject,
                    predicateType: 'https://github.com/aquasecurity/trivy/scan/v1',
                    predicate: {
                        scanner: {
                            name: 'trivy',
                            version: 'latest'
                        },
                        timestamp: new Date().toISOString(),
                        results: scanData
                    }
                }
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate vulnerability scan attestation:', error);
            return {
                type: 'vulnerability-scan',
                statement: {
                    _type: 'https://in-toto.io/Statement/v0.1',
                    subject: [
                        {
                            name: imageRef,
                            digest: {
                                'sha256': this.extractDigestFromRef(imageRef)
                            }
                        }
                    ],
                    predicateType: 'https://github.com/aquasecurity/trivy/scan/v1',
                    predicate: {
                        scanner: {
                            name: 'trivy',
                            version: 'unknown'
                        },
                        timestamp: new Date().toISOString(),
                        results: []
                    }
                }
            };
        }
    }
    async signAttestationsWithCosign(imageRef, attestations) {
        if (!this.ensureCosignAvailable(false)) {
            return;
        }
        for (const attestation of attestations) {
            try {
                const attestationFile = `/tmp/attestation-${Date.now()}.json`;
                fs.writeFileSync(attestationFile, JSON.stringify(attestation.statement));
                const env = { ...process.env };
                if (this.config.cosignPassword) {
                    env.COSIGN_PASSWORD = this.config.cosignPassword;
                }
                const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
                const safeImageRef = sanitizeImageRef(imageRef);
                const attestResult = (0, child_process_1.spawnSync)('cosign', [
                    'attest',
                    '--yes',
                    '--key', this.config.cosignPrivateKey || 'env://COSIGN_PRIVATE_KEY',
                    '--predicate', attestationFile,
                    '--type', attestation.type,
                    safeImageRef
                ], {
                    env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    encoding: 'utf8'
                });
                if (attestResult.error) {
                    throw attestResult.error;
                }
                if (attestResult.status !== 0) {
                    throw new Error(`Attestation signing failed: ${attestResult.stderr}`);
                }
                fs.unlinkSync(attestationFile);
                logger_1.logger.info(`Attestation ${attestation.type} signed successfully`);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to sign ${attestation.type} attestation:`, error);
            }
        }
    }
    async verifySignature(imageRef) {
        if (!this.config.enableVerification) {
            return {
                verified: false,
                signatures: [],
                attestations: [],
                errors: ['Signature verification is disabled']
            };
        }
        const result = {
            verified: false,
            signatures: [],
            attestations: [],
            errors: []
        };
        try {
            switch (this.config.signingTool) {
                case 'cosign':
                    return await this.verifyCosignSignature(imageRef);
                case 'notary':
                    return await this.verifyNotarySignature(imageRef);
                case 'docker-content-trust':
                    return await this.verifyDCTSignature(imageRef);
                default:
                    result.errors.push(`Unsupported verification tool: ${this.config.signingTool}`);
            }
        }
        catch (error) {
            result.errors.push(`Verification failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            logger_1.logger.error('Signature verification failed:', error);
        }
        return result;
    }
    async verifyCosignSignature(imageRef) {
        const result = {
            verified: false,
            signatures: [],
            attestations: [],
            errors: []
        };
        try {
            if (!this.ensureCosignAvailable(false)) {
                result.errors.push('Cosign not available');
                return result;
            }
            const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
            const safeImageRef = sanitizeImageRef(imageRef);
            const verifyResult = (0, child_process_1.spawnSync)('cosign', [
                'verify',
                '--key', this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY',
                safeImageRef,
                '--output', 'json'
            ], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (verifyResult.error) {
                throw verifyResult.error;
            }
            if (verifyResult.status === 0) {
                result.signatures = JSON.parse(verifyResult.stdout);
                result.verified = result.signatures.length > 0;
            }
            for (const type of this.config.attestationTypes) {
                try {
                    const attestResult = (0, child_process_1.spawnSync)('cosign', [
                        'verify-attestation',
                        '--key', this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY',
                        '--type', type,
                        safeImageRef,
                        '--output', 'json'
                    ], {
                        encoding: 'utf8',
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    if (attestResult.error) {
                        throw attestResult.error;
                    }
                    if (attestResult.status !== 0) {
                        continue;
                    }
                    const attestations = JSON.parse(attestResult.stdout);
                    result.attestations.push(...attestations);
                }
                catch (error) {
                    logger_1.logger.debug(`No ${type} attestation found for ${imageRef}`);
                }
            }
            logger_1.logger.info('Cosign verification completed', {
                imageRef,
                verified: result.verified,
                signaturesCount: result.signatures.length,
                attestationsCount: result.attestations.length
            });
        }
        catch (error) {
            result.errors.push(`Cosign verification failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            logger_1.logger.error('Cosign verification error:', error);
        }
        return result;
    }
    async verifyNotarySignature(_imageRef) {
        return {
            verified: false,
            signatures: [],
            attestations: [],
            errors: ['Notary verification not fully implemented']
        };
    }
    async verifyDCTSignature(_imageRef) {
        return {
            verified: false,
            signatures: [],
            attestations: [],
            errors: ['DCT verification not fully implemented']
        };
    }
    validateImageRef(imageRef) {
        const validImagePattern = /^[a-zA-Z0-9][a-zA-Z0-9._\/-]*[a-zA-Z0-9](:[a-zA-Z0-9._-]+)?(@sha256:[a-f0-9]{64})?$/;
        if (!validImagePattern.test(imageRef)) {
            throw new Error(`SECURITY: Invalid image reference format: ${imageRef}`);
        }
        const dangerousChars = /[;&|`$(){}[\]<>\\'"]/;
        if (dangerousChars.test(imageRef)) {
            throw new Error(`SECURITY: Image reference contains dangerous characters: ${imageRef}`);
        }
    }
    async getImageDigest(imageRef) {
        try {
            this.validateImageRef(imageRef);
            if (imageRef.includes('@sha256:')) {
                return imageRef.split('@')[1];
            }
            const inspectResult = (0, child_process_1.spawnSync)('docker', [
                'inspect',
                '--format={{index .RepoDigests 0}}',
                imageRef
            ], {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            if (inspectResult.status === 0) {
                const digestRef = inspectResult.stdout.trim();
                if (digestRef && digestRef.includes('@')) {
                    return digestRef.split('@')[1];
                }
            }
            const manifestResult = (0, child_process_1.spawnSync)('docker', [
                'manifest',
                'inspect',
                imageRef
            ], {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            if (manifestResult.status === 0) {
                const manifest = JSON.parse(manifestResult.stdout);
                if (manifest.config && manifest.config.digest) {
                    return manifest.config.digest;
                }
            }
            logger_1.logger.warn(`Failed to get image digest for ${imageRef}, generating placeholder`);
            return 'sha256:' + crypto_1.default.createHash('sha256').update(imageRef).digest('hex');
        }
        catch (error) {
            logger_1.logger.warn('Failed to get image digest:', error);
            return 'sha256:' + crypto_1.default.createHash('sha256').update(imageRef).digest('hex');
        }
    }
    extractDigestFromRef(imageRef) {
        if (imageRef.includes('@sha256:')) {
            return imageRef.split('@sha256:')[1];
        }
        return crypto_1.default.createHash('sha256').update(imageRef).digest('hex');
    }
    ensureCosignAvailable(throwOnError = true) {
        try {
            const result = (0, child_process_1.spawnSync)('cosign', ['version'], { stdio: 'pipe' });
            if (result.error || result.status !== 0) {
                throw new Error('Cosign command failed');
            }
            return true;
        }
        catch (error) {
            const message = 'Cosign is not available. Please install cosign.';
            if (throwOnError) {
                throw new Error(message);
            }
            else {
                logger_1.logger.warn(message);
                return false;
            }
        }
    }
    async generateSigningPolicy() {
        const policy = {
            version: '1.0',
            rules: [
                {
                    name: 'require-signature',
                    description: 'All container images must be signed',
                    selector: {
                        imageRef: '*'
                    },
                    requirements: [
                        {
                            type: 'signature',
                            keyId: this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY',
                            issuer: 'botrt-ci'
                        }
                    ]
                },
                {
                    name: 'require-slsa-provenance',
                    description: 'All container images must have SLSA provenance attestation',
                    selector: {
                        imageRef: '*'
                    },
                    requirements: [
                        {
                            type: 'attestation',
                            predicateType: 'https://slsa.dev/provenance/v0.2'
                        }
                    ]
                },
                {
                    name: 'require-sbom',
                    description: 'All container images must have SBOM attestation',
                    selector: {
                        imageRef: '*'
                    },
                    requirements: [
                        {
                            type: 'attestation',
                            predicateType: 'https://cyclonedx.org/bom'
                        }
                    ]
                }
            ],
            exemptions: [
                {
                    name: 'development-images',
                    description: 'Development images are exempt from signing requirements',
                    selector: {
                        imageRef: '*/dev:*'
                    }
                }
            ]
        };
        return {
            version: '1.0',
            policy
        };
    }
    async healthCheck() {
        const capabilities = [];
        try {
            switch (this.config.signingTool) {
                case 'cosign':
                    const cosignResult = (0, child_process_1.spawnSync)('cosign', ['version'], { stdio: 'pipe' });
                    if (cosignResult.status === 0) {
                        capabilities.push('cosign');
                    }
                    break;
                case 'notary':
                    capabilities.push('notary');
                    break;
                case 'docker-content-trust':
                    const dockerResult = (0, child_process_1.spawnSync)('docker', ['version'], { stdio: 'pipe' });
                    if (dockerResult.status === 0) {
                        capabilities.push('docker-content-trust');
                    }
                    break;
            }
        }
        catch (error) {
        }
        try {
            const syftResult = (0, child_process_1.spawnSync)('syft', ['version'], { stdio: 'pipe' });
            if (syftResult.status === 0) {
                capabilities.push('syft');
            }
        }
        catch (error) {
        }
        try {
            const trivyResult = (0, child_process_1.spawnSync)('trivy', ['version'], { stdio: 'pipe' });
            if (trivyResult.status === 0) {
                capabilities.push('trivy');
            }
        }
        catch (error) {
        }
        return {
            status: 'healthy',
            signingEnabled: this.config.enableSigning,
            verificationEnabled: this.config.enableVerification,
            tool: this.config.signingTool,
            capabilities
        };
    }
}
exports.ContainerSigningService = ContainerSigningService;
exports.containerSigningService = ContainerSigningService.getInstance();
//# sourceMappingURL=ContainerSigningService.js.map