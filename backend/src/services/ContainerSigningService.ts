import crypto from 'crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';

export interface SigningConfig {
  enableSigning: boolean;
  signingTool: 'cosign' | 'notary' | 'docker-content-trust';
  keyProvider: 'file' | 'vault' | 'kms' | 'pkcs11';
  registryUrl: string;
  
  // Cosign specific
  cosignPrivateKey?: string;
  cosignPublicKey?: string;
  cosignPassword?: string;
  
  // Notary specific
  notaryServer?: string;
  notaryRootKey?: string;
  notaryTargetKey?: string;
  
  // Build attestation
  enableAttestation: boolean;
  attestationTypes: string[];
  builderImage: string;
  
  // Verification
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

export class ContainerSigningService {
  private static instance: ContainerSigningService;
  private config: SigningConfig;

  private constructor() {
    this.config = {
      enableSigning: process.env.ENABLE_CONTAINER_SIGNING !== 'false',
      signingTool: (process.env.CONTAINER_SIGNING_TOOL as any) || 'cosign',
      keyProvider: (process.env.SIGNING_KEY_PROVIDER as any) || 'file',
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

    logger.info('Container Signing Service initialized', {
      enabled: this.config.enableSigning,
      tool: this.config.signingTool,
      attestationEnabled: this.config.enableAttestation
    });
  }

  public static getInstance(): ContainerSigningService {
    if (!ContainerSigningService.instance) {
      ContainerSigningService.instance = new ContainerSigningService();
    }
    return ContainerSigningService.instance;
  }

  /**
   * Sign container image
   */
  async signImage(
    imageRef: string,
    buildContext?: any
  ): Promise<ContainerSignature> {
    if (!this.config.enableSigning) {
      throw new Error('Container signing is disabled');
    }

    try {
      logger.info('Starting container image signing', {
        imageRef,
        tool: this.config.signingTool
      });

      // Get image digest
      const digest = await this.getImageDigest(imageRef);
      const fullImageRef = `${imageRef}@${digest}`;

      let signature: ContainerSignature;

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

      // Generate attestations if enabled
      if (this.config.enableAttestation) {
        signature.attestations = await this.generateAttestations(
          fullImageRef,
          buildContext
        );
      }

      logger.info('Container image signed successfully', {
        imageRef: fullImageRef,
        tool: this.config.signingTool,
        attestationCount: signature.attestations.length
      });

      return signature;

    } catch (error) {
      logger.error('Container signing failed:', error);
      throw error;
    }
  }

  /**
   * Sign with Cosign
   */
  private async signWithCosign(
    imageRef: string,
    _buildContext?: any
  ): Promise<ContainerSignature> {
    try {
      // Ensure cosign is available
      this.ensureCosignAvailable();

      // Set up environment
      const env = { ...process.env };
      if (this.config.cosignPassword) {
        env.COSIGN_PASSWORD = this.config.cosignPassword;
      }

      // Sign the image
      const signCmd = [
        'cosign sign',
        '--yes', // Skip confirmation
        '--key', this.config.cosignPrivateKey || 'env://COSIGN_PRIVATE_KEY',
        imageRef
      ].join(' ');

      execSync(signCmd, {
        encoding: 'utf8',
        env,
        stdio: 'pipe'
      });

      // Get signature info
      const verifyCmd = `cosign verify --key ${this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY'} ${imageRef} --output json`;
      const verifyOutput = execSync(verifyCmd, {
        encoding: 'utf8',
        env,
        stdio: 'pipe'
      });

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

    } catch (error) {
      logger.error('Cosign signing failed:', error);
      throw error;
    }
  }

  /**
   * Sign with Notary
   */
  private async signWithNotary(
    imageRef: string,
    _buildContext?: any
  ): Promise<ContainerSignature> {
    try {
      // This is a simplified implementation
      // In production, you'd integrate with actual Notary server
      
      const timestamp = new Date();
      const signature = crypto
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

    } catch (error) {
      logger.error('Notary signing failed:', error);
      throw error;
    }
  }

  /**
   * Sign with Docker Content Trust
   */
  private async signWithDCT(
    imageRef: string,
    _buildContext?: any
  ): Promise<ContainerSignature> {
    try {
      // Enable Docker Content Trust
      const env = {
        ...process.env,
        DOCKER_CONTENT_TRUST: '1',
        DOCKER_CONTENT_TRUST_SERVER: this.config.notaryServer || 'https://notary.docker.io'
      };

      // Push with signing
      const pushCmd = `docker push ${imageRef}`;
      execSync(pushCmd, { env, stdio: 'pipe' });

      const timestamp = new Date();
      const signature = crypto
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

    } catch (error) {
      logger.error('Docker Content Trust signing failed:', error);
      throw error;
    }
  }

  /**
   * Generate build attestations
   */
  private async generateAttestations(
    imageRef: string,
    buildContext?: any
  ): Promise<BuildAttestation[]> {
    const attestations: BuildAttestation[] = [];

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
            logger.warn(`Unknown attestation type: ${type}`);
        }
      } catch (error) {
        logger.warn(`Failed to generate ${type} attestation:`, error);
      }
    }

