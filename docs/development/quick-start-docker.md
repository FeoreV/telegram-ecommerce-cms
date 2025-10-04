# ⚡ Быстрый запуск Docker

## 🚀 Запуск за 3 шага

### 1. Создайте файл `.env`
```bash
cp config/environments/env.example .env
```

### 2. Отредактируйте критические настройки в `.env`:
```bash
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
# SUPER_ADMIN_TELEGRAM_ID removed for security
JWT_SECRET=your-secret-key-change-me
```

### 3. Запустите Docker

**Windows:**
```cmd
docker-dev.bat
```

**Linux/macOS:**
```bash
chmod +x docker-dev.sh
./docker-dev.sh
```

## 🌐 Доступ к сервисам

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001  
- **AdminJS**: http://localhost:3001/admin

## 🔍 Проверка работы

```bash
node docker-health-check.js
```

## 📖 Подробная документация

См. `DOCKER_SETUP.md` для полной документации.

---

*Все готово для работы! 🎉*
