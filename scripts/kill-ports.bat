@echo off
REM =============================================================================
REM Kill All Project Processes Script (Batch)
REM Terminates processes running on project ports
REM =============================================================================

echo.
echo Killing processes on project ports...
echo.

REM Define all project ports
set PORTS=3000 3001 3002 3003 5173 6379 5432

REM Kill processes on each port
for %%P in (%PORTS%) do (
    echo Checking port %%P...
    
    REM Find and kill process on port
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
        echo   Killing process with PID: %%a
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Killed PID %%a
        ) else (
            echo   [WARN] Failed to kill PID %%a
        )
    )
)

echo.
echo Done! All project processes have been terminated.
echo.

REM Optional: Also kill PM2 processes
set /p KILLPM2="Do you want to stop PM2 processes as well? (y/n): "
if /i "%KILLPM2%"=="y" (
    echo.
    echo Stopping PM2 processes...
    pm2 stop all 2>nul
    pm2 delete all 2>nul
    echo PM2 processes stopped
)

echo.
echo Tip: You can start the project again with:
echo    pm2 start config/services/ecosystem.config.cjs
echo.

pause

