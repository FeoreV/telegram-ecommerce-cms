# 🐳 Docker Setup для Telegram E-commerce Bot

## 📋 Обзор

Проект поддерживает два режима развертывания:
- **Разработка** (`docker-compose.yml`) - MySQL, базовые сервисы
- **Продакшн** (`docker-compose.production.yml`) - PostgreSQL, полный стек мониторинга

## 🚀 Быстрый старт для разработки

### 1. Предварительные требования

- Docker Desktop или Docker Engine
- Docker Compose v2.0+
- Git

### 2. Настройка окружения

```bash
# 1. Скопируйте файл с переменными окружения
cp config/environments/env.example .env

# 2. Отредактируйте .env файл
# ОБЯЗАТЕЛЬНО измените:
# - TELEGRAM_BOT_TOKEN (получить у @BotFather)
# - SUPER_ADMIN_TELEGRAM_ID (ваш ID от @userinfobot)
# - JWT_SECRET (случайная строка)
# - Пароли для безопасности
```

### 3. Запуск разработки

#### Windows:
```cmd
# Запуск
docker-dev.bat

# Остановка
docker-dev-stop.bat
```

#### Linux/macOS:
```bash
# Сделать скрипты исполняемыми (один раз)
chmod +x docker-dev.sh docker-dev-stop.sh

# Запуск
./docker-dev.sh

# Остановка
./docker-dev-stop.sh
```

### 4. Доступ к сервисам

После успешного запуска:

| Сервис | URL | Описание |
|--------|-----|----------|
| **Frontend** | http://localhost:3000 | React админ-панель |
| **Backend API** | http://localhost:3001 | REST API |
| **AdminJS** | http://localhost:3001/admin | Админ-панель базы данных |
| **MySQL** | localhost:3307 | База данных |
| **Redis** | localhost:6379 | Кэш и сессии |

## 🏭 Продакшн развертывание

### 1. Подготовка

```bash
# Создайте файл .env.production
cp config/environments/env.production.example .env.production

# Настройте продакшн переменные:
# - Надежные пароли
# - SSL сертификаты
# - Домены и URL
# - Секретные ключи
```

### 2. Запуск продакшена

```bash
./docker-prod.sh
```

### 3. Продакшн сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| **Frontend** | http://localhost:3000 | Основное приложение |
| **Backend API** | http://localhost:3001 | API |
| **Bot Webhook** | http://localhost:8443 | Telegram webhook |
| **Grafana** | http://localhost:3001 | Мониторинг (admin/admin) |
| **Prometheus** | http://localhost:9090 | Метрики |
| **Kibana** | http://localhost:5601 | Логи |
| **PostgreSQL** | localhost:5432 | Основная БД |

## 🔍 Диагностика и мониторинг

### Проверка здоровья системы

```bash
node docker-health-check.js
```

### Просмотр логов

```bash
# Все сервисы
docker-compose -f config/docker/docker-compose.yml logs -f

# Конкретный сервис
docker-compose -f config/docker/docker-compose.yml logs -f backend
docker-compose -f config/docker/docker-compose.yml logs -f bot
docker-compose -f config/docker/docker-compose.yml logs -f frontend

# Последние N строк
docker-compose -f config/docker/docker-compose.yml logs --tail=50 backend
```

### Статус контейнеров

```bash
# Проверить состояние
docker-compose -f config/docker/docker-compose.yml ps

# Статистика ресурсов
docker stats
```

## 🛠 Полезные команды

### Управление контейнерами

```bash
# Пересборка после изменений
docker-compose -f config/docker/docker-compose.yml up --build -d

# Остановка всех сервисов
docker-compose -f config/docker/docker-compose.yml down

# Удаление всех данных (ОСТОРОЖНО!)
docker-compose -f config/docker/docker-compose.yml down -v

# Перезапуск конкретного сервиса
docker-compose -f config/docker/docker-compose.yml restart backend
```

### Работа с базой данных

