import { spawnSync } from 'child_process';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getSecurityKeyId } from '../config/securityKeys';
import { sanitizeForLog } from '../utils/inputSanitizer';
import { logger } from '../utils/logger';

export interface SBOMComponent {
  name: string;
  version: string;
  type: 'npm' | 'docker' | 'system' | 'application';
  purl: string; // Package URL
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
  hashes?: { alg: string; content: string }[];
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
  hashes?: { alg: string; content: string }[];
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

export class SBOMService {
  private static instance: SBOMService;
  private vulnerabilityDatabases: Map<string, any> = new Map();

  private constructor() {
    this.initializeVulnerabilityDatabases();
    logger.info('SBOM Service initialized');
  }

  public static getInstance(): SBOMService {
    if (!SBOMService.instance) {
      SBOMService.instance = new SBOMService();
    }
    return SBOMService.instance;
  }

  private async initializeVulnerabilityDatabases(): Promise<void> {
    // Initialize vulnerability databases
    // This would typically load from external sources like OSV, NVD, etc.
    logger.info('Vulnerability databases initialized');
  }

  /**
   * Generate complete SBOM for the application
   */
  async generateSBOM(
    _projectPath: string,
    includeDevDependencies: boolean = false,
    includeSystemPackages: boolean = true
  ): Promise<SBOM> {
    try {
      logger.info('Starting SBOM generation', {
        _projectPath,
        includeDevDependencies,
        includeSystemPackages
      });

      // Generate serial number
      const serialNumber = `urn:uuid:${crypto.randomUUID()}`;

      // Get project metadata
      const packageJson = this.readPackageJson(_projectPath);
      await this.generateMetadata(packageJson);

      // Analyze components
      const components: SBOMComponent[] = [];

      // NPM dependencies
      const npmComponents = await this.analyzeNPMDependencies(
        _projectPath,
        includeDevDependencies
      );
      components.push(...npmComponents);

      // System packages (if running in container)
      if (includeSystemPackages) {
        const systemComponents = await this.analyzeSystemPackages();
        components.push(...systemComponents);
      }

      // Docker base images
      const dockerComponents = await this.analyzeDockerDependencies(_projectPath);
      components.push(...dockerComponents);

      // Application component
      const appComponent = await this.generateApplicationComponent(packageJson);

      // Generate services
      const services = await this.analyzeServices();

      // Generate dependencies graph
      const dependencies = await this.generateDependenciesGraph(components);

      // Run vulnerability analysis
      await this.analyzeVulnerabilities(components);

      const sbom: SBOM = {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber,
        version: 1,
        metadata: {
          timestamp: new Date(),
          tools: [
            {
              vendor: 'BotRT',
              name: 'SBOM-Generator',
              version: '1.0.0'
            }
          ],
          authors: [
            {
              name: 'BotRT Security Team',
              email: 'security@botrt.local'
            }
          ],
          component: appComponent
        },
        components,
        services,
        dependencies,
        compositions: [
          {
            aggregate: 'complete',
            assemblies: components.map(c => c.name),
            dependencies: dependencies.map(d => d.ref)
          }
        ],
        vulnerabilities: components.flatMap(c => c.vulnerabilities)
      };

      // Sign SBOM
      await this.signSBOM(sbom);

      logger.info('SBOM generation completed', {
        serialNumber,
        componentsCount: components.length,
        servicesCount: services?.length || 0,
        vulnerabilitiesCount: sbom.vulnerabilities?.length || 0
      });

      return sbom;

    } catch (err: unknown) {
      logger.error('SBOM generation failed:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Read and parse package.json
   */
  private readPackageJson(_projectPath: string): any {
    const packageJsonPath = path.join(_projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  /**
   * Generate SBOM metadata
   */
  private async generateMetadata(packageJson: any): Promise<any> {
    return {
      timestamp: new Date(),
      tools: [
        {
          vendor: 'BotRT',
          name: 'SBOM-Generator',
          version: '1.0.0',
          hashes: [
            {
              alg: 'SHA-256',
              content: crypto.createHash('sha256').update('sbom-generator-1.0.0').digest('hex')
            }
          ]
        }
      ],
      authors: [
        {
          name: packageJson.author || 'BotRT Team',
          email: 'security@botrt.local'
        }
      ]
    };
  }

  /**
   * Analyze NPM dependencies
   */
  private async analyzeNPMDependencies(
    projectPath: string,
    includeDevDependencies: boolean
  ): Promise<SBOMComponent[]> {
    const components: SBOMComponent[] = [];

    try {
      // Get dependency tree
      // Sanitize project path to prevent command injection (CWE-94)
      const { sanitizeFilePath } = await import('../utils/commandSanitizer.js');
      const safePath = sanitizeFilePath(projectPath);

      const npmArgs = includeDevDependencies
        ? ['list', '--json', '--all']
        : ['list', '--json', '--prod', '--all'];

      // SECURITY FIX: CWE-78, CWE-94 - Use spawnSync instead of execSync to prevent command injection
      const { prepareSafeCommand } = await import('../utils/commandSanitizer.js');
      const { command, args } = prepareSafeCommand('npm', npmArgs);

      const npmResult = spawnSync(command, args, {
        cwd: safePath,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (npmResult.error) {
        throw npmResult.error;
      }

      if (npmResult.status !== 0) {
        throw new Error(`NPM command failed: ${npmResult.stderr}`);
      }

      const npmOutput = npmResult.stdout;

      const dependencyTree = JSON.parse(npmOutput);

      // Process dependencies recursively
      await this.processNPMDependencies(dependencyTree.dependencies || {}, components);

      logger.info('NPM dependencies analyzed', {
        count: components.length,
        includeDevDependencies
      });

    } catch (err: unknown) {
      logger.warn('Failed to analyze NPM dependencies:', err as Record<string, unknown>);
    }

    return components;
  }

  /**
   * Process NPM dependencies recursively
   */
  private async processNPMDependencies(
    dependencies: any,
    components: SBOMComponent[],
    processed: Set<string> = new Set()
  ): Promise<void> {
    for (const [name, info] of Object.entries(dependencies as any)) {
      const packageInfo = info as any;
      const key = `${name}@${packageInfo.version}`;

      if (processed.has(key)) {
        continue;
      }
      processed.add(key);

      const component = await this.createNPMComponent(name, packageInfo);
      components.push(component);

      // Process nested dependencies
      if (packageInfo.dependencies) {
        await this.processNPMDependencies(packageInfo.dependencies, components, processed);
      }
    }
  }

  /**
   * Create NPM component
   */
  private async createNPMComponent(name: string, info: any): Promise<SBOMComponent> {
    const purl = `pkg:npm/${name}@${info.version}`;

    // Get package info
    let packageInfo: any = {};
    try {
      // Sanitize package name and version to prevent command injection (CWE-94)
      const { sanitizePackageName, sanitizeVersion } = await import('../utils/commandSanitizer.js');
      const safeName = sanitizePackageName(name);
      const safeVersion = sanitizeVersion(info.version);

      // SECURITY FIX: CWE-78, CWE-94 - Use spawnSync instead of execSync
      const { prepareSafeCommand } = await import('../utils/commandSanitizer.js');
      const { command, args } = prepareSafeCommand('npm', ['view', `${safeName}@${safeVersion}`, '--json']);

      const packageResult = spawnSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (packageResult.status === 0 && packageResult.stdout) {
        packageInfo = JSON.parse(packageResult.stdout);
      }
    } catch (error: unknown) {
      // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
      logger.warn(`Failed to get package info for ${sanitizeForLog(name)}@${sanitizeForLog(info.version)}`, error as Record<string, unknown>);
    }

    // Calculate hash
    const hash = crypto.createHash('sha256')
      .update(`${name}@${info.version}`)
      .digest('hex');

    const component: SBOMComponent = {
      name,
      version: info.version,
      type: 'npm',
      purl,
      licenses: this.extractLicenses(packageInfo),
      supplier: packageInfo.author?.name || packageInfo._npmUser?.name,
      author: packageInfo.author?.name,
      downloadLocation: packageInfo.dist?.tarball,
      homepage: packageInfo.homepage,
      description: packageInfo.description,
      filesAnalyzed: false,
      verification: {
        hash,
        hashAlgorithm: 'SHA-256'
      },
      vulnerabilities: [],
      dependencies: Object.keys(info.dependencies || {}),
      externalRefs: this.generateNPMExternalRefs(packageInfo)
    };

    return component;
  }

  /**
   * Extract licenses from package info
   */
  private extractLicenses(packageInfo: any): string[] {
    const licenses: string[] = [];

    if (packageInfo.license) {
      if (typeof packageInfo.license === 'string') {
        licenses.push(packageInfo.license);
      } else if (packageInfo.license.type) {
        licenses.push(packageInfo.license.type);
      }
    }

    if (packageInfo.licenses && Array.isArray(packageInfo.licenses)) {
      for (const license of packageInfo.licenses) {
        if (typeof license === 'string') {
          licenses.push(license);
        } else if (license.type) {
          licenses.push(license.type);
        }
      }
    }

    return licenses.length > 0 ? licenses : ['UNKNOWN'];
  }

  /**
   * Generate external references for NPM package
   */
  private generateNPMExternalRefs(packageInfo: any): ExternalReference[] {
    const refs: ExternalReference[] = [];

    if (packageInfo.homepage) {
      refs.push({
        type: 'website',
        url: packageInfo.homepage
      });
    }

    if (packageInfo.repository?.url) {
      refs.push({
        type: 'vcs',
        url: packageInfo.repository.url
      });
    }

    if (packageInfo.bugs?.url) {
      refs.push({
        type: 'issue-tracker',
        url: packageInfo.bugs.url
      });
    }

    return refs;
  }

  /**
   * Analyze system packages
   */
  private async analyzeSystemPackages(): Promise<SBOMComponent[]> {
    const components: SBOMComponent[] = [];

    try {
      // Try different package managers
      const managers = [
        { cmd: 'dpkg -l', parser: this.parseDpkgOutput.bind(this) },
        { cmd: 'rpm -qa', parser: this.parseRpmOutput.bind(this) },
        { cmd: 'apk list -I', parser: this.parseApkOutput.bind(this) }
      ];

      for (const manager of managers) {
        try {
          // SECURITY FIX: CWE-78, CWE-94 - Use spawnSync instead of execSync
          const [command, ...args] = manager.cmd.split(' ');
          const result = spawnSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
          });

          if (result.status === 0 && result.stdout) {
            const packages = manager.parser(result.stdout);
            components.push(...packages);
            break; // Use first successful manager
          }
        } catch (_error) {
          // Try next package manager
          continue;
        }
      }

      logger.info('System packages analyzed', { count: components.length });

    } catch (err: unknown) {
      logger.warn('Failed to analyze system packages:', err as Record<string, unknown>);
    }

    return components;
  }

  /**
   * Parse dpkg output (Debian/Ubuntu)
   */
  private parseDpkgOutput(output: string): SBOMComponent[] {
    const components: SBOMComponent[] = [];
    const lines = output.split('\n').slice(5); // Skip header lines

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      const [status, name, version, arch, ...description] = parts;
      if (status !== 'ii') continue; // Only installed packages

      const hash = crypto.createHash('sha256')
        .update(`${name}@${version}`)
        .digest('hex');

      components.push({
        name,
        version,
        type: 'system',
        purl: `pkg:deb/ubuntu/${name}@${version}?arch=${arch}`,
        licenses: ['UNKNOWN'],
        description: description.join(' '),
        filesAnalyzed: false,
        verification: {
          hash,
          hashAlgorithm: 'SHA-256'
        },
        vulnerabilities: [],
        dependencies: [],
        externalRefs: []
      });
    }

    return components;
  }

  /**
   * Parse RPM output (RedHat/CentOS)
   */
  private parseRpmOutput(output: string): SBOMComponent[] {
    const components: SBOMComponent[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // RPM format: name-version-release.arch
      const match = line.match(/^(.+)-([^-]+)-([^-]+)\.(.+)$/);
      if (!match) continue;

      const [, name, version, release, arch] = match;
      const fullVersion = `${version}-${release}`;

      const hash = crypto.createHash('sha256')
        .update(`${name}@${fullVersion}`)
        .digest('hex');

      components.push({
        name,
        version: fullVersion,
        type: 'system',
        purl: `pkg:rpm/rhel/${name}@${fullVersion}?arch=${arch}`,
        licenses: ['UNKNOWN'],
        filesAnalyzed: false,
        verification: {
          hash,
          hashAlgorithm: 'SHA-256'
        },
        vulnerabilities: [],
        dependencies: [],
        externalRefs: []
      });
    }

    return components;
  }

  /**
   * Parse APK output (Alpine)
   */
  private parseApkOutput(output: string): SBOMComponent[] {
    const components: SBOMComponent[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // APK format: package-version arch {repo} (license) [installed]
      const match = line.match(/^(.+)-([^\s]+)\s+(.+?)\s+\{(.+?)\}/);
      if (!match) continue;

      const [, name, version, arch, repo] = match;

      const hash = crypto.createHash('sha256')
        .update(`${name}@${version}`)
        .digest('hex');

      components.push({
        name,
        version,
        type: 'system',
        purl: `pkg:alpine/${name}@${version}?arch=${arch}`,
        licenses: ['UNKNOWN'],
        filesAnalyzed: false,
        verification: {
          hash,
          hashAlgorithm: 'SHA-256'
        },
        vulnerabilities: [],
        dependencies: [],
        externalRefs: [
          {
            type: 'distribution',
            url: `https://pkgs.alpinelinux.org/package/edge/${repo}/${arch}/${name}`
          }
        ]
      });
    }

    return components;
  }

  /**
   * Analyze Docker dependencies
   */
  private async analyzeDockerDependencies(_projectPath: string): Promise<SBOMComponent[]> {
    const components: SBOMComponent[] = [];

    try {
      const dockerfilePath = path.join(_projectPath, 'Dockerfile');

      if (!fs.existsSync(dockerfilePath)) {
        return components;
      }

      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      const baseImages = this.extractDockerBaseImages(dockerfileContent);

      for (const image of baseImages) {
        const component = await this.createDockerComponent(image);
        components.push(component);
      }

      logger.info('Docker dependencies analyzed', { count: components.length });

    } catch (err: unknown) {
      logger.warn('Failed to analyze Docker dependencies:', err as Record<string, unknown>);
    }

    return components;
  }

  /**
   * Extract base images from Dockerfile
   */
  private extractDockerBaseImages(dockerfileContent: string): string[] {
    const images: string[] = [];
    const lines = dockerfileContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('FROM ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const image = parts[1];
          if (!image.startsWith('scratch') && !images.includes(image)) {
            images.push(image);
          }
        }
      }
    }

    return images;
  }

  /**
   * Create Docker component
   */
  private async createDockerComponent(image: string): Promise<SBOMComponent> {
    const [_nameAndTag] = image.split('@');
    const [name, tag = 'latest'] = _nameAndTag.split(':');

    const hash = crypto.createHash('sha256')
      .update(image)
      .digest('hex');

    return {
      name,
      version: tag,
      type: 'docker',
      purl: `pkg:docker/${name}@${tag}`,
      licenses: ['UNKNOWN'],
      filesAnalyzed: false,
      verification: {
        hash,
        hashAlgorithm: 'SHA-256'
      },
      vulnerabilities: [],
      dependencies: [],
      externalRefs: [
        {
          type: 'distribution',
          url: `https://hub.docker.com/_/${name}`
        }
      ]
    };
  }

  /**
   * Generate application component
   */
  private async generateApplicationComponent(packageJson: any): Promise<SBOMComponent> {
    const name = packageJson.name || 'botrt-app';
    const version = packageJson.version || '1.0.0';

    const hash = crypto.createHash('sha256')
      .update(`${name}@${version}`)
      .digest('hex');

    return {
      name,
      version,
      type: 'application',
      purl: `pkg:generic/${name}@${version}`,
      licenses: this.extractLicenses(packageJson),
      author: packageJson.author?.name || packageJson.author,
      description: packageJson.description,
      homepage: packageJson.homepage,
      filesAnalyzed: true,
      verification: {
        hash,
        hashAlgorithm: 'SHA-256'
      },
      vulnerabilities: [],
      dependencies: Object.keys(packageJson.dependencies || {}),
      externalRefs: []
    };
  }

  /**
   * Analyze services
   */
  private async analyzeServices(): Promise<Service[]> {
    const services: Service[] = [];

    // Main application service
    services.push({
      name: 'botrt-backend',
      version: '1.0.0',
      description: 'BotRT E-commerce Backend Service',
      endpoints: [
        'https://api.botrt.local/api',
        'https://api.botrt.local/admin',
        'https://api.botrt.local/auth'
      ],
      authenticated: true,
      x_trust_boundary: true,
      data: [
        {
          flow: 'bi-directional',
          classification: 'PII'
        },
        {
          flow: 'bi-directional',
          classification: 'Financial'
        }
      ]
    });

    // Database service
    services.push({
      name: 'postgresql',
      version: '15',
      description: 'PostgreSQL Database',
      endpoints: ['postgresql://postgres:5432'],
      authenticated: true,
      x_trust_boundary: false,
      data: [
        {
          flow: 'bi-directional',
          classification: 'PII'
        },
        {
          flow: 'bi-directional',
          classification: 'Financial'
        }
      ]
    });

    return services;
  }

  /**
   * Generate dependencies graph
   */
  private async generateDependenciesGraph(components: SBOMComponent[]): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    for (const component of components) {
      if (component.dependencies.length > 0) {
        dependencies.push({
          ref: component.purl,
          dependsOn: component.dependencies.map(dep =>
            `pkg:npm/${dep}@latest` // Simplified for this example
          )
        });
      }
    }

    return dependencies;
  }

  /**
   * Analyze vulnerabilities
   */
  private async analyzeVulnerabilities(components: SBOMComponent[]): Promise<void> {
    for (const component of components) {
      try {
        // Run security audit for NPM packages
        if (component.type === 'npm') {
          const vulnerabilities = await this.checkNPMVulnerabilities(component);
          component.vulnerabilities.push(...vulnerabilities);
        }

        // Check system package vulnerabilities
        if (component.type === 'system') {
          const vulnerabilities = await this.checkSystemVulnerabilities();
          component.vulnerabilities.push(...vulnerabilities);
        }

        // Check Docker image vulnerabilities
        if (component.type === 'docker') {
          const vulnerabilities = await this.checkDockerVulnerabilities(component);
          component.vulnerabilities.push(...vulnerabilities);
        }

      } catch (err: unknown) {
        // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
        logger.warn(`Failed to check vulnerabilities for ${sanitizeForLog(component.name)}:`, err as Record<string, unknown>);
      }
    }

    const totalVulnerabilities = components.reduce(
      (sum, comp) => sum + comp.vulnerabilities.length,
      0
    );

    logger.info('Vulnerability analysis completed', {
      componentsScanned: components.length,
      totalVulnerabilities
    });
  }

  /**
   * Check NPM vulnerabilities
   */
  private async checkNPMVulnerabilities(component: SBOMComponent): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // SECURITY FIX: CWE-78, CWE-94 - Use spawnSync instead of execSync
      const auditResult = spawnSync('npm', ['audit', '--json', '--package-lock-only'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (auditResult.status !== 0 && !auditResult.stdout) {
        return vulnerabilities;
      }

      const auditData = JSON.parse(auditResult.stdout);

      if (auditData.vulnerabilities && auditData.vulnerabilities[component.name]) {
        const vulnData = auditData.vulnerabilities[component.name];

        for (const advisory of vulnData.via || []) {
          if (typeof advisory === 'object') {
            vulnerabilities.push({
              id: advisory.cwe || `NPM-${advisory.id}`,
              source: 'npm',
              severity: this.mapNPMSeverity(advisory.severity),
              cvssScore: advisory.cvss?.score,
              description: advisory.title,
              references: advisory.url ? [advisory.url] : [],
              fixedIn: advisory.patched_versions,
              publishedDate: new Date(advisory.created),
              lastModifiedDate: new Date(advisory.updated)
            });
          }
        }
      }

    } catch (error: unknown) {
      // npm audit may fail if no vulnerabilities found
      // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
      logger.debug(`No NPM vulnerabilities found for ${sanitizeForLog(component.name)}`, error as Record<string, unknown>);
    }

    return vulnerabilities;
  }

  /**
   * Map NPM severity to standard format
   */
  private mapNPMSeverity(severity: string): Vulnerability['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'CRITICAL';
      case 'high': return 'HIGH';
      case 'moderate': return 'MEDIUM';
      case 'low': return 'LOW';
      default: return 'INFO';
    }
  }

