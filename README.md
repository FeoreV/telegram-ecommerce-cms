# 🛒 Telegram E-Commerce CMS Platform

Мультимагазинная платформа для создания e-commerce ботов в Telegram с полноценной системой управления контентом и заказами.

## 🚀 Быстрый старт

### Запуск через Docker (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone <repository-url>
cd telegram-ecommerce-cms

# 2. Скопировать пример конфигурации
cp env.production.example .env

# 3. Настроить переменные окружения в .env
# Обязательно установите: DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN

# 4. Запустить все сервисы
docker-compose up -d

# 5. Открыть в браузере
# Frontend: http://82.147.84.78:3000
# Backend API: http://82.147.84.78:3001
```

### Быстрая пересборка (Windows)

```powershell
.\rebuild.ps1          # Пересборка всех сервисов
.\rebuild.ps1 backend  # Только backend
.\rebuild.ps1 -NoCache # С полной очисткой кэша
```

📖 **Подробнее**: [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md)

## 📚 Документация

⚡ **[Быстрая справка](QUICK_REFERENCE.md)** - команды и ссылки одним взглядом

Вся документация находится в директории **[docs/](docs/)**:

### Для разработчиков
- 🎯 **[Quick Start с Docker](docs/development/quick-start-docker.md)** - Быстрое начало работы
- ⚙️ **[Настройка окружения](docs/development/environment-setup.md)** - Переменные окружения
- 🏗️ **[Структура проекта](docs/architecture/project-structure.md)** - Архитектура кода
- 🤖 **[Конструктор ботов](docs/development/bot-constructor-guide.md)** - Создание ботов

### Для DevOps
- 🐳 **[Docker Setup](docs/deployment/docker-setup.md)** - Настройка контейнеров
- 📊 **[Monitoring](docs/deployment/monitoring.md)** - Prometheus + Grafana
- 🚀 **[Production Deployment](docs/deployment/production-deployment.md)** - Развертывание
- 🔧 **[Troubleshooting](docs/deployment/docker-troubleshooting.md)** - Решение проблем

### Для Security Engineers
- 🔒 **[Security Architecture](docs/security/security-architecture-overview.md)** - Архитектура безопасности
- 🔑 **[Key Hierarchy](docs/security/key-hierarchy-specification.md)** - Управление ключами
- 🆘 **[Disaster Recovery](docs/security/disaster-recovery-documentation.md)** - План восстановления

📋 **Полный индекс**: [docs/README.md](docs/README.md)

## 🎯 Ключевые возможности

### 🏪 Multi-Store Architecture
- Изолированные магазины с собственными настройками и брендингом
- Автоматическое создание Telegram ботов для каждого магазина
- Шаблоны для быстрого развертывания магазинов
- Иерархическая система прав: OWNER → ADMIN → VENDOR → CUSTOMER

### 📦 Order Management
- Кастомный статус-машина заказов: PENDING_ADMIN → PAID → SHIPPED → DELIVERED
- Ручная проверка платежей с загрузкой подтверждений
- Поддержка множества валют
- Автоматическое обновление складских остатков

### 🤖 Bot Management
- Автоматическая настройка webhook для каждого бота
- Детекция спама для e-commerce контекста
- Store-specific безопасность и rate limiting
- Template-based развертывание ботов

### 📊 Analytics & Monitoring
- Real-time метрики производительности
- Отслеживание конверсии и продаж
- Prometheus + Grafana dashboards
- Предсказание складских остатков

### 🔐 Security
- JWT аутентификация с refresh tokens
- Role-Based Access Control (RBAC)
- Шифрование данных (at rest & in transit)
- HashiCorp Vault интеграция
- CSRF, XSS, SQL Injection защита

Подробнее: [SECURITY.md](SECURITY.md)

## 🛠️ Технологический стек

### Backend
- **Runtime**: Node.js 20+ / TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: MySQL 8.0
- **Cache**: Redis
- **Auth**: JWT + bcrypt

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **State**: React Context + Hooks
- **Styling**: CSS Modules
- **Build**: Vite

### Bot
- **Framework**: Telegraf (Telegram Bot API)
- **TypeScript**: Full type safety
- **Middleware**: Custom session management

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Monitoring**: Prometheus + Grafana
- **Secrets**: HashiCorp Vault
- **Reverse Proxy**: Nginx

## 📁 Структура проекта

```
telegram-ecommerce-cms/
├── backend/          # Express.js API сервер
├── frontend/         # React приложение
├── bot/              # Telegram bot логика
├── docs/             # 📚 Полная документация
├── config/           # Конфигурационные файлы
├── scripts/          # Утилиты и скрипты
├── tools/            # Инструменты разработки
├── docker-compose.yml
└── DOCKER_QUICK_START.md
```

## 🔧 Основные команды

### Docker
```bash
docker-compose up -d              # Запустить все сервисы
docker-compose down               # Остановить все
docker-compose logs -f backend    # Логи сервиса
docker-compose restart backend    # Перезапуск
docker-compose ps                 # Статус контейнеров
```

### Разработка
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend  
cd frontend
npm install
npm run dev

# Bot
cd bot
npm install
npm run dev
```

