# Telegram Bot Setup Guide

## Полное руководство по настройке Telegram бота с продвинутой системой безопасности

### 📋 Содержание
1. [Быстрый старт](#быстрый-старт)
2. [Конфигурация безопасности](#конфигурация-безопасности)
3. [Webhook vs Polling](#webhook-vs-polling)
4. [Мониторинг и аналитика](#мониторинг-и-аналитика)
5. [Производственное развертывание](#производственное-развертывание)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Быстрый старт

### 1. Создание Telegram бота
```bash
# 1. Найдите @BotFather в Telegram
# 2. Отправьте команду /newbot
# 3. Следуйте инструкциям для создания бота
# 4. Получите токен бота (TELEGRAM_BOT_TOKEN)
```

### 2. Настройка окружения

**Для разработки:**
```bash
cp bot/env.example bot/.env

# Отредактируйте .env файл:
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=development
API_URL=http://82.147.84.78:3001
REDIS_URL=redis://82.147.84.78:6379  # Опционально
```

**Для продакшена:**
```bash
cp bot/env.production.example bot/.env.production

# Настройте продакшн переменные:
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=production
WEBHOOK_BASE_URL=https://yourdomain.com
WEBHOOK_SECRET=your_secure_webhook_secret
WEBHOOK_ADMIN_TOKEN=your_admin_token
REDIS_URL=redis://your-redis-host:6379
```

### 3. Запуск бота
```bash
cd bot

# Установка зависимостей
npm install

# Разработка (polling)
npm run dev

# Продакшн (webhook)
npm start
```

---

## 🔒 Конфигурация безопасности

### Система многоуровневой защиты

Наш бот включает продвинутую систему безопасности:

#### Rate Limiting
- **Лимит сообщений:** 20-30 в минуту
- **Блокировка:** 5-10 минут при превышении
- **Graduated Response:** Увеличение времени блокировки при повторных нарушениях

```env
# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_BLOCK_DURATION=600000
```

#### Anti-Spam фильтрация
- **Pattern Detection:** Обнаружение спам-паттернов
- **Behavior Analysis:** Анализ поведения пользователей
- **Automatic Blocking:** Автоматическая блокировка подозрительных пользователей

```env
# Anti-Spam Configuration
SPAM_MAX_MESSAGES_PER_MINUTE=15
SPAM_MAX_COMMANDS_PER_MINUTE=8
SPAM_SUSPICION_THRESHOLD=60
SPAM_BAN_DURATION=3600000
```

### Spam Detection Patterns

Бот автоматически обнаруживает:
- **Повторяющиеся символы** (aaaaaaaa)
- **Слишком много специальных символов**
- **Подозрительные ссылки**
- **Спам-ключевые слова** (crypto, bitcoin, money, etc.)
- **Слишком много заглавных букв**
- **Упоминания** (@username в неподходящем контексте)

### Система подозрительности

Каждому пользователю присваивается **Suspicion Score** (0-100):
- **0-30:** Нормальный пользователь
- **30-60:** Требует внимания  
- **60-80:** Подозрительный
- **80-100:** Автоматическая блокировка

---

## 🌐 Webhook vs Polling

### Polling Mode (Разработка)
- ✅ Простая настройка
- ✅ Не требует домен или SSL
- ✅ Хорош для разработки
- ❌ Менее эффективен для высокой нагрузки

```env
# Polling configuration
NODE_ENV=development
# WEBHOOK_BASE_URL не указывать
```

### Webhook Mode (Продакшн)
- ✅ Более эффективен
- ✅ Instant delivery сообщений
- ✅ Лучше для продакшена
- ❌ Требует HTTPS домен

```env
# Webhook configuration
NODE_ENV=production
WEBHOOK_BASE_URL=https://yourdomain.com
WEBHOOK_PATH=/webhook/telegram
WEBHOOK_PORT=8443
WEBHOOK_SECRET=your_secure_webhook_secret
```

### Настройка Nginx для Webhook

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    
    location /webhook/telegram {
        proxy_pass http://82.147.84.78:8443;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

---

## 📊 Мониторинг и аналитика

### Health Check endpoints

```bash
# Проверка состояния бота
curl http://82.147.84.78:8443/health

# Получение статистики безопасности (требует авторизации)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://82.147.84.78:8443/api/security-stats
```

### Ответ Health Check
```json
{
  "status": "ok",
  "service": "telegram-webhook", 
  "uptime": 86400000,
  "stats": {
    "totalRequests": 1500,
    "successfulRequests": 1485,
    "failedRequests": 15,
    "averageResponseTime": 45
  },
  "timestamp": "2025-09-23T10:00:00.000Z"
}
```

### Security Stats
```json
{
  "blockedUsers": 12,
  "activeUsers": 156,  
  "totalRequests": 2500,
  "service": "telegram-bot-security",
  "timestamp": "2025-09-23T10:00:00.000Z"
}
```

### Admin endpoints для управления безопасностью

```bash
# Разблокировать пользователя
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId": 123456789}' \
     http://82.147.84.78:8443/api/unblock-user
```

---

## 🐳 Производственное развертывание

### Docker Compose Setup

```yaml
version: '3.8'
services:
  telegram-bot:
    build: ./bot
    environment:
      - NODE_ENV=production
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - WEBHOOK_BASE_URL=${WEBHOOK_BASE_URL}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - REDIS_URL=redis://redis:6379
      - API_URL=http://backend:3001
    ports:
      - "8443:8443"
    depends_on:
      - redis
      - backend
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telegram-bot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: telegram-bot
  template:
    metadata:
      labels:
        app: telegram-bot
    spec:
      containers:
      - name: telegram-bot
        image: your-registry/telegram-bot:latest
        ports:
        - containerPort: 8443
        env:
        - name: NODE_ENV
          value: "production"
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: telegram-secrets
              key: bot-token
        - name: WEBHOOK_BASE_URL
          value: "https://yourdomain.com"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        livenessProbe:
          httpGet:
            path: /health
            port: 8443
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8443
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Environment Variables Reference

| Переменная | Обязательна | Описание | Пример |
|------------|-------------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Токен Telegram бота | `1234567890:ABCdef...` |
| `WEBHOOK_BASE_URL` | ⚠️ Prod | URL для webhook | `https://yourdomain.com` |
| `WEBHOOK_SECRET` | ⚠️ Prod | Secret token для webhook | `your-secure-secret` |
| `REDIS_URL` | ⚠️ Prod | URL Redis сервера | `redis://82.147.84.78:6379` |
| `API_URL` | ✅ | URL backend API | `http://82.147.84.78:3001` |
| `WEBHOOK_ADMIN_TOKEN` | ⚠️ | Token для admin endpoints | `secure-admin-token` |
| `LOG_LEVEL` | ❌ | Уровень логирования | `info` |

---

## 🔧 Troubleshooting

### Общие проблемы

#### 1. Бот не отвечает на сообщения
```bash
# Проверьте статус
curl http://82.147.84.78:8443/health

# Проверьте логи
docker logs telegram-bot-container

# Проверьте webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

#### 2. Webhook не работает
```bash
# Проверьте SSL сертификат
curl -I https://yourdomain.com/webhook/telegram

# Проверьте Telegram webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Ответ должен содержать:
{
  "url": "https://yourdomain.com/webhook/telegram",
  "has_custom_certificate": false,
  "pending_update_count": 0,
  "last_error_date": 0
}
```

#### 3. Redis connection errors
```bash
# Проверьте подключение к Redis
redis-cli -h 82.147.84.78 -p 6379 ping

# Проверьте переменные окружения
echo $REDIS_URL
```

#### 4. Rate limiting слишком строгий
```bash
# Временно разблокируйте пользователя
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId": USER_TELEGRAM_ID}' \
     http://82.147.84.78:8443/api/unblock-user

# Измените настройки rate limiting в .env
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_WINDOW_MS=60000
```

### Мониторинг и логи

```bash
# Просмотр логов бота
tail -f bot/logs/bot-combined.log

# Проверка статистики в реальном времени
watch -n 5 'curl -H "Authorization: Bearer TOKEN" 82.147.84.78:8443/api/security-stats'

# Monitoring с Grafana/Prometheus
# Бот экспортирует метрики на /metrics endpoint (если настроен)
```

### Performance Tuning

```env
# Для высоконагруженных ботов
RATE_LIMIT_MAX_REQUESTS=100
SPAM_SUSPICION_THRESHOLD=80
REDIS_MAX_CONNECTIONS=20

# Для строгой безопасности
RATE_LIMIT_MAX_REQUESTS=10
SPAM_SUSPICION_THRESHOLD=40
SPAM_BAN_DURATION=7200000  # 2 hours
```

---

## 📝 Логи и Отладка

### Структура логов
```json
{
  "timestamp": "2025-09-23T10:00:00.000Z",
  "level": "info",
  "message": "Message blocked from user 123456789",
  "metadata": {
    "userId": 123456789,
    "rateLimitPassed": false,
    "antiSpamPassed": false,
    "messageText": "spam message content..."
  }
}
```

### Debug Mode
```env
# Включить детальные логи
DEBUG_ENABLED=true
VERBOSE_LOGGING=true
LOG_LEVEL=debug
```

---

## 🔄 Обновления и Maintenance

### Graceful Updates
```bash
# Остановка бота с graceful shutdown
docker kill --signal=SIGTERM telegram-bot-container

# Обновление без downtime (с load balancer)
kubectl rollout restart deployment/telegram-bot
```

### Backup Configuration
```bash
# Резервное копирование Redis данных
redis-cli --rdb /backup/dump.rdb

# Backup переменных окружения
cp .env .env.backup.$(date +%Y%m%d)
```

---

## 🤝 Поддержка

- **Документация API:** [Backend API Documentation](../backend/CONFIG_API_EXAMPLES.md)
- **Логи:** `bot/logs/`
- **Health Check:** `http://82.147.84.78:8443/health`
- **Admin Panel:** Доступен через backend на `/admin`

Для дополнительных вопросов обратитесь к [Telegram Store Integration Guide](TELEGRAM_STORE_INTEGRATION.md).

---

**📅 Последнее обновление:** 23.09.2025  
**🚀 Готов к продакшену!**
