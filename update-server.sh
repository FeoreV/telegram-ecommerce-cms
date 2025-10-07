#!/bin/bash
# Simple Server Update Script - Handles everything automatically
# Run this on the server: bash update-server.sh

set -e

echo "🚀 Updating Server..."
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_ok() { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err() { echo -e "${RED}✗ $1${NC}"; }

# Check we're in the right place
if [ ! -d ".git" ]; then
    print_err "Not in git repository! Run from project root."
    exit 1
fi

# Step 1: Backup .env files
print_ok "Backing up .env files..."
mkdir -p backups
BACKUP="backups/env-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
[ -f "backend/.env" ] && cp backend/.env "$BACKUP/backend.env"
[ -f "frontend/.env" ] && cp frontend/.env "$BACKUP/frontend.env"
[ -f "bot/.env" ] && cp bot/.env "$BACKUP/bot.env"

# Step 2: Force reset problematic files
print_ok "Cleaning up logs and temp files..."
rm -f backend/logs/audit.json
rm -f bot/logs/bot-combined.log
rm -f bot/logs/bot-error.log
git reset --hard HEAD

# Step 3: Restore .env files
print_ok "Restoring .env files..."
[ -f "$BACKUP/backend.env" ] && cp "$BACKUP/backend.env" backend/.env
[ -f "$BACKUP/frontend.env" ] && cp "$BACKUP/frontend.env" frontend/.env
[ -f "$BACKUP/bot.env" ] && cp "$BACKUP/bot.env" bot/.env

# Step 4: Pull latest code
print_ok "Pulling latest code from git..."
git pull origin main

# Step 5: Install dependencies
print_ok "Installing dependencies..."
[ -f "backend/package.json" ] && (cd backend && npm install --production)
[ -f "frontend/package.json" ] && (cd frontend && npm install --production)
[ -f "bot/package.json" ] && (cd bot && npm install --production)

# Step 6: Run migrations
if [ -f "backend/prisma/schema.prisma" ]; then
    print_ok "Running database migrations..."
    cd backend
    npx prisma migrate deploy 2>/dev/null || print_warn "No new migrations"
    npx prisma generate
    cd ..
fi

# Step 7: Build
print_ok "Building applications..."
[ -f "backend/tsconfig.json" ] && (cd backend && npm run build)
[ -f "frontend/vite.config.ts" ] && (cd frontend && npm run build)
[ -f "bot/tsconfig.json" ] && (cd bot && npm run build 2>/dev/null || true)

# Step 8: Restart
print_ok "Restarting services..."
if command -v pm2 &> /dev/null; then
    pm2 restart backend 2>/dev/null || print_warn "Backend not in PM2"
    pm2 restart frontend 2>/dev/null || print_warn "Frontend not in PM2"
    pm2 restart bot 2>/dev/null || print_warn "Bot not in PM2"
    echo ""
    pm2 status
else
    print_warn "PM2 not found. Restart services manually."
fi

echo ""
echo "===================="
print_ok "✅ Update Complete!"
echo "===================="
echo ""
print_ok "Backups saved to: $BACKUP/"
echo ""
print_warn "Test your application:"
echo "  Backend:  curl http://82.147.84.78:3001/health"
echo "  Frontend: Open in browser"
echo "  Logs:     pm2 logs"
echo ""

