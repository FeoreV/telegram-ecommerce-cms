#!/bin/bash

# Security Dependencies Installation Script
# Telegram E-Commerce CMS Platform
# 
# This script installs all required dependencies for security fixes

set -e

echo "========================================="
echo "Security Dependencies Installation"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing security dependencies...${NC}"
echo ""

# Navigate to backend directory
if [ -d "backend" ]; then
    cd backend
    echo -e "${GREEN}Installing backend dependencies...${NC}"
    
    # Install runtime dependencies
    npm install --save isomorphic-dompurify cookie-parser
    
    # Install dev dependencies
    npm install --save-dev @types/cookie-parser
    
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
    cd ..
else
    echo -e "${RED}Error: backend directory not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Dependencies installed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run: ./scripts/generate-security-keys.sh"
echo "2. Update your .env file with generated keys"
echo "3. Apply CSRF protection to your application"
echo "4. Review SECURITY_FIXES_IMPLEMENTATION_GUIDE.md"
echo ""

