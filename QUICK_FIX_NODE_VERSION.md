# ⚡ Быстрое Исправление: Обновление Node.js

## Проблема
```
You are using Node.js 18.20.8. Vite requires Node.js version 20.19+ or 22.12+
```

## ✅ Решение (2 минуты)

### Вариант 1: Обновить через NVM (Рекомендуется)

```bash
# Обновить Node.js до версии 20
nvm install 20
nvm use 20
nvm alias default 20

# Проверить версию
node --version  # Должно быть v20.x.x

# Переустановить PM2 для новой версии Node
npm install -g pm2

# Продолжить setup
cd ~/telegram-ecommerce-cms
bash setup-production.sh
```

### Вариант 2: Установить Node.js 20 напрямую

```bash
# Удалить старую версию
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверить версию
node --version  # Должно быть v20.x.x

# Переустановить PM2
npm install -g pm2

# Продолжить setup
cd ~/telegram-ecommerce-cms
bash setup-production.sh
```

### Вариант 3: Быстрый (если NVM уже установлен)

```bash
nvm install 20 && nvm use 20 && npm install -g pm2 && cd ~/telegram-ecommerce-cms && bash setup-production.sh
```

---

## 🔧 Исправление проблемы с миграциями БД

Если видите ошибку `table "revoked_tokens" already exists`:

```bash
cd ~/telegram-ecommerce-cms/backend

# Вариант 1: Удалить старую БД (для новой установки)
rm -f prisma/dev.db prisma/dev.db-journal
npx prisma migrate deploy

# Вариант 2: Использовать db push
npx prisma db push --accept-data-loss

# Вернуться в корень
cd ..
```

---

## ✅ Полная Команда (Все в Одну Строку)

```bash
nvm install 20 && nvm use 20 && nvm alias default 20 && npm install -g pm2 && cd ~/telegram-ecommerce-cms && rm -f backend/prisma/dev.db && bash setup-production.sh
```

**Это установит Node 20, удалит старую БД и запустит setup заново!**

---

## 📊 После успешной установки

Проверьте статус:

```bash
pm2 status
```

Должно быть:
- ✅ telegram-backend - **online**
- ✅ telegram-bot - **online**  
- ✅ frontend - **online**

Добавьте токен бота:

```bash
nano bot/.env
# Добавьте: TELEGRAM_BOT_TOKEN=ваш_токен
pm2 restart telegram-bot
```

**Готово! 🎉**

