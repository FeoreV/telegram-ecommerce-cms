# 🟨 Настройка с XAMPP

Подробное руководство по настройке Telegram E-commerce платформы с использованием XAMPP.

## 📥 Установка XAMPP

### Скачивание и установка

1. Перейдите на https://www.apachefriends.org/
2. Скачайте XAMPP для вашей операционной системы
3. Установите XAMPP (рекомендуется в C:\xampp на Windows)

### Запуск служб

1. Откройте **XAMPP Control Panel**
2. Нажмите **Start** напротив **Apache**
3. Нажмите **Start** напротив **MySQL**
4. Убедитесь что оба сервиса показывают зеленый статус

## 🗄️ Настройка базы данных

### Создание базы данных

1. Откройте браузер и перейдите на http://localhost/phpmyadmin
2. В левом меню нажмите **Новый**
3. Введите имя базы данных: `telegram_ecommerce`
4. Выберите кодировку: `utf8mb4_unicode_ci`
5. Нажмите **Создать**

### Создание пользователя (опционально)

```sql
-- В phpMyAdmin выполните эти SQL команды:
CREATE USER 'telegram_user'@'localhost' IDENTIFIED BY 'telegram_pass';
GRANT ALL PRIVILEGES ON telegram_ecommerce.* TO 'telegram_user'@'localhost';
FLUSH PRIVILEGES;
```

## ⚙️ Конфигурация проекта

### Настройка .env файла

Создайте файл `.env` в корне проекта:

```env
# Database Configuration для XAMPP
DATABASE_URL="mysql://root:@localhost:3306/telegram_ecommerce"

# Или если создали пользователя:
# DATABASE_URL="mysql://telegram_user:telegram_pass@localhost:3306/telegram_ecommerce"

# Backend
PORT=3001
JWT_SECRET="your-secret-key-here"
NODE_ENV="development"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-bot-token-here"
# SUPER_ADMIN_TELEGRAM_ID removed for security

# AdminJS Configuration
ADMIN_COOKIE_SECRET="your-admin-cookie-secret"
SESSION_SECRET="your-session-secret"

# Bot
BOT_PORT=3002

# Uploads
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="10485760"

# Logging
LOG_LEVEL="info"
```

## 🚀 Запуск проекта

### Установка зависимостей

```bash
# В корне проекта
npm install

# Backend
cd backend
npm install

# Bot
cd ../bot
npm install

# Вернуться в корень
cd ..
```

### Настройка базы данных

```bash
cd backend

# Генерация Prisma Client
npx prisma generate

# Применение миграций
npx prisma migrate dev

# Заполнение тестовыми данными
npx prisma db seed

cd ..
```

### Запуск всех сервисов

```bash
# Запуск всех сервисов одновременно
npm run dev

# Или по отдельности:
npm run dev:backend   # Backend API
npm run dev:frontend  # Admin Panel
npm run dev:bot       # Telegram Bot
```

## 🔧 Проверка работы

### 1. Backend API
- Откройте http://localhost:3001/health
- Должен вернуть: `{"status":"OK","timestamp":"..."}`

### 2. Admin Panel
- Откройте http://localhost:3001/admin
- Введите ваш Telegram ID как email и любой пароль для входа

### 3. Telegram Bot
- Найдите вашего бота в Telegram
- Отправьте `/start`

## 🛠️ Устранение проблем

### XAMPP не запускается

**Проблема:** Порт 80 или 3306 занят

**Решение:**
```bash
# Проверить какие процессы используют порты
netstat -ano | findstr :80
netstat -ano | findstr :3306

# Остановить конфликтующие процессы или изменить порты в XAMPP
```

### MySQL не подключается

**Проблема:** `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Решение:**
1. Убедитесь что MySQL запущен в XAMPP Control Panel
2. Проверьте DATABASE_URL в .env файле
3. Убедитесь что база данных создана

### Prisma ошибки

**Проблема:** `P1001: Can't reach database server`

**Решение:**
```bash
# Проверить подключение
cd backend
npx prisma db pull

# Пересоздать клиент
npx prisma generate

# Применить миграции заново
npx prisma migrate reset
```

### Порты заняты

**Проблема:** `Error: listen EADDRINUSE :::3001`

**Решение:**
```bash
# Найти процесс на порту 3001
netstat -ano | findstr :3001

# Завершить процесс (замените PID)
taskkill /PID 1234 /F

# Или изменить порт в .env
PORT=3002
```

## 📊 Мониторинг в XAMPP

### Логи MySQL
- Путь: `C:\xampp\mysql\data\mysql_error.log`
- Для просмотра: открыть в любом текстовом редакторе

### Логи Apache
- Путь: `C:\xampp\apache\logs\error.log`
- Путь: `C:\xampp\apache\logs\access.log`

### phpMyAdmin
- URL: http://localhost/phpmyadmin
- Пользователь: root
- Пароль: (пустой по умолчанию)

## 🔄 Обновление проекта

```bash
# Остановить все сервисы
Ctrl+C

# Обновить код
git pull

# Обновить зависимости
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../bot && npm install
cd ..

# Применить новые миграции
cd backend
npx prisma migrate dev
cd ..

# Перезапустить
npm run dev
```

## 💡 Полезные команды XAMPP

```bash
# Запуск XAMPP из командной строки
C:\xampp\xampp-control.exe

# Проверка статуса MySQL
C:\xampp\mysql\bin\mysql.exe -u root -p

# Backup базы данных
C:\xampp\mysql\bin\mysqldump.exe -u root telegram_ecommerce > backup.sql

# Восстановление базы данных
C:\xampp\mysql\bin\mysql.exe -u root telegram_ecommerce < backup.sql
```

---

**Готово!** Теперь ваш проект настроен для работы с XAMPP! 🎉
