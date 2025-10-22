# 🔧 Configuration Directory

Centralized configuration files for all project components and infrastructure.

## 📁 Directory Structure

```
config/
├── compliance/          # Compliance and regulatory specs
├── docker/             # Docker Compose files
├── environments/       # Environment variable templates
├── kubernetes/        # Kubernetes manifests
├── logstash/          # Logstash log processing
├── nginx/             # Nginx web server configs
├── pgbouncer/         # PostgreSQL connection pooler
├── postgres/          # PostgreSQL database configs
├── redis/             # Redis cache configs
├── security/          # Security profiles and headers
├── services/          # PM2 process management
├── tls/               # TLS/SSL certificates
└── vault/             # HashiCorp Vault secrets
```

## 🗂️ Configuration Categories

### 🐳 Infrastructure

#### [docker/](docker/README.md)
Docker Compose configurations for different deployment scenarios:
- `docker-compose.dev.yml` - Development (MySQL)
- `docker-compose.mysql-prod.yml` - Production (MySQL)
- `docker-compose.postgres-prod.yml` - Production (PostgreSQL)
- `docker-compose.mtls.yml` - Mutual TLS
- `docker-compose.secure-infrastructure.yml` - Security hardened
- `docker-compose.medusa.yml` - Medusa CMS integration

#### [kubernetes/](kubernetes/README.md)
Kubernetes manifests for cloud-native deployments:
- Security contexts and policies
- Network isolation
- Pod specifications

---

### 🌍 Environment

#### [environments/](environments/README.md)
Environment variable templates:
- `env.example` - Development template
- `env.production.example` - Production template
- `security.env.example` - Security configuration
- `vault.env.example` - Vault integration
- `bot.env.production.example` - Bot service config

**Quick start:**
```bash
cp config/environments/env.example .env
nano .env  # Edit with your values
```

---

### 🗄️ Databases

#### [postgres/](postgres/README.md)
PostgreSQL configuration and initialization:
- `postgresql.conf` - Server configuration
- `pg_hba.conf` - Authentication rules
- `init-*.sql` - Database initialization scripts
- Row-Level Security (RLS)
- Encryption setup

#### [redis/](redis/README.md)
Redis caching configuration:
- Authentication
- Persistence (RDB + AOF)
- Memory management
- Replication

#### [pgbouncer/](pgbouncer/README.md)
Connection pooling for PostgreSQL:
- Pool size management
- Connection limits
- Performance optimization

---

### 🌐 Web Servers

#### [nginx/](nginx/README.md)
Nginx reverse proxy configurations:
- `nginx.conf` - Standard production config
- `nginx-waf.conf` - Web Application Firewall
- `nginx-mtls.conf` - Mutual TLS authentication

**Usage:**
```bash
sudo cp config/nginx/nginx.conf /etc/nginx/
sudo nginx -t && sudo systemctl reload nginx
```

---

### 📊 Monitoring & Observability

#### [logstash/](logstash/README.md)
Log processing pipeline:
- Input from multiple sources
- Filtering and parsing
- Output to Elasticsearch

---

### 🔐 Security

#### [security/](security/README.md)
Security profiles and headers:
- AppArmor profiles
- Seccomp profiles
- HTTP security headers

#### [tls/](tls/README.md)
TLS/SSL certificate management:
- Certificate Authority setup
- Service certificate generation
- mTLS configuration

**Generate certificates:**
```bash
./config/tls/certificate-authority.sh
./config/tls/generate-service-certs.sh
```

#### [vault/](vault/README.md)
HashiCorp Vault secrets management:
- Vault server configuration
- Initialization scripts
- TLS setup
- Docker Compose deployment

**Quick start:**
```bash
docker-compose -f config/vault/docker-compose.vault.yml up -d
./config/vault/vault-init.sh
```

---

### 🛠️ Services

#### [services/](services/README.md)
PM2 process management:
- `ecosystem.config.cjs` - PM2 configuration
- Multi-process setup
- Clustering
- Auto-restart

**Usage:**
```bash
pm2 start config/services/ecosystem.config.cjs --env production
```

---

### 📋 Compliance

#### [compliance/](compliance/README.md)
Compliance specifications:
- RPO/RTO requirements
- Backup policies
- Recovery procedures
- SLA definitions

---

## 🚀 Quick Start Guides

### Development Setup

```bash
# 1. Copy environment template
cp config/environments/env.example .env

# 2. Edit configuration
nano .env

# 3. Start services
docker-compose -f config/docker/docker-compose.dev.yml up -d
```

### Production Deployment

```bash
# 1. Generate secrets
./tools/deployment/generate-secrets.sh

# 2. Configure environment
cp config/environments/env.production.example .env.production
nano .env.production

# 3. Setup Vault
./tools/vault/setup-vault-secrets.sh

# 4. Deploy with security
docker-compose -f config/docker/docker-compose.postgres-prod.yml \
               -f config/docker/docker-compose.mtls.yml \
               -f config/docker/docker-compose.secure-infrastructure.yml \
               up -d
```

### Security Hardening

