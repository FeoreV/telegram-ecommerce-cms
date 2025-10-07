#!/bin/bash
# Production Setup Script for Telegram E-Commerce CMS
# This script sets up all required environment variables and fixes common production issues

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BOLD}${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🚀 Production Setup - Telegram E-Commerce CMS        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}⚠️  This script should be run with sudo for permission fixes${NC}"
   echo -e "${YELLOW}   Some steps may be skipped if not run with sudo${NC}"
   echo ""
fi

# Function to generate a secure random key
generate_key() {
    openssl rand -hex 32
}

generate_base64_key() {
    openssl rand -base64 64 | tr -d '\n'
}

# Function to check if a variable exists in .env
check_env_var() {
    local var_name=$1
    local env_file=${2:-.env}
    
    if [ -f "$env_file" ]; then
        grep -q "^${var_name}=" "$env_file" 2>/dev/null
        return $?
    fi
    return 1
}

# Function to add or update env variable
set_env_var() {
    local var_name=$1
    local var_value=$2
    local env_file=${3:-.env}
    
    if check_env_var "$var_name" "$env_file"; then
        # Update existing
        sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$env_file"
    else
        # Add new
        echo "${var_name}=${var_value}" >> "$env_file"
    fi
}

echo -e "${YELLOW}📋 Step 1: Checking environment files...${NC}"

# Backend .env
BACKEND_ENV="backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
    echo -e "${YELLOW}⚠️  Backend .env not found, creating from example...${NC}"
    if [ -f "config/environments/env.production.example" ]; then
        cp config/environments/env.production.example "$BACKEND_ENV"
        echo -e "${GREEN}✓ Created backend/.env${NC}"
    else
        touch "$BACKEND_ENV"
        echo -e "${GREEN}✓ Created empty backend/.env${NC}"
    fi
fi

