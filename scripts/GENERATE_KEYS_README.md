# 🔐 Генерация ключей безопасности

Эта директория содержит скрипты для генерации всех необходимых ключей шифрования и аутентификации.

## 📋 Какие ключи генерируются?

### Key IDs для шифрования данных:
- **SECURITY_LOGS_KEY_ID** - шифрование логов безопасности
- **SBOM_SIGNING_KEY_ID** - подпись списка компонентов (Software Bill of Materials)
- **COMMUNICATION_KEY_ID** - шифрование коммуникаций между сервисами
- **WEBSOCKET_KEY_ID** - защита WebSocket соединений
- **BACKUP_KEY_ID** - шифрование бэкапов базы данных
- **STORAGE_KEY_ID** - шифрование данных в хранилище
- **LOG_KEY_ID** - шифрование обычных логов

### Секреты для аутентификации:
- **JWT_SECRET** - подпись JWT токенов
- **JWT_REFRESH_SECRET** - подпись refresh токенов
- **SESSION_SECRET** - шифрование сессий пользователей
- **COOKIE_SECRET** - защита cookies

## 🚀 Как использовать?

### Windows (PowerShell):
```powershell
.\scripts\generate-key-ids.ps1
```

### Windows (Batch):
```cmd
scripts\generate-key-ids.bat
```

### Linux/macOS (Bash):
```bash
bash scripts/generate-security-keys.sh
```

### Кросс-платформенный (Node.js):
```bash
node scripts/generate-key-ids.js
```

## 📝 Что делать после генерации?

1. **Скопируйте ключи** из вывода в ваш `.env` файл
2. **Или сохраните в файл** `.env.keys` (скрипт спросит вас)
3. **Добавьте в backend/.env** все сгенерированные переменные
4. **Удалите временный файл** `.env.keys` после копирования
5. **Перезапустите приложение** чтобы применить новые ключи

## ⚠️ Важные предупреждения

### Безопасность:
- ❌ **НИКОГДА** не коммитьте `.env` файлы в Git
- ✅ Храните ключи в безопасном месте (password manager, vault)
- ✅ Используйте **разные ключи** для development и production
- ✅ **Регулярно ротируйте** ключи в production (каждые 90 дней)

### Development vs Production:
- В **development** можно игнорировать warnings о временных ключах
- В **production** ОБЯЗАТЕЛЬНО установить все ключи
- Для production используйте secret management системы:
  - HashiCorp Vault
  - AWS Secrets Manager
  - Azure Key Vault
  - Google Secret Manager

## 🔍 Проверка установки

После добавления ключей в `.env`, проверьте что warnings исчезли:

```bash
# В логах НЕ должно быть:
# "Generated temporary key ID for ..."

# Должны увидеть:
# "Loaded KEY_ID for <service>"
```

## 🛠️ Требования

### Для PowerShell скрипта:
- Windows PowerShell 5.1+

### Для Batch скрипта:
- Windows
- Node.js установлен

### Для Bash скрипта:
- Linux/macOS/WSL
- OpenSSL установлен

### Для Node.js скрипта:
- Node.js v14+
- Работает на всех платформах

## 📚 Дополнительная информация

### Длина ключей:
- Key IDs: 32 байта (64 hex символа)
- JWT секреты: 64 байта (base64)
- Session секреты: 32 байта (base64)

### Алгоритмы:
- Хеширование: SHA-256
- Шифрование: AES-256-GCM
- Генерация: Криптографически стойкий RNG

## 🆘 Проблемы?

### "openssl not found" в bash скрипте:
```bash
# Ubuntu/Debian
sudo apt-get install openssl

# macOS
brew install openssl
```

### "node not found" в batch скрипте:
Скачайте Node.js: https://nodejs.org/

### Ключи не применяются:
1. Проверьте что `.env` файл в корне backend/
2. Убедитесь что нет опечаток в именах переменных
3. Перезапустите приложение полностью
4. Проверьте логи startup

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `backend/logs/combined-*.log`
2. Убедитесь что все ключи скопированы правильно
3. Проверьте формат `.env` файла (нет лишних пробелов)

