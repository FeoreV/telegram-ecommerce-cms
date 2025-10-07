#!/bin/bash

echo "================================"
echo " Telegram E-commerce Bot Setup"
echo " XAMPP Configuration"
echo "================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found$(node --version)${NC}"
echo

# Check if MySQL is running (XAMPP)
if ! nc -z 82.147.84.78 3306 2>/dev/null; then
    echo -e "${RED}Error: MySQL is not running on port 3306!${NC}"
    echo "Please start XAMPP and enable MySQL service."
    echo "For XAMPP on Linux: sudo /opt/lampp/lampp start"
    echo "For XAMPP on macOS: sudo /Applications/XAMPP/xamppfiles/xampp start"
    exit 1
fi

echo -e "${GREEN}✓ MySQL is running on port 3306${NC}"
echo

# Install dependencies
echo "Installing dependencies..."
echo

echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend
npm install

echo "Installing bot dependencies..."
cd ../bot
npm install

cd ..

echo
echo -e "${GREEN}✓ All dependencies installed${NC}"
echo

# Setup environment
echo "Setting up environment..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# Database Configuration для XAMPP
DATABASE_URL="mysql://root:@82.147.84.78:3306/telegram_ecommerce"

# Backend Configuration
PORT=3001
JWT_SECRET="your-secret-key-change-this"
NODE_ENV="development"

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
SUPER_ADMIN_TELEGRAM_ID="YOUR_TELEGRAM_ID_HERE"

# Frontend Configuration
REACT_APP_API_URL="http://82.147.84.78:3001/api"
REACT_APP_SOCKET_URL="http://82.147.84.78:3001"
VITE_API_URL="http://82.147.84.78:3001/api"

# Bot Configuration
BOT_PORT=3002

# File Upload Configuration
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="10485760"

# Logging Configuration
LOG_LEVEL="info"
EOL
    
    echo -e "${GREEN}✓ .env file created${NC}"
    echo
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env file and set:${NC}"
    echo "   - TELEGRAM_BOT_TOKEN (get from @BotFather)"
    echo "   - SUPER_ADMIN_TELEGRAM_ID (get from @userinfobot)"
    echo
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
    echo
fi

# Database setup
echo "Setting up database..."
echo

echo -e "${YELLOW}⚠️  Make sure you have created 'telegram_ecommerce' database in phpMyAdmin${NC}"
echo "   1. Open http://82.147.84.78/phpmyadmin"
echo "   2. Click 'New' to create database"
echo "   3. Name: telegram_ecommerce"
echo "   4. Collation: utf8mb4_unicode_ci"
echo

read -p "Press Enter when database is ready, or Ctrl+C to exit..."

cd backend

echo "Generating Prisma client..."
npx prisma generate

echo "Applying database migrations..."
npx prisma migrate dev --name init

echo "Seeding database with test data..."
npx prisma db seed

cd ..

echo
echo "================================"
echo " Setup Complete! 🎉"
echo "================================"
echo
echo "Next steps:"
echo "1. Edit .env file with your Telegram bot token and admin ID"
echo "2. Run: npm run dev"
echo "3. Open admin panel: http://82.147.84.78:3000"
echo "4. Test your Telegram bot"
echo
echo "Useful commands:"
echo "  npm run dev          - Start all services"
echo "  npm run dev:backend  - Start only backend"
echo "  npm run dev:frontend - Start only frontend"
echo "  npm run dev:bot      - Start only bot"
echo
echo "Documentation:"
echo "  README.md         - General documentation"
echo "  XAMPP_SETUP.md    - Detailed XAMPP setup"
echo "  QUICK_START.md    - Quick start guide"
echo