```bash
# Выполнить миграции
docker-compose -f config/docker/docker-compose.yml exec backend npx prisma migrate dev

# Заполнить тестовыми данными
docker-compose -f config/docker/docker-compose.yml exec backend npm run db:seed

# Подключиться к MySQL
docker-compose -f config/docker/docker-compose.yml exec database mysql -u telegram_user -p telegram_ecommerce

# Сбросить базу (ОСТОРОЖНО!)
docker-compose -f config/docker/docker-compose.yml exec backend npx prisma migrate reset
```

### Отладка

```bash
# Зайти в контейнер
docker-compose -f config/docker/docker-compose.yml exec backend sh
docker-compose -f config/docker/docker-compose.yml exec bot sh

# Проверить переменные окружения
docker-compose -f config/docker/docker-compose.yml exec backend env

# Выполнить команду в контейнере
docker-compose -f config/docker/docker-compose.yml exec backend npm run --version
```

## 📁 Структура проекта

```
├── backend/
│   ├── Dockerfile              # Backend контейнер
│   └── Dockerfile.production   # Продакшн backend
├── bot/
│   └── Dockerfile             # Telegram bot контейнер
├── frontend/
│   ├── Dockerfile             # React frontend
│   └── nginx.conf            # Nginx конфигурация
├── config/
│   └── docker/
│       ├── docker-compose.yml            # Разработка
│       ├── docker-compose.production.yml # Продакшн
│       └── docker-compose.prod.yml       # Альтернативный prod
├── docker-dev.sh              # Скрипт запуска разработки
├── docker-dev.bat            # Скрипт запуска Windows
├── docker-prod.sh            # Скрипт запуска продакшена
└── docker-health-check.js    # Проверка работоспособности
```

## 🔧 Настройка переменных окружения

### Критически важные настройки:

```bash
# .env файл
TELEGRAM_BOT_TOKEN=your-real-bot-token-from-botfather
SUPER_ADMIN_TELEGRAM_ID=123456789  # Ваш Telegram ID
JWT_SECRET=super-secret-jwt-key-change-me
JWT_REFRESH_SECRET=another-secret-key

# Безопасность AdminJS
ADMIN_DEFAULT_PASSWORD=YourStrongPassword123!
ADMIN_COOKIE_SECRET=32-character-secret-key-here
ADMIN_SESSION_SECRET=another-32-character-secret
```

### Получение Telegram данных:

1. **Токен бота**: @BotFather в Telegram
2. **Ваш ID**: @userinfobot в Telegram
3. **Webhook URL**: для продакшена нужен HTTPS домен

## 🚨 Troubleshooting

### Частые проблемы:

1. **Контейнеры не запускаются**
   ```bash
   # Проверить доступные порты
   netstat -tulpn | grep :3001
   
   # Освободить порт если занят
   docker-compose down
   ```

2. **База данных не подключается**
   ```bash
   # Проверить состояние БД
   docker-compose -f config/docker/docker-compose.yml exec database mysqladmin ping
   
   # Пересоздать том БД
   docker-compose down -v
   docker-compose up -d database
   ```

3. **Бот не отвечает**
   ```bash
   # Проверить логи бота
   docker-compose -f config/docker/docker-compose.yml logs bot
   
   # Проверить токен
   docker-compose -f config/docker/docker-compose.yml exec bot env | grep TELEGRAM
   ```

4. **Не работает AdminJS**
   ```bash
   # Отключить AdminJS если проблемы
   # В .env файле: ENABLE_ADMINJS=false
   ```

### Очистка системы:

```bash
# Удалить все неиспользуемые образы
docker system prune -a

# Удалить все тома (ОСТОРОЖНО!)
docker volume prune

# Полная очистка Docker
docker system prune -a --volumes
```

## 📞 Поддержка

При проблемах:

1. Проверьте логи: `docker-compose logs -f`
2. Выполните проверку здоровья: `node docker-health-check.js`
3. Убедитесь, что все переменные в `.env` корректны
4. Проверьте доступность портов

---

*Context improved by Giga AI - используется информация об архитектуре e-commerce платформы с Telegram интеграцией и многокомпонентной Docker конфигурацией*
