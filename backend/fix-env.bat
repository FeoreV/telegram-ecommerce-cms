@echo off
echo.
echo ========================================
echo   Fixing Missing .env Variables
echo ========================================
echo.

node fix-env.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to fix .env file
    pause
    exit /b 1
)

echo.
echo Running validation...
echo.
node check-env.js

echo.
pause

