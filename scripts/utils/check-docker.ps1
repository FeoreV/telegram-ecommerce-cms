#!/usr/bin/env pwsh
# Check Docker Desktop status and offer solutions

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Docker Desktop Status Checker" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Test-DockerInstalled {
    try {
        $null = Get-Command docker -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Start-DockerDesktop {
    Write-Host "Attempting to start Docker Desktop..." -ForegroundColor Yellow
    
    # Common Docker Desktop paths
    $dockerPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    $dockerPath = $dockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($dockerPath) {
        Write-Host "Found Docker Desktop at: $dockerPath" -ForegroundColor Gray
        Start-Process $dockerPath
        
        Write-Host "`nWaiting for Docker Desktop to start" -NoNewline -ForegroundColor Yellow
        
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Seconds 2
            Write-Host "." -NoNewline -ForegroundColor Yellow
            
            if (Test-DockerRunning) {
                Write-Host "`n✅ Docker Desktop is now running!" -ForegroundColor Green
                return $true
            }
        }
        
        Write-Host "`n⚠️ Docker Desktop started but not ready yet. Please wait a moment and try again." -ForegroundColor Yellow
        return $false
    } else {
        Write-Host "❌ Could not find Docker Desktop executable." -ForegroundColor Red
        Write-Host "Please start Docker Desktop manually from the Start menu." -ForegroundColor Yellow
        return $false
    }
}

# Check if Docker is installed
Write-Host "Checking Docker installation..." -ForegroundColor Yellow

if (-not (Test-DockerInstalled)) {
    Write-Host "❌ Docker is not installed!" -ForegroundColor Red
    Write-Host "`nPlease install Docker Desktop from:" -ForegroundColor Yellow
    Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ Docker CLI found" -ForegroundColor Green
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker Engine status..." -ForegroundColor Yellow

if (Test-DockerRunning) {
    Write-Host "✅ Docker Desktop is running!" -ForegroundColor Green
    Write-Host ""
    
    # Show Docker info
    Write-Host "Docker Information:" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Gray
    docker version --format "{{.Server.Version}}" 2>$null | ForEach-Object {
        Write-Host "Engine Version: $_" -ForegroundColor White
    }
    
    $containers = docker ps -q 2>$null
    $containerCount = if ($containers) { ($containers | Measure-Object).Count } else { 0 }
    Write-Host "Running Containers: $containerCount" -ForegroundColor White
    
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host ""
    
    if ($containerCount -gt 0) {
        Write-Host "Active Containers:" -ForegroundColor Cyan
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    }
    
    Write-Host "`n✅ You can now run Docker commands!" -ForegroundColor Green
    exit 0
    
} else {
    Write-Host "❌ Docker Desktop is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error detected: connect ENOENT \\.\pipe\dockerDesktopEngine" -ForegroundColor Gray
    Write-Host ""
    
    # Offer to start Docker
    Write-Host "Would you like to start Docker Desktop? (Y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host ""
        if (Start-DockerDesktop) {
            Write-Host "`n✅ Docker is ready to use!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "`n⚠️ Please check Docker Desktop and try again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "📝 To start Docker manually:" -ForegroundColor Cyan
        Write-Host "   1. Open 'Docker Desktop' from Start menu" -ForegroundColor Gray
        Write-Host "   2. Wait for it to fully start (30-60 seconds)" -ForegroundColor Gray
        Write-Host "   3. Run this script again or execute your command" -ForegroundColor Gray
        Write-Host ""
        Write-Host "💡 Alternative: Run services locally without Docker" -ForegroundColor Cyan
        Write-Host "   - Bot: cd bot && npm run dev" -ForegroundColor Gray
        Write-Host "   - Backend: cd backend && npm run dev" -ForegroundColor Gray
        Write-Host "   - Frontend: cd frontend && npm run dev" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
}

