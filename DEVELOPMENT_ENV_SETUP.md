# Development Environment Setup Guide

This guide shows you how to configure your `.env` file for localhost development.

## Quick Setup

1. Copy your production `.env` file to `.env.development` or `.env`
2. Make the following changes for localhost development:

## Key Changes for Development

### 1. General Configuration
```env
NODE_ENV=development
SERVER_IP=localhost
```

### 2. Application URLs (Change all IPs to localhost)
```env
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
WEBHOOK_BASE_URL=http://localhost
```

### 3. CORS Configuration (Add localhost variants)
```env
CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

### 4. Logging (More verbose for development)
```env
LOG_LEVEL=debug
ENABLE_JSON_LOGS=false
LOG_REQUESTS=true
LOG_ERRORS=true
```

### 5. Feature Flags (Development-friendly settings)
```env
# Enable AdminJS for easier database management
ENABLE_ADMINJS=true

# Disable webhook mode (use polling for local bot testing)
ENABLE_WEBHOOK_MODE=false

# Disable rate limiting for easier testing
ENABLE_RATE_LIMITING=false

# Disable CSRF for easier API testing
ENABLE_CSRF_PROTECTION=false

# Keep these enabled
ENABLE_AUDIT_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_SECURITY=true
ENABLE_HEALTH_CHECKS=true

# Disable metrics (not needed in dev)
ENABLE_METRICS=false
```

### 6. Security Settings (Relaxed for development)
```env
# Relaxed rate limits
RATE_LIMIT_MAX_REQUESTS=100
API_RATE_LIMIT_MAX=1000

# Relaxed spam detection
SPAM_MAX_MESSAGES_PER_MINUTE=30
SPAM_SUSPICION_THRESHOLD=80
SPAM_BAN_DURATION=600000
```

### 7. Admin Password (Simpler for dev)
```env
ADMIN_DEFAULT_PASSWORD=Admin123!
```

### 8. Backup Configuration (Shorter retention)
```env
BACKUP_RETENTION_DAYS=7
```

### 9. Docker Project Name (Different from production)
```env
COMPOSE_PROJECT_NAME=telegram_ecommerce_dev
```

### 10. Telegram Bot Token
```env
# ⚠️ IMPORTANT: Replace with your bot token from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# ⚠️ Replace with your Telegram ID from @userinfobot
SUPER_ADMIN_TELEGRAM_ID=your_telegram_id_here
```

## Complete Development Configuration

Here's the full `.env` file content for development:

```env
# =============================================================================
# TELEGRAM ECOMMERCE CMS - DEVELOPMENT ENVIRONMENT CONFIGURATION
# =============================================================================
# Configured for localhost development
# =============================================================================

# =============================================================================
# GENERAL CONFIGURATION
# =============================================================================
NODE_ENV=development
SERVER_IP=localhost

# =============================================================================
# DATABASE CONFIGURATION (SQLite)
# =============================================================================
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./backend/prisma/dev.db

# =============================================================================
# APPLICATION URLS
# =============================================================================
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
WEBHOOK_BASE_URL=http://localhost

# Port Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000
BOT_PORT=3003
BOT_WEBHOOK_PORT=8443

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
# JWT Secrets (keep the same from production for now)
JWT_SECRET=JTtYVWvqnwubbg0TiSXLdpMX9mnQGM+aYsunnRGAg6PlRM6K6EyQ5qfy5x545oChOv16Y76ePkMsxDTao5W/kg==
JWT_REFRESH_SECRET=oAG7b2qaHQvFfpWftBaubwOvTmBboHKglBMJdM3dTv3fphpDLviq+62ep/Uf0sl4JHYoI1CPbseHGqYQKrb+oQ==
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
JWT_AUDIENCE=telegram-ecommerce-cms

# Session Secrets (keep the same from production for now)
SESSION_SECRET=OTCmG7kUpSKAmvEsa1+CKPJpzgCrBx2qV7yehueABmo=
COOKIE_SECRET=a+drvIHa7oExYrdvSE8NUCLjUhEipl9BtzZZVk4GpOU=

