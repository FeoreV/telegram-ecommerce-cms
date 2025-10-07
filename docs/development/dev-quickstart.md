# 🚀 Developer Quick Start

Быстрый старт для разработчиков проекта Telegram E-commerce Platform.

## 📋 Предварительные требования

- Node.js 18+
- MySQL 8.0+
- Git
- Telegram бот токен (получить у @BotFather)

## ⚡ Быстрая установка

### 1. Клонирование и настройка

```bash
git clone <repository-url>
cd telegram-ecommerce-bot

# Для Windows:
./setup-dev.bat

# Для Linux/Mac:
chmod +x setup-dev.sh
./setup-dev.sh
```

### 2. Настройка Telegram бота

1. Откройте Telegram и найдите @BotFather
2. Отправьте `/newbot` и следуйте инструкциям
3. Сохраните полученный токен
4. Найдите @userinfobot и получите ваш Telegram ID

### 3. Обновите .env файлы

Отредактируйте `.env` в корне проекта:
```env
TELEGRAM_BOT_TOKEN=ваш-токен-бота
# SUPER_ADMIN_TELEGRAM_ID removed for security
```

### 4. Настройка базы данных

```bash
# Запустите MySQL и создайте базу данных
mysql -u root -p
CREATE DATABASE telegram_ecommerce;
CREATE USER 'telegram_user'@'82.147.84.78' IDENTIFIED BY 'telegram_pass';
GRANT ALL PRIVILEGES ON telegram_ecommerce.* TO 'telegram_user'@'82.147.84.78';
FLUSH PRIVILEGES;
EXIT;

# Примените миграции и заполните тестовыми данными
cd backend
npx prisma migrate dev
npx prisma db seed
```

### 5. Запуск в режиме разработки

```bash
# Запуск всех сервисов одновременно
npm run dev

# Или по отдельности:
npm run dev:backend  # Backend API (порт 3001)
npm run dev:frontend # Frontend (порт 3000)
npm run dev:bot      # Telegram Bot
```

## 🔍 Проверка работоспособности

```bash
# Проверка health endpoints
node scripts/health-check.js
```

Или вручную:
- Backend API: http://82.147.84.78:3001/health
- Admin Panel: http://82.147.84.78:3000
- API Info: http://82.147.84.78:3001/api

## 🧪 Тестирование

1. Откройте admin panel: http://82.147.84.78:3000
2. Войдите используя ваш Telegram ID
3. Найдите вашего бота в Telegram и отправьте `/start`
4. Проверьте навигацию по магазинам и товарам

## 📊 Структура проекта

```
├── backend/          # Express.js API
├── frontend/         # React Admin Panel
├── bot/             # Telegram Bot
├── docs/            # Документация
└── scripts/         # Утилиты и скрипты
```

## 🔧 Полезные команды

```bash
# Сборка всех компонентов
npm run build

# Prisma команды
cd backend
npx prisma studio      # Открыть Prisma Studio
npx prisma generate    # Обновить Prisma Client
npx prisma migrate dev # Применить миграции

# Docker
npm run compose:up     # Запуск через Docker Compose
npm run compose:down   # Остановка контейнеров
```

## 🆘 Устранение неполадок

### Backend не запускается
- Проверьте MySQL соединение
- Убедитесь что база данных создана
- Проверьте переменные окружения в `backend/.env`

### Bot не отвечает
- Проверьте TELEGRAM_BOT_TOKEN
- Убедитесь что бот запущен
- Проверьте логи: `docker-compose logs bot`

### Frontend ошибки
- Проверьте что backend запущен на порту 3001
- Очистите кеш: `cd frontend && npm run build`

## 📝 Документация

- [API Documentation](./README.md)
- [Architecture](./docs/architecture-cms.md)
- [XAMPP Setup](./XAMPP_SETUP.md)

## 🤝 Разработка

1. Создайте feature branch из `main`
2. Внесите изменения
3. Запустите тесты: `npm test`
4. Создайте Pull Request

---

💡 **Совет**: Используйте `todo.md` для отслеживания прогресса разработки!
