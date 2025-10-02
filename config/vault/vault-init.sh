#!/bin/bash
set -e

echo "🔐 Initializing Vault..."

# Wait for Vault to start
sleep 5

# Initialize Vault
vault operator init -key-shares=1 -key-threshold=1 -format=json > /tmp/vault-init.json

# Extract keys
UNSEAL_KEY=$(cat /tmp/vault-init.json | jq -r '.unseal_keys_b64[0]')
ROOT_TOKEN=$(cat /tmp/vault-init.json | jq -r '.root_token')

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
echo "🔑 Root Token: $ROOT_TOKEN"
echo "🔓 Unseal Key: $UNSEAL_KEY"
echo "🎯 Role ID: $ROLE_ID"
echo "🔒 Secret ID: $SECRET_ID"

# Store credentials securely
mkdir -p /vault/config
cat > /vault/config/credentials.json <<EOF
{
  "root_token": "$ROOT_TOKEN",
  "unseal_key": "$UNSEAL_KEY",
  "role_id": "$ROLE_ID",
  "secret_id": "$SECRET_ID"
}
EOF

echo "💾 Credentials saved to /vault/config/credentials.json"
echo "⚠️  IMPORTANT: Store these credentials securely and remove this file in production!"
