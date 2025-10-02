# Prometheus Configuration

Конфигурация Prometheus для мониторинга Telegram E-commerce Platform.

## Структура

```
config/prometheus/
├── prometheus.yml          # Основная конфигурация
├── alerts/
│   └── backend-alerts.yml  # Правила алертов
└── README.md              # Эта документация
```

## Запуск мониторинга

### 1. Запуск через Docker Compose

```bash
# Запустить полный стек мониторинга
docker-compose -f docker-compose.monitoring.yml up -d

# Проверить статус
docker-compose -f docker-compose.monitoring.yml ps

# Посмотреть логи
docker-compose -f docker-compose.monitoring.yml logs -f
```

### 2. Доступ к сервисам

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3030 (admin/admin)
- **Node Exporter**: http://localhost:9100/metrics
- **Backend Metrics**: http://localhost:3001/metrics

### 3. Остановка

```bash
docker-compose -f docker-compose.monitoring.yml down

# С удалением данных
docker-compose -f docker-compose.monitoring.yml down -v
```

## Метрики Backend

### HTTP Метрики
- `botrt_http_requests_total` - Общее количество HTTP запросов
- `botrt_http_request_duration_seconds` - Длительность HTTP запросов
- `botrt_http_requests_in_progress` - Количество запросов в процессе

### Бизнес Метрики
- `botrt_orders_total` - Общее количество заказов
- `botrt_orders_value_total` - Общая стоимость заказов
- `botrt_active_stores` - Количество активных магазинов
- `botrt_active_products` - Количество активных товаров
- `botrt_active_users` - Количество активных пользователей

### Bot Метрики
- `botrt_bot_commands_total` - Количество команд бота
- `botrt_bot_messages_total` - Количество сообщений бота
- `botrt_bot_errors_total` - Количество ошибок бота

### Безопасность
- `botrt_auth_attempts_total` - Попытки аутентификации
- `botrt_rate_limit_hits_total` - Срабатывания rate limit
- `botrt_invalid_token_attempts_total` - Неверные токены

### Системные метрики
- `botrt_system_memory_usage_bytes` - Использование памяти
- `botrt_system_cpu_usage_percent` - Использование CPU
- `botrt_database_connections_active` - Активные соединения с БД
- `botrt_redis_connections_active` - Активные соединения с Redis

## Grafana Dashboards

### Backend Overview
Общий обзор производительности backend:
- HTTP Request Rate
- Response Time (p95)
- HTTP Status Codes
- Memory Usage
- Active Stores/Products/Users
- Orders per Hour

### Business Metrics
Бизнес-метрики и аналитика:
- Orders Rate by Status
- Revenue by Currency
- Stock Levels by Product
- Bot Command Usage
- Orders by Store
- Notifications Sent

## Alerts

Настроенные алерты в `alerts/backend-alerts.yml`:

### Critical
- **HighErrorRate**: Error rate > 5% в течение 5 минут
- **ServiceDown**: Сервис недоступен более 1 минуты

### Warning
- **SlowResponseTime**: p95 response time > 2s в течение 10 минут
- **HighMemoryUsage**: Использование памяти > 90% в течение 5 минут
- **HighRateLimitHits**: Rate limit срабатывает > 10 раз/сек
- **HighAuthFailures**: > 5 неудачных попыток аутентификации в секунду

### Info
- **LowStockLevel**: Запасы товара < 10 единиц

## Кастомизация

### Добавление новых метрик

В `backend/src/services/prometheusService.ts`:

```typescript
// Создать новый счетчик
this.myCustomMetric = new Counter({
  name: 'botrt_my_custom_metric',
  help: 'Description of my metric',
  labelNames: ['label1', 'label2'],
  registers: [this.registry]
});

// Использовать
prometheusService.myCustomMetric.inc({ label1: 'value1', label2: 'value2' });
```

### Добавление новых алертов

В `config/prometheus/alerts/`:

```yaml
- alert: MyCustomAlert
  expr: my_metric > threshold
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Alert summary"
    description: "{{ $value }}"
```

## Troubleshooting

### Prometheus не может подключиться к backend

Проверьте, что backend запущен и доступен:
```bash
curl http://localhost:3001/metrics
```

### Grafana не показывает данные

1. Проверьте подключение к Prometheus в Grafana UI
2. Убедитесь, что Prometheus scraping работает (Status > Targets)
3. Проверьте, что метрики собираются: `curl http://localhost:9090/api/v1/query?query=up`

### Нет метрик от exporters

Проверьте статус контейнеров:
```bash
docker-compose -f docker-compose.monitoring.yml ps
docker-compose -f docker-compose.monitoring.yml logs redis-exporter
docker-compose -f docker-compose.monitoring.yml logs postgres-exporter
```

## Production Notes

Для production окружения:

1. **Измените пароли**:
   - Grafana admin password
   - Prometheus basic auth (если используется)

2. **Настройте хранение данных**:
   - Увеличьте retention period
   - Настройте backup volumes

3. **Включите TLS**:
   - Настройте SSL для Grafana
   - Настройте mTLS для Prometheus

4. **Настройте Alertmanager**:
   - Раскомментируйте сервис в docker-compose
   - Настройте отправку алертов (email, Slack, etc)

5. **Мониторинг самого мониторинга**:
   - Настройте алерты на доступность Prometheus/Grafana
   - Мониторинг использования диска

## Полезные ссылки

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
