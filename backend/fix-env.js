#!/usr/bin/env node
/**
 * Script to add missing environment variables to existing .env file
 * Run: node fix-env.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Missing Environment Variables\n');
console.log('═'.repeat(60));

// Generate random secret
function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('\n❌ ERROR: .env file not found!');
  console.log('\nPlease run: node setup-env.js');
  process.exit(1);
}

// Read existing .env
let envContent = fs.readFileSync(envPath, 'utf-8');
const existingVars = new Set();

// Parse existing variables
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key] = trimmed.split('=');
    if (key) {
      existingVars.add(key.trim());
    }
  }
});

// Variables that need to be added if missing
const requiredVars = {
  'ADMIN_DEFAULT_PASSWORD': 'SecureAdmin2025!ChangeMe',
  'ADMIN_COOKIE_SECRET': generateSecret(32),
  'ADMIN_SESSION_SECRET': generateSecret(32),
  'ENCRYPTION_MASTER_KEY': generateSecret(32),
  'DATA_ENCRYPTION_KEY': generateSecret(32),
  'ENCRYPTION_DATA_KEY': generateSecret(32), // Alternative name
  'TELEGRAM_WEBHOOK_SECRET': generateSecret(32),
  'DATABASE_PROVIDER': 'sqlite',
  'SESSION_SECRET': generateSecret(32),
};

const added = [];
const alreadyExists = [];

// Check and add missing variables
Object.entries(requiredVars).forEach(([key, value]) => {
  if (!existingVars.has(key)) {
    // Check if this variable exists but is empty
    const regex = new RegExp(`^${key}=\\s*$`, 'm');
    if (regex.test(envContent)) {
      // Replace empty value
      envContent = envContent.replace(regex, `${key}=${value}`);
      added.push(`${key} (updated empty value)`);
    } else {
      // Add new line
      if (!envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${key}=${value}\n`;
      added.push(key);
    }
  } else {
    alreadyExists.push(key);
  }
});

if (added.length === 0) {
  console.log('\n✅ All required variables already exist!');
  console.log('\n' + '═'.repeat(60));
  process.exit(0);
}

// Backup existing .env
const backupPath = path.join(__dirname, `.env.backup.${Date.now()}`);
fs.copyFileSync(envPath, backupPath);
console.log(`\n✅ Backed up existing .env to ${path.basename(backupPath)}`);

// Write updated .env
fs.writeFileSync(envPath, envContent);

console.log('\n✅ Successfully added missing variables!\n');

if (added.length > 0) {
  console.log('📝 Added variables:');
  added.forEach(v => console.log(`  ✅ ${v}`));
}

if (alreadyExists.length > 0) {
  console.log('\n📋 Already existed:');
  alreadyExists.forEach(v => console.log(`  ℹ️  ${v}`));
}

console.log('\n' + '═'.repeat(60));
console.log('\n⚠️  IMPORTANT:');
console.log('  • Change ADMIN_DEFAULT_PASSWORD to your own password');
console.log('  • Review all added variables in .env file');
console.log('  • All secrets have been randomly generated');
console.log('\n🚀 Run: npm run check:env');
console.log('   Then: npm run dev');
console.log('\n' + '═'.repeat(60) + '\n');

