# Скрипт автоматической установки ключей в backend/.env
# Использование: .\scripts\setup-env-keys.ps1

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🔧 Автоматическая установка ключей в backend/.env     ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Функция генерации безопасного ключа
function New-SecureKey {
    param([int]$Length = 32)
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

# Функция генерации base64 секрета
function New-Base64Secret {
    param([int]$Length = 32)
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

$envPath = "backend\.env"

# Проверяем существование файла
if (Test-Path $envPath) {
    Write-Host "⚠️  Файл backend\.env уже существует!" -ForegroundColor Yellow
    $response = Read-Host "Добавить ключи в конец файла? (y/n)"
    if ($response -notmatch "^[yYдД]") {
        Write-Host "`n❌ Отменено пользователем" -ForegroundColor Red
        exit 0
    }
    $mode = "append"
} else {
    Write-Host "📄 Создаю новый файл backend\.env..." -ForegroundColor Green
    $mode = "create"
}

Write-Host "`n📝 Генерация ключей безопасности..." -ForegroundColor Yellow

# Генерируем ключи
$keys = @"

# ============================================
# Security Key IDs для шифрования и защиты данных
# Сгенерировано: $(Get-Date -Format "dd.MM.yyyy HH:mm:ss")
# ============================================

# Ключи шифрования
SECURITY_LOGS_KEY_ID=$(New-SecureKey)
SBOM_SIGNING_KEY_ID=$(New-SecureKey)
COMMUNICATION_KEY_ID=$(New-SecureKey)
WEBSOCKET_KEY_ID=$(New-SecureKey)
BACKUP_KEY_ID=$(New-SecureKey)
STORAGE_KEY_ID=$(New-SecureKey)
LOG_KEY_ID=$(New-SecureKey)

# JWT и сессии
JWT_SECRET=$(New-Base64Secret -Length 64)
JWT_REFRESH_SECRET=$(New-Base64Secret -Length 64)
SESSION_SECRET=$(New-Base64Secret -Length 32)
COOKIE_SECRET=$(New-Base64Secret -Length 32)

# Дополнительные настройки безопасности
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm

"@

# Если файл не существует, создаем с базовой конфигурацией
if ($mode -eq "create") {
    $baseConfig = @"
# ============================================
# Environment Configuration
# Generated: $(Get-Date -Format "dd.MM.yyyy HH:mm:ss")
# ============================================

NODE_ENV=development
PORT=3000

# ============================================
# Database Configuration
# ============================================
DATABASE_URL="file:./prisma/dev.db"

"@
    Set-Content -Path $envPath -Value $baseConfig -Encoding UTF8
}

# Добавляем ключи
Add-Content -Path $envPath -Value $keys -Encoding UTF8

Write-Host "`n✅ Ключи успешно добавлены в backend\.env!" -ForegroundColor Green
Write-Host "`n📋 Добавлены следующие переменные:" -ForegroundColor Cyan
Write-Host "   • SECURITY_LOGS_KEY_ID" -ForegroundColor White
Write-Host "   • SBOM_SIGNING_KEY_ID" -ForegroundColor White
Write-Host "   • COMMUNICATION_KEY_ID" -ForegroundColor White
Write-Host "   • WEBSOCKET_KEY_ID" -ForegroundColor White
Write-Host "   • BACKUP_KEY_ID" -ForegroundColor White
Write-Host "   • STORAGE_KEY_ID" -ForegroundColor White
Write-Host "   • LOG_KEY_ID" -ForegroundColor White
Write-Host "   • JWT_SECRET" -ForegroundColor White
Write-Host "   • JWT_REFRESH_SECRET" -ForegroundColor White
Write-Host "   • SESSION_SECRET" -ForegroundColor White
Write-Host "   • COOKIE_SECRET" -ForegroundColor White

Write-Host "`n🔄 Следующие шаги:" -ForegroundColor Yellow
Write-Host "   1. Перезапустите приложение" -ForegroundColor White
Write-Host "   2. Предупреждения о временных ключах исчезнут" -ForegroundColor White

Write-Host "`n⚠️  ВАЖНО:" -ForegroundColor Red
Write-Host "   • backend\.env в .gitignore - можете безопасно работать" -ForegroundColor White
Write-Host "   • Эти ключи для DEVELOPMENT окружения" -ForegroundColor White
Write-Host "   • Для PRODUCTION сгенерируйте новые ключи!" -ForegroundColor White

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                     ✓ ГОТОВО!                            ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

