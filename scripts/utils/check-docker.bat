@echo off
REM Check Docker Desktop status

echo.
echo ========================================
echo    Docker Desktop Status Checker
echo ========================================
echo.

echo Checking Docker status...
docker info >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [92m%CHECKMARK% Docker Desktop is running![0m
    echo.
    echo Docker Information:
    echo ----------------------------------------
    docker version
    echo ----------------------------------------
    echo.
    docker ps
    echo.
    echo [92mYou can now run Docker commands![0m
    goto :end
) else (
    echo [91mX Docker Desktop is not running[0m
    echo.
    echo Error: connect ENOENT \\.\pipe\dockerDesktopEngine
    echo.
    echo [93mTo fix this:[0m
    echo   1. Open 'Docker Desktop' from Start menu
    echo   2. Wait for it to fully start (30-60 seconds)
    echo   3. Run this script again or execute your command
    echo.
    echo [96mAlternative: Run services locally without Docker[0m
    echo   - Bot: cd bot ^&^& npm run dev
    echo   - Backend: cd backend ^&^& npm run dev
    echo   - Frontend: cd frontend ^&^& npm run dev
    echo.
    
    REM Try to start Docker Desktop
    echo.
    set /p START_DOCKER="Would you like to attempt to start Docker Desktop? (Y/N): "
    
    if /i "%START_DOCKER%"=="Y" (
        echo.
        echo Attempting to start Docker Desktop...
        
        REM Check common Docker Desktop locations
        if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
            start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
            echo Docker Desktop launch initiated. Please wait 30-60 seconds.
        ) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
            start "" "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
            echo Docker Desktop launch initiated. Please wait 30-60 seconds.
        ) else (
            echo Could not find Docker Desktop executable.
            echo Please start it manually from the Start menu.
        )
    )
)

:end
echo.
pause

