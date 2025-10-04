#!/usr/bin/env node
/**
 * Security Audit Script
 * Автоматическая проверка безопасности кодовой базы
 * 
 * Usage: node scripts/security-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 Starting Security Audit...\n');

const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function pass(message) {
  results.passed.push(message);
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function fail(message) {
  results.failed.push(message);
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function warn(message) {
  results.warnings.push(message);
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// 1. Check for eval() usage
console.log('\n📝 Checking for dangerous code patterns...');
try {
  const grepEval = execSync('grep -r "eval(" src --include="*.ts" --include="*.js"', { 
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  }).trim();
  
  if (grepEval) {
    fail('Found eval() usage in code');
    console.log(grepEval);
  } else {
    pass('No eval() found');
  }
} catch (error) {
  if (error.status === 1) {
    pass('No eval() found');
  } else {
    warn('Could not check for eval()');
  }
}

// 2. Check for hardcoded secrets
console.log('\n🔑 Checking for hardcoded secrets...');
const secretPatterns = [
  /password\s*=\s*['"][^'"]{8,}['"]/i,
  /api[_-]?key\s*=\s*['"][^'"]{20,}['"]/i,
  /secret\s*=\s*['"][^'"]{20,}['"]/i,
  /token\s*=\s*['"][^'"]{20,}['"]/i
];

let secretsFound = false;
function scanDirectory(dir, ignorePatterns = ['node_modules', 'dist', '.git']) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!ignorePatterns.includes(file)) {
        scanDirectory(fullPath, ignorePatterns);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      secretPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          // Exclude process.env and comments
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (pattern.test(line) && !line.includes('process.env') && !line.trim().startsWith('//')) {
              fail(`Potential hardcoded secret in ${fullPath}:${index + 1}`);
              console.log(`  ${line.trim().substring(0, 80)}...`);
              secretsFound = true;
            }
          });
        }
      });
    }
  });
}

try {
  scanDirectory(path.join(__dirname, '..', 'src'));
  if (!secretsFound) {
    pass('No hardcoded secrets found');
  }
} catch (error) {
  warn('Could not scan for secrets: ' + error.message);
}

// 3. Check npm audit
console.log('\n📦 Running npm audit...');
try {
  execSync('npm audit --audit-level=high', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  pass('npm audit passed');
} catch (error) {
  fail('npm audit found vulnerabilities');
}

// 4. Check for .env files in git
console.log('\n🔍 Checking for .env files in git...');
try {
  const gitTracked = execSync('git ls-files | grep -E "\\.env$"', { 
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  }).trim();
  
  if (gitTracked) {
    fail('.env files found in git:');
    console.log(gitTracked);
  } else {
    pass('No .env files in git');
  }
} catch (error) {
  if (error.status === 1) {
    pass('No .env files in git');
  } else {
    warn('Could not check git for .env files');
  }
}

// 5. Check for security middleware
console.log('\n🛡️  Checking security middleware...');
const indexPath = path.join(__dirname, '..', 'src', 'index.ts');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  const checks = [
    { pattern: /helmet/i, name: 'Helmet security headers' },
    { pattern: /cors/i, name: 'CORS middleware' },
    { pattern: /rateLimit/i, name: 'Rate limiting' },
    { pattern: /express\.json.*limit/i, name: 'JSON body size limit' }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(indexContent)) {
      pass(check.name + ' enabled');
    } else {
      warn(check.name + ' not found');
    }
  });
} else {
  warn('Could not find src/index.ts');
}

// 6. Check for input validation
console.log('\n✅ Checking for input validation...');
const validationFiles = [
  'src/utils/sanitizer.ts',
  'src/utils/validator.ts'
];

validationFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    pass(`${file} exists`);
  } else {
    fail(`${file} missing`);
  }
});

// 7. Check TypeScript strict mode
console.log('\n📘 Checking TypeScript configuration...');
const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  if (tsconfig.compilerOptions?.strict) {
    pass('TypeScript strict mode enabled');
  } else {
    warn('TypeScript strict mode not enabled');
  }
  
  if (tsconfig.compilerOptions?.noImplicitAny) {
    pass('noImplicitAny enabled');
  } else {
    warn('noImplicitAny not enabled');
  }
} else {
  warn('tsconfig.json not found');
}

// 8. Check for HTTPS enforcement
console.log('\n🔐 Security configuration checks...');
const securityMiddlewarePath = path.join(__dirname, '..', 'src', 'middleware', 'security.ts');
if (fs.existsSync(securityMiddlewarePath)) {
  const securityContent = fs.readFileSync(securityMiddlewarePath, 'utf8');
  
  if (securityContent.includes('hsts') || securityContent.includes('strictTransportSecurity')) {
    pass('HSTS configured');
  } else {
    warn('HSTS not found');
  }
  
  if (securityContent.includes('contentSecurityPolicy') || securityContent.includes('CSP')) {
    pass('Content Security Policy configured');
  } else {
    warn('CSP not found');
  }
} else {
  warn('security.ts not found');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Security Audit Summary\n');
console.log(`${colors.green}Passed:${colors.reset} ${results.passed.length}`);
console.log(`${colors.red}Failed:${colors.reset} ${results.failed.length}`);
console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings.length}`);
console.log('='.repeat(60));

if (results.failed.length > 0) {
  console.log(`\n${colors.red}❌ Security audit FAILED${colors.reset}`);
  console.log('\nFailed checks:');
  results.failed.forEach(msg => console.log(`  - ${msg}`));
  process.exit(1);
} else if (results.warnings.length > 0) {
  console.log(`\n${colors.yellow}⚠️  Security audit passed with warnings${colors.reset}`);
  console.log('\nWarnings:');
  results.warnings.forEach(msg => console.log(`  - ${msg}`));
  process.exit(0);
} else {
  console.log(`\n${colors.green}✅ Security audit PASSED${colors.reset}`);
  process.exit(0);
}

