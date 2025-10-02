#!/bin/bash
set -e

echo "🔐 Setting up Vault secrets for Telegram E-commerce Bot..."

# Check if Vault is available
if ! command -v vault &> /dev/null; then
    echo "❌ Vault CLI not found. Please install Vault first."
    exit 1
fi

# Check if Vault is running and unsealed
if ! vault status > /dev/null 2>&1; then
    echo "❌ Vault is not running or not unsealed. Please start and unseal Vault first."
    exit 1
fi

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

echo "🔑 Generating secrets..."

# Generate JWT secrets
JWT_SECRET=$(generate_jwt_secret)
JWT_REFRESH_SECRET=$(generate_jwt_secret)

# Generate admin secrets
ADMIN_PASSWORD=$(generate_secret)
ADMIN_COOKIE_SECRET=$(generate_secret)
ADMIN_SESSION_SECRET=$(generate_secret)

# Generate encryption keys
MASTER_KEY=$(openssl rand -hex 32)
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Generate webhook secret
WEBHOOK_SECRET=$(generate_secret)

echo "📝 Storing secrets in Vault..."

# Store JWT secrets
vault kv put kv/app/jwt \
    secret="$JWT_SECRET" \
    refreshSecret="$JWT_REFRESH_SECRET" \
    expiresIn="15m" \
    refreshExpiresIn="7d"

# Store admin secrets
vault kv put kv/app/admin \
    defaultPassword="$ADMIN_PASSWORD" \
    cookieSecret="$ADMIN_COOKIE_SECRET" \
    sessionSecret="$ADMIN_SESSION_SECRET"

# Store encryption secrets
vault kv put kv/app/encryption \
    masterKey="$MASTER_KEY" \
    dataEncryptionKey="$DATA_ENCRYPTION_KEY"

# Store Telegram secrets (placeholder - you need to set real bot token)
vault kv put kv/app/telegram \
    botToken="REPLACE_WITH_REAL_BOT_TOKEN" \
    webhookSecret="$WEBHOOK_SECRET"

# Store database secrets (placeholder - adjust for your database)
vault kv put kv/app/database \
    url="file:./dev.db" \
    username="" \
    password=""

# Store SMTP secrets (optional)
vault kv put kv/app/smtp \
    host="smtp.gmail.com" \
    port="587" \
    secure="false" \
    user="REPLACE_WITH_EMAIL" \
    password="REPLACE_WITH_APP_PASSWORD" \
    from="noreply@yourdomain.com"

# Store Redis secrets (optional)
vault kv put kv/app/redis \
    url="redis://localhost:6379" \
    password=""

echo "🔧 Setting up Transit encryption engine..."

# Enable transit engine if not already enabled
if ! vault secrets list | grep -q "transit/"; then
    vault secrets enable transit
fi

# Create encryption key
vault write -f transit/keys/telegram-ecommerce-key

echo "✅ Vault secrets setup completed!"
echo ""
echo "📋 Generated credentials:"
echo "Admin Password: $ADMIN_PASSWORD"
echo ""
echo "⚠️  Important next steps:"
echo "1. Update kv/app/telegram/botToken with your real Telegram bot token"
echo "2. Update kv/app/database/* with your production database credentials"
echo "3. Update kv/app/smtp/* with your real SMTP credentials"
echo "4. Store the admin password securely"
echo "5. Update your .env file with Vault configuration"
echo ""
echo "🔍 To view stored secrets:"
echo "vault kv get kv/app/jwt"
echo "vault kv get kv/app/admin"
echo "vault kv get kv/app/encryption"
