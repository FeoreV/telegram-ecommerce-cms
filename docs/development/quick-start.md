# 🚀 Быстрый старт

Этот гайд поможет вам быстро запустить Telegram E-commerce платформу для тестирования.

## 📋 Минимальные требования

- Node.js 18+
- XAMPP (с MySQL)
- Telegram Bot Token

## ⚡ Быстрая установка

### 1. Получите Telegram Bot Token

1. Откройте Telegram и найдите @BotFather
2. Отправьте `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен

### 2. Узнайте ваш Telegram ID

1. Найдите @userinfobot в Telegram
2. Отправьте любое сообщение
3. Скопируйте ваш ID из ответа

### 3. Клонируйте и настройте проект

```bash
# Клонирование
git clone <repository-url>
cd telegram-ecommerce-bot

# Установка зависимостей для всех модулей
npm install

# Установка зависимостей для backend
cd backend && npm install

# Установка зависимостей для frontend
cd ../frontend && npm install

# Установка зависимостей для bot
cd ../bot && npm install

# Возврат в корень
cd ..
```

### 4. Настройка переменных окружения

```bash
# Скопируйте пример конфигурации
cp .env.example .env

# Отредактируйте .env файл
nano .env
```

Минимальная конфигурация для XAMPP:
```env
DATABASE_URL="mysql://root:@localhost:3306/telegram_ecommerce"
JWT_SECRET="your-secret-key"
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
SUPER_ADMIN_TELEGRAM_ID="YOUR_TELEGRAM_ID_HERE"
```

### 5. Настройка базы данных

```bash
# 1. Запустите XAMPP Control Panel
# 2. Включите Apache и MySQL
# 3. Откройте phpMyAdmin: http://localhost/phpmyadmin
# 4. Создайте новую базу данных: telegram_ecommerce

# Перейдите в backend
cd backend

# Примените миграции
npx prisma migrate dev

# Заполните тестовыми данными
npx prisma db seed

cd ..
```

### 6. Запуск всех сервисов

```bash
# Запуск всех сервисов одновременно
npm run dev
```

Или запуск по отдельности:
```bash
# В отдельных терминалах:
npm run dev:backend  # http://localhost:3001
npm run dev:frontend # http://localhost:3000  
npm run dev:bot      # Telegram Bot
```

## 🎯 Первые шаги

### 1. Авторизация

1. Откройте http://localhost:3000
2. Войдите используя ваш Telegram ID
3. Вы автоматически получите роль OWNER

### 2. Тестирование Telegram бота

1. Найдите вашего бота в Telegram
2. Отправьте `/start`
3. Используйте меню для навигации

### 3. Создание тестового заказа

1. В боте выберите "Магазины"
2. Откройте "Demo Store"
3. Добавьте товары в корзину
4. Оформите заказ
5. В админ-панели подтвердите оплату

## 🔧 Быстрое тестирование с Docker

```bash
# Убедитесь что Docker установлен
docker --version

# Создайте .env файл с переменными
cp .env.example .env

# Запустите все сервисы
docker-compose up -d

# Примените миграции
docker-compose exec backend npx prisma migrate dev

# Заполните тестовыми данными
docker-compose exec backend npx prisma db seed
```

## 📱 Тестовые сценарии

### Сценарий 1: Создание заказа
1. Покупатель открывает бота
2. Просматривает магазины и товары
3. Добавляет товары в корзину
4. Оформляет заказ
5. Админ получает уведомление
6. Админ подтверждает оплату
7. Покупатель получает подтверждение

### Сценарий 2: Управление магазином
1. Войдите в админ-панель
2. Создайте новый магазин
3. Добавьте товары
4. Настройте контактную информацию
5. Протестируйте через бота

### Сценарий 3: Роли пользователей
1. Создайте нового админа через панель
2. Назначьте его на магазин
3. Протестируйте права доступа

## 🆘 Частые проблемы

### База данных не подключается
```bash
# Проверьте что XAMPP запущен
# 1. Откройте XAMPP Control Panel
# 2. Убедитесь что MySQL запущен (зеленый индикатор)
# 3. Проверьте что база данных telegram_ecommerce создана в phpMyAdmin
# 4. Убедитесь что в .env правильный DATABASE_URL

# Если проблемы с портом 3306:
netstat -an | findstr :3306
```

### Бот не отвечает
- Проверьте корректность TELEGRAM_BOT_TOKEN
- Убедитесь что бот запущен
- Проверьте логи: `docker-compose logs bot`

### Ошибки компиляции
```bash
# Очистите кеш и переустановите
rm -rf node_modules package-lock.json
npm install

# Для каждого модуля:
cd backend && rm -rf node_modules && npm install
cd ../frontend && rm -rf node_modules && npm install  
cd ../bot && rm -rf node_modules && npm install
```

## 📞 Поддержка

- Проверьте логи: `npm run logs`
- Просмотрите Issues в репозитории
- Создайте новый Issue с описанием проблемы

---

**Готово!** Теперь у вас есть полностью рабочая Telegram E-commerce платформа! 🎉
