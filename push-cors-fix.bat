@echo off
cd /d "%~dp0"
echo Pushing CORS fix to Git...
git add CORS_FIX_INSTRUCTIONS.md backend/fix-cors.sh backend/fix-jwt-secrets.sh
git commit -m "fix: Add CORS configuration script and instructions for production"
git push origin main
echo Done!
pause