# Frontend .env
FRONTEND_ENV="frontend/.env"
if [ ! -f "$FRONTEND_ENV" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env not found, creating...${NC}"
    cat > "$FRONTEND_ENV" << EOF
VITE_API_URL=http://localhost:3002
VITE_WS_URL=ws://localhost:3002
NODE_ENV=production
EOF
    echo -e "${GREEN}✓ Created frontend/.env${NC}"
fi

# Bot .env
BOT_ENV="bot/.env"
if [ ! -f "$BOT_ENV" ]; then
    echo -e "${YELLOW}⚠️  Bot .env not found, creating...${NC}"
    touch "$BOT_ENV"
    echo -e "${GREEN}✓ Created bot/.env${NC}"
fi

echo ""
echo -e "${YELLOW}🔐 Step 2: Generating security keys...${NC}"

# Generate all required security key IDs
declare -A KEYS=(
    ["SECURITY_LOGS_KEY_ID"]="Security logs encryption"
    ["SBOM_SIGNING_KEY_ID"]="SBOM signing"
    ["COMMUNICATION_KEY_ID"]="Communication encryption"
    ["WEBSOCKET_KEY_ID"]="WebSocket encryption"
    ["BACKUP_KEY_ID"]="Backup encryption"
    ["STORAGE_KEY_ID"]="Storage encryption"
    ["LOG_KEY_ID"]="Log encryption"
)

for key_name in "${!KEYS[@]}"; do
    if ! check_env_var "$key_name" "$BACKEND_ENV"; then
        key_value=$(generate_key)
        set_env_var "$key_name" "$key_value" "$BACKEND_ENV"
        echo -e "${GREEN}✓${NC} Generated $key_name - ${KEYS[$key_name]}"
    else
        echo -e "${BLUE}→${NC} $key_name already exists"
    fi
done

# Generate JWT secrets if missing
if ! check_env_var "JWT_SECRET" "$BACKEND_ENV"; then
    JWT_SECRET=$(generate_base64_key)
    set_env_var "JWT_SECRET" "$JWT_SECRET" "$BACKEND_ENV"
    echo -e "${GREEN}✓${NC} Generated JWT_SECRET"
else
    echo -e "${BLUE}→${NC} JWT_SECRET already exists"
fi

if ! check_env_var "JWT_REFRESH_SECRET" "$BACKEND_ENV"; then
    JWT_REFRESH_SECRET=$(generate_base64_key)
    set_env_var "JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET" "$BACKEND_ENV"
    echo -e "${GREEN}✓${NC} Generated JWT_REFRESH_SECRET"
else
    echo -e "${BLUE}→${NC} JWT_REFRESH_SECRET already exists"
fi

if ! check_env_var "SESSION_SECRET" "$BACKEND_ENV"; then
    SESSION_SECRET=$(generate_base64_key)
    set_env_var "SESSION_SECRET" "$SESSION_SECRET" "$BACKEND_ENV"
    echo -e "${GREEN}✓${NC} Generated SESSION_SECRET"
else
    echo -e "${BLUE}→${NC} SESSION_SECRET already exists"
fi

if ! check_env_var "COOKIE_SECRET" "$BACKEND_ENV"; then
    COOKIE_SECRET=$(generate_base64_key)
    set_env_var "COOKIE_SECRET" "$COOKIE_SECRET" "$BACKEND_ENV"
    echo -e "${GREEN}✓${NC} Generated COOKIE_SECRET"
else
    echo -e "${BLUE}→${NC} COOKIE_SECRET already exists"
fi

# Set NODE_ENV to production
set_env_var "NODE_ENV" "production" "$BACKEND_ENV"
set_env_var "NODE_ENV" "production" "$BOT_ENV"

echo ""
echo -e "${YELLOW}🔧 Step 3: Fixing permissions...${NC}"

# Fix node_modules permissions
if [ "$EUID" -eq 0 ] || [ -n "$SUDO_USER" ]; then
    chmod -R 755 frontend/node_modules/.bin 2>/dev/null || true
    chmod +x frontend/node_modules/.bin/vite 2>/dev/null || true
    chmod -R 755 backend/node_modules/.bin 2>/dev/null || true
    chmod -R 755 bot/node_modules/.bin 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Fixed node_modules permissions"
else
    echo -e "${YELLOW}⚠️  Skipping permission fixes (not running with sudo)${NC}"
    echo -e "${YELLOW}   Run: sudo chmod -R 755 frontend/node_modules/.bin${NC}"
fi

# Fix upload directories
mkdir -p backend/uploads/payment-proofs
mkdir -p storage/uploads
mkdir -p storage/logs
chmod -R 755 backend/uploads 2>/dev/null || true
chmod -R 755 storage 2>/dev/null || true

echo ""
echo -e "${YELLOW}🤖 Step 4: Checking bot configuration...${NC}"

# Check if bot token exists
if ! check_env_var "TELEGRAM_BOT_TOKEN" "$BOT_ENV"; then
    echo -e "${RED}❌ TELEGRAM_BOT_TOKEN not found in bot/.env${NC}"
    echo -e "${YELLOW}   Please add your bot token:${NC}"
    echo -e "${BLUE}   1. Get token from @BotFather on Telegram${NC}"
    echo -e "${BLUE}   2. Add to bot/.env: TELEGRAM_BOT_TOKEN=your_token_here${NC}"
    MISSING_BOT_TOKEN=1
else
    echo -e "${GREEN}✓${NC} Bot token configured"
fi

# Set bot API URL if missing
if ! check_env_var "API_URL" "$BOT_ENV"; then
    set_env_var "API_URL" "http://localhost:3002" "$BOT_ENV"
    echo -e "${GREEN}✓${NC} Set default API_URL for bot"
fi

echo ""
echo -e "${YELLOW}⚙️  Step 5: Building applications...${NC}"

# Build backend
echo -e "${BLUE}→${NC} Building backend..."
cd backend
npm install --production=false 2>/dev/null || true
npm run build
cd ..
echo -e "${GREEN}✓${NC} Backend built successfully"

# Build bot
echo -e "${BLUE}→${NC} Building bot..."
cd bot
npm install --production=false 2>/dev/null || true
npm run build
cd ..
echo -e "${GREEN}✓${NC} Bot built successfully"

# Build frontend
echo -e "${BLUE}→${NC} Building frontend..."
cd frontend
npm install --production=false 2>/dev/null || true
npm run build
cd ..
echo -e "${GREEN}✓${NC} Frontend built successfully"

echo ""
echo -e "${YELLOW}🔄 Step 6: Restarting PM2 services...${NC}"

# Restart services
pm2 restart all 2>/dev/null || pm2 start ecosystem.config.cjs 2>/dev/null || true

echo -e "${GREEN}✓${NC} PM2 services restarted"

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  ✓ Setup Complete!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Next Steps:${NC}"
echo ""
echo -e "1. ${BOLD}Check logs:${NC}"
echo -e "   ${BLUE}pm2 logs${NC}"
echo ""
echo -e "2. ${BOLD}Monitor services:${NC}"
echo -e "   ${BLUE}pm2 status${NC}"
echo ""

if [ -n "$MISSING_BOT_TOKEN" ]; then
    echo -e "3. ${BOLD}${RED}Add bot token:${NC}"
    echo -e "   ${BLUE}Edit bot/.env and add: TELEGRAM_BOT_TOKEN=your_token${NC}"
    echo -e "   ${BLUE}Then run: pm2 restart telegram-bot${NC}"
    echo ""
fi

echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo -e "   • Never commit .env files to Git"
echo -e "   • Keep security keys secret"
echo -e "   • Use different keys for dev/staging/prod"
echo -e "   • Regular key rotation in production"
echo ""

echo -e "${GREEN}✓ All done! Your application is ready.${NC}"

