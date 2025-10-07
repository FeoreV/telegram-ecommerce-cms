import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../backend/src/utils/logger';

const execAsync = promisify(exec);

export enum VulnerabilityType {
  INJECTION = 'injection',
  BROKEN_AUTH = 'broken_authentication',
  SENSITIVE_DATA = 'sensitive_data_exposure',
  XXE = 'xml_external_entities',
  BROKEN_ACCESS_CONTROL = 'broken_access_control',
  SECURITY_MISCONFIG = 'security_misconfiguration',
  XSS = 'cross_site_scripting',
  INSECURE_DESERIALIZATION = 'insecure_deserialization',
  VULNERABLE_COMPONENTS = 'vulnerable_components',
  INSUFFICIENT_LOGGING = 'insufficient_logging'
}

export enum SeverityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'informational'
}

export interface PenetrationTestConfig {
  target: {
    baseUrl: string;
    scope: string[];
    excludedPaths: string[];
  };
  
  authentication: {
    method: 'jwt' | 'session' | 'api_key';
    credentials: {
      username?: string;
      password?: string;
      apiKey?: string;
      token?: string;
    };
  };
  
  testSuites: {
    owasp: boolean;
    authentication: boolean;
    authorization: boolean;
    injection: boolean;
    xss: boolean;
    csrf: boolean;
    businessLogic: boolean;
    infrastructure: boolean;
  };
  
  tools: {
    zap: boolean;
    nuclei: boolean;
    sqlmap: boolean;
    dirb: boolean;
    nmap: boolean;
    custom: boolean;
  };
  
  reporting: {
    format: 'json' | 'xml' | 'html' | 'pdf';
    outputPath: string;
    includeProofOfConcept: boolean;
    includeMitigations: boolean;
  };
  
  limits: {
    maxDuration: number; // minutes
    maxRequests: number;
    respectRateLimit: boolean;
    delayBetweenRequests: number; // milliseconds
  };
}

export interface Vulnerability {
  id: string;
  type: VulnerabilityType;
  severity: SeverityLevel;
  title: string;
  description: string;
  url: string;
  method: string;
  parameter?: string;
  payload?: string;
  evidence: {
    request: string;
    response: string;
    screenshot?: string;
  };
  impact: string;
  remediation: string;
  references: string[];
  cve?: string;
  cvss?: number;
  discoveredAt: Date;
  discoveredBy: string;
}

export interface PenetrationTestResult {
  testId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  
  summary: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
    infoVulnerabilities: number;
  };
  
  vulnerabilities: Vulnerability[];
  
  coverage: {
    urlsTested: number;
    endpointsCovered: number;
    parametersAnalyzed: number;
    formsAnalyzed: number;
  };
  
  tools: {
    toolName: string;
    version: string;
    executionTime: number;
    findings: number;
  }[];
  
  metadata: {
    targetUrl: string;
    testConfiguration: PenetrationTestConfig;
    executedBy: string;
    testEnvironment: string;
  };
}

export class PenetrationTestFramework {
  private config: PenetrationTestConfig;
  private vulnerabilities: Vulnerability[] = [];
  private testResults: Map<string, any> = new Map();

  constructor(config: PenetrationTestConfig) {
    this.config = config;
  }

