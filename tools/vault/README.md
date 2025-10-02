# Vault Tools

Scripts for managing HashiCorp Vault, secret management, and key hierarchies.

## 📁 Available Tools

### `setup-vault-secrets.sh`
Initial setup script for HashiCorp Vault integration.

**Usage:**
```bash
chmod +x tools/vault/setup-vault-secrets.sh
./tools/vault/setup-vault-secrets.sh
```

**What it does:**

#### Vault Initialization
- Initializes Vault server
- Generates unseal keys
- Creates root token
- Configures seal/unseal mechanism
- Sets up audit logging

#### Secret Engines
- Enables KV (Key-Value) v2 engine
- Enables Transit engine for encryption
- Enables Database engine for dynamic credentials
- Configures PKI engine for certificates
- Sets up AWS/GCP engines (if applicable)

#### Authentication Methods
- AppRole authentication
- Token authentication
- Kubernetes authentication (if applicable)
- JWT/OIDC authentication (optional)

#### Policies
- Creates admin policy
- Creates application policies
- Configures least-privilege access
- Sets up policy inheritance

#### Secrets Storage
Stores application secrets:
- JWT secrets
- Database credentials
- API keys
- Encryption keys
- Third-party service credentials

**Prerequisites:**
- Vault installed (1.12+)
- Vault server running
- Network access to Vault
- Sufficient permissions

**Environment variables:**
```bash
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=your-root-token
VAULT_NAMESPACE=telegram-ecommerce
```

**Output:**
- Unseal keys (store securely!)
- Root token (store securely!)
- AppRole credentials
- Policy configurations

