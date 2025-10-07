#!/bin/bash
# Fix Frontend Permission Issues
# This script fixes vite permission denied errors

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
echo "║         🔧 Frontend Permission Fix                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}🔍 Checking current user and permissions...${NC}"

CURRENT_USER=$(whoami)
echo -e "${BLUE}→${NC} Current user: $CURRENT_USER"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}⚠️  Running as root - will fix ownership${NC}"
    IS_ROOT=1
fi

echo ""
echo -e "${YELLOW}🔧 Step 1: Fixing node_modules permissions...${NC}"

# Fix frontend node_modules
if [ -d "frontend/node_modules" ]; then
    if [ -n "$IS_ROOT" ]; then
        # If root, change ownership to the user who invoked sudo
        if [ -n "$SUDO_USER" ]; then
            chown -R "$SUDO_USER:$SUDO_USER" frontend/node_modules
            echo -e "${GREEN}✓${NC} Changed ownership to $SUDO_USER"
        fi
    fi
    
    chmod -R 755 frontend/node_modules/.bin 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Fixed frontend/node_modules/.bin permissions"
    
    # Fix vite specifically
    if [ -f "frontend/node_modules/.bin/vite" ]; then
        chmod +x frontend/node_modules/.bin/vite
        echo -e "${GREEN}✓${NC} Made vite executable"
    else
        echo -e "${YELLOW}⚠️  vite binary not found, will reinstall${NC}"
        NEED_REINSTALL=1
    fi
else
    echo -e "${YELLOW}⚠️  frontend/node_modules not found${NC}"
    NEED_REINSTALL=1
fi

# Fix backend and bot node_modules too
for dir in backend bot; do
    if [ -d "$dir/node_modules/.bin" ]; then
        chmod -R 755 "$dir/node_modules/.bin" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Fixed $dir/node_modules/.bin permissions"
    fi
done

echo ""
echo -e "${YELLOW}📦 Step 2: Checking npm/node installation...${NC}"

# Check Node version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

if [ -n "$NEED_REINSTALL" ]; then
    echo ""
    echo -e "${YELLOW}🔄 Step 3: Reinstalling frontend dependencies...${NC}"
    
    cd frontend
    
    # Clean install
    rm -rf node_modules package-lock.json 2>/dev/null || true
    echo -e "${BLUE}→${NC} Cleaned old dependencies"
    
    npm install
    echo -e "${GREEN}✓${NC} Reinstalled dependencies"
    
    # Fix permissions again after install
    chmod -R 755 node_modules/.bin 2>/dev/null || true
    chmod +x node_modules/.bin/vite 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Fixed permissions after install"
    
    cd ..
fi

echo ""
echo -e "${YELLOW}🏗️  Step 4: Building frontend...${NC}"

cd frontend
npm run build
cd ..

echo -e "${GREEN}✓${NC} Frontend built successfully"

echo ""
echo -e "${YELLOW}🔄 Step 5: Restarting frontend service...${NC}"

# Stop and restart frontend
pm2 stop frontend 2>/dev/null || true
sleep 1
pm2 start frontend 2>/dev/null || pm2 restart frontend 2>/dev/null || true

echo -e "${GREEN}✓${NC} Frontend service restarted"

# Fix ownership of PM2 logs if running as sudo
if [ -n "$IS_ROOT" ] && [ -n "$SUDO_USER" ]; then
    if [ -d "/root/.pm2" ]; then
        chown -R "$SUDO_USER:$SUDO_USER" /root/.pm2 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Fixed PM2 logs ownership"
    fi
fi

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║            ✓ Frontend Permissions Fixed!                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Check frontend status:${NC}"
echo -e "   ${GREEN}pm2 logs frontend --lines 20${NC}"
echo ""

echo -e "${BLUE}🌐 Access frontend at:${NC}"
echo -e "   ${GREEN}http://localhost:3000${NC}"
echo ""

echo -e "${YELLOW}💡 If issues persist:${NC}"
echo -e "   1. Check PM2 ecosystem config permissions"
echo -e "   2. Ensure PM2 is running as correct user"
echo -e "   3. Try: ${GREEN}pm2 kill && pm2 start ecosystem.config.cjs${NC}"
echo ""

