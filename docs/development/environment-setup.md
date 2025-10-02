# 🔧 Настройка переменных окружения (.env)

## 📋 Создание .env файла

### 1. Скопируйте пример файла:
```bash
cp config/environments/env.example .env
```

### 2. Обязательные настройки для работы:

#### 🤖 Telegram Bot
```bash
# Получить токен у @BotFather в Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Ваш Telegram ID (получить у @userinfobot)
SUPER_ADMIN_TELEGRAM_ID=123456789
```

#### 🔐 Безопасность
```bash
# Секретные ключи (сгенерируйте случайные строки)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=another-secret-key-for-refresh-tokens

# AdminJS пароли
ADMIN_DEFAULT_PASSWORD=YourStrongPassword123!
ADMIN_COOKIE_SECRET=cookie-secret-at-least-32-characters-long
ADMIN_SESSION_SECRET=session-secret-at-least-32-characters
```

#### 📧 Email (опционально)
```bash
# Для отправки уведомлений
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

## 🔑 Как получить необходимые данные

### Telegram Bot Token:
1. Откройте @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен в формате: `1234567890:ABC-DEF1234ghIkl...`

### Ваш Telegram ID:
1. Откройте @userinfobot в Telegram
2. Отправьте любое сообщение
3. Скопируйте ваш ID (число без букв)

### JWT секреты:
```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))

# Онлайн генератор
# https://generate-secret.vercel.app/32
```

## ✅ Проверка настройки

После создания .env файла:

```bash
# Проверить синтаксис
docker-compose -f config/docker/docker-compose.yml config --quiet

# Если ошибок нет - запустить
docker-dev.bat  # Windows
# или
./docker-dev.sh # Linux/macOS
```

## 🚨 Важные замечания

- **НЕ ДОБАВЛЯЙТЕ** `.env` файл в Git!
- **ИЗМЕНИТЕ** все пароли по умолчанию
- **ИСПОЛЬЗУЙТЕ** сильные пароли для продакшена
- **СОЗДАЙТЕ** отдельный `.env.production` для продакшена

---

*После настройки .env файла можете запускать Docker! 🚀*
