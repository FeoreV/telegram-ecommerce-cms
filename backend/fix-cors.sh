#!/bin/bash
# Fix CORS settings for production server

echo "🔧 Fixing CORS Configuration..."
echo "════════════════════════════════════════════════════════════"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    exit 1
fi

# Server IP
SERVER_IP="82.147.84.78"
FRONTEND_URL="http://${SERVER_IP}:3000"
BACKEND_URL="http://${SERVER_IP}:3001"

echo ""
echo "Setting CORS origins:"
echo "  FRONTEND_URL=$FRONTEND_URL"
echo "  CORS_WHITELIST with server IPs"
echo ""

# Backup .env
BACKUP_FILE=".env.backup.$(date +%s)"
cp .env "$BACKUP_FILE"
echo "✅ Backed up .env to $BACKUP_FILE"

# Update or add FRONTEND_URL
if grep -q "^FRONTEND_URL=" .env; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" .env
    echo "✅ Updated FRONTEND_URL"
else
    echo "FRONTEND_URL=$FRONTEND_URL" >> .env
    echo "✅ Added FRONTEND_URL"
fi

# Update or add CORS_WHITELIST
CORS_WHITELIST="http://localhost:3000,http://localhost:5173,http://${SERVER_IP}:3000,http://${SERVER_IP}:3001"
if grep -q "^CORS_WHITELIST=" .env; then
    sed -i "s|^CORS_WHITELIST=.*|CORS_WHITELIST=$CORS_WHITELIST|" .env
    echo "✅ Updated CORS_WHITELIST"
else
    echo "CORS_WHITELIST=$CORS_WHITELIST" >> .env
    echo "✅ Added CORS_WHITELIST"
fi

# Update or add ADMIN_PANEL_URL (optional but good to have)
if grep -q "^ADMIN_PANEL_URL=" .env; then
    sed -i "s|^ADMIN_PANEL_URL=.*|ADMIN_PANEL_URL=$BACKEND_URL/admin|" .env
    echo "✅ Updated ADMIN_PANEL_URL"
else
    echo "ADMIN_PANEL_URL=$BACKEND_URL/admin" >> .env
    echo "✅ Added ADMIN_PANEL_URL"
fi

# Enable CORS credentials
if grep -q "^CORS_CREDENTIALS=" .env; then
    sed -i "s|^CORS_CREDENTIALS=.*|CORS_CREDENTIALS=true|" .env
else
    echo "CORS_CREDENTIALS=true" >> .env
fi
echo "✅ Set CORS_CREDENTIALS=true"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ CORS configuration fixed successfully!"
echo ""
echo "CORS will now allow:"
echo "  - http://localhost:3000 (local dev)"
echo "  - http://localhost:5173 (Vite)"
echo "  - http://$SERVER_IP:3000 (frontend)"
echo "  - http://$SERVER_IP:3001 (backend)"
echo ""
echo "🚀 Restart the backend: npm run dev"
echo "════════════════════════════════════════════════════════════"

