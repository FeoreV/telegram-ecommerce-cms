@echo off
cd backend
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     FIXING MISSING ENVIRONMENT VARIABLES                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

node fix-env.js

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     VALIDATING CONFIGURATION                               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

node check-env.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║     ✅ SUCCESS! Ready to start backend                     ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    echo Run: npm run dev
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║     ❌ Still has errors - check output above               ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
)

pause

