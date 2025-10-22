#!/usr/bin/env node
/**
 * Script to generate a complete .env file with all required secrets
 * Run: node setup-env.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating Complete .env Configuration\n');
console.log('═'.repeat(60));

// Generate random bytes and convert to hex
function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Generate base64 secret for JWT
function generateBase64Secret(bytes = 64) {
  return crypto.randomBytes(bytes).toString('base64');
}

const envContent = `# Environment Configuration
# Generated: ${new Date().toISOString()}
# IMPORTANT: Never commit this file to version control

# ============================================
# Server Configuration
# ============================================
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ENABLE_ADMINJS=true

# ============================================
# Database Configuration
# ============================================
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/dev.db

# ============================================
# JWT & Authentication Secrets
# ============================================
JWT_SECRET=${generateSecret(64)}
JWT_REFRESH_SECRET=${generateSecret(64)}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# Session & Cookie Secrets
# ============================================
SESSION_SECRET=${generateSecret(32)}
ADMIN_COOKIE_SECRET=${generateSecret(32)}
ADMIN_SESSION_SECRET=${generateSecret(32)}

# ============================================
# AdminJS Security (CRITICAL - CHANGE THIS PASSWORD!)
# ============================================
ADMIN_DEFAULT_PASSWORD=SecureAdmin2025!ChangeMe

# ============================================
# Encryption Keys (CRITICAL)
# ============================================
ENCRYPTION_MASTER_KEY=${generateSecret(32)}
DATA_ENCRYPTION_KEY=${generateSecret(32)}
ENCRYPTION_DATA_KEY=${generateSecret(32)}

# ============================================
# Security Key IDs
# ============================================
SECURITY_LOGS_KEY_ID=${generateSecret(32)}
SBOM_SIGNING_KEY_ID=${generateSecret(32)}
COMMUNICATION_KEY_ID=${generateSecret(32)}
WEBSOCKET_KEY_ID=${generateSecret(32)}
BACKUP_KEY_ID=${generateSecret(32)}
STORAGE_KEY_ID=${generateSecret(32)}
LOG_KEY_ID=${generateSecret(32)}

# ============================================
# Telegram Bot Configuration
# ============================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
TELEGRAM_WEBHOOK_SECRET=${generateSecret(32)}
TELEGRAM_WEBHOOK_URL=
API_URL=http://localhost:3001
BOT_PORT=3003

# ============================================
# Security Configuration
# ============================================
CORS_WHITELIST=http://localhost:3000,http://localhost:5173
ENABLE_BRUTE_FORCE_PROTECTION=true
ENABLE_SECURITY_HEADERS=true
ENABLE_REQUEST_SANITIZATION=true
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm

# ============================================
# Optional: Redis (for session storage)
# ============================================
# REDIS_URL=redis://localhost:6379

# ============================================
# Optional: Email Notifications (SMTP)
# ============================================
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM=noreply@telegram-ecommerce.com

# ============================================
# Optional: Admin Telegram Bot
# ============================================
# ADMIN_TELEGRAM_BOT_TOKEN=your-admin-bot-token-here

# ============================================
# Optional: Vault Configuration
# ============================================
# USE_VAULT=false
# VAULT_ADDR=http://localhost:8200
# VAULT_ROLE_ID=your-role-id
# VAULT_SECRET_ID=your-secret-id

# ============================================
# Medusa CMS (if using)
# ============================================
CMS_BASE_URL=http://localhost:9000
MEDUSA_JWT_SECRET=${generateSecret(32)}
MEDUSA_COOKIE_SECRET=${generateSecret(32)}
MEDUSA_WEBHOOK_TOKEN=${generateSecret(32)}

# ============================================
# Development Settings
# ============================================
MAX_REQUEST_SIZE=10mb
RATE_LIMIT_MAX=10000
AUTH_RATE_LIMIT_MAX=100
UPLOAD_RATE_LIMIT_MAX=50
`;

const envPath = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  WARNING: .env file already exists!');
  console.log('');
  console.log('Options:');
  console.log('1. Backup existing .env to .env.backup');
  console.log('2. Exit and manually review');
  console.log('');
  
  // Create backup
  const backupPath = path.join(__dirname, `.env.backup.${Date.now()}`);
  fs.copyFileSync(envPath, backupPath);
  console.log(`✅ Backed up existing .env to ${path.basename(backupPath)}`);
}

// Write the .env file
fs.writeFileSync(envPath, envContent);

console.log('');
console.log('✅ Successfully created .env file!');
console.log('');
console.log('📝 Location:', envPath);
console.log('');
console.log('═'.repeat(60));
console.log('');
console.log('⚠️  IMPORTANT NEXT STEPS:');
console.log('');
console.log('1. ✏️  CHANGE the ADMIN_DEFAULT_PASSWORD in the .env file');
console.log('   Current: SecureAdmin2025!ChangeMe');
console.log('');
console.log('2. 🤖 SET your TELEGRAM_BOT_TOKEN in the .env file');
console.log('   Get it from: https://t.me/BotFather');
console.log('');
console.log('3. 🔐 All other secrets have been randomly generated');
console.log('   - JWT secrets');
console.log('   - Encryption keys');
console.log('   - Session secrets');
console.log('   - Security key IDs');
console.log('');
console.log('4. ✅ Review optional settings (Redis, SMTP, etc.)');
console.log('');
console.log('═'.repeat(60));
console.log('');
console.log('🚀 You can now run: npm run dev');
console.log('');
console.log('⚠️  SECURITY NOTES:');
console.log('• Never commit .env to version control');
console.log('• Use different secrets for production');
console.log('• Store production secrets in a secure vault');
console.log('• Rotate secrets regularly');
console.log('');

