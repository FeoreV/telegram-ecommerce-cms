@echo off
echo ================================
echo  Telegram E-commerce Bot Setup
echo  XAMPP Configuration
echo ================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js found
echo.

REM Check if XAMPP is running
echo Checking XAMPP MySQL connection...
netstat -an | findstr :3306 >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: MySQL is not running on port 3306!
    echo Please start XAMPP and enable MySQL service.
    echo Open XAMPP Control Panel and click Start for MySQL.
    pause
    exit /b 1
)

echo ✓ MySQL is running on port 3306
echo.

REM Install dependencies
echo Installing dependencies...
echo.

echo Installing root dependencies...
call npm install

echo Installing backend dependencies...
cd backend
call npm install

echo Installing bot dependencies...
cd ..\bot
call npm install

cd ..

echo.
echo ✓ All dependencies installed
echo.

REM Setup environment
echo Setting up environment...
if not exist .env (
    echo Creating .env file...
    (
        echo # Database Configuration для XAMPP
        echo DATABASE_URL="mysql://root:@82.147.84.78:3306/telegram_ecommerce"
        echo.
        echo # Backend Configuration
        echo PORT=3001
        echo JWT_SECRET="your-secret-key-change-this"
        echo NODE_ENV="development"
        echo.
        echo # Telegram Bot Configuration
        echo TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
        echo SUPER_ADMIN_TELEGRAM_ID="YOUR_TELEGRAM_ID_HERE"
        echo.
        echo # AdminJS Configuration
        echo ADMIN_COOKIE_SECRET="your-admin-cookie-secret"
        echo SESSION_SECRET="your-session-secret"
        echo.
        echo # Bot Configuration
        echo BOT_PORT=3002
        echo.
        echo # File Upload Configuration
        echo UPLOAD_PATH="./uploads"
        echo MAX_FILE_SIZE="10485760"
        echo.
        echo # Logging Configuration
        echo LOG_LEVEL="info"
    ) > .env
    
    echo ✓ .env file created
    echo.
    echo ⚠️  IMPORTANT: Edit .env file and set:
    echo    - TELEGRAM_BOT_TOKEN (get from @BotFather)
    echo    - SUPER_ADMIN_TELEGRAM_ID (get from @userinfobot)
    echo.
) else (
    echo ✓ .env file already exists
    echo.
)

REM Database setup
echo Setting up database...
echo.

echo ⚠️  Make sure you have created 'telegram_ecommerce' database in phpMyAdmin
echo    1. Open http://82.147.84.78/phpmyadmin
echo    2. Click 'New' to create database
echo    3. Name: telegram_ecommerce
echo    4. Collation: utf8mb4_unicode_ci
echo.

set /p continue="Press Enter when database is ready, or Ctrl+C to exit..."

cd backend

echo Generating Prisma client...
call npx prisma generate

echo Applying database migrations...
call npx prisma migrate dev --name init

echo Seeding database with test data...
call npx prisma db seed

cd ..

echo.
echo ================================
echo  Setup Complete! 🎉
echo ================================
echo.
echo Next steps:
echo 1. Edit .env file with your Telegram bot token and admin ID
echo 2. Run: npm run dev
echo 3. Open admin panel: http://82.147.84.78:3001/admin
echo 4. Test your Telegram bot
echo.
echo Useful commands:
echo   npm run dev          - Start all services
echo   npm run dev:backend  - Start backend with AdminJS
echo   npm run dev:bot      - Start only bot
echo.
echo Documentation:
echo   README.md         - General documentation
echo   XAMPP_SETUP.md    - Detailed XAMPP setup
echo   QUICK_START.md    - Quick start guide
echo.

pause
