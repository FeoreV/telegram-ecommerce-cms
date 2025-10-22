#!/bin/bash

# Quick deploy script for megapenis.work.gd
# Run this on the server after git pull

set -e

echo "🚀 Starting deployment..."

# Stop all services
echo "⏸️  Stopping services..."
pm2 stop all

# Update backend .env
echo "📝 Updating backend .env..."
cd /root/telegram-ecommerce-cms/backend

# Add missing security keys if not present
if ! grep -q "SECURITY_LOGS_KEY_ID" .env; then
    cat >> .env << 'EOF'

# Security Key IDs (required in production)
SECURITY_LOGS_KEY_ID=security-logs-key-1
SBOM_SIGNING_KEY_ID=sbom-signing-key-1
COMMUNICATION_KEY_ID=communication-key-1
WEBSOCKET_KEY_ID=websocket-key-1
BACKUP_KEY_ID=backup-key-1
STORAGE_KEY_ID=storage-key-1
LOG_KEY_ID=log-key-1
EOF
    echo "✅ Added security keys to backend .env"
fi

# Build backend
echo "🔨 Building backend..."
npm run build

# Build frontend
echo "🔨 Building frontend..."
cd /root/telegram-ecommerce-cms/frontend
npm run build

# Start services
echo "▶️  Starting services..."
cd /root/telegram-ecommerce-cms
pm2 restart all

echo "✅ Deployment complete!"
echo ""
echo "Services:"
echo "  Frontend: localhost"
echo "  Backend:  localhost/api"
echo ""
echo "Check status: pm2 status"
echo "Check logs:   pm2 logs"