# Encryption Key IDs
SECURITY_LOGS_KEY_ID=security_logs_key_2025
SBOM_SIGNING_KEY_ID=sbom_signing_key_2025
COMMUNICATION_KEY_ID=communication_key_2025
WEBSOCKET_KEY_ID=websocket_key_2025
BACKUP_KEY_ID=backup_key_2025
STORAGE_KEY_ID=storage_key_2025
LOG_KEY_ID=log_key_2025

# Algorithm specifications
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm

# AdminJS Security (enabled for development)
ADMIN_DEFAULT_PASSWORD=Admin123!
ADMIN_COOKIE_SECRET=a+drvIHa7oExYrdvSE8NUCLjUhEipl9BtzZZVk4GpOU=
ADMIN_SESSION_SECRET=OTCmG7kUpSKAmvEsa1+CKPJpzgCrBx2qV7yehueABmo=

# Encryption Keys (keep the same from production for now)
ENCRYPTION_MASTER_KEY=qmXfi3GUSdvnacH4dFxPcQFPXNwRMz1Y
ENCRYPTION_DATA_KEY=pNyUKrBXORwarAQz2YPy6KaIssk3kcgq

# =============================================================================
# TELEGRAM BOT CONFIGURATION
# =============================================================================
# ⚠️ IMPORTANT: Replace with your real token from @BotFather
TELEGRAM_BOT_TOKEN=8476385665:AAFRGcTMjgxHyh2AcfBj6yeyes6oTN-3UFE

# Webhook Configuration (webhook disabled in dev, uses polling)
WEBHOOK_PATH=/webhook/telegram
WEBHOOK_SECRET=5e85fc5d15a9ffe489774ba642d630dfd94fba0b92db2f0f9477c1f300c65310
WEBHOOK_ADMIN_TOKEN=cf3c43726c2935ef3fa13bce963818a27fd9c6e81774462632e9833cf88f8808

# Bot Security Settings (relaxed for development)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
SPAM_MAX_MESSAGES_PER_MINUTE=30
SPAM_SUSPICION_THRESHOLD=80
SPAM_BAN_DURATION=600000

# Super Admin (get your ID from @userinfobot in Telegram)
# ⚠️ Replace with your Telegram ID for testing
SUPER_ADMIN_TELEGRAM_ID=123456789

# =============================================================================
# REDIS CONFIGURATION (optional for development)
# =============================================================================
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_MAX_RETRIES=3
REDIS_TTL=3600

# =============================================================================
# CORS CONFIGURATION (permissive for development)
# =============================================================================
CORS_WHITELIST=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# =============================================================================
# CSRF PROTECTION (disabled for easier development)
# =============================================================================
ENABLE_CSRF_PROTECTION=false
CSRF_COOKIE_NAME=_csrf
CSRF_HEADER_NAME=X-CSRF-Token

# =============================================================================
# API SECURITY (relaxed for development)
# =============================================================================
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=1000
API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# =============================================================================
# LOGGING CONFIGURATION (verbose for development)
# =============================================================================
LOG_LEVEL=debug
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD
ENABLE_JSON_LOGS=false
LOG_REQUESTS=true
LOG_ERRORS=true

# =============================================================================
# FEATURE FLAGS (development settings)
# =============================================================================
ENABLE_ADMINJS=true
ENABLE_WEBHOOK_MODE=false
ENABLE_RATE_LIMITING=false
ENABLE_AUDIT_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_SECURITY=true
ENABLE_METRICS=false
ENABLE_HEALTH_CHECKS=true

# =============================================================================
# MONITORING CONFIGURATION
# =============================================================================
PROMETHEUS_PORT=9090
METRICS_ENDPOINT=/metrics
HEALTH_CHECK_INTERVAL=30000