### Миграции БД
```bash
cd backend
npx prisma migrate dev      # Применить миграции
npx prisma generate         # Генерация Prisma Client
npx prisma studio           # GUI для БД
```

## 🌐 Порты и доступ

После запуска доступны:

- **Frontend**: http://82.147.84.78:3000
- **Backend API**: http://82.147.84.78:3001
- **Grafana**: http://82.147.84.78:3030 (admin/admin)
- **Prometheus**: http://82.147.84.78:9090
- **MySQL**: 82.147.84.78:3307
- **Redis**: 82.147.84.78:6379

## 🔐 Безопасность

### Генерация секретов

```bash
cd backend
node scripts/generate-secrets.js
```

### Критические переменные окружения

```env
JWT_SECRET=<your-secret-here>
JWT_REFRESH_SECRET=<your-secret-here>
SESSION_SECRET=<your-secret-here>
ENCRYPTION_KEY=<your-secret-here>
DATABASE_URL=mysql://user:password@82.147.84.78:3306/dbname
```

⚠️ **Никогда не коммитьте .env файлы в git!**

📖 **Подробнее**: [SECURITY.md](SECURITY.md)

## 🧪 Тестирование

```bash
# Backend тесты
cd backend
npm test

# Frontend тесты
cd frontend
npm test

# E2E тесты
npm run test:e2e
```

## 📝 Переменные окружения

Скопируйте `env.production.example` в `.env` и настройте:

```bash
cp env.production.example .env
```

Обязательные переменные:
- `DATABASE_URL` - строка подключения к MySQL
- `JWT_SECRET` - секрет для JWT токенов
- `TELEGRAM_BOT_TOKEN` - токен от @BotFather
- `REDIS_URL` - URL Redis сервера

📖 **Полный список**: [docs/development/environment-setup.md](docs/development/environment-setup.md)

## 🐛 Устранение неполадок

### Порты заняты
```powershell
.\tools\development\kill-project-ports.ps1
```

### Проблемы с Docker
```bash
docker-compose down -v
docker builder prune -f
docker-compose build --no-cache
docker-compose up -d
```

### Логи с ошибками
```bash
docker-compose logs --tail=100 backend
docker-compose logs --tail=100 frontend
docker-compose logs --tail=100 bot
```

📖 **Подробнее**: [docs/deployment/docker-troubleshooting.md](docs/deployment/docker-troubleshooting.md)

## 📊 Мониторинг

Grafana дашборды доступны после запуска:

1. Откройте http://82.147.84.78:3030
2. Войдите (admin/admin)
3. Импортируйте дашборды из `config/grafana/dashboards/`

Доступные метрики:
- API Response Times
- Request Rate
- Error Rate
- Database Connections
- Redis Performance
- Bot Activity

📖 **Настройка**: [docs/deployment/monitoring.md](docs/deployment/monitoring.md)

## 🤝 Разработка

### Workflow
1. Создайте feature branch: `git checkout -b feature/my-feature`
2. Внесите изменения и сделайте коммит
3. Убедитесь что тесты проходят: `npm test`
4. Создайте Pull Request

### Code Style
- TypeScript строгий режим
- ESLint + Prettier
- Автоматическая проверка при коммите (husky)

### AI-помощь
Для разработчиков с AI-ассистентами доступна документация:
- [docs/ai/index.md](docs/ai/index.md) - Индекс для AI
- [docs/ai/rbac.md](docs/ai/rbac.md) - Система ролей
- [docs/ai/data-models.md](docs/ai/data-models.md) - Модели данных
- [docs/ai/order-flow.md](docs/ai/order-flow.md) - Бизнес-логика заказов

## 📜 Лицензия

См. файл [LICENSE](LICENSE)

## 📧 Контакты

- **Security**: security@your-domain.com
- **Support**: support@your-domain.com
- **Issues**: Создайте issue на GitHub

## 🎉 Contributors

Спасибо всем, кто принял участие в разработке этой платформы!

---

**Версия**: 1.0.0  
**Последнее обновление**: Октябрь 2025


