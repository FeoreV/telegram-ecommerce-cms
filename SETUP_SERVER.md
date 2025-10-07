# 🚀 Быстрая Настройка Production Сервера

## Автоматическая установка (Рекомендуется)

### Одной командой:

```bash
cd /root/telegram-ecommerce-cms
git pull origin main
bash setup-production.sh
```

Скрипт автоматически:
- ✅ Создаст `.env` файлы с новыми ключами безопасности
- ✅ Настроит базу данных
- ✅ Соберёт все приложения (backend, bot, frontend)
- ✅ Запустит PM2 с правильной конфигурацией
- ✅ Настроит автозапуск PM2

---

## Ручная установка

### 1. Получить код

```bash
cd /root/telegram-ecommerce-cms
git pull origin main
```

### 2. Настроить Backend

```bash
cd backend
cp ../env.production.example .env
# Отредактируйте .env и добавьте необходимые ключи
npm install --production=false
npx prisma generate
npx prisma migrate deploy
npm run build
cd ..
```

### 3. Настроить Bot

```bash
cd bot
echo "NODE_ENV=production" > .env
echo "API_URL=http://localhost:3002" >> .env
echo "TELEGRAM_BOT_TOKEN=ваш_токен" >> .env
npm install --production=false
npm run build
cd ..
```

### 4. Настроить Frontend

```bash
cd frontend
npm install --production=false
npm run build
cd ..
```

### 5. Запустить PM2

```bash
pm2 stop all
pm2 delete all
pm2 start config/services/ecosystem.config.cjs
pm2 save
```

---

## После установки

### Проверка статуса

```bash
pm2 status
```

Все три процесса должны быть `online`:
- ✅ telegram-backend
- ✅ telegram-bot
- ✅ frontend

### Просмотр логов

```bash
# Все логи
pm2 logs

# Только backend
pm2 logs telegram-backend

# Только ошибки
pm2 logs --err
```

### Мониторинг

```bash
pm2 monit
```

### Проверка API

```bash
curl http://localhost:3002/api/health
```

---

## Telegram Bot Token

1. Получите токен от [@BotFather](https://t.me/BotFather)
2. Добавьте в `bot/.env`:
   ```bash
   nano bot/.env
   # Добавьте: TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
3. Перезапустите бота:
   ```bash
   pm2 restart telegram-bot
   ```

---

## Обновление

### Получить новые изменения:

```bash
cd /root/telegram-ecommerce-cms
git pull origin main
bash setup-production.sh
```

### Только пересборка без сброса .env:

```bash
cd /root/telegram-ecommerce-cms

# Backend
cd backend && npm install && npm run build && cd ..

# Bot
cd bot && npm install && npm run build && cd ..

# Frontend
cd frontend && npm install && npm run build && cd ..

# Перезапуск
pm2 restart all
```

---

## Устранение проблем

### Backend не запускается

```bash
# Проверить логи
pm2 logs telegram-backend --err --lines 100

# Проверить .env
cat backend/.env | grep -v "SECRET\|KEY_ID"

# Пересоздать .env
rm backend/.env
bash setup-production.sh
```

### PM2 показывает "errored"

```bash
# Посмотреть детали ошибки
pm2 logs --err --lines 200

# Полный перезапуск
pm2 delete all
pm2 start config/services/ecosystem.config.cjs
```

### База данных не найдена

```bash
cd backend
npx prisma migrate deploy
# или
npx prisma db push
```

### Проблемы с правами доступа

```bash
chmod -R 755 backend/node_modules/.bin
chmod -R 755 bot/node_modules/.bin
chmod -R 755 frontend/node_modules/.bin
```

---

## Порты

- Frontend: `3000`
- Backend API: `3002`
- Bot: работает через Telegram

---

## Безопасность

1. **Измените пароль администратора** после первого входа
2. **Настройте CORS** в `backend/.env`:
   ```
   ALLOWED_ORIGINS=https://yourdomain.com
   ```
3. **Используйте HTTPS** для production
4. **Настройте firewall**
5. **Регулярно обновляйте** зависимости

---

## Полезные команды

```bash
# Перезапустить всё
pm2 restart all

# Остановить всё
pm2 stop all

# Посмотреть использование ресурсов
pm2 monit

# Очистить логи
pm2 flush

# Список процессов
pm2 list

# Детальная информация
pm2 show telegram-backend
```

