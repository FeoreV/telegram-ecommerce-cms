# Environment Configuration Templates

This directory contains environment variable templates for different deployment scenarios.

## 📁 Available Templates

### `env.example`
**Purpose:** Development environment template

**Usage:**
```bash
# Copy to project root
cp config/environments/env.example .env

# Edit with your values
nano .env
```

**Key sections:**
- **Application**: Port, Node environment
- **Database**: Connection strings (SQLite for dev)
- **Redis**: Cache connection
- **Telegram Bot**: Bot token and admin ID
- **Security**: JWT secrets (development keys)
- **AdminJS**: Admin panel configuration

**When to use:** Local development, testing

---

### `env.production.example`
**Purpose:** Full production environment configuration

**Usage:**
```bash
# Copy to project root as production env
cp config/environments/env.production.example .env.production

# Edit with STRONG production values
nano .env.production
```

**Key sections:**
- **Database**: PostgreSQL/MySQL production connections
- **Redis**: Production Redis with password
- **Security**: Strong secrets (64+ characters)
- **Vault**: HashiCorp Vault integration
- **Monitoring**: Prometheus, Grafana endpoints
- **Logging**: ELK stack configuration
- **SSL/TLS**: Certificate paths
- **Backup**: Automated backup configuration

**Security requirements:**
- ✅ Strong passwords (32+ characters)
- ✅ Unique JWT secrets (64+ characters)
- ✅ Vault integration enabled
- ✅ All default values changed
- ✅ Database encryption enabled
- ✅ SSL/TLS configured

**When to use:** Production deployment

---

### `security.env.example`
**Purpose:** Security-specific configuration

**Usage:**
```bash
# Use with production environment
cp config/environments/security.env.example .env.security

# Source in production scripts
source .env.security
```

**Key sections:**
- **Encryption**: Master keys, algorithm settings
- **Vault**: Vault-specific credentials
- **SSL/TLS**: Certificate management
- **Security Policies**: Rate limiting, CORS settings
- **Audit**: Logging and monitoring

**When to use:** Security-hardened deployments

---

### `vault.env.example`
**Purpose:** HashiCorp Vault configuration

**Usage:**
```bash
cp config/environments/vault.env.example .env.vault
nano .env.vault
```

**Key sections:**
- **Vault Address**: Vault server URL
- **Authentication**: AppRole credentials
- **Secret Paths**: KV and Transit engine paths
- **Key Rotation**: Rotation policies

**When to use:** When using Vault for secrets management

---

### `bot.env.production.example`
**Purpose:** Telegram bot-specific production configuration

**Usage:**
```bash
# For bot service only
cp config/environments/bot.env.production.example bot/.env.production
```

**Key sections:**
- **Bot Token**: Production bot token
- **Webhook**: Webhook URL and certificate
- **API**: Backend API connection
- **Rate Limiting**: Bot-specific limits

**When to use:** Separate bot service deployment

---

## 🔧 Configuration Workflow

### Development Setup

```bash
# 1. Copy development template
cp config/environments/env.example .env

# 2. Minimal required changes
# - TELEGRAM_BOT_TOKEN (from @BotFather)
# - JWT_SECRET (any strong random string for dev)

# 3. Start development
docker-compose up -d
```

### Production Setup

```bash
# 1. Generate production secrets
./tools/deployment/generate-secrets.sh

# 2. Copy and customize
cp config/environments/env.production.example .env.production

# 3. Edit with generated secrets
nano .env.production

# 4. Validate configuration
./tools/deployment/validate-env.sh .env.production

# 5. Deploy
./tools/deployment/deploy-production.sh
```

### Security-Hardened Setup

```bash
# 1. Setup Vault first
./tools/vault/setup-vault-secrets.sh

# 2. Configure all environment files
cp config/environments/env.production.example .env.production
cp config/environments/security.env.example .env.security
cp config/environments/vault.env.example .env.vault

# 3. Use Vault for secrets
# Edit files to reference Vault paths instead of hardcoded values

# 4. Deploy with security features
./tools/security/deploy-encryption-at-rest.sh
./tools/security/deploy-mtls-stack.sh
```

---

## 🔐 Security Best Practices

### Never Commit `.env` Files
```bash
# Ensure .env files are ignored
cat .gitignore | grep "\.env"

# Should see:
# .env
# .env.local
# .env.*.local
# *.env
# !*.env.example
```

### Strong Secret Generation

```bash
# Generate strong random secrets
openssl rand -base64 64

# Or use the provided tool
./tools/deployment/generate-secrets.sh
```

### Validate Before Deployment

```bash
# Check for weak secrets
./tools/maintenance/security-audit.sh

# Validate environment
node tools/deployment/validate-env.js .env.production
```

---

## 📋 Environment Variables Checklist

### Critical (Must Change)
- [ ] `TELEGRAM_BOT_TOKEN` - From @BotFather
- [ ] `JWT_SECRET` - Strong random (64+ chars)
- [ ] `JWT_REFRESH_SECRET` - Different from JWT_SECRET
- [ ] `DATABASE_URL` - Production database connection
- [ ] `ADMIN_DEFAULT_PASSWORD` - Strong password

### Important (Recommended)
- [ ] `SESSION_SECRET` - Session encryption
- [ ] `ADMIN_COOKIE_SECRET` - Admin panel security
- [ ] `ADMIN_SESSION_SECRET` - Admin sessions
- [ ] `ENCRYPTION_KEY` - Data encryption
- [ ] `REDIS_PASSWORD` - Redis security

### Optional (As Needed)
- [ ] `VAULT_ADDR` - If using Vault
- [ ] `VAULT_TOKEN` - Vault authentication
- [ ] `AWS_*` - If using AWS services
- [ ] `SMTP_*` - If sending emails
- [ ] `SENTRY_DSN` - If using Sentry

---

## 🔄 Environment Management

### Multiple Environments

```bash
# Development
.env                    # Local development
.env.local             # Personal overrides

# Staging
.env.staging           # Staging environment

# Production
.env.production        # Production environment
.env.security          # Security config
.env.vault             # Vault config
```

### Loading Environments

```bash
# Docker Compose
docker-compose --env-file .env.production up -d

# Node.js
node -r dotenv/config backend/src/index.js dotenv_config_path=.env.production

# Shell scripts
source .env.production
```

---

## 🆘 Troubleshooting

### Missing Variables

```bash
# Check what variables are missing
./tools/deployment/check-env.sh .env.production
```

### Invalid Values

```bash
# Validate format
./tools/deployment/validate-env.sh .env.production
```

### Connection Issues

```bash
# Test database connection
node tools/database/test-connection.js

# Test Redis connection
redis-cli -h 82.147.84.78 -p 6379 ping
```

---

## 📚 Additional Resources

- [Environment Setup Guide](../../docs/development/environment-setup.md)
- [Production Deployment](../../docs/deployment/production-deployment.md)
- [Security Configuration](../../docs/security/)
- [Vault Setup](../../docs/deployment/vault-setup-guide.md)

---

## 🔗 Related Tools

- [Generate Secrets](../../tools/deployment/generate-secrets.sh) - Generate secure secrets
- [Vault Setup](../../tools/vault/setup-vault-secrets.sh) - Configure Vault
- [Security Audit](../../tools/maintenance/security-audit.sh) - Check configuration security