# =============================================================================
# BACKUP CONFIGURATION
# =============================================================================
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=7
BACKUP_DESTINATION=./storage/backups

# =============================================================================
# CMS CONFIGURATION (optional)
# =============================================================================
CMS_BASE_URL=http://localhost:9000
MEDUSA_JWT_SECRET=FOPyIWno2Qfs9wisI2tYzHScBbpCH51p
MEDUSA_COOKIE_SECRET=FOPyIWno2Qfs9wisI2tYzHScBbpCH51p
MEDUSA_WEBHOOK_TOKEN=medusa-webhook-token-dev

# =============================================================================
# EMAIL CONFIGURATION (optional - for testing)
# =============================================================================
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM=noreply@telegram-ecommerce.com

# =============================================================================
# SSL/TLS CONFIGURATION (disabled for local development)
# =============================================================================
USE_HTTPS=false
# SSL_CERT_PATH=/etc/ssl/certs/certificate.crt
# SSL_KEY_PATH=/etc/ssl/private/private.key

# =============================================================================
# DOCKER CONFIGURATION
# =============================================================================
COMPOSE_PROJECT_NAME=telegram_ecommerce_dev
COMPOSE_FILE=docker-compose.yml
```

## Usage Instructions

### Option 1: Manual Setup
1. Copy the complete configuration above
2. Create a new file named `.env` in your project root
3. Paste the configuration
4. Update `TELEGRAM_BOT_TOKEN` and `SUPER_ADMIN_TELEGRAM_ID` with your values

### Option 2: Quick Command (Windows PowerShell)
```powershell
# Copy your production env and edit it manually
Copy-Item .env .env.backup
# Then edit .env with the changes listed above
```

### Option 3: Quick Command (Linux/Mac)
```bash
# Copy your production env and edit it manually
cp .env .env.backup
# Then edit .env with the changes listed above
```

## Important Notes

1. **Bot Token**: Make sure to use your actual bot token from [@BotFather](https://t.me/BotFather)
2. **Telegram ID**: Get your Telegram ID from [@userinfobot](https://t.me/userinfobot)
3. **Database**: The SQLite database will be created automatically at `backend/prisma/dev.db`
4. **Redis**: Optional for development, you can skip running Redis if not needed
5. **AdminJS**: Access it at `http://localhost:3001/admin` with the configured password
6. **Security Keys**: Keep the same keys from production for consistency, or regenerate if needed

## Testing the Setup

After configuring, start the application:

```bash
# Install dependencies (if not done yet)
npm install

# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev

# Start bot (in another terminal)
cd bot
npm run dev
```

## Troubleshooting

### Issue: "Cannot connect to database"
- Ensure the `backend/prisma/dev.db` path is correct
- Run `npx prisma migrate dev` in the backend folder

### Issue: "Bot not responding"
- Verify your `TELEGRAM_BOT_TOKEN` is correct
- Check if `ENABLE_WEBHOOK_MODE=false` (should use polling in dev)
- Ensure no firewall is blocking the connection

### Issue: "CORS errors in browser"
- Verify `CORS_ORIGIN` matches your frontend URL
- Check `CORS_CREDENTIALS=true` is set
- Restart the backend after .env changes

### Issue: "Cannot access AdminJS"
- Ensure `ENABLE_ADMINJS=true`
- Navigate to `http://localhost:3001/admin`
- Use password from `ADMIN_DEFAULT_PASSWORD`

## Next Steps

Once your environment is configured:
1. Run database migrations: `cd backend && npx prisma migrate dev`
2. Seed initial data: `cd backend && npx prisma db seed`
3. Start all services as shown in the testing section
4. Access the frontend at `http://localhost:3000`
5. Access AdminJS at `http://localhost:3001/admin`

## Security Reminders

- ⚠️ **Never commit your `.env` file to version control**
- ⚠️ **Regenerate all secrets before deploying to production**
- ⚠️ **The development configuration is intentionally less secure for convenience**
- ⚠️ **Always use different bot tokens for development and production**


