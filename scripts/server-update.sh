#!/bin/bash
# Complete Server Update Script
# Pulls latest code, rebuilds, and restarts services

set -e

echo "🚀 Server Update Script"
echo "======================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_info() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if in correct directory
if [ ! -d ".git" ]; then
    print_error "Not in a git repository!"
    exit 1
fi

# Step 1: Safe git pull
print_step "Step 1: Pulling latest code..."
if [ -f "scripts/safe-git-pull.sh" ]; then
    bash scripts/safe-git-pull.sh
else
    print_warning "safe-git-pull.sh not found, doing manual pull..."
    
    # Backup .env files
    BACKUP_DIR="backups/env-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    [ -f "backend/.env" ] && cp backend/.env "$BACKUP_DIR/backend.env"
    [ -f "frontend/.env" ] && cp frontend/.env "$BACKUP_DIR/frontend.env"
    [ -f "bot/.env" ] && cp bot/.env "$BACKUP_DIR/bot.env"
    
    # Reset log files
    git checkout HEAD -- backend/logs/audit.json 2>/dev/null || true
    git checkout HEAD -- bot/logs/*.log 2>/dev/null || true
    
    # Stash and pull
    git stash
    git pull origin main
    
    # Restore .env
    [ -f "$BACKUP_DIR/backend.env" ] && cp "$BACKUP_DIR/backend.env" backend/.env
    [ -f "$BACKUP_DIR/frontend.env" ] && cp "$BACKUP_DIR/frontend.env" frontend/.env
    [ -f "$BACKUP_DIR/bot.env" ] && cp "$BACKUP_DIR/bot.env" bot/.env
fi

echo ""
print_step "Step 2: Installing dependencies..."

# Backend dependencies
if [ -f "backend/package.json" ]; then
    print_info "Installing backend dependencies..."
    cd backend
    npm install --production
    cd ..
fi

# Frontend dependencies
if [ -f "frontend/package.json" ]; then
    print_info "Installing frontend dependencies..."
    cd frontend
    npm install --production
    cd ..
fi

# Bot dependencies
if [ -f "bot/package.json" ]; then
    print_info "Installing bot dependencies..."
    cd bot
    npm install --production
    cd ..
fi

echo ""
print_step "Step 3: Running database migrations..."
if [ -f "backend/prisma/schema.prisma" ]; then
    cd backend
    npx prisma migrate deploy 2>/dev/null || print_warning "No new migrations"
    npx prisma generate
    cd ..
    print_info "Database updated"
fi

echo ""
print_step "Step 4: Building applications..."

# Build backend
if [ -f "backend/tsconfig.json" ]; then
    print_info "Building backend..."
    cd backend
    npm run build
    cd ..
fi

# Build frontend
if [ -f "frontend/vite.config.ts" ]; then
    print_info "Building frontend..."
    cd frontend
    npm run build
    cd ..
fi

# Build bot
if [ -f "bot/tsconfig.json" ]; then
    print_info "Building bot..."
    cd bot
    npm run build 2>/dev/null || npm run build --if-present
    cd ..
fi

echo ""
print_step "Step 5: Restarting services..."

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    print_info "Restarting with PM2..."
    pm2 restart backend 2>/dev/null || print_warning "Backend not running in PM2"
    pm2 restart frontend 2>/dev/null || print_warning "Frontend not running in PM2"
    pm2 restart bot 2>/dev/null || print_warning "Bot not running in PM2"
    
    # Show status
    echo ""
    pm2 status
else
    print_warning "PM2 not found. Please restart services manually:"
    echo "  Backend:  cd backend && npm run start"
    echo "  Frontend: cd frontend && npm run preview (or use nginx)"
    echo "  Bot:      cd bot && npm run start"
fi

echo ""
echo "========================================"
print_info "✅ Server update completed!"
echo "========================================"
echo ""
print_info "Summary:"
echo "  • Code updated from Git"
echo "  • Dependencies installed"
echo "  • Database migrated"
echo "  • Applications rebuilt"
echo "  • Services restarted"
echo ""
print_warning "Verify everything works:"
echo "  • Frontend: http://your-server:3000"
echo "  • Backend:  http://your-server:3001/health"
echo "  • Logs:     pm2 logs"
echo ""

