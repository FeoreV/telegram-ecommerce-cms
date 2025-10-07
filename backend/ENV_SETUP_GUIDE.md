# 🔐 Environment Setup Guide

This guide will help you set up all required environment variables for the Telegram E-Commerce CMS backend.

## Quick Start

### Option 1: Automated Setup (Recommended)

Run the setup script that matches your system:

**Windows (Batch):**
```bash
.\setup-env.bat
```

**Windows (PowerShell):**
```powershell
.\setup-env.ps1
```

**Linux/Mac/Node.js:**
```bash
node setup-env.js
```

This will automatically generate a `.env` file with all required secrets.

### Option 2: Manual Setup

1. Copy the example file:
   ```bash
   cp ../config/environments/env.example .env
   ```

2. Generate secrets using the provided script:
   ```bash
   node scripts/generate-secrets.js
   ```

3. Copy the generated secrets into your `.env` file.

## Required Environment Variables

### 🔑 Critical Security Variables

These MUST be set before starting the backend:

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `ADMIN_DEFAULT_PASSWORD` | Default admin password | Choose a strong password (min 8 chars, mix of upper/lower/numbers/symbols) |
| `JWT_SECRET` | JWT token signing secret | Auto-generated (64 bytes hex) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Auto-generated (64 bytes hex) |
| `ADMIN_COOKIE_SECRET` | Admin session cookie secret | Auto-generated (32 bytes hex) |
| `ADMIN_SESSION_SECRET` | Admin session secret | Auto-generated (32 bytes hex) |
| `ENCRYPTION_MASTER_KEY` | Master encryption key | Auto-generated (32 bytes hex) |
| `DATA_ENCRYPTION_KEY` | Data encryption key | Auto-generated (32 bytes hex) |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook validation | Auto-generated (32 bytes hex) |

### 🤖 Telegram Bot Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `TELEGRAM_WEBHOOK_URL` | Webhook URL (optional for dev) | `https://yourdomain.com/api/webhook` |

**How to get a bot token:**
1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow the instructions
4. Copy the token and paste it in `.env`

### 🔐 Security Key IDs

Auto-generated for encryption and security features:

- `SECURITY_LOGS_KEY_ID`
- `SBOM_SIGNING_KEY_ID`
- `COMMUNICATION_KEY_ID`
- `WEBSOCKET_KEY_ID`
- `BACKUP_KEY_ID`
- `STORAGE_KEY_ID`
- `LOG_KEY_ID`

### 📊 Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_PROVIDER` | Database type | `sqlite` (dev) or `mysql` (prod) |
| `DATABASE_URL` | Database connection string | `file:./prisma/dev.db` |

### 🌐 Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `FRONTEND_URL` | Frontend URL | `http://localhost:3000` |
| `ENABLE_ADMINJS` | Enable AdminJS panel | `true` |

## After Setup

### 1. ✅ Verify Your Configuration

Check that all required variables are set:
```bash
node scripts/check-env.js
```

### 2. 🗄️ Initialize the Database

```bash
npx prisma migrate dev
npx prisma db seed
```

### 3. 🚀 Start the Backend

```bash
npm run dev
```

### 4. 🔍 Verify It's Working

You should see:
- ✅ No warning messages about missing secrets
- ✅ Server listening on port 3001
- ✅ Database connected successfully
- ✅ AdminJS panel available at http://localhost:3001/admin

## Common Issues

### Issue: "ADMIN_DEFAULT_PASSWORD not set"

**Solution:** Make sure you've set `ADMIN_DEFAULT_PASSWORD` in your `.env` file.

### Issue: "Failed to initialize secret manager"

**Solution:** Run the setup script again to regenerate all secrets.

### Issue: "TELEGRAM_BOT_TOKEN invalid"

**Solution:** 
1. Get a new token from [@BotFather](https://t.me/BotFather)
2. Update `TELEGRAM_BOT_TOKEN` in `.env`
3. Restart the backend

### Issue: Secrets change on every restart

**Solution:** This means secrets are being auto-generated. Run the setup script to create a persistent `.env` file.

## Security Best Practices

### Development
- ✅ Use the auto-generated secrets
- ✅ Never commit `.env` to Git
- ✅ Use a simple password for `ADMIN_DEFAULT_PASSWORD`

### Production
- ⚠️ Generate NEW secrets for production
- ⚠️ Use strong, unique passwords
- ⚠️ Store secrets in a secure vault (e.g., HashiCorp Vault, AWS Secrets Manager)
- ⚠️ Enable HTTPS
- ⚠️ Rotate secrets regularly
- ⚠️ Use environment variables or secret management systems, not `.env` files

## Optional Configuration

### Email Notifications (SMTP)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@telegram-ecommerce.com
```

### Redis (Session Storage)

```env
REDIS_URL=redis://localhost:6379
```

### Vault Integration

```env
USE_VAULT=true
VAULT_ADDR=http://localhost:8200
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
```

## Troubleshooting

### Check Environment Variables

```bash
# On Windows
echo %ADMIN_DEFAULT_PASSWORD%

# On Linux/Mac
echo $ADMIN_DEFAULT_PASSWORD
```

### View All Loaded Variables

```bash
node -e "require('dotenv').config(); console.log(process.env)"
```

### Regenerate All Secrets

```bash
# Backup current .env
copy .env .env.backup

# Run setup again
.\setup-env.bat
```

## Need Help?

- 📚 Check the [main README](./README.md)
- 📖 Review [development docs](../docs/development/)
- 🐛 Open an issue on GitHub
- 💬 Ask in Telegram support group

---

**Last Updated:** 2025-10-07  
**Version:** 1.0.0

