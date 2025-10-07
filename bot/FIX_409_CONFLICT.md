# Исправление ошибки 409 Conflict

## Проблема
Ошибка `409 Conflict: terminated by other getUpdates request` означает, что запущено несколько экземпляров бота одновременно.

## Возможные причины

### 1. Webhook настроен на production сервере
Если у вас настроен webhook на production сервере, нужно его удалить:

```bash
# Получите ваш BOT_TOKEN из bot/.env
BOT_TOKEN="ваш_токен"

# Удалите webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"

# Проверьте, что webhook удален
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

### 2. Несколько локальных процессов
Остановите все процессы node:

**Windows PowerShell:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Linux/Mac:**
```bash
pkill -9 node
```

### 3. Docker контейнеры
Если бот запущен в Docker:

```bash
docker ps | grep bot
docker stop <container_id>
```

## Правильный запуск бота

### Локальная разработка (polling):

```bash
cd bot
npm run build
npm start
```

### Production (webhook):
Убедитесь, что в `.env` файле:
```
USE_WEBHOOK=true
WEBHOOK_URL=https://your-domain.com/webhook
```

## Что было исправлено

✅ Добавлена корректная обработка callback_data для `store_products` с поддержкой пагинации
✅ Исправлена функция `showStoreProducts` для принятия параметра `page`
✅ Улучшено кеширование товаров с учетом номера страницы
✅ Исправлена пагинация для CMS товаров
✅ Кнопки товаров теперь отображаются корректно

## Проверка изменений

После запуска бота:
1. Откройте бот в Telegram
2. Нажмите "🏪 Просмотр магазинов"
3. Выберите магазин
4. Нажмите "🛍️ Посмотреть товары"
5. Вы должны увидеть список товаров с кнопками вида "🛒 Название товара"

