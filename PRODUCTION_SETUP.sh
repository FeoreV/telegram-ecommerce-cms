#!/bin/bash

# Production Setup Script for Telegram E-commerce CMS
# Fixes all production issues automatically

set -e

echo "🔧 Starting production setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Fix security keys
echo -e "${YELLOW}📝 Step 1: Generating security keys...${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env not found!${NC}"
    exit 1
fi

# Generate security key IDs if not set
generate_key_id() {
    local key_name=$1
    local key_var="${key_name}_KEY_ID"
    
    if ! grep -q "^${key_var}=" backend/.env 2>/dev/null || grep -q "^${key_var}=$" backend/.env 2>/dev/null; then
        local key_value="${key_name}-$(openssl rand -hex 16)"
        echo "${key_var}=${key_value}" >> backend/.env
        echo -e "${GREEN}✅ Generated ${key_var}${NC}"
    else
        echo -e "${GREEN}✓ ${key_var} already set${NC}"
    fi
}

generate_key_id "SECURITY_LOGS"
generate_key_id "SBOM_SIGNING"
generate_key_id "COMMUNICATION"
generate_key_id "WEBSOCKET"
generate_key_id "BACKUP"
generate_key_id "STORAGE"
generate_key_id "LOG"

# 2. Fix bot token
echo -e "\n${YELLOW}📝 Step 2: Setting up Telegram bot token...${NC}"

if [ ! -f "bot/.env" ]; then
    echo -e "${YELLOW}Creating bot/.env from template...${NC}"
    cat > bot/.env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=

# API Configuration
API_URL=http://localhost:3001

# Redis Configuration (optional for development)
REDIS_URL=redis://localhost:6379

# Bot Port
BOT_PORT=3003

# Environment
NODE_ENV=development
EOF
fi

if grep -q "^TELEGRAM_BOT_TOKEN=$" bot/.env 2>/dev/null || grep -q "YOUR_BOT_TOKEN_FROM_BOTFATHER" bot/.env 2>/dev/null; then
    echo -e "${RED}⚠️  Telegram bot token not configured!${NC}"
    echo -e "${YELLOW}Please follow these steps:${NC}"
    echo "1. Open @BotFather in Telegram"
    echo "2. Create a new bot with /newbot or get token with /token"
    echo "3. Edit bot/.env and set: TELEGRAM_BOT_TOKEN=your_token_here"
    echo ""
    echo -e "${YELLOW}After setting the token, run: pm2 restart telegram-bot${NC}"
else
    echo -e "${GREEN}✓ Bot token configured${NC}"
fi

# 3. Fix frontend permissions
echo -e "\n${YELLOW}📝 Step 3: Fixing frontend permissions...${NC}"

if [ -d "frontend/node_modules/.bin" ]; then
    chmod +x frontend/node_modules/.bin/* 2>/dev/null || true
    echo -e "${GREEN}✅ Fixed vite permissions${NC}"
fi

if [ -d "node_modules/.bin" ]; then
    chmod +x node_modules/.bin/* 2>/dev/null || true
fi

# 4. Rebuild everything
echo -e "\n${YELLOW}📝 Step 4: Rebuilding projects...${NC}"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
fi

# Install and build
pnpm -r install --frozen-lockfile 2>/dev/null || pnpm -r install
pnpm -r build

echo -e "${GREEN}✅ Build completed${NC}"

# 5. Update PM2 ecosystem config
echo -e "\n${YELLOW}📝 Step 5: Updating PM2 configuration...${NC}"

# Create optimized PM2 config
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'telegram-backend',
      script: 'dist/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/.pm2/logs/telegram-backend-error.log',
      out_file: '/root/.pm2/logs/telegram-backend-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'telegram-bot',
      script: 'dist/index.js',
      cwd: './bot',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/.pm2/logs/telegram-bot-error.log',
      out_file: '/root/.pm2/logs/telegram-bot-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run preview -- --port 3000 --host',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/.pm2/logs/frontend-error.log',
      out_file: '/root/.pm2/logs/frontend-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s'
    }
  ]
};
EOF

echo -e "${GREEN}✅ PM2 config updated${NC}"

# 6. Restart services
echo -e "\n${YELLOW}📝 Step 6: Restarting services...${NC}"

pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo -e "\n${GREEN}✅ All services restarted${NC}"

# 7. Check status
echo -e "\n${YELLOW}📊 Service Status:${NC}"
pm2 status

echo -e "\n${GREEN}🎉 Production setup completed!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. If bot token not set, edit bot/.env and run: pm2 restart telegram-bot"
echo "2. Check logs: pm2 logs"
echo "3. Test store creation: open https://yourdomain.com"
echo ""
echo -e "${YELLOW}📚 Documentation: See QUICK_FIX_GUIDE.md${NC}"

