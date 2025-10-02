# Security Tools

Scripts for enhancing security, deploying security features, and managing secure infrastructure.

## 📁 Available Tools

### `deploy-encryption-at-rest.sh`
Deploys encryption-at-rest for all sensitive data storage.

**Usage:**
```bash
chmod +x tools/security/deploy-encryption-at-rest.sh
./tools/security/deploy-encryption-at-rest.sh
```

**What it does:**

#### Database Encryption
- Enables transparent data encryption (TDE)
- Encrypts database files at rest
- Configures encrypted backups
- Sets up key management

#### File System Encryption
- Encrypts upload directories
- Encrypts temporary file storage
- Encrypts log files with sensitive data
- Configures encrypted volumes

#### Vault Integration
- Stores encryption keys in Vault
- Configures automatic key rotation
- Sets up key hierarchy
- Implements envelope encryption

**Prerequisites:**
- HashiCorp Vault installed and configured
- Database supports encryption (MySQL Enterprise or PostgreSQL with pgcrypto)
- Sufficient system resources
- Root/admin access

**Configuration:**
```bash
# Environment variables
ENCRYPTION_ALGORITHM=AES-256-GCM
KEY_ROTATION_DAYS=90
VAULT_ENCRYPTION_PATH=secret/encryption
```

**Verification:**
```bash
# Check encryption status
./tools/security/check-encryption-status.sh

# Test encryption
./tools/security/test-encryption.sh
```

---

### `deploy-mtls-stack.sh`
Deploys mutual TLS (mTLS) for service-to-service authentication.

**Usage:**
```bash
chmod +x tools/security/deploy-mtls-stack.sh
./tools/security/deploy-mtls-stack.sh
```

**What it does:**

#### Certificate Authority Setup
- Creates internal Certificate Authority (CA)
- Generates CA root certificate
- Configures certificate signing
- Sets up certificate revocation list (CRL)

#### Service Certificates
- Generates certificates for each service:
  - Backend API
  - Frontend server
  - Bot service
  - Database connections
  - Redis connections
- Configures automatic renewal
- Implements certificate pinning

#### mTLS Configuration
- Configures Nginx for mTLS
- Updates service configurations
- Sets up certificate validation
- Configures fallback mechanisms

#### Docker Integration
- Updates Docker Compose files
- Configures Docker secrets
- Sets up encrypted overlay networks
- Implements service mesh (optional)

**Architecture:**
```
┌─────────────────────────────────────────┐
│  Certificate Authority (CA)             │
│  └── Root Certificate                   │
└─────────────────────────────────────────┘
           │
           ├── Backend Service Certificate
           ├── Frontend Service Certificate
           ├── Bot Service Certificate
           ├── Database Client Certificate
           └── Redis Client Certificate
```

**Prerequisites:**
- OpenSSL installed
- Docker Compose 3.8+
- Write access to config directory
- Services running or ready to restart

**Generated files:**
```
config/tls/
├── ca/
│   ├── ca-cert.pem
│   └── ca-key.pem
├── backend/
│   ├── cert.pem
│   └── key.pem
├── frontend/
│   ├── cert.pem
│   └── key.pem
└── bot/
    ├── cert.pem
    └── key.pem
```

**Configuration:**
```bash
# Certificate validity
CERT_VALIDITY_DAYS=365

# Key size
KEY_SIZE=4096

# Certificate subject
CERT_COUNTRY=US
CERT_STATE=State
CERT_CITY=City
CERT_ORG=YourOrganization
```

**Verification:**
```bash
# Verify mTLS setup
./tools/security/verify-mtls.sh

# Test service connections
./tools/security/test-mtls-connections.sh

# Check certificate expiration
./tools/security/check-cert-expiration.sh
```

**Docker Compose Integration:**
```bash
# Use mTLS configuration
docker-compose -f config/docker/docker-compose.mtls.yml up -d
```

---

## 🔐 Security Best Practices

### Encryption at Rest

**When to use:**
- Storing sensitive user data
- Payment information
- Personal identifiable information (PII)
- Authentication credentials
- API keys and secrets

**Implementation checklist:**
- [ ] Database encryption enabled
- [ ] File system encryption configured
- [ ] Backups encrypted
- [ ] Keys stored in Vault
- [ ] Key rotation automated
- [ ] Encryption tested and verified

### Mutual TLS (mTLS)

**When to use:**
- Service-to-service communication
- Microservices architecture
- Zero-trust network model
- High-security requirements
- Compliance requirements (PCI DSS, HIPAA)

**Implementation checklist:**
- [ ] CA properly secured
- [ ] Certificates generated for all services
- [ ] Certificate rotation configured
- [ ] Monitoring and alerts set up
- [ ] Fallback mechanism tested
- [ ] Documentation updated

