# ⚙️ Настройка .env файлов

## Автоматическая настройка (рекомендуется)

### Windows:
```cmd
setup-env-files.bat
```

### Linux/Mac:
```bash
chmod +x setup-env-files.sh
./setup-env-files.sh
```

Скрипт автоматически создаст:
- `backend/.env` — бэкенд на порту **3001**
- `frontend/.env` — фронтенд на порту **3000**
- `bot/.env` — бот на порту **3003**

---

## Ручная настройка

### 1. Backend (.env)
```bash
cp config/environments/backend.env.example backend/.env
```

Отредактируй `backend/.env`:
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=получи_от_@BotFather
```

### 2. Frontend (.env)
```bash
cp config/environments/frontend.env.example frontend/.env
```

Отредактируй `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### 3. Bot (.env)
```bash
cp config/environments/bot.env.production.example bot/.env
```

Отредактируй `bot/.env`:
```env
PORT=3003
BACKEND_URL=http://localhost:3001
TELEGRAM_BOT_TOKEN=твой_бот_токен
```

---

## Обязательные изменения

### 1. Telegram Bot Token
Получи токен от @BotFather:
1. Открой Telegram
2. Найди @BotFather
3. Напиши `/newbot` или используй существующий бот
4. Скопируй токен и добавь в `.env` файлы:
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 2. Генерация ключей шифрования
```bash
cd backend
node scripts/generate-key-ids.js
```

Скопируй сгенерированные ключи в `backend/.env`

### 3. JWT Secrets
Сгенерируй случайные секреты:

**Linux/Mac:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Windows PowerShell:**
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Обнови в `backend/.env`:
```env
JWT_SECRET=твой_сгенерированный_секрет
JWT_REFRESH_SECRET=другой_сгенерированный_секрет
```

---

## Production (сервер)

Для production сервера (с HTTPS):

### Backend:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
CORS_WHITELIST=https://yourdomain.com,https://api.yourdomain.com
```

### Frontend:
```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
VITE_NODE_ENV=production
```

### Bot:
```env
NODE_ENV=production
PORT=3003
BACKEND_URL=https://api.yourdomain.com
USE_POLLING=false
WEBHOOK_DOMAIN=https://yourdomain.com
```

---

## Проверка конфигурации

### Backend:
```bash
cd backend
node check-env.js
```

### Запуск для тестирования:
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend  
npm run dev

# Bot
cd bot
npm run dev
```

Проверь:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/health
- Bot: Проверь логи в консоли

---

## Часто задаваемые вопросы

### Порты уже заняты?
Измени порты в `.env`:
```env
# Backend
PORT=3002

# Frontend (в vite.config.ts или package.json)
```

### CORS ошибки?
Проверь `backend/.env`:
```env
FRONTEND_URL=http://localhost:3000
CORS_WHITELIST=http://localhost:3000,http://localhost:5173
```

### Bot не подключается?
Проверь `bot/.env`:
```env
BACKEND_URL=http://localhost:3001
TELEGRAM_BOT_TOKEN=правильный_токен
USE_POLLING=true  # для разработки
```

---

## Структура портов

| Сервис   | Порт | URL                      |
|----------|------|--------------------------|
| Frontend | 3000 | http://localhost:3000    |
| Backend  | 3001 | http://localhost:3001    |
| Bot      | 3003 | (внутренний)             |

---

**Готово!** После настройки запусти сервисы и проверь их работу! 🚀

