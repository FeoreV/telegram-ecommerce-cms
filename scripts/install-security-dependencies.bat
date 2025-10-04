@echo off
REM Security Dependencies Installation Script (Windows)
REM Telegram E-Commerce CMS Platform

echo =========================================
echo Security Dependencies Installation
echo =========================================
echo.

REM Check if running from project root
if not exist "package.json" (
    echo Error: Please run this script from the project root directory
    exit /b 1
)

echo Installing security dependencies...
echo.

REM Navigate to backend directory
if exist "backend" (
    cd backend
    echo Installing backend dependencies...
    
    REM Install runtime dependencies
    call npm install --save isomorphic-dompurify cookie-parser
    
    REM Install dev dependencies
    call npm install --save-dev @types/cookie-parser
    
    echo Backend dependencies installed
    cd ..
) else (
    echo Error: backend directory not found
    exit /b 1
)

echo.
echo =========================================
echo Dependencies installed successfully!
echo =========================================
echo.
echo Next steps:
echo 1. Run: scripts\generate-security-keys.bat
echo 2. Update your .env file with generated keys
echo 3. Apply CSRF protection to your application
echo 4. Review SECURITY_FIXES_IMPLEMENTATION_GUIDE.md
echo.
pause

