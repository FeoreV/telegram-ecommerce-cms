# 🔑 Key Hierarchy Specification

Определение иерархии ключей для полного шифрования данных в платформе.

## 🏗️ Архитектура ключей

### 1. Root Key Management

```
Master Key (Vault Root)
├── Data Encryption Keys (DEK)
│   ├── Application DEK
│   ├── Database DEK  
│   ├── File Storage DEK
│   └── Backup DEK
├── Transport Keys
│   ├── TLS Certificates
│   ├── mTLS Client Certs
│   └── JWT Signing Keys
└── Service Keys
    ├── Telegram Bot Keys
    ├── Webhook Signing Keys
    └── API Authentication Keys
```

### 2. Key Types and Usage

| Key Type | Purpose | Rotation | Storage |
|----------|---------|----------|---------|
| **Master Key** | Envelope encryption root | Annual | Vault KMS |
| **Data DEK** | Application data encryption | Quarterly | Vault Transit |
| **Database DEK** | DB field-level encryption | Monthly | Vault Transit |
| **JWT Signing** | Token authentication | Weekly | Vault KV |
| **TLS Certs** | Transport encryption | Annual | Vault PKI |
| **Webhook Keys** | API signature verification | Monthly | Vault KV |

## 🔐 Key Hierarchy Implementation

### Level 1: Master Keys (Vault Root)

```bash
# Vault root token (unsealed by key shares)
vault operator init -key-shares=5 -key-threshold=3

# Master encryption key in Vault
vault secrets enable -path=master kv-v2
```

### Level 2: Data Encryption Keys

```bash
# Enable Transit engine for envelope encryption
vault secrets enable transit

# Application data encryption key
vault write -f transit/keys/app-data-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false

# Database field encryption key  
vault write -f transit/keys/db-field-key \
    type="aes256-gcm96" \
    exportable=false

# File storage encryption key
vault write -f transit/keys/file-storage-key \
    type="aes256-gcm96" \
    exportable=false

# Backup encryption key (separate from operational data)
vault write -f transit/keys/backup-key \
    type="aes256-gcm96" \
    exportable=false
```

### Level 3: Transport Keys

```bash
# Enable PKI engine for certificates
vault secrets enable pki

# Configure CA
vault write pki/config/ca \
    pem_bundle="@ca-bundle.pem"

# TLS certificate role
vault write pki/roles/telegram-ecommerce \
    allowed_domains="botrt.local,localhost" \
    allow_subdomains=true \
    max_ttl="8760h"

# JWT signing keys (stored in KV)
vault kv put kv/transport/jwt \
    signing_key="$(openssl rand -base64 64)" \
    refresh_signing_key="$(openssl rand -base64 64)" \
    algorithm="HS256"
```

### Level 4: Service Keys

```bash
# Telegram Bot keys
vault kv put kv/services/telegram \
    bot_token="TELEGRAM_BOT_TOKEN" \
    webhook_secret="$(openssl rand -base64 32)"

# API authentication keys
vault kv put kv/services/api \
    internal_api_key="$(openssl rand -base64 32)" \
    webhook_signing_key="$(openssl rand -base64 32)"

# Database connection encryption
vault kv put kv/services/database \
    encryption_key="$(openssl rand -hex 32)" \
    connection_string_encrypted="encrypted_connection"
```

## 🔄 Key Rotation Schedule

### Automated Rotation (via Vault)

```bash
# Configure automatic rotation for transit keys
vault write transit/keys/app-data-key/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false

# Set up rotation policy (90 days)
vault write transit/keys/app-data-key/rotate
```

### Manual Rotation Schedule

| Key Type | Frequency | Automation | Impact |
|----------|-----------|------------|---------|
| Master Keys | Annual | Manual | High - requires maintenance window |
| Data DEKs | Quarterly | Automated | Low - transparent to application |
| JWT Keys | Weekly | Automated | Medium - requires token refresh |
| TLS Certs | Annual | Semi-auto | Medium - requires deployment |
| Service Keys | Monthly | Manual | High - requires service restart |

## 🛡️ Key Security Policies

### Access Control Matrix

```
Role        | Master | Data DEK | Transport | Service |
------------|--------|----------|-----------|---------|
SUPER_ADMIN | RW     | RW       | RW        | RW      |
ADMIN       | -      | R        | R         | RW      |
SERVICE     | -      | Encrypt  | R         | R       |
APPLICATION | -      | Encrypt  | -         | R       |
```

### Vault Policies

