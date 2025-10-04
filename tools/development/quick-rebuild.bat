@echo off
REM Quick rebuild script - wrapper for PowerShell script

echo ========================================
echo   Docker Quick Rebuild
echo ========================================
echo.

REM Check if specific service is provided
if "%1"=="" (
    echo Rebuilding all services...
    powershell -ExecutionPolicy Bypass -File "%~dp0rebuild-docker.ps1"
) else if "%1"=="--no-cache" (
    echo Rebuilding all services with --no-cache...
    powershell -ExecutionPolicy Bypass -File "%~dp0rebuild-docker.ps1" -NoCache
) else if "%1"=="-s" (
    echo Rebuilding service: %2
    powershell -ExecutionPolicy Bypass -File "%~dp0rebuild-docker.ps1" -Service -ServiceName "%2"
) else (
    echo Usage:
    echo   quick-rebuild.bat              - Rebuild all services
    echo   quick-rebuild.bat --no-cache   - Rebuild with fresh cache
    echo   quick-rebuild.bat -s backend   - Rebuild specific service
    echo.
    echo Available services: backend, frontend, bot
)

