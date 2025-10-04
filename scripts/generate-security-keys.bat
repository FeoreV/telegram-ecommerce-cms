@echo off
REM Security Keys Generation Script (Windows)
REM Telegram E-Commerce CMS Platform

setlocal enabledelayedexpansion

echo =========================================
echo Security Keys Generation
echo =========================================
echo.

echo Generating security keys...
echo.

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: OpenSSL not found in PATH
    echo Please install OpenSSL or use Git Bash to run the .sh version
    echo.
    echo Alternative: Use online tools to generate random hex strings
    echo - https://www.random.org/strings/
    echo - Or use PowerShell: [System.Convert]::ToBase64String((1..32 ^| ForEach-Object {Get-Random -Maximum 256}))
    pause
    exit /b 1
)

REM Function to generate keys (using OpenSSL if available)
echo Generating keys with OpenSSL...
echo.

REM Generate keys
for /f "delims=" %%i in ('openssl rand -hex 32') do set SECURITY_LOGS_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set SBOM_SIGNING_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set COMMUNICATION_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set WEBSOCKET_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set BACKUP_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set STORAGE_KEY_ID=%%i
for /f "delims=" %%i in ('openssl rand -hex 32') do set LOG_KEY_ID=%%i

REM Generate JWT secrets
for /f "delims=" %%i in ('openssl rand -base64 64') do set JWT_SECRET=%%i
for /f "delims=" %%i in ('openssl rand -base64 64') do set JWT_REFRESH_SECRET=%%i
for /f "delims=" %%i in ('openssl rand -base64 32') do set SESSION_SECRET=%%i
for /f "delims=" %%i in ('openssl rand -base64 32') do set COOKIE_SECRET=%%i

echo Keys generated successfully!
echo.
echo =========================================
echo Copy the following to your .env file:
echo =========================================
echo.
echo # Security Key IDs
echo SECURITY_LOGS_KEY_ID=!SECURITY_LOGS_KEY_ID!
echo SBOM_SIGNING_KEY_ID=!SBOM_SIGNING_KEY_ID!
echo COMMUNICATION_KEY_ID=!COMMUNICATION_KEY_ID!
echo WEBSOCKET_KEY_ID=!WEBSOCKET_KEY_ID!
echo BACKUP_KEY_ID=!BACKUP_KEY_ID!
echo STORAGE_KEY_ID=!STORAGE_KEY_ID!
echo LOG_KEY_ID=!LOG_KEY_ID!
echo.
echo # JWT and Session Secrets
echo JWT_SECRET=!JWT_SECRET!
echo JWT_REFRESH_SECRET=!JWT_REFRESH_SECRET!
echo SESSION_SECRET=!SESSION_SECRET!
echo COOKIE_SECRET=!COOKIE_SECRET!
echo.
echo # CSRF Protection
echo ENABLE_CSRF_PROTECTION=true
echo CSRF_COOKIE_NAME=_csrf
echo CSRF_HEADER_NAME=X-CSRF-Token
echo.
echo # Security Algorithms
echo HASH_ALGORITHM=sha256
echo ENCRYPTION_ALGORITHM=aes-256-gcm
echo.

REM Save to file
echo Would you like to save these to .env.security? (Y/N)
set /p response=
if /i "!response!"=="Y" (
    (
        echo # Security Key IDs
        echo SECURITY_LOGS_KEY_ID=!SECURITY_LOGS_KEY_ID!
        echo SBOM_SIGNING_KEY_ID=!SBOM_SIGNING_KEY_ID!
        echo COMMUNICATION_KEY_ID=!COMMUNICATION_KEY_ID!
        echo WEBSOCKET_KEY_ID=!WEBSOCKET_KEY_ID!
        echo BACKUP_KEY_ID=!BACKUP_KEY_ID!
        echo STORAGE_KEY_ID=!STORAGE_KEY_ID!
        echo LOG_KEY_ID=!LOG_KEY_ID!
        echo.
        echo # JWT and Session Secrets
        echo JWT_SECRET=!JWT_SECRET!
        echo JWT_REFRESH_SECRET=!JWT_REFRESH_SECRET!
        echo SESSION_SECRET=!SESSION_SECRET!
        echo COOKIE_SECRET=!COOKIE_SECRET!
        echo.
        echo # CSRF Protection
        echo ENABLE_CSRF_PROTECTION=true
        echo CSRF_COOKIE_NAME=_csrf
        echo CSRF_HEADER_NAME=X-CSRF-Token
        echo.
        echo # Security Algorithms
        echo HASH_ALGORITHM=sha256
        echo ENCRYPTION_ALGORITHM=aes-256-gcm
    ) > .env.security
    echo Keys saved to .env.security
    echo.
    echo WARNING: Add .env.security to your .gitignore!
    echo WARNING: Copy these values to your .env file manually
)

echo.
echo =========================================
echo Done!
echo =========================================
echo.
pause

