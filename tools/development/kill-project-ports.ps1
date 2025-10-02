# Kill project-related processes bound to predefined TCP ports.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
    Write-Warning 'Запустите PowerShell от имени администратора, чтобы гарантировать завершение процессов.'
}

$projectPorts = @(3000, 3001, 3002, 3003)

foreach ($port in $projectPorts) {
    Write-Host "`nПроверка порта $port..." -ForegroundColor Cyan

    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "Не удалось получить соединения для порта ${port}: $($_.Exception.Message)"
        continue
    }

    if (-not $connections) {
        Write-Host "Порт $port свободен." -ForegroundColor DarkGreen
        continue
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Завершаю процесс $($process.ProcessName) (PID ${processId}) на порту $port..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Процесс $($process.ProcessName) (PID ${processId}) завершён." -ForegroundColor Green
        } catch {
            Write-Warning "Не удалось завершить процесс с PID ${processId}: $($_.Exception.Message)"
        }
    }
}

Write-Host "`nГотово." -ForegroundColor Green

