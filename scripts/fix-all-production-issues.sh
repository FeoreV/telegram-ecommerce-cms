#!/bin/bash
# Master Production Issues Fix Script
# Fixes all common production issues: security keys, bot memory, frontend permissions

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🚀 Master Production Issues Fix                      ║"
echo "║        Telegram E-Commerce CMS                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}Current directory: $PROJECT_ROOT${NC}"
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}⚠️  Not running with sudo. Some fixes may be limited.${NC}"
   echo -e "${YELLOW}   For best results, run: sudo bash $0${NC}"
   echo ""
   read -p "Continue anyway? (y/n) " -n 1 -r
   echo
   if [[ ! $REPLY =~ ^[Yy]$ ]]; then
       exit 1
   fi
fi

# Create log directories
echo -e "${YELLOW}📁 Creating log directories...${NC}"
mkdir -p backend/logs
mkdir -p bot/logs
mkdir -p frontend/logs
mkdir -p storage/logs
chmod -R 755 backend/logs bot/logs frontend/logs storage/logs 2>/dev/null || true
echo -e "${GREEN}✓${NC} Log directories created"
echo ""

# Run production setup (generates keys, builds apps)
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔐 Step 1: Running production setup...${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/production-setup.sh" ]; then
    bash "$SCRIPT_DIR/production-setup.sh"
else
    echo -e "${RED}❌ production-setup.sh not found${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🤖 Step 2: Fixing bot issues...${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/fix-bot-issues.sh" ]; then
    bash "$SCRIPT_DIR/fix-bot-issues.sh"
else
    echo -e "${RED}❌ fix-bot-issues.sh not found${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔧 Step 3: Fixing frontend permissions...${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/fix-frontend-permissions.sh" ]; then
    bash "$SCRIPT_DIR/fix-frontend-permissions.sh"
else
    echo -e "${RED}❌ fix-frontend-permissions.sh not found${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔄 Step 4: Restarting all services with new config...${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Stop all services
echo -e "${BLUE}→${NC} Stopping all services..."
pm2 stop all 2>/dev/null || true
sleep 2

# Delete old processes
echo -e "${BLUE}→${NC} Cleaning old PM2 processes..."
pm2 delete all 2>/dev/null || true
sleep 1

# Start with new ecosystem config
echo -e "${BLUE}→${NC} Starting services with updated configuration..."
pm2 start config/services/ecosystem.config.cjs
sleep 3

# Save PM2 config
pm2 save
echo -e "${GREEN}✓${NC} PM2 configuration saved"

# Setup PM2 startup
if [ "$EUID" -eq 0 ] || [ -n "$SUDO_USER" ]; then
    pm2 startup systemd -u ${SUDO_USER:-$USER} --hp /home/${SUDO_USER:-$USER} 2>/dev/null || true
    echo -e "${GREEN}✓${NC} PM2 startup configured"
fi

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✓ All Fixes Applied Successfully!           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}📊 Current Service Status:${NC}"
echo ""
pm2 status

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo ""
echo -e "1. ${BOLD}Monitor services:${NC}"
echo -e "   ${GREEN}pm2 monit${NC}         - Real-time monitoring"
echo -e "   ${GREEN}pm2 logs${NC}          - View all logs"
echo -e "   ${GREEN}pm2 logs telegram-bot${NC} - View bot logs only"
echo ""

echo -e "2. ${BOLD}Check for errors:${NC}"
echo -e "   ${GREEN}pm2 logs --err${NC}    - View error logs"
echo ""

echo -e "3. ${BOLD}Verify bot token (if bot shows errors):${NC}"
echo -e "   ${GREEN}grep TELEGRAM_BOT_TOKEN bot/.env${NC}"
echo -e "   If missing or invalid, get token from @BotFather on Telegram"
echo -e "   Add to bot/.env: ${BLUE}TELEGRAM_BOT_TOKEN=your_token${NC}"
echo -e "   Then: ${GREEN}pm2 restart telegram-bot${NC}"
echo ""

echo -e "4. ${BOLD}Access your application:${NC}"
echo -e "   Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend:   ${GREEN}http://localhost:3002${NC}"
echo ""

echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo -e "   • Review generated .env files for production readiness"
echo -e "   • Update CORS origins if accessing from external domains"
echo -e "   • Configure SSL/HTTPS for production use"
echo -e "   • Set up proper firewall rules"
echo -e "   • Keep security keys backed up in a secure location"
echo ""

echo -e "${GREEN}✓ System is ready!${NC}"
echo ""