```hcl
# Application policy
path "transit/encrypt/app-data-key" {
  capabilities = ["update"]
}

path "transit/decrypt/app-data-key" {
  capabilities = ["update"]
}

path "kv/data/services/*" {
  capabilities = ["read"]
}

# Admin policy
path "transit/*" {
  capabilities = ["create", "read", "update", "list"]
}

path "kv/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

## 🔍 Key Usage Patterns

### 1. Application Data Encryption

```typescript
// Encrypt PII before database storage
const encryptedData = await vault.encrypt('app-data-key', plaintext);

// Store in database with key version
await db.user.create({
  email: encryptedData,
  email_key_version: getKeyVersion('app-data-key')
});
```

### 2. Database Field Encryption

```typescript
// Transparent encryption in data layer
class EncryptedRepository {
  async save(entity: Entity) {
    const encrypted = await this.encryptFields(entity);
    return this.repository.save(encrypted);
  }
  
  async find(id: string) {
    const entity = await this.repository.findById(id);
    return this.decryptFields(entity);
  }
}
```

### 3. File Storage Encryption

```typescript
// Encrypt files before storage
const fileKey = await vault.generateDataKey('file-storage-key');
const encryptedFile = encrypt(fileContent, fileKey.plaintext);

// Store encrypted file + encrypted key
await storage.put(filePath, encryptedFile);
await storage.putMetadata(filePath, {
  encrypted_key: fileKey.ciphertext,
  key_version: fileKey.version
});
```

## 📊 Key Metrics and Monitoring

### Key Performance Indicators

- **Key Rotation Compliance**: % of keys rotated on schedule
- **Encryption Coverage**: % of sensitive data encrypted
- **Key Access Patterns**: Unusual access attempts
- **Performance Impact**: Encryption/decryption latency

### Monitoring Setup

```bash
# Vault audit logs
vault audit enable file file_path=/var/log/vault_audit.log

# Key usage metrics
vault read sys/metrics?format=prometheus | grep transit

# Application metrics
curl http://localhost:3001/metrics | grep encryption
```

## 🚨 Incident Response

### Key Compromise Response

1. **Immediate Actions**:
   - Revoke compromised key
   - Rotate to new key version
   - Audit access logs

2. **Recovery Process**:
   - Re-encrypt affected data
   - Update application configurations
   - Validate data integrity

3. **Post-Incident**:
   - Root cause analysis
   - Update security policies
   - Improve monitoring

### Emergency Key Recovery

```bash
# Emergency unseal (if Vault is sealed)
vault operator unseal <emergency-key-1>
vault operator unseal <emergency-key-2>
vault operator unseal <emergency-key-3>

# Force key rotation
vault write -f transit/keys/app-data-key/rotate

# Verify new key version
vault read transit/keys/app-data-key
```

## ✅ Validation and Testing

### Key Hierarchy Tests

```bash
# Test encryption/decryption chain
echo "test data" | vault write -field=ciphertext transit/encrypt/app-data-key plaintext=-
vault write -field=plaintext transit/decrypt/app-data-key ciphertext=<ciphertext>

# Test key rotation
vault write -f transit/keys/app-data-key/rotate
vault read transit/keys/app-data-key

# Test access policies
vault auth -method=userpass username=testuser password=testpass
vault read kv/services/telegram  # Should succeed/fail based on policy
```

### Application Integration Tests

```typescript
describe('Key Hierarchy', () => {
  it('should encrypt/decrypt data with current key', async () => {
    const data = 'sensitive information';
    const encrypted = await encryptionService.encryptData(data);
    const decrypted = await encryptionService.decryptData(encrypted);
    expect(decrypted).toBe(data);
  });

  it('should handle key rotation transparently', async () => {
    // Encrypt with old key
    const encrypted = await encryptionService.encryptData('test');
    
    // Rotate key
    await vault.rotateKey('app-data-key');
    
    // Should still decrypt old data
    const decrypted = await encryptionService.decryptData(encrypted);
    expect(decrypted).toBe('test');
  });
});
```

## 📋 Implementation Checklist

- [ ] Vault cluster setup with HA
- [ ] Root key initialization and distribution
- [ ] Transit engine configuration
- [ ] PKI engine for certificates
- [ ] KV engine for service keys
- [ ] Access policies and roles
- [ ] Key rotation automation
- [ ] Monitoring and alerting
- [ ] Backup and recovery procedures
- [ ] Application integration
- [ ] Security testing
- [ ] Documentation and training

---

*Эта иерархия ключей обеспечивает defense-in-depth подход к шифрованию с минимальным влиянием на производительность и максимальной безопасностью.*
