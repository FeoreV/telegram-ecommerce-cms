#!/bin/bash
set -e

echo "🔐 Initializing Vault..."

# SECURITY FIX: CWE-798, CWE-522 - Improve Vault initialization security
# Check if this is production environment
if [ "${ENVIRONMENT}" = "production" ]; then
  echo "⚠️  WARNING: For production, use Shamir's Secret Sharing with multiple key shares!"
  echo "⚠️  Recommended: -key-shares=5 -key-threshold=3"
  echo "⚠️  Current single-key configuration is only suitable for development."

  if [ "${ALLOW_SINGLE_KEY_PROD}" != "true" ]; then
    echo "❌ ERROR: Single-key Vault initialization blocked in production."
    echo "Set ALLOW_SINGLE_KEY_PROD=true to override (NOT RECOMMENDED)"
    exit 1
  fi
fi

# Wait for Vault to start
sleep 5

# Use secure key-shares for production, single key only for dev
KEY_SHARES="${VAULT_KEY_SHARES:-1}"
KEY_THRESHOLD="${VAULT_KEY_THRESHOLD:-1}"

if [ "$KEY_SHARES" -lt 3 ] && [ "${ENVIRONMENT}" = "production" ]; then
  echo "⚠️  WARNING: Using less than 3 key shares in production is insecure!"
fi

# Initialize Vault with secure file permissions
touch /tmp/vault-init.json
chmod 600 /tmp/vault-init.json

vault operator init -key-shares="$KEY_SHARES" -key-threshold="$KEY_THRESHOLD" -format=json > /tmp/vault-init.json

# Extract keys (avoid exposing in process list)
UNSEAL_KEY=$(jq -r '.unseal_keys_b64[0]' < /tmp/vault-init.json)
ROOT_TOKEN=$(jq -r '.root_token' < /tmp/vault-init.json)

# Unseal Vault
vault operator unseal "$UNSEAL_KEY"

# Login with root token
vault auth "$ROOT_TOKEN"

echo "🚀 Setting up secret engines and policies..."

# Enable KV v2 secrets engine
vault secrets enable -version=2 kv

# Create policies
vault policy write app-policy - <<EOF
path "kv/data/app/*" {
  capabilities = ["read"]
}
path "kv/data/shared/*" {
  capabilities = ["read"]
}
EOF

vault policy write admin-policy - <<EOF
path "kv/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
EOF

# Enable AppRole auth method
vault auth enable approle

# Create AppRole for application
vault write auth/approle/role/telegram-ecommerce \
    token_policies="app-policy" \
    token_ttl=1h \
    token_max_ttl=4h \
    bind_secret_id=true

# Get role-id
ROLE_ID=$(vault read -field=role_id auth/approle/role/telegram-ecommerce/role-id)

# Generate secret-id
SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/telegram-ecommerce/secret-id)

echo "✅ Vault initialized successfully!"

# SECURITY FIX: CWE-532, CWE-200 - Never log secrets to console
# Secrets should only be stored securely, never displayed or logged
echo "⚠️  SECURITY: Credentials are stored securely in /vault/config/credentials.json"
echo "⚠️  DO NOT display credentials in logs or console output"

# Store credentials with secure permissions
mkdir -p /vault/config
chmod 700 /vault/config

# Create credentials file with restricted permissions
touch /vault/config/credentials.json
chmod 600 /vault/config/credentials.json

cat > /vault/config/credentials.json <<EOF
{
  "root_token": "$ROOT_TOKEN",
  "unseal_key": "$UNSEAL_KEY",
  "role_id": "$ROLE_ID",
  "secret_id": "$SECRET_ID",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "${ENVIRONMENT:-development}",
  "warning": "SENSITIVE: This file contains secrets. Protect access."
}
EOF

echo "🔐 Credentials stored securely with mode 600"
echo "📍 Location: /vault/config/credentials.json"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   1. Rotate the root token immediately after setup"
echo "   2. Store unseal keys in separate secure locations"
echo "   3. Never commit credentials.json to version control"
echo "   4. Use environment variables or secret managers for production"

echo "💾 Credentials saved to /vault/config/credentials.json"
echo "⚠️  IMPORTANT: Store these credentials securely and remove this file in production!"