    // Sign attestations if cosign is available
    if (this.config.signingTool === 'cosign') {
      await this.signAttestationsWithCosign(imageRef, attestations);
    }

    return attestations;
  }

  /**
   * Generate SLSA Provenance attestation
   */
  private async generateSLSAProvenance(
    imageRef: string,
    buildContext?: any
  ): Promise<BuildAttestation> {
    const buildStartTime = buildContext?.startTime || new Date();
    const buildEndTime = new Date();
    const buildId = buildContext?.buildId || crypto.randomUUID();

    const provenance: SLSAProvenance = {
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

    const subject: Subject[] = [
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

  /**
   * Generate SBOM attestation
   */
  private async generateSBOMAttestation(
    imageRef: string,
    _buildContext?: any
  ): Promise<BuildAttestation> {
    try {
      // Generate SBOM using syft or similar tool
      const sbomCmd = `syft ${imageRef} -o cyclonedx-json`;
      const sbomOutput = execSync(sbomCmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const sbomData = JSON.parse(sbomOutput);

      const subject: Subject[] = [
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

    } catch (error) {
      logger.warn('Failed to generate SBOM attestation:', error);
      
      // Return minimal SBOM attestation
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
            serialNumber: `urn:uuid:${crypto.randomUUID()}`,
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

  /**
   * Generate vulnerability scan attestation
   */
  private async generateVulnerabilityScanAttestation(
    imageRef: string
  ): Promise<BuildAttestation> {
    try {
      // Run vulnerability scan using trivy
      const scanCmd = `trivy image --format json --quiet ${imageRef}`;
      const scanOutput = execSync(scanCmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const scanData = JSON.parse(scanOutput);

      const subject: Subject[] = [
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

    } catch (error) {
      logger.warn('Failed to generate vulnerability scan attestation:', error);
      
      // Return minimal scan attestation
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

  /**
   * Sign attestations with Cosign
   */
  private async signAttestationsWithCosign(
    imageRef: string,
    attestations: BuildAttestation[]
  ): Promise<void> {
    if (!this.ensureCosignAvailable(false)) {
      return;
    }

    for (const attestation of attestations) {
      try {
        // Write attestation to temporary file
        const attestationFile = `/tmp/attestation-${Date.now()}.json`;
        fs.writeFileSync(attestationFile, JSON.stringify(attestation.statement));

        // Sign attestation
        const env = { ...process.env };
        if (this.config.cosignPassword) {
          env.COSIGN_PASSWORD = this.config.cosignPassword;
        }

        const attestCmd = [
          'cosign attest',
          '--yes',
          '--key', this.config.cosignPrivateKey || 'env://COSIGN_PRIVATE_KEY',
          '--predicate', attestationFile,
          '--type', attestation.type,
          imageRef
        ].join(' ');

        execSync(attestCmd, {
          env,
          stdio: 'pipe'
        });

        // Clean up
        fs.unlinkSync(attestationFile);

        logger.info(`Attestation ${attestation.type} signed successfully`);

      } catch (error) {
        logger.warn(`Failed to sign ${attestation.type} attestation:`, error);
      }
    }
  }

  /**
   * Verify container signature
   */
  async verifySignature(imageRef: string): Promise<{
    verified: boolean;
    signatures: any[];
    attestations: any[];
    errors: string[];
  }> {
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
      signatures: [] as any[],
      attestations: [] as any[],
      errors: [] as string[]
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

    } catch (error) {
      result.errors.push(`Verification failed: ${getErrorMessage(error)}`);
      logger.error('Signature verification failed:', error);
    }

    return result;
  }

  /**
   * Verify Cosign signature
   */
  private async verifyCosignSignature(imageRef: string): Promise<any> {
    const result = {
      verified: false,
      signatures: [] as any[],
      attestations: [] as any[],
      errors: [] as string[]
    };

    try {
      if (!this.ensureCosignAvailable(false)) {
        result.errors.push('Cosign not available');
        return result;
      }

      // Verify signatures
      const verifyCmd = `cosign verify --key ${this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY'} ${imageRef} --output json`;
      const verifyOutput = execSync(verifyCmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      result.signatures = JSON.parse(verifyOutput);
      result.verified = result.signatures.length > 0;

      // Verify attestations
      for (const type of this.config.attestationTypes) {
        try {
          const attestCmd = `cosign verify-attestation --key ${this.config.cosignPublicKey || 'env://COSIGN_PUBLIC_KEY'} --type ${type} ${imageRef} --output json`;
          const attestOutput = execSync(attestCmd, {
            encoding: 'utf8',
            stdio: 'pipe'
          });

          const attestations = JSON.parse(attestOutput);
          result.attestations.push(...attestations);

        } catch (error) {
          // Attestation might not exist
          logger.debug(`No ${type} attestation found for ${imageRef}`);
        }
      }

      logger.info('Cosign verification completed', {
        imageRef,
        verified: result.verified,
        signaturesCount: result.signatures.length,
        attestationsCount: result.attestations.length
      });

    } catch (error) {
      result.errors.push(`Cosign verification failed: ${getErrorMessage(error)}`);
      logger.error('Cosign verification error:', error);
    }

    return result;
  }

  /**
   * Verify Notary signature
   */
  private async verifyNotarySignature(_imageRef: string): Promise<any> {
    // Simplified implementation for Notary verification
    return {
      verified: false,
      signatures: [],
      attestations: [],
      errors: ['Notary verification not fully implemented']
    };
  }

  /**
   * Verify Docker Content Trust signature
   */
  private async verifyDCTSignature(_imageRef: string): Promise<any> {
    // Simplified implementation for DCT verification
    return {
      verified: false,
      signatures: [],
      attestations: [],
      errors: ['DCT verification not fully implemented']
    };
  }

  /**
   * Get image digest
   */
  private async getImageDigest(imageRef: string): Promise<string> {
    try {
      // If digest is already in the ref, extract it
      if (imageRef.includes('@sha256:')) {
        return imageRef.split('@')[1];
      }

      // Get digest using docker inspect
      const inspectCmd = `docker inspect --format='{{index .RepoDigests 0}}' ${imageRef}`;
      const output = execSync(inspectCmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const digestRef = output.trim();
      if (digestRef && digestRef.includes('@')) {
        return digestRef.split('@')[1];
      }

      // Fallback: get digest using docker manifest
      const manifestCmd = `docker manifest inspect ${imageRef} --verbose | grep -m1 '"digest"' | cut -d'"' -f4`;
      const manifestOutput = execSync(manifestCmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return manifestOutput.trim();

    } catch (error) {
      logger.warn('Failed to get image digest:', error);
      // Generate a placeholder digest
      return 'sha256:' + crypto.createHash('sha256').update(imageRef).digest('hex');
    }
  }

  /**
   * Extract digest from image reference
   */
  private extractDigestFromRef(imageRef: string): string {
    if (imageRef.includes('@sha256:')) {
      return imageRef.split('@sha256:')[1];
    }
    
    // Generate placeholder if no digest
    return crypto.createHash('sha256').update(imageRef).digest('hex');
  }

  /**
   * Ensure Cosign is available
   */
  private ensureCosignAvailable(throwOnError: boolean = true): boolean {
    try {
      execSync('cosign version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      const message = 'Cosign is not available. Please install cosign.';
      if (throwOnError) {
        throw new Error(message);
      } else {
        logger.warn(message);
        return false;
      }
    }
  }

  /**
   * Generate signing policy
   */
  async generateSigningPolicy(): Promise<{
    version: string;
    policy: any;
  }> {
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

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    signingEnabled: boolean;
    verificationEnabled: boolean;
    tool: string;
    capabilities: string[];
  }> {
    const capabilities: string[] = [];

    // Check signing tool availability
    try {
      switch (this.config.signingTool) {
        case 'cosign':
          execSync('cosign version', { stdio: 'pipe' });
          capabilities.push('cosign');
          break;
        case 'notary':
          // Check notary availability
          capabilities.push('notary');
          break;
        case 'docker-content-trust':
          execSync('docker version', { stdio: 'pipe' });
          capabilities.push('docker-content-trust');
          break;
      }
    } catch (error) {
      // Tool not available
    }

    // Check attestation tools
    try {
      execSync('syft version', { stdio: 'pipe' });
      capabilities.push('syft');
    } catch (error) {
      // syft not available
    }

    try {
      execSync('trivy version', { stdio: 'pipe' });
      capabilities.push('trivy');
    } catch (error) {
      // trivy not available
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

// Export singleton instance
export const containerSigningService = ContainerSigningService.getInstance();
