#!/bin/bash
# Setup .env files for development
# Ports: Frontend=3000, Backend=3001, Bot=3003

echo "⚙️  Setting up .env files..."
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_ok() { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp config/environments/backend.env.example backend/.env
    print_ok "Created backend/.env (Port 3001)"
else
    print_warn "backend/.env already exists, skipping..."
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    cp config/environments/frontend.env.example frontend/.env
    print_ok "Created frontend/.env (Port 3000)"
else
    print_warn "frontend/.env already exists, skipping..."
fi

# Bot .env
if [ ! -f "bot/.env" ]; then
    cp config/environments/bot.env.production.example bot/.env
    
    # Update bot port to 3003
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/PORT=8443/PORT=3003/' bot/.env
    else
        # Linux
        sed -i 's/PORT=8443/PORT=3003/' bot/.env
    fi
    
    print_ok "Created bot/.env (Port 3003)"
else
    print_warn "bot/.env already exists, skipping..."
fi

echo ""
echo "============================"
print_ok "✅ Setup Complete!"
echo "============================"
echo ""
echo "📝 Configuration:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Bot:      Port 3003"
echo ""
echo "⚠️  IMPORTANT: Edit .env files and add:"
echo "   1. TELEGRAM_BOT_TOKEN from @BotFather"
echo "   2. Generate encryption keys: node backend/scripts/generate-key-ids.js"
echo "   3. Update JWT secrets (see .env files)"
echo ""
echo "🚀 Next steps:"
echo "   1. cd backend && npm install && npx prisma migrate dev"
echo "   2. cd frontend && npm install"
echo "   3. cd bot && npm install"
echo "   4. Start services: npm run dev (in each directory)"
echo ""