---

## 🛡️ Security Hardening

### Complete Security Setup

```bash
# 1. Deploy encryption at rest
./tools/security/deploy-encryption-at-rest.sh

# 2. Deploy mTLS
./tools/security/deploy-mtls-stack.sh

# 3. Configure Vault
./tools/vault/setup-vault-secrets.sh

# 4. Run security audit
./tools/maintenance/security-audit.sh

# 5. Verify setup
./tools/security/verify-security-setup.sh
```

### Docker Security

```bash
# Use security-hardened configuration
docker-compose -f config/docker/docker-compose.secure-infrastructure.yml up -d

# Or use both mTLS and secure infrastructure
docker-compose \
  -f config/docker/docker-compose.postgres-prod.yml \
  -f config/docker/docker-compose.mtls.yml \
  -f config/docker/docker-compose.secure-infrastructure.yml \
  up -d
```

---

## 🔄 Key Rotation

### Automatic Rotation

```bash
# Setup automated key rotation
./tools/vault/key-rotation-automation.sh

# Manual rotation
./tools/security/rotate-keys.sh --all

# Rotate specific keys
./tools/security/rotate-keys.sh --type encryption
./tools/security/rotate-keys.sh --type certificates
```

### Rotation Schedule

- **Encryption keys**: Every 90 days
- **Certificates**: Every 365 days (auto-renewed at 30 days)
- **JWT secrets**: Every 180 days
- **Database passwords**: Every 90 days

---

## 🔍 Security Monitoring

### Real-time Monitoring

```bash
# Monitor security events
./tools/security/monitor-security-events.sh

# Check for anomalies
./tools/security/check-anomalies.sh

# View security logs
tail -f storage/logs/security-*.log
```

### Alerts Configuration

Configure in `config/prometheus/alert-rules.yml`:

```yaml
groups:
  - name: security
    rules:
      - alert: UnauthorizedAccess
        expr: rate(unauthorized_requests_total[5m]) > 10
        
      - alert: CertificateExpiringSoon
        expr: ssl_certificate_expiry_days < 30
        
      - alert: FailedAuthAttempts
        expr: rate(failed_auth_attempts[5m]) > 20
```

---

## 📋 Security Compliance

### PCI DSS Compliance

```bash
# Run PCI DSS checklist
./tools/security/compliance-check.sh --standard pci-dss

# Generate compliance report
./tools/security/generate-compliance-report.sh --standard pci-dss
```

### GDPR Compliance

```bash
# Check GDPR requirements
./tools/security/compliance-check.sh --standard gdpr

# Data protection assessment
./tools/security/data-protection-assessment.sh
```

---

## 🆘 Security Incident Response

### Immediate Actions

```bash
# 1. Enable high-security mode
./tools/security/emergency-lockdown.sh

# 2. Rotate all credentials
./tools/security/rotate-keys.sh --all --force

# 3. Review access logs
./tools/security/analyze-access-logs.sh --suspicious

# 4. Generate incident report
./tools/security/incident-report.sh --output incident-$(date +%Y%m%d).pdf
```

### Forensics

```bash
# Capture system state
./tools/security/capture-forensics.sh

# Analyze security logs
./tools/security/analyze-security-logs.sh --from "2025-09-30 00:00" --to "2025-09-30 23:59"

# Check for indicators of compromise
./tools/security/check-ioc.sh
```

---

## 🧪 Security Testing

### Penetration Testing

```bash
# Run automated penetration tests
./tools/security/pentest.sh

# Specific tests
./tools/security/pentest.sh --test sql-injection
./tools/security/pentest.sh --test xss
./tools/security/pentest.sh --test auth
```

### Vulnerability Scanning

```bash
# Scan Docker images
docker scan backend:latest

# Scan dependencies
npm audit
npm audit fix

# Full system scan
./tools/security/vulnerability-scan.sh --full
```

---

## 📚 Additional Resources

- [Security Architecture Overview](../../docs/security/security-architecture-overview.md)
- [Penetration Testing Guide](../../docs/security/penetration-testing-guide.md)
- [Key Hierarchy Specification](../../docs/security/key-hierarchy-specification.md)
- [Server Compromise Containment](../../docs/security/server-compromise-containment.md)
- [Security Quick Reference](../../docs/security/quick-reference-guide.md)

---

## 🔒 Security Contacts

For security issues:
- **Security Policy**: [.github/SECURITY.md](../../.github/SECURITY.md)
- **Report vulnerabilities**: See SECURITY.md for contact
- **Emergency**: Run `./tools/security/emergency-lockdown.sh`
