#!/bin/bash

# Script to upload updated .env files to server
# Usage: ./upload-env-to-server.sh [server-ip-or-hostname]

set -e

SERVER=${1:-"megapenis.worg.gd"}
SERVER_USER="root"
PROJECT_PATH="/root/telegram-ecommerce-cms"

echo "🚀 Uploading .env files to $SERVER..."

# Upload root .env
echo "📤 Uploading .env..."
scp .env ${SERVER_USER}@${SERVER}:${PROJECT_PATH}/.env

# Upload backend .env
echo "📤 Uploading backend/.env..."
scp backend/.env ${SERVER_USER}@${SERVER}:${PROJECT_PATH}/backend/.env

# Upload frontend .env
echo "📤 Uploading frontend/.env..."
scp frontend/.env ${SERVER_USER}@${SERVER}:${PROJECT_PATH}/frontend/.env

# Upload nginx config
echo "📤 Uploading nginx config..."
scp nginx-megapenis.worg.gd.conf ${SERVER_USER}@${SERVER}:/tmp/nginx-megapenis.worg.gd.conf

echo ""
echo "✅ Files uploaded successfully!"
echo ""
echo "Next steps on the server:"
echo "1. Install nginx config:"
echo "   sudo cp /tmp/nginx-megapenis.worg.gd.conf /etc/nginx/sites-available/megapenis.worg.gd"
echo "   sudo ln -sf /etc/nginx/sites-available/megapenis.worg.gd /etc/nginx/sites-enabled/"
echo ""
echo "2. Get SSL certificate:"
echo "   sudo certbot --nginx -d megapenis.worg.gd -d www.megapenis.worg.gd"
echo ""
echo "3. Rebuild and restart:"
echo "   cd ${PROJECT_PATH}/frontend && npm run build"
echo "   cd ${PROJECT_PATH} && pm2 restart all"
echo "   sudo systemctl restart nginx"
echo ""
echo "Or run the full setup script:"
echo "   ssh ${SERVER_USER}@${SERVER} 'bash -s' < SETUP-MEGAPENIS-WORG-HTTPS.md"
