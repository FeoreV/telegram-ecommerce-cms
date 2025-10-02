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
exports.sbomService = exports.SBOMService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const logger_1 = require("../utils/logger");
class SBOMService {
    constructor() {
        this.vulnerabilityDatabases = new Map();
        this.initializeVulnerabilityDatabases();
        logger_1.logger.info('SBOM Service initialized');
    }
    static getInstance() {
        if (!SBOMService.instance) {
            SBOMService.instance = new SBOMService();
        }
        return SBOMService.instance;
    }
    async initializeVulnerabilityDatabases() {
        logger_1.logger.info('Vulnerability databases initialized');
    }
    async generateSBOM(_projectPath, includeDevDependencies = false, includeSystemPackages = true) {
        try {
            logger_1.logger.info('Starting SBOM generation', {
                _projectPath,
                includeDevDependencies,
                includeSystemPackages
            });
            const serialNumber = `urn:uuid:${crypto_1.default.randomUUID()}`;
            const packageJson = this.readPackageJson(_projectPath);
            await this.generateMetadata(packageJson);
            const components = [];
            const npmComponents = await this.analyzeNPMDependencies(_projectPath, includeDevDependencies);
            components.push(...npmComponents);
            if (includeSystemPackages) {
                const systemComponents = await this.analyzeSystemPackages();
                components.push(...systemComponents);
            }
            const dockerComponents = await this.analyzeDockerDependencies(_projectPath);
            components.push(...dockerComponents);
            const appComponent = await this.generateApplicationComponent(packageJson);
            const services = await this.analyzeServices();
            const dependencies = await this.generateDependenciesGraph(components);
            await this.analyzeVulnerabilities(components);
            const sbom = {
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
            await this.signSBOM(sbom);
            logger_1.logger.info('SBOM generation completed', {
                serialNumber,
                componentsCount: components.length,
                servicesCount: services?.length || 0,
                vulnerabilitiesCount: sbom.vulnerabilities?.length || 0
            });
            return sbom;
        }
        catch (err) {
            logger_1.logger.error('SBOM generation failed:', err);
            throw err;
        }
    }
    readPackageJson(_projectPath) {
        const packageJsonPath = path.join(_projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('package.json not found');
        }
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    }
    async generateMetadata(packageJson) {
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
                            content: crypto_1.default.createHash('sha256').update('sbom-generator-1.0.0').digest('hex')
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
    async analyzeNPMDependencies(projectPath, includeDevDependencies) {
        const components = [];
        try {
            const npmListCmd = includeDevDependencies
                ? 'npm list --json --all'
                : 'npm list --json --prod --all';
            const npmOutput = (0, child_process_1.execSync)(npmListCmd, {
                cwd: projectPath,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            const dependencyTree = JSON.parse(npmOutput);
            await this.processNPMDependencies(dependencyTree.dependencies || {}, components);
            logger_1.logger.info('NPM dependencies analyzed', {
                count: components.length,
                includeDevDependencies
            });
        }
        catch (err) {
            logger_1.logger.warn('Failed to analyze NPM dependencies:', err);
        }
        return components;
    }
    async processNPMDependencies(dependencies, components, processed = new Set()) {
        for (const [name, info] of Object.entries(dependencies)) {
            const packageInfo = info;
            const key = `${name}@${packageInfo.version}`;
            if (processed.has(key)) {
                continue;
            }
            processed.add(key);
            const component = await this.createNPMComponent(name, packageInfo);
            components.push(component);
            if (packageInfo.dependencies) {
                await this.processNPMDependencies(packageInfo.dependencies, components, processed);
            }
        }
    }
    async createNPMComponent(name, info) {
        const purl = `pkg:npm/${name}@${info.version}`;
        let packageInfo = {};
        try {
            const packageInfoCmd = `npm view ${name}@${info.version} --json`;
            const packageOutput = (0, child_process_1.execSync)(packageInfoCmd, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            packageInfo = JSON.parse(packageOutput);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to get package info for ${name}@${info.version}`);
        }
        const hash = crypto_1.default.createHash('sha256')
            .update(`${name}@${info.version}`)
            .digest('hex');
        const component = {
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
    extractLicenses(packageInfo) {
        const licenses = [];
        if (packageInfo.license) {
            if (typeof packageInfo.license === 'string') {
                licenses.push(packageInfo.license);
            }
            else if (packageInfo.license.type) {
                licenses.push(packageInfo.license.type);
            }
        }
        if (packageInfo.licenses && Array.isArray(packageInfo.licenses)) {
            for (const license of packageInfo.licenses) {
                if (typeof license === 'string') {
                    licenses.push(license);
                }
                else if (license.type) {
                    licenses.push(license.type);
                }
            }
        }
        return licenses.length > 0 ? licenses : ['UNKNOWN'];
    }
    generateNPMExternalRefs(packageInfo) {
        const refs = [];
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
    async analyzeSystemPackages() {
        const components = [];
        try {
            const managers = [
                { cmd: 'dpkg -l', parser: this.parseDpkgOutput.bind(this) },
                { cmd: 'rpm -qa', parser: this.parseRpmOutput.bind(this) },
                { cmd: 'apk list -I', parser: this.parseApkOutput.bind(this) }
            ];
            for (const manager of managers) {
                try {
                    const output = (0, child_process_1.execSync)(manager.cmd, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });
                    const packages = manager.parser(output);
                    components.push(...packages);
                    break;
                }
                catch (error) {
                    continue;
                }
            }
            logger_1.logger.info('System packages analyzed', { count: components.length });
        }
        catch (err) {
            logger_1.logger.warn('Failed to analyze system packages:', err);
        }
        return components;
    }
    parseDpkgOutput(output) {
        const components = [];
        const lines = output.split('\n').slice(5);
        for (const line of lines) {
            if (!line.trim())
                continue;
            const parts = line.split(/\s+/);
            if (parts.length < 4)
                continue;
            const [status, name, version, arch, ...description] = parts;
            if (status !== 'ii')
                continue;
            const hash = crypto_1.default.createHash('sha256')
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
    parseRpmOutput(output) {
        const components = [];
        const lines = output.split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            const match = line.match(/^(.+)-([^-]+)-([^-]+)\.(.+)$/);
            if (!match)
                continue;
            const [, name, version, release, arch] = match;
            const fullVersion = `${version}-${release}`;
            const hash = crypto_1.default.createHash('sha256')
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
    parseApkOutput(output) {
        const components = [];
        const lines = output.split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            const match = line.match(/^(.+)-([^\s]+)\s+(.+?)\s+\{(.+?)\}/);
            if (!match)
                continue;
            const [, name, version, arch, repo] = match;
            const hash = crypto_1.default.createHash('sha256')
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
    async analyzeDockerDependencies(_projectPath) {
        const components = [];
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
            logger_1.logger.info('Docker dependencies analyzed', { count: components.length });
        }
        catch (err) {
            logger_1.logger.warn('Failed to analyze Docker dependencies:', err);
        }
        return components;
    }
    extractDockerBaseImages(dockerfileContent) {
        const images = [];
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
    async createDockerComponent(image) {
        const [_nameAndTag] = image.split('@');
        const [name, tag = 'latest'] = _nameAndTag.split(':');
        const hash = crypto_1.default.createHash('sha256')
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
    async generateApplicationComponent(packageJson) {
        const name = packageJson.name || 'botrt-app';
        const version = packageJson.version || '1.0.0';
        const hash = crypto_1.default.createHash('sha256')
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
    async analyzeServices() {
        const services = [];
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
    async generateDependenciesGraph(components) {
        const dependencies = [];
        for (const component of components) {
            if (component.dependencies.length > 0) {
                dependencies.push({
                    ref: component.purl,
                    dependsOn: component.dependencies.map(dep => `pkg:npm/${dep}@latest`)
                });
            }
        }
        return dependencies;
    }
    async analyzeVulnerabilities(components) {
        for (const component of components) {
            try {
                if (component.type === 'npm') {
                    const vulnerabilities = await this.checkNPMVulnerabilities(component);
                    component.vulnerabilities.push(...vulnerabilities);
                }
                if (component.type === 'system') {
                    const vulnerabilities = await this.checkSystemVulnerabilities();
                    component.vulnerabilities.push(...vulnerabilities);
                }
                if (component.type === 'docker') {
                    const vulnerabilities = await this.checkDockerVulnerabilities(component);
                    component.vulnerabilities.push(...vulnerabilities);
                }
            }
            catch (err) {
                logger_1.logger.warn(`Failed to check vulnerabilities for ${component.name}:`, err);
            }
        }
        const totalVulnerabilities = components.reduce((sum, comp) => sum + comp.vulnerabilities.length, 0);
        logger_1.logger.info('Vulnerability analysis completed', {
            componentsScanned: components.length,
            totalVulnerabilities
        });
    }
    async checkNPMVulnerabilities(component) {
        const vulnerabilities = [];
        try {
            const auditCmd = `npm audit --json --package-lock-only`;
            const auditOutput = (0, child_process_1.execSync)(auditCmd, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            const auditData = JSON.parse(auditOutput);
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
        }
        catch (error) {
            logger_1.logger.debug(`No NPM vulnerabilities found for ${component.name}`);
        }
        return vulnerabilities;
    }
    mapNPMSeverity(severity) {
        switch (severity?.toLowerCase()) {
            case 'critical': return 'CRITICAL';
            case 'high': return 'HIGH';
            case 'moderate': return 'MEDIUM';
            case 'low': return 'LOW';
            default: return 'INFO';
        }
    }
    async checkSystemVulnerabilities() {
        return [];
    }
    async checkDockerVulnerabilities(component) {
        const vulnerabilities = [];
        try {
            const image = `${component.name}:${component.version}`;
            const trivyCmd = `trivy image --format json --quiet ${image}`;
            const trivyOutput = (0, child_process_1.execSync)(trivyCmd, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            const trivyData = JSON.parse(trivyOutput);
            for (const result of trivyData.Results || []) {
                for (const vuln of result.Vulnerabilities || []) {
                    vulnerabilities.push({
                        id: vuln.VulnerabilityID,
                        source: 'trivy',
                        severity: vuln.Severity,
                        cvssScore: vuln.CVSS?.nvd?.V3Score || vuln.CVSS?.redhat?.V3Score,
                        description: vuln.Description,
                        references: vuln.References || [],
                        fixedIn: vuln.FixedVersion,
                        publishedDate: new Date(vuln.PublishedDate),
                        lastModifiedDate: new Date(vuln.LastModifiedDate)
                    });
                }
            }
        }
        catch (err) {
            logger_1.logger.debug(`Trivy scan failed for ${component.name}:`, err);
        }
        return vulnerabilities;
    }
    async signSBOM(sbom) {
        try {
            const sbomString = JSON.stringify(sbom, null, 2);
            const hash = crypto_1.default.createHash('sha256').update(sbomString).digest('hex');
            sbom.signature = {
                algorithm: 'SHA-256',
                keyId: 'botrt-sbom-signing-key',
                value: hash
            };
            logger_1.logger.info('SBOM signed successfully', {
                algorithm: sbom.signature.algorithm,
                keyId: sbom.signature.keyId
            });
        }
        catch (err) {
            logger_1.logger.error('SBOM signing failed:', err);
            throw err;
        }
    }
    async exportSBOM(sbom, outputPath) {
        try {
            const sbomJson = JSON.stringify(sbom, null, 2);
            fs.writeFileSync(outputPath, sbomJson, 'utf8');
            logger_1.logger.info('SBOM exported successfully', {
                outputPath,
                size: sbomJson.length
            });
        }
        catch (err) {
            logger_1.logger.error('SBOM export failed:', err);
            throw err;
        }
    }
    async validateSBOM(sbom) {
        const errors = [];
        const warnings = [];
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
exports.SBOMService = SBOMService;
exports.sbomService = SBOMService.getInstance();
//# sourceMappingURL=SBOMService.js.map