#!/bin/bash

# Quick Production Fix - Minimal steps to get running
# Use when PRODUCTION_SETUP.sh hangs

set -e

echo "🚀 Quick Production Fix"
echo "======================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Fix security keys quickly
echo -e "${YELLOW}1. Generating security keys...${NC}"

cat >> backend/.env << 'EOF'

# Auto-generated security keys
SECURITY_LOGS_KEY_ID=security-logs-$(openssl rand -hex 8)
SBOM_SIGNING_KEY_ID=sbom-signing-$(openssl rand -hex 8)
COMMUNICATION_KEY_ID=communication-$(openssl rand -hex 8)
WEBSOCKET_KEY_ID=websocket-$(openssl rand -hex 8)
BACKUP_KEY_ID=backup-$(openssl rand -hex 8)
STORAGE_KEY_ID=storage-$(openssl rand -hex 8)
LOG_KEY_ID=log-$(openssl rand -hex 8)
EOF

echo -e "${GREEN}✓ Keys added to backend/.env${NC}"

# 2. Install using npm (faster, more stable)
echo -e "\n${YELLOW}2. Installing dependencies with npm...${NC}"

cd backend && npm install && cd ..
cd bot && npm install && cd ..
cd frontend && npm install && cd ..

echo -e "${GREEN}✓ Dependencies installed${NC}"

# 3. Build projects
echo -e "\n${YELLOW}3. Building projects...${NC}"

cd backend && npm run build && cd ..
cd bot && npm run build && cd ..
cd frontend && npm run build && cd ..

echo -e "${GREEN}✓ Build completed${NC}"

# 4. Fix permissions
echo -e "\n${YELLOW}4. Fixing permissions...${NC}"

chmod +x frontend/node_modules/.bin/* 2>/dev/null || true
chmod +x backend/node_modules/.bin/* 2>/dev/null || true
chmod +x bot/node_modules/.bin/* 2>/dev/null || true

echo -e "${GREEN}✓ Permissions fixed${NC}"

# 5. Create simple PM2 config
echo -e "\n${YELLOW}5. Creating PM2 config...${NC}"

cat > ecosystem.production.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'telegram-backend',
      script: './backend/dist/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'telegram-bot',
      script: './bot/dist/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run preview -- --port 3000 --host',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

echo -e "${GREEN}✓ PM2 config created${NC}"

# 6. Restart services
echo -e "\n${YELLOW}6. Restarting services...${NC}"

pm2 delete all 2>/dev/null || true
pm2 start ecosystem.production.cjs
pm2 save

echo -e "${GREEN}✓ Services started${NC}"

# 7. Status
echo -e "\n${YELLOW}📊 Status:${NC}"
pm2 status

echo -e "\n${GREEN}✅ Quick fix completed!${NC}"
echo -e "\n${YELLOW}⚠️  Don't forget to set bot token:${NC}"
echo "nano bot/.env"
echo "TELEGRAM_BOT_TOKEN=your_token_here"
echo "pm2 restart telegram-bot"

