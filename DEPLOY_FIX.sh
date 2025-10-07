#!/bin/bash
# Production Server Deployment Fix
# Run this script on the server at: /root/telegram-ecommerce-cms

set -e

echo "🔧 Telegram E-Commerce CMS - Production Fix"
echo "============================================"
echo ""

# Navigate to project directory
cd /root/telegram-ecommerce-cms

echo "📦 Step 1: Pulling latest changes..."
echo ""

# Stash any local changes
git stash

# Pull latest code
git pull origin main

echo ""
echo "🏗️  Step 2: Building applications..."
echo ""

# Build backend
echo "Building backend..."
cd backend
npm install --production=false
npm run build
cd ..

# Build bot
echo "Building bot..."
cd bot
npm install --production=false
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm install --production=false
npm run build
cd ..

echo ""
echo "🔄 Step 3: Restarting PM2 services..."
echo ""

# Stop all PM2 processes
pm2 stop all || true
sleep 2

# Delete all PM2 processes
pm2 delete all || true
sleep 1

# Start with new ecosystem config
pm2 start config/services/ecosystem.config.cjs

# Save PM2 config
pm2 save

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "📝 View logs with:"
echo "  pm2 logs telegram-backend"
echo "  pm2 logs telegram-bot"
echo "  pm2 logs frontend"
echo ""
echo "🔍 Monitor services:"
echo "  pm2 monit"
echo ""

