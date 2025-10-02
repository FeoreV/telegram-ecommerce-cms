# Grafana Configuration

Конфигурация Grafana для визуализации метрик Telegram E-commerce Platform.

## Структура

```
config/grafana/
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml         # Автоматическая настройка Prometheus datasource
│   └── dashboards/
│       ├── default.yml            # Провизионинг дашбордов
│       ├── backend-overview.json  # Дашборд обзора backend
│       └── business-metrics.json  # Дашборд бизнес-метрик
├── grafana.ini                    # Основная конфигурация Grafana
└── README.md                      # Эта документация
```

## Быстрый старт

### 1. Запуск Grafana

```bash
# Запустить через Docker Compose
docker-compose -f docker-compose.monitoring.yml up -d grafana

# Проверить статус
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

### 2. Доступ к Grafana

- URL: http://localhost:3030
- Логин: `admin`
- Пароль: `admin` (измените в production!)

### 3. Проверка дашбордов

После запуска дашборды будут автоматически загружены:
- **BotRT - Backend Overview**: Общий обзор производительности
- **BotRT - Business Metrics**: Бизнес-метрики и аналитика

## Дашборды

### Backend Overview

**URL**: http://localhost:3030/d/botrt-backend-overview

**Панели**:
1. **HTTP Request Rate** - Частота HTTP запросов по методам и маршрутам
2. **Response Time (p95)** - 95-й перцентиль времени ответа
3. **HTTP Status Codes** - Распределение HTTP статус-кодов
4. **Memory Usage (Heap Used)** - Использование heap памяти
5. **Active Stores** - Количество активных магазинов
6. **Total Products** - Общее количество товаров
7. **Active Users** - Количество активных пользователей
8. **Orders (Last Hour)** - Заказы за последний час

**Обновление**: Каждые 10 секунд

### Business Metrics

**URL**: http://localhost:3030/d/botrt-business-metrics

**Панели**:
1. **Orders Rate by Status** - Скорость создания заказов по статусам
2. **Revenue by Currency** - Выручка по валютам
3. **Stock Levels by Product** - Уровни запасов по товарам
4. **Bot Command Usage** - Использование команд бота
5. **Orders by Store (Last Hour)** - Заказы по магазинам
6. **Notifications Sent** - Отправленные уведомления

**Обновление**: Каждые 30 секунд

## Интеграция с AdminJS

### Просмотр в админ-панели

1. Откройте AdminJS: http://localhost:3001/admin
2. Войдите с правами OWNER или ADMIN
3. Перейдите в раздел **Monitoring**
4. Выберите дашборд из списка

### Настройка URL Grafana

Если Grafana работает на другом порту или хосте:

1. Нажмите кнопку **⚙️ Настройки** в разделе Monitoring
2. Введите новый URL (например: `http://grafana.example.com`)
3. Нажмите **Сохранить**

## Создание новых дашбордов

### Через UI

1. Откройте Grafana
2. Нажмите `+` → **Dashboard**
3. Добавьте панели с нужными метриками
4. Сохраните дашборд

### Через JSON

1. Создайте JSON файл дашборда в `config/grafana/provisioning/dashboards/`
2. Дашборд будет автоматически загружен при перезапуске Grafana

Пример структуры:
```json
{
  "title": "My Custom Dashboard",
  "uid": "my-custom-dashboard",
  "panels": [...],
  "tags": ["botrt", "custom"]
}
```

### Экспорт существующего дашборда

1. Откройте дашборд в Grafana
2. Нажмите **Share** → **Export**
3. **Export for sharing externally**
4. Сохраните JSON в `provisioning/dashboards/`

## Полезные PromQL запросы

### HTTP метрики

```promql
# Request rate
rate(botrt_http_requests_total[5m])

# Average response time
rate(botrt_http_request_duration_seconds_sum[5m]) 
/ 
rate(botrt_http_request_duration_seconds_count[5m])

# Error rate
sum(rate(botrt_http_requests_total{status_code=~"5.."}[5m])) 
/ 
sum(rate(botrt_http_requests_total[5m]))
```

### Бизнес метрики

```promql
# Orders per hour
sum(increase(botrt_orders_total[1h]))

# Revenue rate
sum(rate(botrt_orders_value_total[5m])) by (currency)

# Top products by stock
topk(10, botrt_stock_levels)
```

### Системные метрики

```promql
# Memory usage percentage
(botrt_system_memory_usage_bytes{type="heapUsed"} 
/ 
botrt_system_memory_usage_bytes{type="heapTotal"}) * 100

# Active connections
botrt_database_connections_active
botrt_redis_connections_active
```

## Алерты в Grafana

### Создание алерта

1. Откройте панель
2. Нажмите на заголовок → **Edit**
3. Перейдите на вкладку **Alert**
4. Настройте условия срабатывания
5. Добавьте notification channel

### Notification Channels

Настройка каналов уведомлений:
- Alerting → Notification channels
- Добавьте Email, Slack, Telegram и др.

## Безопасность

### Production настройки

В `docker-compose.monitoring.yml`:

```yaml
environment:
  # Измените пароль админа
  - GF_SECURITY_ADMIN_PASSWORD=<strong-password>
  
  # Отключите анонимный доступ
  - GF_AUTH_ANONYMOUS_ENABLED=false
  
  # Включите HTTPS
  - GF_SERVER_PROTOCOL=https
  - GF_SERVER_CERT_FILE=/etc/grafana/cert.pem
  - GF_SERVER_CERT_KEY=/etc/grafana/key.pem
```

### CORS для iframe

Для встраивания Grafana в AdminJS уже настроено:
```ini
[security]
allow_embedding = true
cookie_samesite = none
```

### Аутентификация

Для production рекомендуется:
- OAuth integration (Google, GitHub)
- LDAP/Active Directory
- SAML

## Troubleshooting

### Дашборды не загружаются

Проверьте логи:
```bash
docker-compose -f docker-compose.monitoring.yml logs grafana
```

Проверьте провизионинг:
```bash
docker exec -it botrt-grafana ls -la /etc/grafana/provisioning/dashboards/
```

### Нет данных на дашбордах

1. Проверьте подключение к Prometheus:
   - Configuration → Data Sources → Prometheus
   - Нажмите **Save & Test**

2. Проверьте, что метрики есть в Prometheus:
   - Откройте http://localhost:9090
   - Query: `up`

3. Проверьте временной диапазон в Grafana (правый верхний угол)

### Grafana не встраивается в AdminJS

Проверьте настройки в `grafana.ini`:
```ini
[security]
allow_embedding = true
cookie_samesite = none
```

Проверьте CORS headers в браузере (F12 → Console)

### Производительность

Если дашборды медленно загружаются:

1. Увеличьте query timeout:
   ```yaml
   jsonData:
     queryTimeout: '120s'
   ```

2. Уменьшите временной диапазон
3. Оптимизируйте PromQL запросы
4. Увеличьте ресурсы контейнера

## Бэкап и восстановление

### Бэкап дашбордов

```bash
# Через API
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3030/api/dashboards/uid/<dashboard-uid> \
  > dashboard-backup.json

# Через volume
docker run --rm \
  -v botrt_grafana-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/grafana-backup.tar.gz /data
```

### Восстановление

```bash
# Через volume
docker run --rm \
  -v botrt_grafana-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/grafana-backup.tar.gz -C /
```

## Полезные ссылки

- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Provisioning Dashboards](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Dashboard JSON Model](https://grafana.com/docs/grafana/latest/dashboards/json-model/)
- [PromQL Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/)
