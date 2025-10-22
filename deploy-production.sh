#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📥 Pulling latest changes..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

echo "🏗️  Building backend..."
cd backend
npm run build
cd ..

echo "🔧 Updating nginx config..."
sudo cp nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd.conf

echo "🧪 Testing nginx config..."
sudo nginx -t

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "🔄 Restarting backend..."
cd backend
pm2 restart telegram-backend 2>/dev/null || pm2 start npm --name "telegram-backend" -- start

echo "✅ Deployment complete!"
echo ""
echo "📊 Checking status..."
pm2 status

echo ""
echo "🌐 Your site should now be available at: localhost"
echo ""
echo "📝 To check logs:"
echo "   Backend: pm2 logs telegram-backend"
echo "   Nginx: sudo tail -f /var/log/nginx/megapenis-error.log"