```bash
# 1. Deploy encryption at rest
./tools/security/deploy-encryption-at-rest.sh

# 2. Deploy mTLS
./tools/security/deploy-mtls-stack.sh

# 3. Configure Nginx with WAF
sudo cp config/nginx/nginx-waf.conf /etc/nginx/nginx.conf
sudo systemctl reload nginx

# 4. Apply security profiles
docker-compose -f config/docker/docker-compose.secure-infrastructure.yml up -d
```

---

## 🎯 Configuration Workflows

### Database Setup

```bash
# PostgreSQL
docker-compose -f config/docker/docker-compose.postgres-prod.yml up -d

# Initialize database
docker exec -it postgres psql -U postgres -d telegram_ecommerce \
  -f /docker-entrypoint-initdb.d/init-sessions-table.sql

# Configure PgBouncer for connection pooling
# (automatically configured in Docker Compose)
```

### Monitoring Stack

```bash
# Application has built-in /metrics endpoint (JSON format)
curl http://localhost:3001/metrics

# For advanced monitoring, you can integrate external tools
# See: config/docker/docker-compose.secure-infrastructure.yml
```

### TLS/SSL Setup

```bash
# 1. Create Certificate Authority
./config/tls/certificate-authority.sh

# 2. Generate service certificates
./config/tls/generate-service-certs.sh

# 3. Deploy with mTLS
docker-compose -f config/docker/docker-compose.mtls.yml up -d
```

---

## 🔧 Configuration Management

### Environment Variables

All configurations use environment variables for flexibility:

```bash
# Load environment
export $(cat .env | xargs)

# Or use with Docker Compose
docker-compose --env-file .env.production up -d

# Validate configuration
./tools/deployment/validate-env.sh .env.production
```

### Secrets Management

**Development:**
- Store in `.env` files (git-ignored)

**Production:**
- Use Vault for all secrets
- Never hardcode credentials
- Rotate secrets regularly

```bash
# Store in Vault
vault kv put secret/application/jwt \
  secret="$(openssl rand -base64 64)"

# Retrieve in application
vault kv get -field=secret secret/application/jwt
```

---

## 📊 Configuration Validation

### Pre-Deployment Checks

```bash
# Test Nginx configuration
nginx -t -c config/nginx/nginx.conf

# Validate Docker Compose
docker-compose -f config/docker/docker-compose.postgres-prod.yml config

# Check PostgreSQL configuration
postgres --config-file=config/postgres/postgresql.conf -C shared_buffers

# Validate environment variables
./tools/deployment/validate-env.sh .env.production
```

### Security Audit

```bash
# Run security audit
./tools/maintenance/security-audit.sh

# Check for weak configurations
./tools/security/check-config-security.sh

# Verify TLS certificates
./tools/security/verify-certificates.sh
```

---

## 🐳 Docker Integration

All configurations are Docker-ready:

```yaml
services:
  backend:
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./config/tls:/etc/nginx/ssl:ro
      - ./config/security:/etc/security:ro
```

### Multi-File Docker Compose

Combine configurations for complex deployments:

```bash
docker-compose \
  -f config/docker/docker-compose.postgres-prod.yml \
  -f config/docker/docker-compose.mtls.yml \
  -f config/docker/docker-compose.secure-infrastructure.yml \
  -f config/vault/docker-compose.vault.yml \
  up -d
```

---

## 🆘 Troubleshooting

### Configuration Not Loading

```bash
# Check file permissions
ls -la config/

# Verify mounts in Docker
docker inspect <container> | grep Mounts -A 20

# Check logs
docker logs <container>
```

### Service Won't Start

```bash
# Validate configuration syntax
<service> -t -c config/<service>/<config-file>

# Check environment variables
docker exec <container> env | grep <VAR>

# Review startup logs
docker-compose logs <service>
```

### Permission Errors

```bash
# Fix ownership
chown -R 1000:1000 config/

# Set correct permissions
chmod 600 config/tls/*.key  # Private keys
chmod 644 config/tls/*.pem  # Certificates
chmod 644 config/*/*.conf   # Configuration files
```

---

## 📚 Additional Resources

### Documentation
- [Development Guide](../docs/development/)
- [Deployment Guide](../docs/deployment/)
- [Security Documentation](../docs/security/)
- [Architecture Overview](../docs/architecture/)

### Tools
- [Database Tools](../tools/database/)
- [Deployment Scripts](../tools/deployment/)
- [Security Tools](../tools/security/)
- [Vault Management](../tools/vault/)

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Vault Documentation](https://www.vaultproject.io/docs)
- [Prometheus Docs](https://prometheus.io/docs/)

---

## 🎓 Best Practices

1. **Never commit secrets** - Use `.env` files (git-ignored) or Vault
2. **Use templates** - Start from `.example` files
3. **Validate before deploy** - Test configurations
4. **Version control** - Track configuration changes
5. **Document changes** - Comment complex configurations
6. **Regular audits** - Review security settings
7. **Backup configs** - Include in backup procedures
8. **Test recovery** - Verify configuration restoration

---

**Last Updated:** September 30, 2025  
**Configuration Version:** 1.0  
**Maintainer:** Project Team