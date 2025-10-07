# 🛠️ Tools Directory

Comprehensive collection of utilities and scripts for managing the Telegram E-commerce Bot Platform.

## 📁 Directory Structure

```
tools/
├── database/        # Database management and optimization
├── deployment/      # Deployment and release scripts
├── development/     # Development environment setup
├── maintenance/     # System maintenance and monitoring
├── security/        # Security features and hardening
└── vault/          # HashiCorp Vault and secrets management
```

## 🚀 Quick Start

### First-Time Setup

```bash
# Development environment
./tools/development/setup-dev.sh

# Or with XAMPP
./tools/development/setup-xampp.sh

# Generate production secrets
./tools/deployment/generate-secrets.sh
```

### Daily Development

```bash
# Start development services
npm run dev

# Or with Docker
docker-compose up -d

# Check system health
node tools/maintenance/health-check.js
```

### Production Deployment

```bash
# 1. Setup Vault and secrets
./tools/vault/setup-vault-secrets.sh

# 2. Generate secure secrets
./tools/deployment/generate-secrets.sh

# 3. Deploy application
./tools/deployment/deploy-production.sh

# 4. Enable security features
./tools/security/deploy-encryption-at-rest.sh
./tools/security/deploy-mtls-stack.sh
```

## 📚 Detailed Documentation

Each subdirectory contains detailed README with usage instructions:

### 🗄️ [Database Tools](database/README.md)
Scripts for database management, optimization, and maintenance.

**Key tools:**
- `delete_all_users.js` - Reset user database (development only)
- `init-db.sql` - Initialize database schema
- `optimize-database.sh` - Database optimization and cleanup

**Use cases:**
- Database initialization
- Performance optimization
- Development data reset
- Schema management

---

### 🚀 [Deployment Tools](deployment/README.md)
Automated deployment scripts for various environments.

**Key tools:**
- `deploy.sh` - Standard deployment script
- `deploy-production.sh` - Production deployment with safety checks
- `docker-entrypoint.sh` - Docker container initialization
- `generate-secrets.sh` - Cryptographically secure secret generation

**Use cases:**
- Automated deployments
- Secret management
- Docker orchestration
- Environment configuration

---

### 💻 [Development Tools](development/README.md)
Setup and maintenance scripts for local development.

**Key tools:**
- `setup-dev.sh` / `setup-dev.bat` - Development environment setup
- `setup-xampp.sh` / `setup-xampp.bat` - XAMPP configuration
- `dev-compose.ps1` - PowerShell Docker Compose manager
- `kill-project-ports.ps1` - Free up occupied ports (Windows)
- `fix-adminjs-design-system.js` - AdminJS compatibility patches

**Use cases:**
- Initial project setup
- Local environment configuration
- Port conflict resolution
- Dependency fixes

---

### 🔧 [Maintenance Tools](maintenance/README.md)
System monitoring, health checks, and routine maintenance.

**Key tools:**
- `backup.sh` - Comprehensive backup solution
- `health-check.js` - System health verification
- `security-audit.sh` - Security vulnerability scanning

**Use cases:**
- Regular backups
- System monitoring
- Health checks
- Security audits
- Performance analysis

---

### 🔒 [Security Tools](security/README.md)
Security hardening and advanced security features.

**Key tools:**
- `deploy-encryption-at-rest.sh` - Enable data encryption
- `deploy-mtls-stack.sh` - Mutual TLS implementation

**Use cases:**
- Data encryption
- Service authentication
- Security compliance
- Certificate management
- Incident response

---

### 🔐 [Vault Tools](vault/README.md)
HashiCorp Vault integration and secret management.

**Key tools:**
- `setup-vault-secrets.sh` - Initial Vault configuration
- `init-key-hierarchy.sh` - Three-tier key hierarchy setup
- `key-rotation-automation.sh` - Automated key rotation

**Use cases:**
- Secrets management
- Encryption key management
- Automated key rotation
- Secure credential storage
- Disaster recovery

---

## 🎯 Common Workflows

### Complete Fresh Installation

```bash
# 1. Clone and setup development
git clone <repository-url>
cd botrt
./tools/development/setup-dev.sh

# 2. Start services
docker-compose up -d

# 3. Verify health
node tools/maintenance/health-check.js
```

### Production Deployment

```bash
# 1. Prepare environment
./tools/deployment/generate-secrets.sh
./tools/vault/setup-vault-secrets.sh

# 2. Security hardening
./tools/security/deploy-encryption-at-rest.sh
./tools/security/deploy-mtls-stack.sh

# 3. Deploy application
./tools/deployment/deploy-production.sh

# 4. Verify deployment
./tools/maintenance/health-check.js --verbose
```

### Regular Maintenance

