#!/usr/bin/env node
/**
 * Script to generate secure random secrets for environment variables
 * Run: node scripts/generate-secrets.js
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating Secure Secrets for Environment Variables\n');
console.log('=' .repeat(60));

// Generate random bytes and convert to hex
function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Generate JWT secrets
console.log('\n📝 JWT & Authentication Secrets:');
console.log('JWT_SECRET=' + generateSecret(64));
console.log('JWT_REFRESH_SECRET=' + generateSecret(64));

// Generate session secrets
console.log('\n📝 Session & Cookie Secrets:');
console.log('SESSION_SECRET=' + generateSecret(32));
console.log('ADMIN_COOKIE_SECRET=' + generateSecret(32));

// Generate encryption keys
console.log('\n🔐 Encryption Keys (256-bit):');
console.log('ENCRYPTION_KEY=' + generateSecret(32));
console.log('BACKUP_ENCRYPTION_KEY=' + generateSecret(32));
console.log('DATABASE_ENCRYPTION_KEY=' + generateSecret(32));

// Generate break glass secrets
console.log('\n⚠️  Break Glass Emergency Access:');
console.log('BREAK_GLASS_AUTH_SECRET=' + generateSecret(32));

console.log('\n⚠️  Break Glass Password Hashes:');
console.log('Note: Replace these with actual bcrypt hashes of your emergency passwords');
console.log('Generate with: node -e "const bcrypt = require(\'bcrypt\'); bcrypt.hash(\'YOUR_PASSWORD\', 10, (e,h) => console.log(h))"');
console.log('');
console.log('Example placeholders (CHANGE THESE):');
const examplePasswords = ['CEO_EMERGENCY_PASS', 'SECURITY_EMERGENCY_PASS', 'SYSADMIN_EMERGENCY_PASS', 'DBA_EMERGENCY_PASS'];
const promises = examplePasswords.map(async (pwd, idx) => {
  const hash = await bcrypt.hash(pwd, 10);
  const keys = ['BREAK_GLASS_CEO_PASSWORD_HASH', 'BREAK_GLASS_SECURITY_PASSWORD_HASH', 'BREAK_GLASS_SYSADMIN_PASSWORD_HASH', 'BREAK_GLASS_DBA_PASSWORD_HASH'];
  console.log(`${keys[idx]}="${hash}"`);
});

Promise.all(promises).then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
  console.log('1. Never commit these secrets to version control');
  console.log('2. Store them securely (e.g., password manager, vault)');
  console.log('3. Use different secrets for development and production');
  console.log('4. Rotate secrets regularly in production');
  console.log('5. The example password hashes above should be replaced with real ones');
  console.log('\n📝 Copy the values above to your .env file');
  console.log('=' .repeat(60) + '\n');
});

