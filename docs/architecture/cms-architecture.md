## CMS Integration Architecture (Medusa)

Context added by Giga authorization-model: Маппинг ролей OWNER/ADMIN/VENDOR/CUSTOMER и изоляция магазинов применяются при доступе к CMS и backend.
Context added by Giga order-processing-flow: Резерв стока, верификация оплаты и генерация номера заказа остаются в backend и синхронизируются с CMS.
Context added by Giga telegram-integration: Бот читает каталог/цену из CMS, а оформление и оплата проходят через кастомный flow.
Context added by Giga data-models-and-relationships: Store–Product–Order–User и вариантные запасы учитываются в CMS моделировании (regions/channels, variants, inventory).

### Goals
- Использовать Medusa для каталога, цен и запасов (multi-store через regions/channels)
- Сохранить кастомный order/payment verification в backend + Telegram bot
- Двусторонняя синхронизация событий через webhooks; кэширование через Redis

### Ownership
- Catalog (products, variants, prices, inventory): CMS — источник истины
- Orders and Payments (verification, holds, reconciliation): Backend — источник истины
- Users/RBAC: Backend (store-scoped), CMS — сервисные аккаунты

### Data Flow
1. Bot запрашивает каталог у CMS API (public store endpoints)
2. Bot создаёт заказ через Backend API (идемпотентность по ключу)
3. Backend резервирует сток (через CMS Reservation/Inventory API или локальный hold)
4. Пользователь отправляет подтверждение оплаты → Backend верифицирует админом
5. При подтверждении Backend:
   - фиксирует заказ (status PAID)
   - подтверждает/списывает резерв в CMS
   - отправляет события в Socket/Telegram

### Webhooks (CMS → Backend)
- product.created/updated, variant.updated → инвалидация кэша, нотификация UI
- inventory.updated/reservation.released → пересчёт доступности
- Безопасность: подпись/токен в заголовке, защита от реплеев, rate limit

### Mapping
- Store ↔ CMS Region/Channel (по одному или несколько на магазин)
- Product/Variant ↔ SKU/External ID (сохранение соответствий в backend)
- Order ↔ External Reference в CMS (если создаются записи для отчётности)

### Environments
- docker-compose: medusa (Node), medusa-db (Postgres), shared redis
- Secrets: MEDUSA_* в секрет-менеджере; backend читает MEDUSA_WEBHOOK_TOKEN

### Observability
- Корреляционный ID по цепочке: bot → backend → CMS
- Логи JSON, метрики p95, ошибки вебхуков, резервы/откаты

### Next Steps
- Поднять Medusa в docker-compose
- Подключить вебхуки CMS к /api/cms/webhooks/medusa
- Переключить бот на CMS API для каталога

