# 🔄 Переход на MySQL для продакшена

Руководство по настройке MySQL для продакшена и переходу с SQLite в разработке.

## 🛑 Внимание

⚠️ **Этот процесс удалит все данные в вашей текущей базе данных!**
Сделайте резервную копию, если есть важные данные.

## 🐳 Docker (Рекомендуется)

### 1. Быстрый запуск с MySQL

```bash
# Убедитесь что Docker запущен
docker-compose up -d

# База данных автоматически создастся в контейнере
```

## 💻 Локальная установка MySQL

### Вариант 1: XAMPP (Windows)

1. Скачайте XAMPP с https://www.apachefriends.org/
2. Установите и запустите XAMPP Control Panel  
3. Включите Apache и MySQL
4. Откройте http://localhost/phpmyadmin
5. Создайте базу данных: `telegram_ecommerce` (кодировка `utf8mb4_unicode_ci`)

### Вариант 2: MySQL Community Server

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# macOS (Homebrew)
brew install mysql
brew services start mysql

# Windows
# Скачайте MySQL Installer с https://dev.mysql.com/downloads/installer/
```

### 2. Резервное копирование данных (опционально)

Если у вас есть важные данные в PostgreSQL:

```bash
# Экспорт из PostgreSQL
pg_dump telegram_ecommerce > postgres_backup.sql

# Вам нужно будет вручную адаптировать данные для MySQL
```

## ⚙️ Обновление конфигурации

### 1. Остановка текущих сервисов

```bash
# Остановите все запущенные сервисы
Ctrl+C

# Если используете PM2
pm2 stop all
```

### 2. Выбор конфигурации

Проект поддерживает SQLite для разработки и MySQL для продакшена через переменные окружения.

#### Для разработки (SQLite):
```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
```

#### Для продакшена (MySQL):
```env
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://telegram_user:telegram_pass@localhost:3306/telegram_ecommerce
```

#### Docker контейнеры:
```env
DATABASE_PROVIDER=mysql  
DATABASE_URL=mysql://telegram_user:telegram_pass@database:3306/telegram_ecommerce
```

### 3. Копирование конфигурации

```bash
# Для разработки
cp env.example .env

# Для продакшена
cp env.prod.example .env
# Отредактируйте .env под ваши настройки
```

### 4. Применение изменений

#### 🐳 Docker (самый простой способ):

```bash
# Остановить контейнеры если запущены
docker-compose down

# Пересобрать и запустить с новыми переменными
docker-compose up -d --build

# Миграции применятся автоматически при запуске backend контейнера
```

#### 💻 Локальная разработка:

```bash
cd backend

# Остановить текущие процессы
# Ctrl+C или pm2 stop all

# Установить зависимости если нужно
npm install

# Применить миграции для MySQL
npx prisma generate
npx prisma migrate dev --name "init_mysql"

# Заполнить тестовыми данными
npx prisma db seed

cd ..
```

### 5. Переход с существующих данных

Если у вас есть данные в SQLite и нужно перенести их:

```bash
cd backend

# Создать дамп данных (кастомный скрипт)
npm run db:export-data

# Переключиться на MySQL в .env
# DATABASE_PROVIDER=mysql
# DATABASE_URL=mysql://...

# Применить схему к MySQL
npx prisma migrate dev --name "migrate_from_sqlite"

# Импортировать данные (кастомный скрипт) 
npm run db:import-data
```

## 🚀 Перезапуск

```bash
# Запуск всех сервисов
npm run dev
```

## ✅ Проверка

### 1. Тест API
```bash
curl http://localhost:3001/health
```

### 2. Проверка базы данных
В phpMyAdmin должны появиться таблицы проекта.

### 3. Тест админ-панели
Откройте http://localhost:3000

### 4. Тест Telegram бота
Отправьте `/start` вашему боту.

## 🛠️ Устранение проблем

### Ошибка подключения

```bash
# Проверьте что MySQL запущен в XAMPP
# Проверьте порт 3306
netstat -an | findstr :3306
```

### Ошибки миграции

```bash
cd backend

# Сброс базы данных
npx prisma migrate reset

# Повторная миграция
npx prisma migrate dev

# Повторное заполнение
npx prisma db seed
```

### Проблемы с кодировкой

В phpMyAdmin:
1. Выберите базу данных
2. Вкладка "Операции"
3. Сопоставление: `utf8mb4_unicode_ci`

## 📊 Проверка миграции

### Команды для проверки

```bash
# Проверка подключения
cd backend
npx prisma db pull

# Просмотр схемы
npx prisma studio
```

### Проверочный список

- [ ] XAMPP запущен
- [ ] MySQL работает на порту 3306
- [ ] База данных `telegram_ecommerce` создана
- [ ] .env обновлен с MySQL URL
- [ ] Prisma schema обновлена
- [ ] Миграции применены
- [ ] Тестовые данные загружены
- [ ] API отвечает на /health
- [ ] Админ-панель открывается
- [ ] Telegram бот работает

---

**Готово!** Теперь ваш проект работает с MySQL в XAMPP! 🎉

Если возникли проблемы, обратитесь к [XAMPP_SETUP.md](XAMPP_SETUP.md) для детального руководства.
