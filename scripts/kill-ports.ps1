# =============================================================================
# Kill All Project Processes Script (PowerShell)
# Terminates processes running on project ports
# =============================================================================

Write-Host "`n🔍 Killing processes on project ports...`n" -ForegroundColor Blue

# Define all project ports
$ports = @(
    3000,  # Frontend
    3001,  # Backend (development)
    3002,  # Backend (production)
    3003,  # Telegram Bot
    5173,  # Vite Dev Server
    6379,  # Redis (optional)
    5432   # PostgreSQL (optional)
)

# Function to kill process on a specific port
function Kill-ProcessOnPort {
    param (
        [int]$Port
    )
    
    try {
        # Find processes using the port
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            
            Write-Host "🔫 Port ${Port}: Found processes (PIDs: $($pids -join ', '))" -ForegroundColor Red
            
            foreach ($pid in $pids) {
                try {
                    $process = Get-Process -Id $pid -ErrorAction Stop
                    $processName = $process.ProcessName
                    
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "   ✓ Killed PID $pid ($processName)" -ForegroundColor Green
                }
                catch {
                    Write-Host "   ⚠️  Failed to kill PID $pid (may already be dead)" -ForegroundColor Yellow
                }
            }
        }
        else {
            Write-Host "⚠️  Port ${Port}: No process found" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "⚠️  Port ${Port}: No process found" -ForegroundColor Yellow
    }
}

# Kill processes on all ports
foreach ($port in $ports) {
    Kill-ProcessOnPort -Port $port
}

Write-Host "`n✅ Done! All project processes have been terminated.`n" -ForegroundColor Green

# Optional: Also kill PM2 processes
$response = Read-Host "Do you want to stop PM2 processes as well? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nStopping PM2 processes..." -ForegroundColor Blue
    
    try {
        pm2 stop all 2>$null
        pm2 delete all 2>$null
        Write-Host "✓ PM2 processes stopped" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  PM2 not found or no processes running" -ForegroundColor Yellow
    }
}

Write-Host "`n💡 Tip: You can start the project again with:" -ForegroundColor Blue
Write-Host "   pm2 start config/services/ecosystem.config.cjs`n"

