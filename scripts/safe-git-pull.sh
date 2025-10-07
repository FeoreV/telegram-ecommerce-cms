#!/bin/bash
# Safe Git Pull - preserves .env files and handles conflicts

set -e

echo "🔄 Safe Git Pull with .env preservation"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -d ".git" ]; then
    print_error "Not in a git repository!"
    exit 1
fi

# Backup .env files
print_info "Backing up .env files..."
BACKUP_DIR="backups/env-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "backend/.env" ]; then
    cp backend/.env "$BACKUP_DIR/backend.env"
    print_info "Backed up backend/.env"
fi

if [ -f "frontend/.env" ]; then
    cp frontend/.env "$BACKUP_DIR/frontend.env"
    print_info "Backed up frontend/.env"
fi

if [ -f "bot/.env" ]; then
    cp bot/.env "$BACKUP_DIR/bot.env"
    print_info "Backed up bot/.env"
fi

# Reset log files (they shouldn't be tracked)
print_info "Resetting log files..."
git checkout HEAD -- backend/logs/audit.json 2>/dev/null || true
git checkout HEAD -- bot/logs/bot-combined.log 2>/dev/null || true
git checkout HEAD -- bot/logs/bot-error.log 2>/dev/null || true

# Stash .env changes temporarily
print_info "Stashing local changes..."
git stash push -m "Auto-stash before pull $(date)" -- backend/.env bot/.env frontend/.env || true

# Pull latest changes
print_info "Pulling latest changes from origin/main..."
git pull origin main

# Restore .env files from backup
print_info "Restoring .env files from backup..."
if [ -f "$BACKUP_DIR/backend.env" ]; then
    cp "$BACKUP_DIR/backend.env" backend/.env
    print_info "Restored backend/.env"
fi

if [ -f "$BACKUP_DIR/frontend.env" ]; then
    cp "$BACKUP_DIR/frontend.env" frontend/.env
    print_info "Restored frontend/.env"
fi

if [ -f "$BACKUP_DIR/bot.env" ]; then
    cp "$BACKUP_DIR/bot.env" bot/.env
    print_info "Restored bot/.env"
fi

# Ensure .env files are in .gitignore
print_info "Checking .gitignore..."
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    print_warning "Added .env to .gitignore"
fi

if ! grep -q "^backend/\.env$" .gitignore 2>/dev/null; then
    echo "backend/.env" >> .gitignore
    print_warning "Added backend/.env to .gitignore"
fi

if ! grep -q "^frontend/\.env$" .gitignore 2>/dev/null; then
    echo "frontend/.env" >> .gitignore
    print_warning "Added frontend/.env to .gitignore"
fi

if ! grep -q "^bot/\.env$" .gitignore 2>/dev/null; then
    echo "bot/.env" >> .gitignore
    print_warning "Added bot/.env to .gitignore"
fi

# Ensure log directories are in .gitignore
if ! grep -q "^backend/logs/\*\.log$" .gitignore 2>/dev/null; then
    echo "backend/logs/*.log" >> .gitignore
    print_warning "Added backend logs to .gitignore"
fi

if ! grep -q "^bot/logs/\*\.log$" .gitignore 2>/dev/null; then
    echo "bot/logs/*.log" >> .gitignore
    print_warning "Added bot logs to .gitignore"
fi

echo ""
print_info "Git pull completed successfully!"
echo ""
echo "Your .env files have been preserved and are in:"
echo "  Current location: backend/.env, frontend/.env, bot/.env"
echo "  Backup location: $BACKUP_DIR/"
echo ""
print_warning "Next steps:"
echo "  1. Review any changes: git log --oneline -5"
echo "  2. Rebuild if needed: cd backend && npm run build"
echo "  3. Restart services: pm2 restart all"
echo ""

