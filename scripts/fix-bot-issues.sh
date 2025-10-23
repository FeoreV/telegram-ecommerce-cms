#!/bin/bash
# Fix Bot Memory and Token Issues
# This script addresses bot memory limits and token configuration

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
echo "║         🤖 Bot Issues Fix - Memory & Token               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if PM2 ecosystem config exists
ECOSYSTEM_FILE="config/services/ecosystem.config.cjs"

if [ ! -f "$ECOSYSTEM_FILE" ]; then
    echo -e "${RED}❌ PM2 ecosystem config not found at $ECOSYSTEM_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Step 1: Fixing bot memory limits...${NC}"

# Backup ecosystem config
cp "$ECOSYSTEM_FILE" "${ECOSYSTEM_FILE}.backup.$(date +%s)"
echo -e "${GREEN}✓${NC} Created backup of ecosystem config"

# Update bot memory limit in ecosystem config
# Check if max_memory_restart exists and update it
if grep -q "max_memory_restart.*telegram-bot" "$ECOSYSTEM_FILE"; then
    sed -i 's/max_memory_restart:.*\/\/ telegram-bot/max_memory_restart: "512M", \/\/ telegram-bot - increased limit/' "$ECOSYSTEM_FILE"
    echo -e "${GREEN}✓${NC} Updated bot memory limit to 512MB"
else
    echo -e "${YELLOW}⚠️  Could not automatically update memory limit${NC}"
    echo -e "${YELLOW}   Please manually add to bot config: max_memory_restart: '512M'${NC}"
fi

# Add node memory options to bot
if ! grep -q "node_args.*max-old-space-size.*telegram-bot" "$ECOSYSTEM_FILE"; then
    echo -e "${BLUE}→${NC} Adding Node.js memory optimization flags..."
    # This will need manual update - just inform user
    echo -e "${YELLOW}⚠️  Please add to bot config in ecosystem.config.cjs:${NC}"
    echo -e "${BLUE}   node_args: '--max-old-space-size=512'${NC}"
fi

echo ""
echo -e "${YELLOW}🔍 Step 2: Checking bot token...${NC}"

BOT_ENV="bot/.env"

if [ ! -f "$BOT_ENV" ]; then
    echo -e "${RED}❌ Bot .env file not found${NC}"
    touch "$BOT_ENV"
    echo "NODE_ENV=production" >> "$BOT_ENV"
    echo -e "${GREEN}✓${NC} Created bot/.env"
fi

# Check if bot token exists
if grep -q "^TELEGRAM_BOT_TOKEN=" "$BOT_ENV"; then
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" "$BOT_ENV" | cut -d '=' -f2)
    
    if [ -z "$BOT_TOKEN" ] || [ "$BOT_TOKEN" = "your_bot_token_here" ]; then
        echo -e "${RED}❌ Bot token is empty or placeholder${NC}"
        INVALID_TOKEN=1
    else
        echo -e "${GREEN}✓${NC} Bot token found: ${BOT_TOKEN:0:10}..."
        
        # Validate token format (should be like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
        if [[ ! "$BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
            echo -e "${RED}❌ Bot token format appears invalid${NC}"
            echo -e "${YELLOW}   Format should be: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11${NC}"
            INVALID_TOKEN=1
        fi
    fi
else
    echo -e "${RED}❌ TELEGRAM_BOT_TOKEN not found in bot/.env${NC}"
    INVALID_TOKEN=1
fi

if [ -n "$INVALID_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}📝 To fix bot token:${NC}"
    echo -e "${BLUE}1. Go to Telegram and message @BotFather${NC}"
    echo -e "${BLUE}2. Send /newbot to create a new bot (or /mybots to manage existing)${NC}"
    echo -e "${BLUE}3. Copy the token you receive${NC}"
    echo -e "${BLUE}4. Add to bot/.env:${NC}"
    echo ""
    echo -e "${GREEN}   echo 'TELEGRAM_BOT_TOKEN=your_actual_token' >> bot/.env${NC}"
    echo ""
fi

# Set API URL if missing
if ! grep -q "^API_URL=" "$BOT_ENV"; then
    echo "API_URL=http://82.147.84.78:3002" >> "$BOT_ENV"
    echo -e "${GREEN}✓${NC} Set default API_URL"
fi

echo ""
echo -e "${YELLOW}🔄 Step 3: Rebuilding bot...${NC}"

cd bot
npm install 2>/dev/null || true
npm run build
cd ..

echo -e "${GREEN}✓${NC} Bot rebuilt successfully"

echo ""
echo -e "${YELLOW}🔄 Step 4: Restarting bot service...${NC}"

# Stop bot to clear memory
pm2 stop telegram-bot 2>/dev/null || true
sleep 2

# Delete and restart to clear any memory leaks
pm2 delete telegram-bot 2>/dev/null || true
pm2 start "$ECOSYSTEM_FILE" --only telegram-bot 2>/dev/null || true

echo -e "${GREEN}✓${NC} Bot service restarted"

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  ✓ Bot Fix Complete!                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Check bot status:${NC}"
echo -e "   ${GREEN}pm2 logs telegram-bot --lines 50${NC}"
echo ""

if [ -n "$INVALID_TOKEN" ]; then
    echo -e "${RED}⚠️  IMPORTANT: Fix bot token before bot will work!${NC}"
    echo -e "   Edit bot/.env and add your Telegram bot token"
    echo -e "   Then run: pm2 restart telegram-bot"
    echo ""
fi

echo -e "${BLUE}💡 Memory optimization tips:${NC}"
echo -e "   • Monitor with: pm2 monit"
echo -e "   • Check memory: pm2 show telegram-bot"
echo -e "   • If issues persist, increase max_memory_restart in ecosystem config"
echo ""

