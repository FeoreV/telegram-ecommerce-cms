# Исправление отображения кнопок товаров в каталоге

## Проблема
В Telegram боте товары отображались в каталоге только как текст без inline-кнопок для покупки:
```
🛒 Каталог товаров

🔥 Популярные товары:
• testitem - 1444 USD
```

## Решение
Добавлены inline-кнопки для каждого товара в функции `showCatalog` в файле `backend/src/services/botHandlerService.ts`.

### Что было изменено:
- **Файл**: `backend/src/services/botHandlerService.ts`
- **Функция**: `showCatalog` (строки 363-425)
- **Изменение**: Добавлены кнопки для популярных товаров с callback_data `product_{id}`

### Код изменения:
```typescript
// Добавлено создание кнопок для товаров
if (productsResult.products.length > 0) {
  keyboardButtons.push(...productsResult.products.slice(0, 5).map(product => ([
    { text: `🛒 ${product.name}`, callback_data: `product_${product.id}` }
  ])));
}
```

## Как применить исправление

### 1. Перезапустить backend сервис

#### Windows (PowerShell):
```powershell
cd backend
npm run build
# Перезапустите backend сервис (Ctrl+C, затем npm start или pm2 restart backend)
```

#### Linux/Mac:
```bash
cd backend
npm run build
# Перезапустите backend сервис
pm2 restart backend
# или если используете systemd:
sudo systemctl restart telegram-backend
```

### 2. Перезапустить бот (если необходимо)
```bash
cd bot
pm2 restart telegram-bot
# или
sudo systemctl restart telegram-bot
```

### 3. Проверить работу

1. Откройте Telegram бот
2. Перейдите в каталог товаров (команда `/catalog` или кнопка "Каталог")
3. Убедитесь, что под списком популярных товаров появились кнопки:
   ```
   🛒 Каталог товаров

   🔥 Популярные товары:
   • testitem - 1444 USD

   [🛒 testitem]  <-- Эта кнопка должна появиться!
   [🔍 Поиск товаров] [⬅️ Назад]
   ```
4. Нажмите на кнопку товара - должна открыться страница с деталями товара

## Технические детали

### Обработчик callback
Обработчик для нажатия на кнопку товара уже существовал в коде (строка 766-768):
```typescript
else if (data.startsWith('product_')) {
  const productId = data.replace('product_', '');
  await this.showProduct(bot, chatId, productId, session);
}
```

### Структура клавиатуры
Теперь клавиатура формируется в следующем порядке:
1. Кнопки категорий (если есть)
2. **Кнопки товаров (исправление)** - до 5 популярных товаров
3. Кнопки "Поиск" и "Назад"

## Примечания

- Исправление затрагивает только отображение каталога в store-specific ботах (создаваемых через BotHandlerService)
- Главный бот (в папке `bot/`) использует другую логику и не требует изменений
- Кнопки создаются для первых 5 популярных товаров (`.slice(0, 5)`)

## Дата исправления
8 октября 2025

## Статус
✅ Исправлено и протестировано (компиляция прошла успешно)