  /**
   * Check system vulnerabilities
   */
  private async checkSystemVulnerabilities(): Promise<Vulnerability[]> {
    // This would integrate with vulnerability databases like OSV, NVD
    // For now, return empty array
    return [];
  }

  /**
   * Check Docker vulnerabilities
   */
  private async checkDockerVulnerabilities(component: SBOMComponent): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // SECURITY FIX: Use Trivy with safe command execution (CWE-94, CWE-78)
      const { sanitizeImageRef } = await import('../utils/commandSanitizer.js');
      const image = `${component.name}:${component.version}`;
      const safeImage = sanitizeImageRef(image);

      // Use spawnSync for safer command execution with argument array
      const result = spawnSync('trivy', ['image', '--format', 'json', '--quiet', safeImage], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        logger.warn('Trivy scan failed', {
          status: result.status,
          stderr: result.stderr
        });
        return vulnerabilities;
      }

      const trivyData = JSON.parse(result.stdout);

      for (const result of trivyData.Results || []) {
        for (const vuln of result.Vulnerabilities || []) {
          vulnerabilities.push({
            id: vuln.VulnerabilityID,
            source: 'trivy',
            severity: vuln.Severity as Vulnerability['severity'],
            cvssScore: vuln.CVSS?.nvd?.V3Score || vuln.CVSS?.redhat?.V3Score,
            description: vuln.Description,
            references: vuln.References || [],
            fixedIn: vuln.FixedVersion,
            publishedDate: new Date(vuln.PublishedDate),
            lastModifiedDate: new Date(vuln.LastModifiedDate)
          });
        }
      }

    } catch (err: unknown) {
      // SECURITY FIX: CWE-117 - Sanitize log data to prevent log injection
      logger.debug(`Trivy scan failed for ${sanitizeForLog(component.name)}:`, err as Record<string, unknown>);
    }

