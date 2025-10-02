# Deployment Tools

Scripts and utilities for deploying the application to various environments.

## 📁 Available Tools

### `deploy.sh`
Standard deployment script for staging or production environments.

**Usage:**
```bash
chmod +x tools/deployment/deploy.sh
./tools/deployment/deploy.sh [environment]
```

**Arguments:**
- `environment` (optional): `staging` | `production` | `development` (default: staging)

**What it does:**
1. Validates environment configuration
2. Pulls latest code from repository
3. Installs/updates dependencies
4. Runs database migrations
5. Builds production assets
6. Restarts services
7. Performs health checks
8. Creates deployment log

**Example:**
```bash
# Deploy to staging
./tools/deployment/deploy.sh staging

# Deploy to production (requires confirmation)
./tools/deployment/deploy.sh production
```

---

### `deploy-production.sh`
Enhanced deployment script specifically for production with additional safety checks.

**Usage:**
```bash
chmod +x tools/deployment/deploy-production.sh
./tools/deployment/deploy-production.sh
```

**Additional safety features:**
- Requires explicit confirmation
- Creates automatic backup before deployment
- Validates all environment variables
- Checks for required secrets in Vault
- Tests database connection
- Performs rolling updates (zero downtime)
- Rollback capability
- Comprehensive logging

**Pre-deployment checklist:**
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured

---

### `docker-entrypoint.sh`
Docker container entrypoint script for proper initialization.

**Usage:**
This script is automatically executed when Docker containers start. No manual execution needed.

**What it does:**
1. Waits for database to be ready
2. Runs pending database migrations
3. Validates environment configuration
4. Initializes application services
5. Starts the main application process

**Configuration:**
Set via Dockerfile:
```dockerfile
ENTRYPOINT ["./tools/deployment/docker-entrypoint.sh"]
CMD ["npm", "start"]
```

---

### `generate-secrets.sh`
Generates strong, cryptographically secure secrets for production deployment.

**Usage:**
```bash
chmod +x tools/deployment/generate-secrets.sh
./tools/deployment/generate-secrets.sh
```

**What it generates:**
- JWT secret (64 characters)
- Session secret (64 characters)
- Cookie secret (64 characters)
- Database passwords (32 characters)
- API keys (32 characters)
- Encryption keys (32 bytes hex)
- Admin password (16 characters)

**Output:**
Creates `.env.production` file with all generated secrets.

**Features:**
- Cryptographically secure random generation
- Automatic backup of existing secrets
- Configurable length and complexity
- Option to generate individual secrets
- Integration with HashiCorp Vault (optional)

**Example:**
```bash
# Generate all secrets
./tools/deployment/generate-secrets.sh

# Generate specific secret
./tools/deployment/generate-secrets.sh --secret jwt

# Output to custom file
./tools/deployment/generate-secrets.sh --output .env.custom
```

---

## 🚀 Deployment Workflows

### First-Time Production Deployment

```bash
# 1. Generate production secrets
./tools/deployment/generate-secrets.sh

# 2. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your values

# 3. Setup Vault (if using)
./tools/vault/setup-vault-secrets.sh

# 4. Initialize database
cd backend
npx prisma migrate deploy

# 5. Deploy application
cd ..
./tools/deployment/deploy-production.sh
```

### Regular Updates

```bash
# 1. Run tests locally
npm test

# 2. Deploy to staging first
./tools/deployment/deploy.sh staging

# 3. Verify staging works
./tools/maintenance/health-check.js

# 4. Deploy to production
./tools/deployment/deploy-production.sh
```

### Rollback Procedure

```bash
# 1. Stop current deployment
docker-compose down

# 2. Restore backup
./tools/maintenance/restore-backup.sh [backup-id]

# 3. Deploy previous version
git checkout [previous-tag]
./tools/deployment/deploy-production.sh

# 4. Verify system health
./tools/maintenance/health-check.js
```

---

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Development
docker-compose -f config/docker/docker-compose.dev.yml up -d

# Production (PostgreSQL)
docker-compose -f config/docker/docker-compose.postgres-prod.yml up -d

# With environment file
docker-compose -f config/docker/docker-compose.postgres-prod.yml --env-file .env.production up -d
```

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache
```

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] All secrets generated and secure
- [ ] Environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Database encryption enabled
- [ ] Vault initialized and unsealed
- [ ] Backups automated
- [ ] Monitoring configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured

---

## 📊 Monitoring Deployment

After deployment, monitor:

```bash
# Check service health
./tools/maintenance/health-check.js

# View logs
docker-compose logs -f

# Check system resources
docker stats

# Monitor database
./tools/database/optimize-database.sh --check-only
```

---

## 🆘 Troubleshooting

### Deployment fails
1. Check logs: `docker-compose logs backend`
2. Verify environment variables
3. Test database connection
4. Check disk space: `df -h`

### Migration fails
1. Backup database first
2. Check migration files
3. Test on staging environment
4. Rollback if needed

### Services won't start
1. Check Docker logs
2. Verify port availability
3. Check health endpoints
4. Review entrypoint script output

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Guide](https://docs.docker.com/compose/)
- [Deployment Best Practices](../../docs/deployment/production-deployment.md)
- [Security Guidelines](../../docs/security/)
