@echo off
REM Setup .env files for development
REM Ports: Frontend=3000, Backend=3001, Bot=3003

echo ⚙️  Setting up .env files...
echo ============================
echo.

REM Backend .env
if not exist "backend\.env" (
    copy config\environments\backend.env.example backend\.env >nul
    echo ✓ Created backend\.env ^(Port 3001^)
) else (
    echo ⚠ backend\.env already exists, skipping...
)

REM Frontend .env  
if not exist "frontend\.env" (
    copy config\environments\frontend.env.example frontend\.env >nul
    echo ✓ Created frontend\.env ^(Port 3000^)
) else (
    echo ⚠ frontend\.env already exists, skipping...
)

REM Bot .env
if not exist "bot\.env" (
    copy config\environments\bot.env.production.example bot\.env >nul
    
    REM Update bot port to 3003
    powershell -Command "(Get-Content bot\.env) -replace 'PORT=8443', 'PORT=3003' | Set-Content bot\.env"
    
    echo ✓ Created bot\.env ^(Port 3003^)
) else (
    echo ⚠ bot\.env already exists, skipping...
)

echo.
echo ============================
echo ✅ Setup Complete!
echo ============================
echo.
echo 📝 Configuration:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:3001
echo    Bot:      Port 3003
echo.
echo ⚠️  IMPORTANT: Edit .env files and add:
echo    1. TELEGRAM_BOT_TOKEN from @BotFather
echo    2. Generate encryption keys: node backend\scripts\generate-key-ids.js
echo    3. Update JWT secrets ^(see .env files^)
echo.
echo 🚀 Next steps:
echo    1. cd backend ^&^& npm install ^&^& npx prisma migrate dev
echo    2. cd frontend ^&^& npm install
echo    3. cd bot ^&^& npm install
echo    4. Start services: npm run dev ^(in each directory^)
echo.
pause

