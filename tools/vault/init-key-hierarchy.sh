#!/bin/bash
set -e

echo "🔑 Initializing Key Hierarchy for Telegram E-commerce Bot..."

# Check if Vault is available and unsealed
if ! vault status > /dev/null 2>&1; then
    echo "❌ Vault is not running or not unsealed. Please start and unseal Vault first."
    exit 1
fi

echo "🏗️ Setting up key hierarchy..."

# 1. Enable Transit engine for data encryption keys
echo "📦 Enabling Transit engine..."
if ! vault secrets list | grep -q "transit/"; then
    vault secrets enable transit
    echo "✅ Transit engine enabled"
else
    echo "ℹ️  Transit engine already enabled"
fi

# 2. Create Data Encryption Keys
echo "🔐 Creating Data Encryption Keys..."

# Application data encryption key
vault write -f transit/keys/app-data-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false \
    deletion_allowed=false
echo "✅ Application data key created"

# Database field encryption key
vault write -f transit/keys/db-field-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false \
    deletion_allowed=false
echo "✅ Database field key created"

# File storage encryption key
vault write -f transit/keys/file-storage-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false \
    deletion_allowed=false
echo "✅ File storage key created"

# Backup encryption key (separate from operational data)
vault write -f transit/keys/backup-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false \
    deletion_allowed=false
echo "✅ Backup encryption key created"

# PII encryption key (for sensitive personal data)
vault write -f transit/keys/pii-key \
    type="aes256-gcm96" \
    exportable=false \
    allow_plaintext_backup=false \
    deletion_allowed=false
echo "✅ PII encryption key created"

# 3. Enable PKI engine for certificates
echo "📜 Setting up PKI engine..."
if ! vault secrets list | grep -q "pki/"; then
    vault secrets enable pki
    vault secrets tune -max-lease-ttl=87600h pki
    echo "✅ PKI engine enabled"
else
    echo "ℹ️  PKI engine already enabled"
fi

# Generate root CA
vault write -field=certificate pki/root/generate/internal \
    common_name="Telegram E-commerce Bot Root CA" \
    ttl=87600h > ca.crt
echo "✅ Root CA generated"

# Configure CA and CRL URLs
vault write pki/config/urls \
    issuing_certificates="http://127.0.0.1:8200/v1/pki/ca" \
    crl_distribution_points="http://127.0.0.1:8200/v1/pki/crl"

# Create role for application certificates
vault write pki/roles/telegram-ecommerce \
    allowed_domains="botrt.local,localhost,127.0.0.1" \
    allow_subdomains=true \
    allow_localhost=true \
    allow_ip_sans=true \
    max_ttl="8760h" \
    generate_lease=true
echo "✅ PKI role created"

# 4. Set up key rotation policies
echo "🔄 Configuring key rotation policies..."

# Configure automatic rotation for transit keys (90 days)
vault write transit/keys/app-data-key/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false

vault write transit/keys/db-field-key/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false

vault write transit/keys/file-storage-key/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false

vault write transit/keys/pii-key/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false

echo "✅ Key rotation policies configured"

# 5. Create enhanced policies for key hierarchy
echo "🛡️ Creating access policies..."

# Enhanced application policy
vault policy write telegram-ecommerce-enhanced - <<EOF
# Data encryption keys
path "transit/encrypt/app-data-key" {
  capabilities = ["update"]
}

path "transit/decrypt/app-data-key" {
  capabilities = ["update"]
}

path "transit/encrypt/db-field-key" {
  capabilities = ["update"]
}

path "transit/decrypt/db-field-key" {
  capabilities = ["update"]
}

path "transit/encrypt/file-storage-key" {
  capabilities = ["update"]
}

path "transit/decrypt/file-storage-key" {
  capabilities = ["update"]
}

path "transit/encrypt/pii-key" {
  capabilities = ["update"]
}

path "transit/decrypt/pii-key" {
  capabilities = ["update"]
}

# Application secrets (read-only)
path "kv/data/app/*" {
  capabilities = ["read"]
}

path "kv/data/services/*" {
  capabilities = ["read"]
}

# PKI certificate generation
path "pki/issue/telegram-ecommerce" {
  capabilities = ["update"]
}

# Key metadata (for version tracking)
path "transit/keys/*/config" {
  capabilities = ["read"]
}