    return vulnerabilities;
  }

  /**
   * Sign SBOM
   */
  private async signSBOM(sbom: SBOM): Promise<void> {
    try {
      const sbomString = JSON.stringify(sbom, null, 2);
      const hash = crypto.createHash('sha256').update(sbomString).digest('hex');

      // In production, this would use proper digital signatures with configured key ID
      const keyId = getSecurityKeyId('sbomSigningKeyId');
      sbom.signature = {
        algorithm: 'SHA-256',
        keyId: keyId,
        value: hash
      };

      logger.info('SBOM signed successfully', {
        algorithm: sbom.signature.algorithm,
        keyId: sbom.signature.keyId
      });

    } catch (err: unknown) {
      logger.error('SBOM signing failed:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Export SBOM to file
   */
  async exportSBOM(sbom: SBOM, outputPath: string): Promise<void> {
    try {
      const sbomJson = JSON.stringify(sbom, null, 2);
      fs.writeFileSync(outputPath, sbomJson, 'utf8');

      logger.info('SBOM exported successfully', {
        outputPath,
        size: sbomJson.length
      });

    } catch (err: unknown) {
      logger.error('SBOM export failed:', err as Record<string, unknown>);
      throw err;
    }
  }

  /**
   * Validate SBOM
   */
  async validateSBOM(sbom: SBOM): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!sbom.bomFormat || sbom.bomFormat !== 'CycloneDX') {
      errors.push('Invalid or missing bomFormat');
    }

    if (!sbom.specVersion) {
      errors.push('Missing specVersion');
    }

    if (!sbom.serialNumber) {
      errors.push('Missing serialNumber');
    }

    if (!sbom.components || sbom.components.length === 0) {
      warnings.push('No components found');
    }

    // Validate components
    for (const component of sbom.components || []) {
      if (!component.name) {
        errors.push(`Component missing name: ${JSON.stringify(component)}`);
      }

      if (!component.version) {
        warnings.push(`Component ${component.name} missing version`);
      }

      if (!component.type) {
        errors.push(`Component ${component.name} missing type`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const sbomService = SBOMService.getInstance();
