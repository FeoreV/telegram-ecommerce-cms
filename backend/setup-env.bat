@echo off
REM Batch script to run the .env setup
REM This will try PowerShell first, then fall back to Node.js

echo.
echo ============================================================
echo    Setting up .env file for Telegram E-Commerce Backend
echo ============================================================
echo.

REM Check if PowerShell is available
where pwsh >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using PowerShell 7...
    pwsh -ExecutionPolicy Bypass -File "%~dp0setup-env.ps1"
    goto :end
)

where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using Windows PowerShell...
    powershell -ExecutionPolicy Bypass -File "%~dp0setup-env.ps1"
    goto :end
)

REM Check if Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using Node.js...
    node "%~dp0setup-env.js"
    goto :end
)

echo ERROR: Neither PowerShell nor Node.js found!
echo Please install Node.js from https://nodejs.org/
echo.
pause
exit /b 1

:end
echo.
echo ============================================================
echo.
pause

