@echo off
echo ========================================
echo   Git Commit and Push
echo ========================================
echo.

REM Add all changes
echo Adding files...
git add backend/setup-env.js
git add backend/setup-env.ps1
git add backend/setup-env.bat
git add backend/check-env.js
git add backend/fix-env.js
git add backend/fix-env.bat
git add backend/ENV_SETUP_GUIDE.md
git add backend/package.json
git add FIX-ENV-NOW.bat
git add git-push.bat
git add git-push.ps1

REM Show status
echo.
echo Current status:
git status
echo.

REM Commit
echo Creating commit...
git commit -m "feat: Add comprehensive environment setup and fix tools" -m "" -m "- Add automated .env generation scripts (JS, PowerShell, Batch)" -m "- Add environment validation script (check-env.js)" -m "- Add fix-env.js to add missing variables to existing .env" -m "- Add detailed setup guide (ENV_SETUP_GUIDE.md)" -m "- Add npm scripts: setup:env, check:env, fix:env" -m "- Add one-click fix script (FIX-ENV-NOW.bat)" -m "- Add git-push automation scripts" -m "- Generate secure random secrets for JWT, encryption, sessions" -m "- Include all required security key IDs" -m "" -m "Resolves backend startup errors:" -m "- TELEGRAM_WEBHOOK_SECRET not set" -m "- ADMIN_DEFAULT_PASSWORD not set" -m "- ADMIN_COOKIE_SECRET not set" -m "- ADMIN_SESSION_SECRET not set" -m "- ENCRYPTION_MASTER_KEY not set" -m "- DATA_ENCRYPTION_KEY not set" -m "- DATABASE_PROVIDER not set" -m "- Failed to initialize secret manager"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Commit failed!
    pause
    exit /b 1
)

echo.
echo Pushing to origin main...
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Push failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! Changes pushed to GitHub
echo ========================================
echo.
pause