```bash
# Daily: Health check
node tools/maintenance/health-check.js

# Weekly: Full backup
./tools/maintenance/backup.sh --full --encrypt --remote

# Weekly: Database optimization
./tools/database/optimize-database.sh

# Weekly: Security audit
./tools/maintenance/security-audit.sh

# Monthly: Key rotation
./tools/vault/key-rotation-automation.sh
```

### Emergency Procedures

```bash
# System health check
./tools/maintenance/health-check.js --verbose

# Create emergency backup
./tools/maintenance/backup.sh --full --encrypt --label emergency

# Security incident
./tools/security/deploy-mtls-stack.sh
./tools/vault/key-rotation-automation.sh --emergency

# Restore from backup
./tools/maintenance/restore-backup.sh [backup-id]
```

---

## 🔄 Automation with Cron

### Recommended Cron Jobs

```bash
# Edit crontab
crontab -e

# Add these jobs:

# Health check every 15 minutes
*/15 * * * * /path/to/tools/maintenance/health-check.js --json >> /var/log/health.log 2>&1

# Daily database backup at 2 AM
0 2 * * * /path/to/tools/maintenance/backup.sh --database-only

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 /path/to/tools/maintenance/backup.sh --full --encrypt --remote

# Weekly optimization on Sunday at 4 AM
0 4 * * 0 /path/to/tools/database/optimize-database.sh

# Weekly security audit on Sunday at 5 AM
0 5 * * 0 /path/to/tools/maintenance/security-audit.sh --report

# Monthly key rotation on 1st of month at 2 AM
0 2 1 * * /path/to/tools/vault/key-rotation-automation.sh
```

---

## 🐳 Docker Integration

### Development

```bash
# Start with Docker Compose helper
./tools/development/dev-compose.ps1 -Action start

# Or directly
docker-compose -f config/docker/docker-compose.dev.yml up -d
```

### Production

```bash
# PostgreSQL + Monitoring
docker-compose -f config/docker/docker-compose.postgres-prod.yml up -d

# With mTLS
docker-compose \
  -f config/docker/docker-compose.postgres-prod.yml \
  -f config/docker/docker-compose.mtls.yml \
  up -d

# With security hardening
docker-compose \
  -f config/docker/docker-compose.postgres-prod.yml \
  -f config/docker/docker-compose.secure-infrastructure.yml \
  up -d
```

---

## 📊 Monitoring and Observability

### Health Monitoring

```bash
# Quick health check
node tools/maintenance/health-check.js

# Detailed check with JSON output
node tools/maintenance/health-check.js --verbose --json

# Specific service check
node tools/maintenance/health-check.js --service backend
```

### Metrics

```bash
# Application metrics (Prometheus)
curl http://82.147.84.78:3001/metrics

# Vault metrics
curl http://82.147.84.78:8200/v1/sys/metrics

# System metrics
docker stats
```

### Logs

```bash
# Application logs
docker-compose logs -f backend

# Security logs
tail -f storage/logs/security-*.log

# Vault audit logs
tail -f /var/log/vault/audit.log | jq
```

---

## 🔐 Security Best Practices

1. **Never commit secrets** - Use environment variables and Vault
2. **Regular backups** - Automated daily backups with encryption
3. **Security audits** - Weekly automated security scans
4. **Key rotation** - Automated monthly key rotation
5. **Access control** - Principle of least privilege
6. **Monitoring** - Real-time security event monitoring
7. **Updates** - Keep dependencies and tools updated

---

## 🆘 Troubleshooting

### Tool doesn't execute

```bash
# Make script executable
chmod +x tools/path/to/script.sh

# Check shell compatibility
bash tools/path/to/script.sh
```

### Permission denied

```bash
# Run with appropriate permissions
sudo ./tools/path/to/script.sh

# Or fix ownership
sudo chown -R $USER:$USER tools/
```

### Dependencies missing

```bash
# Install required tools
npm install  # Node.js dependencies
# System dependencies vary by OS
```

---

## 📞 Support

- **Documentation**: See individual README files in each subdirectory
- **Issues**: Create a GitHub issue
- **Security**: See [Security Policy](../.github/SECURITY.md)

---

## 📚 Additional Resources

- [Development Guide](../docs/development/dev-quickstart.md)
- [Deployment Guide](../docs/deployment/production-deployment.md)
- [Security Documentation](../docs/security/)
- [Docker Configuration](../config/docker/README.md)

---

## 🎓 Learning Path

### For Developers
1. Start with [Development Tools](development/README.md)
2. Learn [Database Tools](database/README.md)
3. Explore [Maintenance Tools](maintenance/README.md)

### For DevOps
1. Begin with [Deployment Tools](deployment/README.md)
2. Master [Security Tools](security/README.md)
3. Configure [Vault Tools](vault/README.md)

### For System Administrators
1. Focus on [Maintenance Tools](maintenance/README.md)
2. Implement [Security Tools](security/README.md)
3. Setup monitoring and automation

---

**Last Updated**: September 30, 2025  
**Version**: 1.0  
**Maintainer**: Project Team