**⚠️ Security Notice:**
Store unseal keys and root token in a secure location!
- Use multiple key shares (Shamir's Secret Sharing)
- Store in password manager
- Distribute among trusted team members
- Never commit to version control

---

### `init-key-hierarchy.sh`
Initializes the three-tier key hierarchy for encryption.

**Usage:**
```bash
chmod +x tools/vault/init-key-hierarchy.sh
./tools/vault/init-key-hierarchy.sh
```

**Key Hierarchy:**

```
┌─────────────────────────────────────────────┐
│  Tier 1: Master Keys (Vault Root)          │
│  - Vault unseal keys                        │
│  - Root token                               │
│  - Highest security level                   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Tier 2: Data Encryption Keys (Transit)    │
│  - Payment data encryption                  │
│  - PII encryption                           │
│  - File encryption                          │
│  - Automatic rotation                       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Tier 3: Service Keys (KV Store)           │
│  - JWT secrets                              │
│  - Session keys                             │
│  - API keys                                 │
│  - Service credentials                      │
└─────────────────────────────────────────────┘
```

**What it creates:**

#### Master Keys (Tier 1)
- Vault unseal keys (5 shares, 3 required)
- Root token
- Recovery keys

#### Data Encryption Keys (Tier 2)
- `payment-data` encryption key
- `pii-data` encryption key
- `file-encryption` key
- `backup-encryption` key

#### Service Keys (Tier 3)
- Application secrets in KV store
- Database credentials
- API keys
- Session secrets

**Key Properties:**
- Automatic rotation enabled
- Version tracking
- Access logging
- Deletion protection

**Verification:**
```bash
# List encryption keys
vault list transit/keys

# Check key properties
vault read transit/keys/payment-data

# Test encryption
echo "test" | base64 | vault write transit/encrypt/payment-data plaintext=-
```

---

### `key-rotation-automation.sh`
Automated key rotation script for all tiers.

**Usage:**
```bash
chmod +x tools/vault/key-rotation-automation.sh

# Run manually
./tools/vault/key-rotation-automation.sh

# Schedule (add to cron)
0 2 * * 0 /path/to/tools/vault/key-rotation-automation.sh
```

**Rotation Strategy:**

#### Tier 1: Master Keys
- **Frequency**: Annually or on security incident
- **Method**: Manual rotation with team coordination
- **Requires**: Quorum of key holders

#### Tier 2: Data Encryption Keys
- **Frequency**: Every 90 days (automatic)
- **Method**: Transit engine auto-rotation
- **Old keys**: Retained for decryption
- **Impact**: Zero downtime

#### Tier 3: Service Keys
- **Frequency**: Every 30 days
- **Method**: Automated secret rotation
- **Applications**: Auto-reloaded
- **Rollback**: Previous version retained

**What it does:**

1. **Pre-rotation checks**
   - Verify Vault health
   - Check key usage
   - Backup current keys
   - Notify administrators

2. **Rotate keys**
   - Transit keys (Tier 2)
   - KV secrets (Tier 3)
   - Database credentials
   - API keys

3. **Update applications**
   - Reload configurations
   - Update environment variables
   - Restart services if needed
   - Verify connectivity

4. **Post-rotation validation**
   - Test encryption/decryption
   - Verify application access
   - Check audit logs
   - Generate rotation report

**Configuration:**
```bash
# .env
ROTATION_SCHEDULE_DAYS=90
ROTATION_NOTIFICATION_EMAIL=admin@example.com
ROTATION_BACKUP_ENABLED=true
ROTATION_DRY_RUN=false
```

**Notification:**
Email alert sent to administrators:
- Rotation start time
- Keys rotated
- Any errors
- Next rotation date

**Rollback:**
```bash
# Rollback to previous version
./tools/vault/rollback-rotation.sh --version previous

# Rollback specific key
./tools/vault/rollback-rotation.sh --key payment-data --version 5
```

---

## 🔐 Vault Management

### Daily Operations

```bash
# Check Vault status
vault status

# Unseal Vault (if sealed)
vault operator unseal

# List secrets
vault kv list secret/application

# Read secret
vault kv get secret/application/jwt

# Write secret
vault kv put secret/application/api-key value=your-key

# Delete secret
vault kv delete secret/application/old-key
```

### Key Management

```bash
# List all keys
vault list transit/keys

# Rotate key manually
vault write -f transit/keys/payment-data/rotate

# Check key version
vault read transit/keys/payment-data

# Enable key deletion (dangerous!)
vault write transit/keys/payment-data/config deletion_allowed=true
```

### Encryption Operations

```bash
# Encrypt data
echo -n "sensitive data" | base64 | \
  vault write transit/encrypt/payment-data plaintext=- -format=json | \
  jq -r .data.ciphertext

# Decrypt data
echo "vault:v1:ciphertext" | \
  vault write transit/decrypt/payment-data ciphertext=- -format=json | \
  jq -r .data.plaintext | base64 -d
```

---

## 🔄 Backup and Recovery

### Backup Vault Data

```bash
# Snapshot (requires Vault Enterprise)
vault operator raft snapshot save backup.snap

# Or use backup script
./tools/vault/backup-vault.sh

# Backup location
storage/backups/vault/vault-backup-$(date +%Y%m%d).snap
```

### Restore from Backup

```bash
# Restore snapshot
vault operator raft snapshot restore backup.snap

# Or use restore script
./tools/vault/restore-vault.sh backup.snap
```

### Disaster Recovery

```bash
# Generate recovery token
vault operator generate-root -init

# Complete disaster recovery process
./tools/vault/disaster-recovery.sh
```

---

## 🔍 Monitoring and Auditing

### Enable Audit Logging

```bash
# File audit device
vault audit enable file file_path=/var/log/vault/audit.log

# Syslog audit device
vault audit enable syslog

# Socket audit device
vault audit enable socket address=127.0.0.1:9090
```

### View Audit Logs

```bash
# Tail audit log
tail -f /var/log/vault/audit.log | jq

# Search for specific operations
cat /var/log/vault/audit.log | jq 'select(.request.path | contains("transit/encrypt"))'

# Count operations by type
cat /var/log/vault/audit.log | jq -r '.request.operation' | sort | uniq -c
```

### Metrics

```bash
# Vault metrics endpoint
curl http://localhost:8200/v1/sys/metrics

# Integrate with Prometheus
# See config/prometheus/prometheus.yml
```

---

## 🛡️ Security Best Practices

### Access Control

```bash
# Create restrictive policy
vault policy write app-policy - <<EOF
path "secret/data/application/*" {
  capabilities = ["read"]
}
path "transit/encrypt/payment-data" {
  capabilities = ["update"]
}
path "transit/decrypt/payment-data" {
  capabilities = ["update"]
}
EOF

# Apply policy to AppRole
vault write auth/approle/role/app-role policies="app-policy"
```

### Token Management

```bash
# Create limited-lifetime token
vault token create -ttl=1h -policy=app-policy

# Revoke token
vault token revoke <token>

# Revoke all tokens under path
vault token revoke -mode=path auth/approle

# List token accessors
vault list auth/token/accessors
```

### Seal/Unseal

```bash
# Check seal status
vault status | grep Sealed

# Seal Vault (emergency)
vault operator seal

# Unseal Vault (requires threshold of key shares)
vault operator unseal <key-share-1>
vault operator unseal <key-share-2>
vault operator unseal <key-share-3>
```

---

## 🚨 Emergency Procedures

### Vault Sealed Unexpectedly

```bash
# 1. Check Vault status
vault status

# 2. Gather key shares from key holders
# 3. Unseal Vault
vault operator unseal <share-1>
vault operator unseal <share-2>
vault operator unseal <share-3>

# 4. Verify applications reconnect
./tools/maintenance/health-check.js
```

### Suspected Key Compromise

```bash
# 1. Rotate affected keys immediately
./tools/vault/key-rotation-automation.sh --emergency

# 2. Revoke suspicious tokens
vault token revoke -mode=path auth/approle

# 3. Audit access logs
cat /var/log/vault/audit.log | jq 'select(.auth.metadata.role_name == "compromised-role")'

# 4. Update policies
vault policy write updated-policy policy.hcl

# 5. Notify team
./tools/security/send-security-alert.sh "Key rotation completed"
```

### Lost Unseal Keys

**Prevention is key!** If unseal keys are lost:
1. Vault cannot be unsealed
2. All data is inaccessible
3. Complete redeployment required

**Mitigation:**
- Use auto-unseal with cloud KMS
- Distribute keys among multiple trusted parties
- Store recovery keys securely
- Regular backup verification

---

## 📚 Additional Resources

- [Key Hierarchy Specification](../../docs/security/key-hierarchy-specification.md)
- [Vault Configuration](../../config/vault/)
- [Security Architecture](../../docs/security/security-architecture-overview.md)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)

---

## 🔗 Integration

### Application Integration

```typescript
// backend/src/services/VaultService.ts
import Vault from 'node-vault';

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

// Read secret
const secret = await vault.read('secret/data/application/jwt');

// Encrypt data
const encrypted = await vault.write('transit/encrypt/payment-data', {
  plaintext: Buffer.from(data).toString('base64')
});
```

### Docker Integration

```yaml
# docker-compose.vault.yml
services:
  vault:
    image: vault:latest
    cap_add:
      - IPC_LOCK
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: dev-token
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    ports:
      - "8200:8200"
```

---

## ⚙️ Configuration Files

Vault configuration files location:
- `config/vault/vault-config.hcl` - Main Vault configuration
- `config/vault/vault-tls.hcl` - TLS configuration
- `config/vault/docker-compose.vault.yml` - Docker setup
