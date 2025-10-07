@echo off
REM Development environment setup script for Windows

echo 🚀 Setting up Telegram E-commerce development environment...

REM Create .env files from examples if they don't exist
if not exist .env (
    echo 📝 Creating root .env file...
    copy env.example .env
    echo ✅ Created .env - please update TELEGRAM_BOT_TOKEN and SUPER_ADMIN_TELEGRAM_ID
)

if not exist backend\.env (
    echo 📝 Creating backend .env file...
    (
    echo PORT=3001
    echo NODE_ENV=development
    echo JWT_SECRET=dev-jwt-secret-change-in-production
    echo DATABASE_URL=mysql://telegram_user:telegram_pass@82.147.84.78:3306/telegram_ecommerce
    echo REDIS_URL=redis://82.147.84.78:6379
    echo FRONTEND_URL=http://82.147.84.78:3000
    echo ENABLE_ADMINJS=true
    echo MEDUSA_BASE_URL=http://82.147.84.78:9000
    echo MEDUSA_WEBHOOK_TOKEN=dev-webhook-token
    ) > backend\.env
    echo ✅ Created backend\.env
)

if not exist frontend\.env (
    echo 📝 Creating frontend .env file...
    (
    echo VITE_API_URL=http://82.147.84.78:3001/api
    echo VITE_SOCKET_URL=http://82.147.84.78:3001
    ) > frontend\.env
    echo ✅ Created frontend\.env
)

echo 📦 Installing dependencies...
call npm install
cd backend && call npm install && cd ..
cd frontend && call npm install && cd ..
cd bot && call npm install && cd ..

echo 🗄️ Setting up database...
echo Please ensure MySQL is running and create database 'telegram_ecommerce'
echo Then run: cd backend && npx prisma migrate dev

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env files with your Telegram bot token and admin ID
echo 2. Start MySQL and create database
echo 3. Run migrations: cd backend && npx prisma migrate dev
echo 4. Start services: npm run dev

pause
