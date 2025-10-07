# PowerShell script for Git commit and push
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Git Commit and Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Add all changes
Write-Host "Adding files..." -ForegroundColor Yellow
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

# Show status
Write-Host ""
Write-Host "Current status:" -ForegroundColor Cyan
git status
Write-Host ""

# Commit
Write-Host "Creating commit..." -ForegroundColor Yellow
$commitMessage = @"
feat: Add comprehensive environment setup and fix tools

- Add automated .env generation scripts (JS, PowerShell, Batch)
- Add environment validation script (check-env.js)
- Add fix-env.js to add missing variables to existing .env
- Add detailed setup guide (ENV_SETUP_GUIDE.md)
- Add npm scripts: setup:env, check:env, fix:env
- Add one-click fix script (FIX-ENV-NOW.bat)
- Add git-push automation scripts
- Generate secure random secrets for JWT, encryption, sessions
- Include all required security key IDs

Resolves backend startup errors:
- TELEGRAM_WEBHOOK_SECRET not set
- ADMIN_DEFAULT_PASSWORD not set
- ADMIN_COOKIE_SECRET not set
- ADMIN_SESSION_SECRET not set
- ENCRYPTION_MASTER_KEY not set
- DATA_ENCRYPTION_KEY not set
- DATABASE_PROVIDER not set
- Failed to initialize secret manager
"@

git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Commit failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Pushing to origin main..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Push failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SUCCESS! Changes pushed to GitHub" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"

