#!/bin/bash

# =============================================================================
# Kill All Project Processes Script
# Terminates processes running on project ports
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Killing processes on project ports...${NC}"
echo ""

# Define all project ports
PORTS=(
    3000  # Frontend
    3001  # Backend (development)
    3002  # Backend (production)
    3003  # Telegram Bot
    5173  # Vite Dev Server
    6379  # Redis (optional)
    5432  # PostgreSQL (optional)
)

# Function to kill process on a specific port
kill_port() {
    local port=$1
    
    # Find PIDs using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  Port $port: No process found${NC}"
    else
        echo -e "${RED}🔫 Port $port: Killing PIDs: $pids${NC}"
        
        # Kill each PID
        for pid in $pids; do
            kill -9 $pid 2>/dev/null || true
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}   ✓ Killed PID $pid${NC}"
            else
                echo -e "${YELLOW}   ⚠️  Failed to kill PID $pid (may already be dead)${NC}"
            fi
        done
    fi
}

# Kill processes on all ports
for port in "${PORTS[@]}"; do
    kill_port $port
done

echo ""
echo -e "${GREEN}✅ Done! All project processes have been terminated.${NC}"
echo ""

# Optional: Also kill PM2 processes
read -p "Do you want to stop PM2 processes as well? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Stopping PM2 processes...${NC}"
    pm2 stop all 2>/dev/null || echo -e "${YELLOW}⚠️  PM2 not found or no processes running${NC}"
    pm2 delete all 2>/dev/null || true
    echo -e "${GREEN}✓ PM2 processes stopped${NC}"
fi

echo ""
echo -e "${BLUE}💡 Tip: You can start the project again with:${NC}"
echo "   pm2 start config/services/ecosystem.config.cjs"
echo ""

