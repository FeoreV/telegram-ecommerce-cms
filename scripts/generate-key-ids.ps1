# Скрипт генерации всех KEY_ID для системы (PowerShell)
# Использование: .\scripts\generate-key-ids.ps1

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      🔐 Генератор Key IDs для всех сервисов              ║" -ForegroundColor Cyan
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

# Список всех необходимых Key IDs
$keyIds = @(
    @{ Name = "SECURITY_LOGS_KEY_ID"; Description = "Шифрование логов безопасности" }
    @{ Name = "SBOM_SIGNING_KEY_ID"; Description = "Подпись списка компонентов (SBOM)" }
    @{ Name = "COMMUNICATION_KEY_ID"; Description = "Шифрование коммуникаций" }
    @{ Name = "WEBSOCKET_KEY_ID"; Description = "Защита WebSocket соединений" }
    @{ Name = "BACKUP_KEY_ID"; Description = "Шифрование бэкапов" }
    @{ Name = "STORAGE_KEY_ID"; Description = "Шифрование данных в хранилище" }
    @{ Name = "LOG_KEY_ID"; Description = "Шифрование обычных логов" }
)

# Дополнительные секреты
$additionalSecrets = @(
    @{ Name = "JWT_SECRET"; Description = "JWT токены"; Length = 64; Type = "base64" }
    @{ Name = "JWT_REFRESH_SECRET"; Description = "JWT refresh токены"; Length = 64; Type = "base64" }
    @{ Name = "SESSION_SECRET"; Description = "Сессии пользователей"; Length = 32; Type = "base64" }
    @{ Name = "COOKIE_SECRET"; Description = "Защита cookies"; Length = 32; Type = "base64" }
)

Write-Host "📝 Генерация ключей...`n" -ForegroundColor Yellow

# Генерируем все ключи
$generatedKeys = @{}

# Key IDs
foreach ($key in $keyIds) {
    $value = New-SecureKey -Length 32
    $generatedKeys[$key.Name] = $value
    Write-Host "✓ $($key.Name.PadRight(25)) - $($key.Description)" -ForegroundColor Green
}

Write-Host ""

# Дополнительные секреты
foreach ($secret in $additionalSecrets) {
    $value = New-Base64Secret -Length $secret.Length
    $generatedKeys[$secret.Name] = $value
    Write-Host "✓ $($secret.Name.PadRight(25)) - $($secret.Description)" -ForegroundColor Green
}

Write-Host "`n═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Формируем содержимое для .env файла
$envContent = @"
# ============================================
# Key IDs для шифрования и защиты данных
# Сгенерировано: $(Get-Date -Format "dd.MM.yyyy HH:mm:ss")
# ============================================

# Ключи шифрования
$($keyIds | ForEach-Object { "$($_.Name)=$($generatedKeys[$_.Name])" } | Out-String)
# JWT и сессии
$($additionalSecrets | ForEach-Object { "$($_.Name)=$($generatedKeys[$_.Name])" } | Out-String)
# Дополнительные настройки безопасности
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm
"@

Write-Host "📋 Копируйте следующие строки в ваш .env файл:`n" -ForegroundColor Cyan
Write-Host $envContent

# Спрашиваем, сохранить ли в файл
$response = Read-Host "`nСохранить в файл .env.keys? (y/n)"
if ($response -match "^[yYдД]") {
    $filePath = Join-Path $PSScriptRoot "..\\.env.keys"
    Set-Content -Path $filePath -Value $envContent -Encoding UTF8
    Write-Host "`n✓ Ключи сохранены в $filePath" -ForegroundColor Green
    Write-Host "`n⚠️  ВАЖНО:" -ForegroundColor Yellow
    Write-Host "   1. Скопируйте содержимое .env.keys в ваш .env файл"
    Write-Host "   2. Удалите .env.keys после копирования"
    Write-Host "   3. Убедитесь, что .env в .gitignore"
} else {
    Write-Host "`n✓ Скопируйте ключи вручную из вывода выше" -ForegroundColor Cyan
}

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                     ✓ ГОТОВО!                            ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "⚠️  ПРЕДУПРЕЖДЕНИЯ БЕЗОПАСНОСТИ:" -ForegroundColor Red
Write-Host "   • НИКОГДА не коммитьте .env файлы в Git"
Write-Host "   • Храните ключи в безопасном месте"
Write-Host "   • Используйте разные ключи для dev/prod"
Write-Host "   • Регулярно ротируйте ключи в продакшене`n"