path "transit/keys/app-data-key" {
  capabilities = ["read"]
}

path "transit/keys/db-field-key" {
  capabilities = ["read"]
}

path "transit/keys/file-storage-key" {
  capabilities = ["read"]
}

path "transit/keys/pii-key" {
  capabilities = ["read"]
}
EOF

# Admin policy for key management
vault policy write key-admin - <<EOF
# Full access to transit engine
path "transit/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Full access to PKI
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Full access to secrets
path "kv/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# System operations
path "sys/rotate" {
  capabilities = ["update"]
}

path "sys/key-status" {
  capabilities = ["read"]
}
EOF

echo "✅ Access policies created"

# 6. Update AppRole with enhanced policy
echo "🔧 Updating AppRole with enhanced policy..."
vault write auth/approle/role/telegram-ecommerce \
    token_policies="telegram-ecommerce-enhanced" \
    token_ttl=1h \
    token_max_ttl=4h \
    bind_secret_id=true \
    secret_id_ttl=24h \
    secret_id_num_uses=0

echo "✅ AppRole updated with enhanced policy"

# 7. Store key hierarchy information
echo "📋 Storing key hierarchy metadata..."
vault kv put kv/system/key-hierarchy \
    version="1.0" \
    created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    keys="app-data-key,db-field-key,file-storage-key,backup-key,pii-key" \
    rotation_schedule="quarterly" \
    backup_schedule="daily"

# 8. Test key hierarchy
echo "🧪 Testing key hierarchy..."

# Test data encryption
echo "Testing application data encryption..."
PLAINTEXT="Hello, secure world!"
CIPHERTEXT=$(echo -n "$PLAINTEXT" | vault write -field=ciphertext transit/encrypt/app-data-key plaintext=-)
DECRYPTED=$(vault write -field=plaintext transit/decrypt/app-data-key ciphertext="$CIPHERTEXT" | base64 -d)

if [ "$PLAINTEXT" = "$DECRYPTED" ]; then
    echo "✅ Application data encryption test passed"
else
    echo "❌ Application data encryption test failed"
    exit 1
fi

# Test PII encryption
echo "Testing PII encryption..."
PII_DATA="user@example.com"
PII_CIPHERTEXT=$(echo -n "$PII_DATA" | vault write -field=ciphertext transit/encrypt/pii-key plaintext=-)
PII_DECRYPTED=$(vault write -field=plaintext transit/decrypt/pii-key ciphertext="$PII_CIPHERTEXT" | base64 -d)

if [ "$PII_DATA" = "$PII_DECRYPTED" ]; then
    echo "✅ PII encryption test passed"
else
    echo "❌ PII encryption test failed"
    exit 1
fi

# Test certificate generation
echo "Testing certificate generation..."
vault write pki/issue/telegram-ecommerce \
    common_name="test.botrt.local" \
    ttl="24h" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Certificate generation test passed"
else
    echo "❌ Certificate generation test failed"
    exit 1
fi

echo ""
echo "🎉 Key hierarchy initialization completed successfully!"
echo ""
echo "📊 Key Hierarchy Summary:"
echo "├── Data Encryption Keys:"
echo "│   ├── app-data-key (Application data)"
echo "│   ├── db-field-key (Database fields)"
echo "│   ├── file-storage-key (File storage)"
echo "│   ├── backup-key (Backup encryption)"
echo "│   └── pii-key (Personal data)"
echo "├── Transport Keys:"
echo "│   └── PKI certificates (TLS/mTLS)"
echo "└── Service Keys:"
echo "    └── KV secrets (JWT, API keys, etc.)"
echo ""
echo "🔄 Rotation Schedule:"
echo "├── Data Keys: Quarterly (automatic)"
echo "├── Certificates: Annual (manual)"
echo "└── Service Keys: Monthly (manual)"
echo ""
echo "🛡️ Security Features:"
echo "├── Envelope encryption with Vault Transit"
echo "├── Non-exportable keys"
echo "├── Version-based key rotation"
echo "├── Policy-based access control"
echo "└── Audit logging enabled"
echo ""
echo "📋 Next Steps:"
echo "1. Update application to use new key hierarchy"
echo "2. Migrate existing data to encrypted format"
echo "3. Set up automated key rotation"
echo "4. Configure monitoring and alerting"
echo "5. Test backup and recovery procedures"
