#!/usr/bin/env node
/**
 * Script to validate that all required environment variables are set
 * Run: node check-env.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Environment Configuration\n');
console.log('═'.repeat(60));

// Load .env file
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('\n❌ ERROR: .env file not found!');
  console.log('\n📝 To create it, run:');
  console.log('   Windows: .\\setup-env.bat');
  console.log('   Node.js: node setup-env.js');
  console.log('');
  process.exit(1);
}

// Parse .env file
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Required variables
const requiredVars = {
  'Critical Security': [
    'ADMIN_DEFAULT_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ADMIN_COOKIE_SECRET',
    'ADMIN_SESSION_SECRET',
    'ENCRYPTION_MASTER_KEY',
    'DATA_ENCRYPTION_KEY',
    'TELEGRAM_WEBHOOK_SECRET',
  ],
  'Telegram Bot': [
    'TELEGRAM_BOT_TOKEN',
  ],
  'Server Configuration': [
    'PORT',
    'NODE_ENV',
    'FRONTEND_URL',
  ],
  'Database': [
    'DATABASE_PROVIDER',
    'DATABASE_URL',
  ],
  'Security Key IDs': [
    'SECURITY_LOGS_KEY_ID',
    'SBOM_SIGNING_KEY_ID',
    'COMMUNICATION_KEY_ID',
    'WEBSOCKET_KEY_ID',
    'BACKUP_KEY_ID',
    'STORAGE_KEY_ID',
    'LOG_KEY_ID',
  ],
};

let allValid = true;
const warnings = [];
const errors = [];

console.log('\n📋 Validation Results:\n');

Object.entries(requiredVars).forEach(([category, vars]) => {
  console.log(`\n${category}:`);
  
  vars.forEach(varName => {
    const value = envVars[varName];
    
    if (!value || value === '') {
      console.log(`  ❌ ${varName.padEnd(30)} - MISSING`);
      errors.push(`${varName} is not set`);
      allValid = false;
    } else if (value.includes('your-') || value.includes('change-') || value.includes('ChangeMe')) {
      console.log(`  ⚠️  ${varName.padEnd(30)} - NEEDS CUSTOMIZATION`);
      warnings.push(`${varName} contains placeholder value: ${value.substring(0, 30)}...`);
    } else if (varName.includes('SECRET') || varName.includes('KEY')) {
      if (value.length < 32) {
        console.log(`  ⚠️  ${varName.padEnd(30)} - TOO SHORT (${value.length} chars)`);
        warnings.push(`${varName} is shorter than recommended (32+ chars)`);
      } else {
        console.log(`  ✅ ${varName.padEnd(30)} - OK (${value.length} chars)`);
      }
    } else {
      console.log(`  ✅ ${varName.padEnd(30)} - SET`);
    }
  });
});

console.log('\n' + '═'.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ ERRORS:\n');
  errors.forEach(err => console.log(`  • ${err}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:\n');
  warnings.forEach(warn => console.log(`  • ${warn}`));
}

if (allValid && warnings.length === 0) {
  console.log('\n✅ All environment variables are properly configured!');
  console.log('\n🚀 You can now run: npm run dev');
} else if (allValid) {
  console.log('\n⚠️  Configuration is valid but has warnings.');
  console.log('    Review the warnings above and update as needed.');
  console.log('\n🚀 You can proceed with: npm run dev');
} else {
  console.log('\n❌ Configuration has errors. Please fix them before starting the backend.');
  console.log('\n📝 To regenerate .env file, run:');
  console.log('   Windows: .\\setup-env.bat');
  console.log('   Node.js: node setup-env.js');
}

console.log('\n' + '═'.repeat(60));
console.log('');

process.exit(allValid ? 0 : 1);

