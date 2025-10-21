# Настройка .env на сервере

## Критически важно!

На сервере в файле `/root/telegram-ecommerce-cms/backend/.env` нужно установить:

```bash
# 1. Откройте файл
nano /root/telegram-ecommerce-cms/backend/.env

# 2. Найдите строку TELEGRAM_BOT_TOKEN и замените YOUR_BOT_TOKEN_HERE на ваш реальный токен
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# 3. Сохраните (Ctrl+O, Enter, Ctrl+X)
```

## Быстрая команда для обновления

```bash
cd /root/telegram-ecommerce-cms/backend

# Замените YOUR_ACTUAL_BOT_TOKEN на ваш реальный токен бота
sed -i 's/TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE/TELEGRAM_BOT_TOKEN=YOUR_ACTUAL_BOT_TOKEN/' .env

# Проверьте
grep TELEGRAM_BOT_TOKEN .env

# Перезапустите
pm2 restart all
```

## Получение токена бота

Если у вас нет токена:

1. Откройте Telegram
2. Найдите @BotFather
3. Отправьте `/newbot` или `/mybots`
4. Скопируйте токен (формат: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Проверка после настройки

```bash
# Проверить статус
pm2 status

# Посмотреть логи
pm2 logs telegram-backend --lines 50

# Если всё ок, должно быть:
# ✅ Backend запущен
# ✅ Нет ошибок "TELEGRAM_BOT_TOKEN is required"
```

## Альтернатива: Режим development

Если вы хотите запустить без production проверок:

```bash
# В backend/.env измените
NODE_ENV=development

# Перезапустите
pm2 restart all
```

Но для production рекомендуется использовать `NODE_ENV=production` с правильными токенами.
