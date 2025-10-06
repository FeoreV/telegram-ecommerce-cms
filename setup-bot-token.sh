#!/bin/bash

# Interactive Bot Token Setup Script

echo "🤖 Telegram Bot Token Setup"
echo "=============================="
echo ""

# Check if bot/.env exists
if [ ! -f "bot/.env" ]; then
    echo "Creating bot/.env file..."
    cat > bot/.env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=

# API Configuration
API_URL=http://localhost:3001

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Bot Port
BOT_PORT=3003

# Environment
NODE_ENV=development
EOF
    echo "✅ Created bot/.env"
fi

# Instructions
echo "📝 How to get your Telegram bot token:"
echo ""
echo "1. Open Telegram and search for @BotFather"
echo "2. Send /newbot to create a new bot (or /token for existing)"
echo "3. Follow the instructions to set bot name and username"
echo "4. Copy the token (format: 1234567890:ABCdefGhIJklmNOpqRStuvwXYz)"
echo ""
read -p "Enter your bot token: " BOT_TOKEN

# Validate token format
if [[ ! $BOT_TOKEN =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
    echo "❌ Invalid token format!"
    echo "Token should be like: 1234567890:ABCdefGhIJklmNOpqRStuvwXYz"
    exit 1
fi

# Update .env file
if grep -q "^TELEGRAM_BOT_TOKEN=" bot/.env; then
    sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=${BOT_TOKEN}|" bot/.env
else
    echo "TELEGRAM_BOT_TOKEN=${BOT_TOKEN}" >> bot/.env
fi

echo ""
echo "✅ Bot token configured successfully!"
echo ""
echo "🔄 Restarting bot service..."

if command -v pm2 &> /dev/null; then
    pm2 restart telegram-bot 2>/dev/null || pm2 start ecosystem.config.cjs --only telegram-bot
    echo "✅ Bot restarted"
    echo ""
    echo "📊 Checking bot status..."
    sleep 2
    pm2 logs telegram-bot --lines 20 --nostream
else
    echo "⚠️  PM2 not found. Please restart bot manually."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Test your bot by opening it in Telegram and sending /start"

