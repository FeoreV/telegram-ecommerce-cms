# Security Scripts Documentation

Набор скриптов для обеспечения безопасности приложения.

## 📋 Доступные скрипты

### 1. `check-security-config.sh`
**Проверка конфигурации безопасности**

Проверяет все критические настройки безопасности перед развертыванием.

**Использование:**
```bash
# Загрузите переменные окружения и запустите проверку
source .env && ./scripts/security/check-security-config.sh
```

**Что проверяется:**
- ✅ JWT Secrets (наличие и минимальная длина 32 символа)
- ✅ Database configuration (пароли не по умолчанию)
- ✅ Redis configuration и пароли
- ✅ CA Password (минимум 16 символов)
- ✅ Vault configuration (multi-key для продакшена)
- ✅ Session & CSRF secrets
- ✅ Права доступа на .env файл (должно быть 600)
- ✅ .env в .gitignore
- ✅ Уязвимости в зависимостях (npm audit)

**Коды выхода:**
- `0` - Все проверки пройдены или только warnings
- `1` - Найдены критические ошибки

---

### 2. `generate-secrets.sh`
**Генератор криптографически стойких секретов**

Генерирует все необходимые секреты для безопасной работы приложения.

**Использование:**
```bash
# Вывод в консоль
./scripts/security/generate-secrets.sh

# Сохранение в файл
./scripts/security/generate-secrets.sh > .env.generated
cat .env.generated >> .env
rm .env.generated
```

**Что генерируется:**
- JWT_SECRET (48 байт, base64)
- JWT_REFRESH_SECRET (48 байт, base64)
- CA_PASSWORD (24 байта, base64)
- SESSION_SECRET (48 байт, base64)
- CSRF_SECRET (48 байт, base64)
- DB_PASSWORD (24 байта, base64)
- REDIS_PASSWORD (24 байта, base64)

**Требования:** OpenSSL

---

### 3. `scan-for-secrets.sh`
**Сканер утечек секретов**

Сканирует код на наличие случайно закоммиченных секретов и credentials.

**Использование:**
```bash
./scripts/security/scan-for-secrets.sh
```

**Что ищет:**
- API Keys (различные форматы)
- Tokens (access tokens, secret tokens)
- Passwords (явные пароли в коде)
- Private Keys (RSA, SSH keys)
- AWS Credentials (Access Key ID, Secret Access Key)
- GitHub Tokens
- Stripe Keys
- Database URLs с паролями
- .env файлы в git
- Секреты в истории git (последние 10 коммитов)

**Сканируемые директории:**
- `backend/src`
- `bot/src`
- `frontend/src`
- `config/`

**Исключения:**
- test/spec файлы
- example/mock/fixture файлы
- node_modules, dist, build

**Коды выхода:**
- `0` - Секреты не найдены
- `1` - Найдены потенциальные утечки

---

### 4. `setup-git-hooks.sh`
**Установка Git Hooks**

Устанавливает автоматические проверки безопасности при коммитах.

**Использование:**
```bash
./scripts/security/setup-git-hooks.sh
```

**Что устанавливается:**
- Pre-commit hook для проверки:
  - Секретов в staged файлах
  - .env файлов в коммите
  - Hardcoded credentials
  - Debug кода (console.log)

**После установки:**
Проверки будут запускаться автоматически при каждом `git commit`.

**Пропуск проверок (не рекомендуется):**
```bash
git commit --no-verify
```

---

## 🚀 Быстрый старт

### Первоначальная настройка безопасности:

```bash
# 1. Генерация секретов
./scripts/security/generate-secrets.sh > .env

# 2. Проверка конфигурации
source .env && ./scripts/security/check-security-config.sh

# 3. Установка git hooks
./scripts/security/setup-git-hooks.sh

# 4. Сканирование кода
./scripts/security/scan-for-secrets.sh
```

### Перед каждым развертыванием:

```bash
# Проверка безопасности
source .env && ./scripts/security/check-security-config.sh

# Сканирование на секреты
./scripts/security/scan-for-secrets.sh

# Audit зависимостей
cd backend && npm audit
cd ../bot && npm audit
cd ../frontend && npm audit
```

---

## 📝 Рекомендации

### Для разработки:
1. ✅ Запустите `setup-git-hooks.sh` сразу после клонирования репозитория
2. ✅ Используйте `generate-secrets.sh` для создания .env файла
3. ✅ Периодически запускайте `scan-for-secrets.sh`

### Перед production deployment:
1. ✅ Обязательно запустите `check-security-config.sh`
2. ✅ Убедитесь, что все секреты >= минимальной длины
3. ✅ Проверьте `npm audit` на критические уязвимости
4. ✅ Настройте Vault с multi-key sharing (key-shares >= 5)

### CI/CD Integration:
Добавьте в ваш CI/CD пайплайн:

```yaml
# Пример для GitHub Actions
- name: Security Check
  run: |
    source .env.ci && ./scripts/security/check-security-config.sh
    ./scripts/security/scan-for-secrets.sh
    npm audit --audit-level=high
```

---

## 🔧 Troubleshooting

### Проблема: "JWT_SECRET не установлен"
**Решение:**
```bash
export JWT_SECRET="$(openssl rand -base64 32)"
```

### Проблема: "chmod: command not found" (Windows)
**Решение:**
- На Windows используйте Git Bash или WSL
- Или пропустите chmod - скрипты будут работать

### Проблема: "openssl: command not found"
**Решение:**
```bash
# Ubuntu/Debian
sudo apt-get install openssl

# macOS
brew install openssl

# Windows
# Используйте Git Bash (openssl уже включен)
```

### Проблема: Git hook не срабатывает
**Решение:**
```bash
# Переустановите hook
./scripts/security/setup-git-hooks.sh

# Проверьте права
ls -la .git/hooks/pre-commit

# Должно быть исполняемым: -rwxr-xr-x
```

---

## 📚 Дополнительные ресурсы

- [SECURITY_DEPLOYMENT_GUIDE.md](../../SECURITY_DEPLOYMENT_GUIDE.md) - Руководство по развертыванию
- [SECURITY_FIXES_FINAL_REPORT.md](../../SECURITY_FIXES_FINAL_REPORT.md) - Отчет по безопасности
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)

---

## 🆘 Поддержка

При обнаружении проблем безопасности:
1. **НЕ создавайте публичный issue**
2. Свяжитесь с командой безопасности: security@your-company.com
3. Используйте шифрованный канал связи

---

*Версия: 1.0 | Обновлено: 3 октября 2025*

