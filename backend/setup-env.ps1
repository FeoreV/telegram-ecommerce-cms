# PowerShell script to generate .env file with all required secrets
# Run: .\setup-env.ps1

Write-Host "🔐 Generating Complete .env Configuration`n" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Cyan

# Function to generate random hex string
function Generate-Secret {
    param([int]$Bytes = 32)
    $randomBytes = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($randomBytes)
    $rng.Dispose()
    return [System.BitConverter]::ToString($randomBytes).Replace('-', '').ToLower()
}

$envContent = @"
# Environment Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# IMPORTANT: Never commit this file to version control

# ============================================
# Server Configuration
# ============================================
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://82.147.84.78:3000
ENABLE_ADMINJS=true

# ============================================
# Database Configuration
# ============================================
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/dev.db

# ============================================
# JWT & Authentication Secrets
# ============================================
JWT_SECRET=$(Generate-Secret 64)
JWT_REFRESH_SECRET=$(Generate-Secret 64)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# Session & Cookie Secrets
# ============================================
SESSION_SECRET=$(Generate-Secret 32)
ADMIN_COOKIE_SECRET=$(Generate-Secret 32)
ADMIN_SESSION_SECRET=$(Generate-Secret 32)

# ============================================
# AdminJS Security (CRITICAL - CHANGE THIS PASSWORD!)
# ============================================
ADMIN_DEFAULT_PASSWORD=SecureAdmin2025!ChangeMe

# ============================================
# Encryption Keys (CRITICAL)
# ============================================
ENCRYPTION_MASTER_KEY=$(Generate-Secret 32)
DATA_ENCRYPTION_KEY=$(Generate-Secret 32)
ENCRYPTION_DATA_KEY=$(Generate-Secret 32)

# ============================================
# Security Key IDs
# ============================================
SECURITY_LOGS_KEY_ID=$(Generate-Secret 32)
SBOM_SIGNING_KEY_ID=$(Generate-Secret 32)
COMMUNICATION_KEY_ID=$(Generate-Secret 32)
WEBSOCKET_KEY_ID=$(Generate-Secret 32)
BACKUP_KEY_ID=$(Generate-Secret 32)
STORAGE_KEY_ID=$(Generate-Secret 32)
LOG_KEY_ID=$(Generate-Secret 32)

# ============================================
# Telegram Bot Configuration
# ============================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
TELEGRAM_WEBHOOK_SECRET=$(Generate-Secret 32)
TELEGRAM_WEBHOOK_URL=
API_URL=http://82.147.84.78:3001
BOT_PORT=3003

# ============================================
# Security Configuration
# ============================================
CORS_WHITELIST=http://82.147.84.78:3000,http://82.147.84.78:5173
ENABLE_BRUTE_FORCE_PROTECTION=true
ENABLE_SECURITY_HEADERS=true
ENABLE_REQUEST_SANITIZATION=true
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm

# ============================================
# Optional: Redis (for session storage)
# ============================================
# REDIS_URL=redis://82.147.84.78:6379

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
# VAULT_ADDR=http://82.147.84.78:8200
# VAULT_ROLE_ID=your-role-id
# VAULT_SECRET_ID=your-secret-id

# ============================================
# Medusa CMS (if using)
# ============================================
CMS_BASE_URL=http://82.147.84.78:9000
MEDUSA_JWT_SECRET=$(Generate-Secret 32)
MEDUSA_COOKIE_SECRET=$(Generate-Secret 32)
MEDUSA_WEBHOOK_TOKEN=$(Generate-Secret 32)

# ============================================
# Development Settings
# ============================================
MAX_REQUEST_SIZE=10mb
RATE_LIMIT_MAX=10000
AUTH_RATE_LIMIT_MAX=100
UPLOAD_RATE_LIMIT_MAX=50
"@

$envPath = Join-Path $PSScriptRoot ".env"

# Check if .env already exists
if (Test-Path $envPath) {
    Write-Host "`n⚠️  WARNING: .env file already exists!" -ForegroundColor Yellow
    Write-Host ""
    
    # Create backup
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = Join-Path $PSScriptRoot ".env.backup.$timestamp"
    Copy-Item $envPath $backupPath
    Write-Host "✅ Backed up existing .env to .env.backup.$timestamp" -ForegroundColor Green
}

# Write the .env file
Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host ""
Write-Host "✅ Successfully created .env file!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Location: $envPath" -ForegroundColor Cyan
Write-Host ""
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ✏️  CHANGE the ADMIN_DEFAULT_PASSWORD in the .env file" -ForegroundColor White
Write-Host "   Current: SecureAdmin2025!ChangeMe" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 🤖 SET your TELEGRAM_BOT_TOKEN in the .env file" -ForegroundColor White
Write-Host "   Get it from: https://t.me/BotFather" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🔐 All other secrets have been randomly generated" -ForegroundColor White
Write-Host "   - JWT secrets" -ForegroundColor Gray
Write-Host "   - Encryption keys" -ForegroundColor Gray
Write-Host "   - Session secrets" -ForegroundColor Gray
Write-Host "   - Security key IDs" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ✅ Review optional settings (Redis, SMTP, etc.)" -ForegroundColor White
Write-Host ""
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 You can now run: npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  SECURITY NOTES:" -ForegroundColor Yellow
Write-Host "• Never commit .env to version control" -ForegroundColor Gray
Write-Host "• Use different secrets for production" -ForegroundColor Gray
Write-Host "• Store production secrets in a secure vault" -ForegroundColor Gray
Write-Host "• Rotate secrets regularly" -ForegroundColor Gray
Write-Host ""

