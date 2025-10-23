#!/bin/bash
# Development environment setup script

echo "🚀 Setting up Telegram E-commerce development environment..."

# Create .env files from examples if they don't exist
if [ ! -f .env ]; then
    echo "📝 Creating root .env file..."
    cp env.example .env
    echo "✅ Created .env - please update TELEGRAM_BOT_TOKEN and SUPER_ADMIN_TELEGRAM_ID"
fi

if [ ! -f backend/.env ]; then
    echo "📝 Creating backend .env file..."
    cat > backend/.env << 'EOF'
PORT=3001
NODE_ENV=development
JWT_SECRET=dev-jwt-secret-change-in-production
DATABASE_URL=mysql://telegram_user:telegram_pass@82.147.84.78:3306/telegram_ecommerce
REDIS_URL=redis://82.147.84.78:6379
FRONTEND_URL=http://82.147.84.78:3000
ENABLE_ADMINJS=true
MEDUSA_BASE_URL=http://82.147.84.78:9000
MEDUSA_WEBHOOK_TOKEN=dev-webhook-token
EOF
    echo "✅ Created backend/.env"
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend .env file..."
    cat > frontend/.env << 'EOF'
VITE_API_URL=http://82.147.84.78:3001/api
VITE_SOCKET_URL=http://82.147.84.78:3001
EOF
    echo "✅ Created frontend/.env"
fi

echo "📦 Installing dependencies..."
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd bot && npm install && cd ..

echo "🗄️ Setting up database..."
echo "Please ensure MySQL is running and create database 'telegram_ecommerce'"
echo "Then run: cd backend && npx prisma migrate dev"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env files with your Telegram bot token and admin ID"
echo "2. Start MySQL and create database"
echo "3. Run migrations: cd backend && npx prisma migrate dev"
echo "4. Start services: npm run dev"
