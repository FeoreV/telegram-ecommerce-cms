# Docker Build Tools

Инструменты для работы с Docker образами и контейнерами.

## Скрипты для пересборки

### PowerShell Script (Рекомендуется)

```powershell
# Пересобрать все сервисы
.\tools\development\rebuild-docker.ps1

# Пересобрать с полной очисткой кэша
.\tools\development\rebuild-docker.ps1 -NoCache

# Пересобрать конкретный сервис
.\tools\development\rebuild-docker.ps1 -Service -ServiceName backend
.\tools\development\rebuild-docker.ps1 -Service -ServiceName frontend
.\tools\development\rebuild-docker.ps1 -Service -ServiceName bot
```

### Batch Script (Быстрый запуск)

```batch
# Пересобрать все
tools\development\quick-rebuild.bat

# С очисткой кэша
tools\development\quick-rebuild.bat --no-cache

# Конкретный сервис
tools\development\quick-rebuild.bat -s backend
tools\development\quick-rebuild.bat -s frontend
tools\development\quick-rebuild.bat -s bot
```

## Прямые команды Docker Compose

### Пересборка всех сервисов

```bash
# Остановить контейнеры
docker-compose down

# Пересобрать образы
docker-compose build

# Пересобрать с очисткой кэша
docker-compose build --no-cache

# Запустить
docker-compose up -d
```

### Пересборка конкретного сервиса

```bash
# Backend
docker-compose build backend
docker-compose up -d backend

# Frontend
docker-compose build frontend
docker-compose up -d frontend

# Bot
docker-compose build bot
docker-compose up -d bot
```

### Полная пересборка с очисткой

```bash
# Остановить и удалить все контейнеры, сети, и анонимные volumes
docker-compose down -v

# Удалить старые образы
docker-compose rm -f

# Пересобрать с нуля
docker-compose build --no-cache

# Запустить
docker-compose up -d
```

## Проверка состояния

```bash
# Статус контейнеров
docker-compose ps

# Логи всех сервисов
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f bot

# Использование ресурсов
docker stats
```

## Очистка системы Docker

```bash
# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые контейнеры
docker container prune

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка (ОСТОРОЖНО!)
docker system prune -a --volumes
```

## Полезные команды

### Проверка образов

```bash
# Список всех образов
docker images

# Список образов проекта
docker images | grep telegram

# Детали образа
docker inspect telegram-ecommerce-cms-backend
```

### Вход в контейнер

```bash
# Backend
docker exec -it telegram_ecommerce_backend sh

# Frontend
docker exec -it telegram_ecommerce_frontend sh

# Bot
docker exec -it telegram_ecommerce_bot sh

# Database
docker exec -it telegram_ecommerce_db mysql -u telegram_user -p
```

### Копирование файлов

```bash
# Из контейнера на хост
docker cp telegram_ecommerce_backend:/app/logs/error.log ./backend-errors.log

# С хоста в контейнер
docker cp ./config.json telegram_ecommerce_backend:/app/config.json
```

## Troubleshooting

### Проблема: Порт уже занят

```powershell
# Используйте скрипт для освобождения портов
.\tools\development\kill-project-ports.ps1
```

### Проблема: Кэш Docker не обновляется

```bash
# Пересоберите с --no-cache
docker-compose build --no-cache
```

### Проблема: Volumes содержат старые данные

```bash
# Удалите volumes и пересоздайте
docker-compose down -v
docker-compose up -d
```

### Проблема: Нет свободного места

```bash
# Проверьте использование
docker system df

# Очистите неиспользуемые ресурсы
docker system prune -a
```

### Проблема: Backend не подключается к базе данных

```bash
# Проверьте статус базы данных
docker-compose logs database

# Проверьте здоровье контейнера
docker inspect telegram_ecommerce_db | grep -A 10 Health
```

## Production Builds

Для production используйте специализированные Dockerfiles:

```bash
# Backend production
docker build -f backend/Dockerfile.production -t backend:prod ./backend

# Frontend production (уже использует multi-stage build)
docker build -t frontend:prod ./frontend

# Или используйте production compose файлы
docker-compose -f config/docker/docker-compose.postgres-prod.yml up -d
docker-compose -f config/docker/docker-compose.mysql-prod.yml up -d
```

## Мониторинг

После пересборки и запуска:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3030 (admin/admin)
- **Backend Health**: http://localhost:3001/api/health
- **Frontend**: http://localhost:3000

## Автоматическая пересборка при изменениях

Для development режима с hot-reload:

```bash
# Запустить с watch mode
docker-compose watch
```

Или используйте volumes для монтирования кода (уже настроено в docker-compose.yml):
- Backend: `./backend:/app`
- Bot: `./bot:/app`