  /**
   * Execute comprehensive penetration test
   */
  async executePenetrationTest(): Promise<PenetrationTestResult> {
    const testId = crypto.randomUUID();
    const startTime = new Date();

    logger.info('Starting penetration test', {
      testId,
      target: this.config.target.baseUrl,
      suites: Object.keys(this.config.testSuites).filter(key => this.config.testSuites[key])
    });

    try {
      // Phase 1: Reconnaissance and Information Gathering
      if (this.config.testSuites.infrastructure) {
        await this.performReconnaissance();
      }

      // Phase 2: Vulnerability Scanning
      await this.performVulnerabilityScanning();

      // Phase 3: Authentication and Authorization Testing
      if (this.config.testSuites.authentication || this.config.testSuites.authorization) {
        await this.performAuthenticationTesting();
      }

      // Phase 4: Injection Testing
      if (this.config.testSuites.injection) {
        await this.performInjectionTesting();
      }

      // Phase 5: Cross-Site Scripting Testing
      if (this.config.testSuites.xss) {
        await this.performXSSTesting();
      }

      // Phase 6: CSRF Testing
      if (this.config.testSuites.csrf) {
        await this.performCSRFTesting();
      }

      // Phase 7: Business Logic Testing
      if (this.config.testSuites.businessLogic) {
        await this.performBusinessLogicTesting();
      }

      // Phase 8: OWASP Top 10 Testing
      if (this.config.testSuites.owasp) {
        await this.performOWASPTesting();
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: PenetrationTestResult = {
        testId,
        startTime,
        endTime,
        duration,
        summary: this.generateSummary(),
        vulnerabilities: this.vulnerabilities,
        coverage: this.calculateCoverage(),
        tools: this.getToolResults(),
        metadata: {
          targetUrl: this.config.target.baseUrl,
          testConfiguration: this.config,
          executedBy: 'PenetrationTestFramework',
          testEnvironment: process.env.NODE_ENV || 'test'
        }
      };

      // Generate report
      await this.generateReport(result);

      logger.info('Penetration test completed', {
        testId,
        duration,
        vulnerabilities: this.vulnerabilities.length,
        critical: result.summary.criticalVulnerabilities,
        high: result.summary.highVulnerabilities
      });

      return result;

    } catch (error) {
      logger.error('Penetration test failed', { testId, error: error.message });
      throw error;
    }
  }

  /**
   * Phase 1: Reconnaissance and Information Gathering
   */
  private async performReconnaissance(): Promise<void> {
    logger.info('Starting reconnaissance phase');

    try {
      // Port scanning with nmap
      if (this.config.tools.nmap) {
        await this.executeNmapScan();
      }

      // Directory and file discovery
      if (this.config.tools.dirb) {
        await this.executeDirectoryBruteforce();
      }

      // SSL/TLS testing
      await this.performSSLTesting();

      // HTTP headers analysis
      await this.analyzeSecurityHeaders();

    } catch (error) {
      logger.error('Reconnaissance phase failed', { error: error.message });
    }
  }

  private async executeNmapScan(): Promise<void> {
    try {
      const targetHost = new URL(this.config.target.baseUrl).hostname;
      const { stdout } = await execAsync(`nmap -sV -sC -O ${targetHost} -oX nmap_results.xml`);
      
      // Parse nmap results and identify vulnerabilities
      await this.parseNmapResults('nmap_results.xml');
      
    } catch (error) {
      logger.warn('Nmap scan failed', { error: error.message });
    }
  }

  private async executeDirectoryBruteforce(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `dirb ${this.config.target.baseUrl} /usr/share/dirb/wordlists/common.txt -o dirb_results.txt`
      );
      
      await this.parseDirbResults('dirb_results.txt');
      
    } catch (error) {
      logger.warn('Directory bruteforce failed', { error: error.message });
    }
  }

  private async performSSLTesting(): Promise<void> {
    try {
      const targetHost = new URL(this.config.target.baseUrl).hostname;
      const { stdout } = await execAsync(`sslscan ${targetHost}`);
      
      // Analyze SSL/TLS configuration
      if (stdout.includes('SSLv2') || stdout.includes('SSLv3')) {
        this.addVulnerability({
          type: VulnerabilityType.SECURITY_MISCONFIG,
          severity: SeverityLevel.HIGH,
          title: 'Insecure SSL/TLS Protocol Versions',
          description: 'Server supports deprecated SSL/TLS protocol versions',
          url: this.config.target.baseUrl,
          method: 'SSL/TLS',
          evidence: { request: 'SSL scan', response: stdout.substring(0, 500) },
          impact: 'Man-in-the-middle attacks, data interception',
          remediation: 'Disable SSLv2, SSLv3, and weak TLS versions. Use TLS 1.2+',
          references: ['https://owasp.org/www-project-transport-layer-protection-cheat-sheet/']
        });
      }

    } catch (error) {
      logger.warn('SSL testing failed', { error: error.message });
    }
  }

  private async analyzeSecurityHeaders(): Promise<void> {
    try {
      const response = await fetch(this.config.target.baseUrl, { method: 'HEAD' });
      const headers = Object.fromEntries(response.headers);

      // Check for missing security headers
      const requiredHeaders = [
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options',
        'content-security-policy',
        'x-xss-protection'
      ];

      for (const header of requiredHeaders) {
        if (!headers[header]) {
          this.addVulnerability({
            type: VulnerabilityType.SECURITY_MISCONFIG,
            severity: SeverityLevel.MEDIUM,
            title: `Missing Security Header: ${header}`,
            description: `The ${header} security header is not present`,
            url: this.config.target.baseUrl,
            method: 'HEAD',
            evidence: { 
              request: 'HEAD request',
              response: JSON.stringify(headers, null, 2)
            },
            impact: 'Increased risk of XSS, clickjacking, and other attacks',
            remediation: `Implement the ${header} security header`,
            references: ['https://owasp.org/www-project-secure-headers/']
          });
        }
      }

    } catch (error) {
      logger.warn('Security headers analysis failed', { error: error.message });
    }
  }

  /**
   * Phase 2: Vulnerability Scanning
   */
  private async performVulnerabilityScanning(): Promise<void> {
    logger.info('Starting vulnerability scanning phase');

    try {
      // OWASP ZAP scanning
      if (this.config.tools.zap) {
        await this.executeZAPScan();
      }

      // Nuclei scanning
      if (this.config.tools.nuclei) {
        await this.executeNucleiScan();
      }

      // Custom vulnerability checks
      if (this.config.tools.custom) {
        await this.executeCustomScans();
      }

    } catch (error) {
      logger.error('Vulnerability scanning failed', { error: error.message });
    }
  }

  private async executeZAPScan(): Promise<void> {
    try {
      // Start ZAP daemon
      const zapProcess = spawn('zap.sh', ['-daemon', '-host', '0.0.0.0', '-port', '8080']);
      
      // Wait for ZAP to start
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Spider the application
      await execAsync(`zap-cli spider ${this.config.target.baseUrl}`);
      
      // Active scan
      await execAsync(`zap-cli active-scan ${this.config.target.baseUrl}`);
      
      // Generate report
      const { stdout } = await execAsync('zap-cli report -o zap_report.json -f json');
      
      await this.parseZAPResults('zap_report.json');

      // Stop ZAP
      zapProcess.kill();

    } catch (error) {
      logger.warn('ZAP scan failed', { error: error.message });
    }
  }

  private async executeNucleiScan(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `nuclei -u ${this.config.target.baseUrl} -t /root/nuclei-templates/ -json -o nuclei_results.json`
      );
      
      await this.parseNucleiResults('nuclei_results.json');
      
    } catch (error) {
      logger.warn('Nuclei scan failed', { error: error.message });
    }
  }

  private async executeCustomScans(): Promise<void> {
    // Custom vulnerability detection logic
    await this.checkForKnownVulnerabilities();
    await this.performConfigurationAnalysis();
    await this.checkForInformationDisclosure();
  }

  /**
   * Phase 3: Authentication and Authorization Testing
   */
  private async performAuthenticationTesting(): Promise<void> {
    logger.info('Starting authentication testing phase');

    try {
      await this.testWeakPasswordPolicies();
      await this.testBruteForceProtection();
      await this.testSessionManagement();
      await this.testAccountLockout();
      await this.testPasswordRecovery();
      await this.testMultiFactorAuthentication();

    } catch (error) {
      logger.error('Authentication testing failed', { error: error.message });
    }
  }

  private async testWeakPasswordPolicies(): Promise<void> {
    const weakPasswords = [
      'password', '123456', 'admin', 'qwerty', 'letmein',
      'password123', 'admin123', 'root', 'toor', 'guest'
    ];

    for (const password of weakPasswords) {
      try {
        const response = await fetch(`${this.config.target.baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `test${Date.now()}@example.com`,
            password,
            confirmPassword: password
          })
        });

        if (response.status === 201) {
          this.addVulnerability({
            type: VulnerabilityType.BROKEN_AUTH,
            severity: SeverityLevel.MEDIUM,
            title: 'Weak Password Policy',
            description: 'System accepts weak passwords during registration',
            url: `${this.config.target.baseUrl}/api/auth/register`,
            method: 'POST',
            payload: password,
            evidence: {
              request: `POST /api/auth/register with password: ${password}`,
              response: `HTTP ${response.status}: Registration successful`
            },
            impact: 'Increased risk of credential-based attacks',
            remediation: 'Implement strong password policy with complexity requirements',
            references: ['https://owasp.org/www-project-authentication-cheat-sheet/']
          });
        }
      } catch (error) {
        // Ignore network errors
      }
    }
  }

  private async testBruteForceProtection(): Promise<void> {
    const attempts = 15;
    let rateLimited = false;

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(`${this.config.target.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
        });

        if (response.status === 429) {
          rateLimited = true;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore network errors
      }
    }

    if (!rateLimited) {
      this.addVulnerability({
        type: VulnerabilityType.BROKEN_AUTH,
        severity: SeverityLevel.HIGH,
        title: 'Insufficient Brute Force Protection',
        description: 'No rate limiting detected on login endpoint after multiple failed attempts',
        url: `${this.config.target.baseUrl}/api/auth/login`,
        method: 'POST',
        evidence: {
          request: `${attempts} consecutive POST requests to /api/auth/login`,
          response: 'No rate limiting observed'
        },
        impact: 'Susceptible to credential brute force attacks',
        remediation: 'Implement rate limiting and account lockout mechanisms',
        references: ['https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks']
      });
    }
  }

  private async testSessionManagement(): Promise<void> {
    try {
      // Test session token properties
      const loginResponse = await fetch(`${this.config.target.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword'
        })
      });

      const cookies = loginResponse.headers.get('set-cookie');
      if (cookies) {
        if (!cookies.includes('HttpOnly')) {
          this.addVulnerability({
            type: VulnerabilityType.BROKEN_AUTH,
            severity: SeverityLevel.MEDIUM,
            title: 'Session Cookie Missing HttpOnly Flag',
            description: 'Session cookies are accessible via JavaScript',
            url: `${this.config.target.baseUrl}/api/auth/login`,
            method: 'POST',
            evidence: {
              request: 'Login request',
              response: `Set-Cookie: ${cookies}`
            },
            impact: 'Session hijacking via XSS attacks',
            remediation: 'Set HttpOnly flag on session cookies',
            references: ['https://owasp.org/www-community/HttpOnly']
          });
        }

        if (!cookies.includes('Secure')) {
          this.addVulnerability({
            type: VulnerabilityType.BROKEN_AUTH,
            severity: SeverityLevel.MEDIUM,
            title: 'Session Cookie Missing Secure Flag',
            description: 'Session cookies can be transmitted over unencrypted connections',
            url: `${this.config.target.baseUrl}/api/auth/login`,
            method: 'POST',
            evidence: {
              request: 'Login request',
              response: `Set-Cookie: ${cookies}`
            },
            impact: 'Session interception over insecure connections',
            remediation: 'Set Secure flag on session cookies',
            references: ['https://owasp.org/www-community/controls/SecureCookieAttribute']
          });
        }
      }

    } catch (error) {
      logger.warn('Session management testing failed', { error: error.message });
    }
  }

  private async testAccountLockout(): Promise<void> {
    // Implementation for account lockout testing
  }

  private async testPasswordRecovery(): Promise<void> {
    // Implementation for password recovery testing
  }

  private async testMultiFactorAuthentication(): Promise<void> {
    // Implementation for MFA testing
  }

  /**
   * Phase 4: Injection Testing
   */
  private async performInjectionTesting(): Promise<void> {
    logger.info('Starting injection testing phase');

    try {
      await this.testSQLInjection();
      await this.testCommandInjection();
      await this.testLDAPInjection();
      await this.testXPathInjection();
      await this.testNoSQLInjection();

    } catch (error) {
      logger.error('Injection testing failed', { error: error.message });
    }
  }

  private async testSQLInjection(): Promise<void> {
    if (this.config.tools.sqlmap) {
      try {
        const { stdout } = await execAsync(
          `sqlmap -u "${this.config.target.baseUrl}/api/products/search?q=test" --batch --level=3 --risk=2 --dump-format=JSON`
        );
        
        if (stdout.includes('vulnerable')) {
          this.addVulnerability({
            type: VulnerabilityType.INJECTION,
            severity: SeverityLevel.CRITICAL,
            title: 'SQL Injection Vulnerability',
            description: 'SQL injection vulnerability detected by SQLMap',
            url: `${this.config.target.baseUrl}/api/products/search`,
            method: 'GET',
            parameter: 'q',
            evidence: {
              request: 'SQLMap automated testing',
              response: stdout.substring(0, 1000)
            },
            impact: 'Complete database compromise, data theft, system takeover',
            remediation: 'Use parameterized queries and input validation',
            references: ['https://owasp.org/www-community/attacks/SQL_Injection']
          });
        }
      } catch (error) {
        logger.warn('SQLMap testing failed', { error: error.message });
      }
    }

    // Manual SQL injection testing
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1; SELECT * FROM information_schema.tables; --"
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await fetch(
          `${this.config.target.baseUrl}/api/products/search?q=${encodeURIComponent(payload)}`
        );
        
        const responseText = await response.text();
        
        if (responseText.includes('ORA-') || responseText.includes('MySQL') || 
            responseText.includes('PostgreSQL') || responseText.includes('sqlite')) {
          this.addVulnerability({
            type: VulnerabilityType.INJECTION,
            severity: SeverityLevel.HIGH,
            title: 'SQL Injection - Database Error Disclosure',
            description: 'Database errors exposed in response, indicating potential SQL injection',
            url: `${this.config.target.baseUrl}/api/products/search`,
            method: 'GET',
            parameter: 'q',
            payload,
            evidence: {
              request: `GET /api/products/search?q=${payload}`,
              response: responseText.substring(0, 500)
            },
            impact: 'Potential database access and information disclosure',
            remediation: 'Implement proper error handling and parameterized queries',
            references: ['https://owasp.org/www-community/attacks/SQL_Injection']
          });
        }
      } catch (error) {
        // Ignore network errors
      }
    }
  }

  private async testCommandInjection(): Promise<void> {
    const commandPayloads = [
      '; cat /etc/passwd',
      '| whoami',
      '&& ls -la',
      '`id`',
      '$(whoami)'
    ];

    for (const payload of commandPayloads) {
      try {
        const response = await fetch(`${this.config.target.baseUrl}/api/system/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: `8.8.8.8${payload}` })
        });

        const responseText = await response.text();
        
        if (responseText.includes('root:') || responseText.includes('uid=') || 
            responseText.includes('total ')) {
          this.addVulnerability({
            type: VulnerabilityType.INJECTION,
            severity: SeverityLevel.CRITICAL,
            title: 'Command Injection Vulnerability',
            description: 'Command injection detected in system ping functionality',
            url: `${this.config.target.baseUrl}/api/system/ping`,
            method: 'POST',
            parameter: 'host',
            payload,
            evidence: {
              request: `POST /api/system/ping with host: 8.8.8.8${payload}`,
              response: responseText.substring(0, 500)
            },
            impact: 'Complete server compromise and arbitrary command execution',
            remediation: 'Use safe APIs and validate/sanitize all input',
            references: ['https://owasp.org/www-community/attacks/Command_Injection']
          });
        }
      } catch (error) {
        // Ignore network errors
      }
    }
  }

  private async testLDAPInjection(): Promise<void> {
    // Implementation for LDAP injection testing
  }

  private async testXPathInjection(): Promise<void> {
    // Implementation for XPath injection testing
  }

  private async testNoSQLInjection(): Promise<void> {
    // Implementation for NoSQL injection testing
  }

  /**
   * Phase 5: Cross-Site Scripting Testing
   */
  private async performXSSTesting(): Promise<void> {
    logger.info('Starting XSS testing phase');

    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
      "'\"><script>alert('XSS')</script>"
    ];

    for (const payload of xssPayloads) {
      try {
        // Test reflected XSS
        const response = await fetch(
          `${this.config.target.baseUrl}/api/search?q=${encodeURIComponent(payload)}`
        );
        const responseText = await response.text();
        
        if (responseText.includes(payload) && 
            (responseText.includes('<script>') || responseText.includes('onerror='))) {
          this.addVulnerability({
            type: VulnerabilityType.XSS,
            severity: SeverityLevel.HIGH,
            title: 'Reflected Cross-Site Scripting (XSS)',
            description: 'User input is reflected in the response without proper encoding',
            url: `${this.config.target.baseUrl}/api/search`,
            method: 'GET',
            parameter: 'q',
            payload,
            evidence: {
              request: `GET /api/search?q=${payload}`,
              response: responseText.substring(0, 500)
            },
            impact: 'Session hijacking, credential theft, malicious actions',
            remediation: 'Encode output and implement Content Security Policy',
            references: ['https://owasp.org/www-community/attacks/xss/']
          });
        }

        // Test stored XSS (if POST endpoints available)
        const postResponse = await fetch(`${this.config.target.baseUrl}/api/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payload })
        });

        if (postResponse.status === 201) {
          // Check if the payload is stored and executed
          const getResponse = await fetch(`${this.config.target.baseUrl}/api/comments`);
          const getResponseText = await getResponse.text();
          
          if (getResponseText.includes(payload) && 
              (getResponseText.includes('<script>') || getResponseText.includes('onerror='))) {
            this.addVulnerability({
              type: VulnerabilityType.XSS,
              severity: SeverityLevel.CRITICAL,
              title: 'Stored Cross-Site Scripting (XSS)',
              description: 'Malicious scripts can be permanently stored and executed',
              url: `${this.config.target.baseUrl}/api/comments`,
              method: 'POST',
              parameter: 'content',
              payload,
              evidence: {
                request: `POST /api/comments with content: ${payload}`,
                response: getResponseText.substring(0, 500)
              },
              impact: 'Persistent attacks affecting all users',
              remediation: 'Sanitize input and encode output, implement CSP',
              references: ['https://owasp.org/www-community/attacks/xss/']
            });
          }
        }

      } catch (error) {
        // Ignore network errors
      }
    }
  }

  /**
   * Phase 6: CSRF Testing
   */
  private async performCSRFTesting(): Promise<void> {
    logger.info('Starting CSRF testing phase');

    try {
      // Test state-changing operations without CSRF protection
      const stateChangingEndpoints = [
        { url: '/api/users/profile', method: 'PUT' },
        { url: '/api/orders', method: 'POST' },
        { url: '/api/passwords/change', method: 'POST' }
      ];

      for (const endpoint of stateChangingEndpoints) {
        const response = await fetch(`${this.config.target.baseUrl}${endpoint.url}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'csrf_test' })
        });

        // Check if request is accepted without CSRF token
        if (response.status !== 403 && response.status !== 401) {
          this.addVulnerability({
            type: VulnerabilityType.BROKEN_ACCESS_CONTROL,
            severity: SeverityLevel.MEDIUM,
            title: 'Missing CSRF Protection',
            description: `State-changing operation accepts requests without CSRF protection`,
            url: `${this.config.target.baseUrl}${endpoint.url}`,
            method: endpoint.method,
            evidence: {
              request: `${endpoint.method} ${endpoint.url} without CSRF token`,
              response: `HTTP ${response.status}: Request accepted`
            },
            impact: 'Cross-site request forgery attacks',
            remediation: 'Implement CSRF tokens for state-changing operations',
            references: ['https://owasp.org/www-community/attacks/csrf']
          });
        }
      }

    } catch (error) {
      logger.error('CSRF testing failed', { error: error.message });
    }
  }

  /**
   * Phase 7: Business Logic Testing
   */
  private async performBusinessLogicTesting(): Promise<void> {
    logger.info('Starting business logic testing phase');

    try {
      await this.testPriceManipulation();
      await this.testOrderQuantityManipulation();
      await this.testWorkflowBypass();
      await this.testRaceConditions();

    } catch (error) {
      logger.error('Business logic testing failed', { error: error.message });
    }
  }

  private async testPriceManipulation(): Promise<void> {
    const priceManipulationTests = [
      { price: -100, description: 'Negative price' },
      { price: 0.01, description: 'Extremely low price' },
      { price: 999999999, description: 'Extremely high price' }
    ];

    for (const test of priceManipulationTests) {
      try {
        const response = await fetch(`${this.config.target.baseUrl}/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Product',
            price: test.price
          })
        });

        if (response.status === 201) {
          this.addVulnerability({
            type: VulnerabilityType.BROKEN_ACCESS_CONTROL,
            severity: SeverityLevel.HIGH,
            title: 'Price Manipulation Vulnerability',
            description: `System accepts ${test.description}`,
            url: `${this.config.target.baseUrl}/api/products`,
            method: 'POST',
            payload: JSON.stringify({ price: test.price }),
            evidence: {
              request: `POST /api/products with price: ${test.price}`,
              response: `HTTP ${response.status}: Product created`
            },
            impact: 'Financial loss through price manipulation',
            remediation: 'Implement proper business logic validation',
            references: ['https://owasp.org/www-community/vulnerabilities/Business_logic_vulnerability']
          });
        }
      } catch (error) {
        // Ignore network errors
      }
    }
  }

  private async testOrderQuantityManipulation(): Promise<void> {
    // Implementation for order quantity manipulation testing
  }

  private async testWorkflowBypass(): Promise<void> {
    // Implementation for workflow bypass testing
  }

  private async testRaceConditions(): Promise<void> {
    // Implementation for race condition testing
  }

  /**
   * Phase 8: OWASP Top 10 Testing
   */
  private async performOWASPTesting(): Promise<void> {
    logger.info('Starting OWASP Top 10 testing phase');

    try {
      await this.testA01_BrokenAccessControl();
      await this.testA02_CryptographicFailures();
      await this.testA03_Injection();
      await this.testA04_InsecureDesign();
      await this.testA05_SecurityMisconfiguration();
      await this.testA06_VulnerableComponents();
      await this.testA07_IdentificationAuthFailures();
      await this.testA08_SoftwareDataIntegrityFailures();
      await this.testA09_SecurityLoggingFailures();
      await this.testA10_ServerSideRequestForgery();

    } catch (error) {
      logger.error('OWASP testing failed', { error: error.message });
    }
  }

  private async testA01_BrokenAccessControl(): Promise<void> {
    // Already covered in authorization testing
  }

  private async testA02_CryptographicFailures(): Promise<void> {
    // Test for sensitive data in transit/rest
    try {
      const response = await fetch(`${this.config.target.baseUrl}/api/users/profile`);
      const responseText = await response.text();
      
      // Check for exposed sensitive data
      if (responseText.includes('password') || responseText.includes('ssn') || 
          responseText.includes('creditCard')) {
        this.addVulnerability({
          type: VulnerabilityType.SENSITIVE_DATA,
          severity: SeverityLevel.HIGH,
          title: 'Sensitive Data Exposure',
          description: 'Sensitive information exposed in API responses',
          url: `${this.config.target.baseUrl}/api/users/profile`,
          method: 'GET',
          evidence: {
            request: 'GET /api/users/profile',
            response: responseText.substring(0, 500)
          },
          impact: 'Unauthorized access to sensitive user data',
          remediation: 'Remove sensitive data from responses and implement proper data classification',
          references: ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/']
        });
      }
    } catch (error) {
      // Ignore network errors
    }
  }

  private async testA03_Injection(): Promise<void> {
    // Already covered in injection testing
  }

  private async testA04_InsecureDesign(): Promise<void> {
    // Implementation for insecure design testing
  }

  private async testA05_SecurityMisconfiguration(): Promise<void> {
    // Already covered in reconnaissance phase
  }

  private async testA06_VulnerableComponents(): Promise<void> {
    // Implementation for vulnerable components testing
  }

  private async testA07_IdentificationAuthFailures(): Promise<void> {
    // Already covered in authentication testing
  }

  private async testA08_SoftwareDataIntegrityFailures(): Promise<void> {
    // Implementation for software/data integrity testing
  }

  private async testA09_SecurityLoggingFailures(): Promise<void> {
    // Implementation for logging failures testing
  }

  private async testA10_ServerSideRequestForgery(): Promise<void> {
    const ssrfPayloads = [
      'http://82.147.84.78:22',
      'http://127.0.0.1:8080',
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd'
    ];

    for (const payload of ssrfPayloads) {
      try {
        const response = await fetch(`${this.config.target.baseUrl}/api/webhook/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload })
        });

        if (response.status === 200) {
          const responseText = await response.text();
          if (responseText.length > 0) {
            this.addVulnerability({
              type: VulnerabilityType.INJECTION,
              severity: SeverityLevel.HIGH,
              title: 'Server-Side Request Forgery (SSRF)',
              description: 'Application makes requests to attacker-controlled URLs',
              url: `${this.config.target.baseUrl}/api/webhook/test`,
              method: 'POST',
              payload,
              evidence: {
                request: `POST /api/webhook/test with url: ${payload}`,
                response: responseText.substring(0, 500)
              },
              impact: 'Internal network access, metadata service access',
              remediation: 'Implement URL validation and allowlisting',
              references: ['https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/']
            });
          }
        }
      } catch (error) {
        // Ignore network errors
      }
    }
  }

  // Helper methods for parsing tool results
  private async parseNmapResults(filename: string): Promise<void> {
    try {
      if (fs.existsSync(filename)) {
        const xmlContent = fs.readFileSync(filename, 'utf8');
        // Parse XML and extract vulnerabilities
        // Implementation would depend on XML parsing library
      }
    } catch (error) {
      logger.warn('Failed to parse nmap results', { error: error.message });
    }
  }

  private async parseDirbResults(filename: string): Promise<void> {
    try {
      if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (line.includes('200') || line.includes('301') || line.includes('302')) {
            // Found directory/file - analyze for sensitive information
            const path = line.split(' ')[0];
            if (path.includes('admin') || path.includes('config') || path.includes('backup')) {
              this.addVulnerability({
                type: VulnerabilityType.SENSITIVE_DATA,
                severity: SeverityLevel.MEDIUM,
                title: 'Sensitive Directory/File Exposure',
                description: `Potentially sensitive path discovered: ${path}`,
                url: `${this.config.target.baseUrl}${path}`,
                method: 'GET',
                evidence: {
                  request: `Directory bruteforce scan`,
                  response: line
                },
                impact: 'Information disclosure',
                remediation: 'Restrict access to sensitive directories',
                references: ['https://owasp.org/www-community/vulnerabilities/Forced_browsing']
              });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse dirb results', { error: error.message });
    }
  }

  private async parseZAPResults(filename: string): Promise<void> {
    try {
      if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf8');
        const results = JSON.parse(content);
        
        // Parse ZAP JSON format and add vulnerabilities
        // Implementation would depend on ZAP output format
      }
    } catch (error) {
      logger.warn('Failed to parse ZAP results', { error: error.message });
    }
  }

  private async parseNucleiResults(filename: string): Promise<void> {
    try {
      if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            this.addVulnerability({
              type: this.mapNucleiSeverity(result.info?.severity),
              severity: this.mapSeverityLevel(result.info?.severity),
              title: result.info?.name || 'Nuclei Detection',
              description: result.info?.description || result.info?.name,
              url: result.matched_at || this.config.target.baseUrl,
              method: 'GET',
              evidence: {
                request: `Nuclei template: ${result.template}`,
                response: JSON.stringify(result, null, 2)
              },
              impact: result.info?.impact || 'Security vulnerability detected',
              remediation: result.info?.remediation || 'Apply security patches',
              references: result.info?.reference || []
            });
          } catch (parseError) {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse nuclei results', { error: error.message });
    }
  }

  private mapNucleiSeverity(severity: string): VulnerabilityType {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return VulnerabilityType.SECURITY_MISCONFIG;
      default:
        return VulnerabilityType.SECURITY_MISCONFIG;
    }
  }

  private mapSeverityLevel(severity: string): SeverityLevel {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return SeverityLevel.CRITICAL;
      case 'high':
        return SeverityLevel.HIGH;
      case 'medium':
        return SeverityLevel.MEDIUM;
      case 'low':
        return SeverityLevel.LOW;
      default:
        return SeverityLevel.INFO;
    }
  }

  private async checkForKnownVulnerabilities(): Promise<void> {
    // Implementation for checking known vulnerabilities
  }

  private async performConfigurationAnalysis(): Promise<void> {
    // Implementation for configuration analysis
  }

  private async checkForInformationDisclosure(): Promise<void> {
    // Implementation for information disclosure testing
  }

  private addVulnerability(vuln: Partial<Vulnerability>): void {
    const vulnerability: Vulnerability = {
      id: crypto.randomUUID(),
      type: vuln.type || VulnerabilityType.SECURITY_MISCONFIG,
      severity: vuln.severity || SeverityLevel.INFO,
      title: vuln.title || 'Security Finding',
      description: vuln.description || '',
      url: vuln.url || this.config.target.baseUrl,
      method: vuln.method || 'GET',
      parameter: vuln.parameter,
      payload: vuln.payload,
      evidence: vuln.evidence || { request: '', response: '' },
      impact: vuln.impact || '',
      remediation: vuln.remediation || '',
      references: vuln.references || [],
      cve: vuln.cve,
      cvss: vuln.cvss,
      discoveredAt: new Date(),
      discoveredBy: 'PenetrationTestFramework'
    };

    this.vulnerabilities.push(vulnerability);
  }

  private generateSummary(): PenetrationTestResult['summary'] {
    const summary = {
      totalVulnerabilities: this.vulnerabilities.length,
      criticalVulnerabilities: 0,
      highVulnerabilities: 0,
      mediumVulnerabilities: 0,
      lowVulnerabilities: 0,
      infoVulnerabilities: 0
    };

    for (const vuln of this.vulnerabilities) {
      switch (vuln.severity) {
        case SeverityLevel.CRITICAL:
          summary.criticalVulnerabilities++;
          break;
        case SeverityLevel.HIGH:
          summary.highVulnerabilities++;
          break;
        case SeverityLevel.MEDIUM:
          summary.mediumVulnerabilities++;
          break;
        case SeverityLevel.LOW:
          summary.lowVulnerabilities++;
          break;
        case SeverityLevel.INFO:
          summary.infoVulnerabilities++;
          break;
      }
    }

    return summary;
  }

  private calculateCoverage(): PenetrationTestResult['coverage'] {
    return {
      urlsTested: this.testResults.get('urlsTested') || 0,
      endpointsCovered: this.testResults.get('endpointsCovered') || 0,
      parametersAnalyzed: this.testResults.get('parametersAnalyzed') || 0,
      formsAnalyzed: this.testResults.get('formsAnalyzed') || 0
    };
  }

  private getToolResults(): PenetrationTestResult['tools'] {
    return Array.from(this.testResults.entries())
      .filter(([key]) => key.startsWith('tool_'))
      .map(([key, value]) => ({
        toolName: key.replace('tool_', ''),
        version: value.version || 'unknown',
        executionTime: value.executionTime || 0,
        findings: value.findings || 0
      }));
  }

  private async generateReport(result: PenetrationTestResult): Promise<void> {
    const reportPath = path.join(this.config.reporting.outputPath, `pentest_report_${result.testId}.json`);
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
      logger.info('Penetration test report generated', { reportPath });
    } catch (error) {
      logger.error('Failed to generate report', { error: error.message });
    }
  }
}

export default PenetrationTestFramework;
