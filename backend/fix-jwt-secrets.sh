#!/bin/bash
# Fix JWT secrets to be different

echo "🔧 Fixing JWT Secrets..."
echo "════════════════════════════════════════════════════════════"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    exit 1
fi

# Generate new secrets
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

echo ""
echo "Generated new secrets:"
echo "  JWT_SECRET (128 chars)"
echo "  JWT_REFRESH_SECRET (128 chars)"
echo ""

# Backup .env
BACKUP_FILE=".env.backup.$(date +%s)"
cp .env "$BACKUP_FILE"
echo "✅ Backed up .env to $BACKUP_FILE"

# Update or add JWT_SECRET
if grep -q "^JWT_SECRET=" .env; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    echo "✅ Updated JWT_SECRET"
else
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo "✅ Added JWT_SECRET"
fi

# Update or add JWT_REFRESH_SECRET
if grep -q "^JWT_REFRESH_SECRET=" .env; then
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    echo "✅ Updated JWT_REFRESH_SECRET"
else
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> .env
    echo "✅ Added JWT_REFRESH_SECRET"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ JWT secrets fixed successfully!"
echo ""
echo "🚀 Now run: npm run dev"
echo "════════════════════════════════════════════════════════════"

