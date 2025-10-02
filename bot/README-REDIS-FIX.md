# Redis Connection Fix

## Проблема
Бот не может подключиться к Redis: `ECONNREFUSED 127.0.0.1:6379`

## Решения

### Решение 1: Запустить Redis через Docker (Рекомендуется)

1. **Убедитесь, что Docker Desktop запущен**

2. **Запустите только Redis контейнер:**
   ```bash
   # Из корневой директории проекта
   docker-compose up -d redis
   
   # Или используйте готовый скрипт
   start-redis-only.bat
   ```

3. **Проверьте, что Redis запущен:**
   ```bash
   docker ps --filter "name=redis"
   ```

4. **Настройте .env файл бота:**
   ```bash
   # В директории bot/ скопируйте .env.development в .env
   cp .env.development .env
   
   # Убедитесь, что REDIS_URL установлен:
   REDIS_URL=redis://localhost:6379
   ```

5. **Перезапустите бота**

### Решение 2: Работа без Redis (Только для разработки)

Бот может работать без Redis, используя in-memory хранилище сессий.

1. **Создайте файл `bot/.env`:**
   ```bash
   cp bot/.env.development bot/.env
   ```

2. **Закомментируйте REDIS_URL в `.env`:**
   ```env
   # REDIS_URL=redis://localhost:6379
   ```

3. **Перезапустите бота**

Бот автоматически переключится на in-memory режим и выдаст сообщение:
```
Redis not configured, using in-memory session store (development mode)
```

### Решение 3: Запустить весь стек через Docker

```bash
# Из корневой директории
docker-compose up -d

# Это запустит: database, redis, backend, bot, frontend
```

## Проверка работы Redis

После запуска Redis проверьте подключение:

```bash
# Через Docker
docker exec -it telegram_ecommerce_redis redis-cli ping
# Ответ должен быть: PONG

# Через redis-cli локально (если установлен)
redis-cli -h localhost -p 6379 ping
```

## Логи бота

При успешном подключении к Redis вы увидите:
```
Bot Redis session store connected
```

При работе без Redis:
```
Redis not configured, using in-memory session store (development mode)
```

## Важно

- **Продакшн**: Redis обязателен для продакшн среды
- **Разработка**: Можно работать без Redis, но данные сессий будут теряться при перезапуске бота
- **Docker**: При использовании Docker Compose Redis настраивается автоматически
