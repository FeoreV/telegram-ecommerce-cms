# ⚡ Быстрая Настройка Сервера (5 минут)

## 🎯 Минимальная установка за 3 команды

```bash
# 1. Клонировать репозиторий
git clone <URL_РЕПОЗИТОРИЯ> telegram-ecommerce-cms
cd telegram-ecommerce-cms

# 2. Запустить автоматическую настройку
bash setup-production.sh

# 3. Добавить Telegram Bot Token
nano bot/.env
# Добавьте: TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
pm2 restart telegram-bot
```

**Готово! ✅**

---

## 📋 Что делает setup-production.sh?

1. ✅ Создает `.env` файлы с безопасными ключами
2. ✅ Устанавливает зависимости (backend, bot, frontend)
3. ✅ Настраивает базу данных (миграции)
4. ✅ Собирает все приложения (build)
5. ✅ Запускает PM2 процессы
6. ✅ Сохраняет конфигурацию PM2

---

## 🔑 Обязательные действия после установки

### 1. Telegram Bot Token

```bash
nano bot/.env
```

Добавьте строку:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

Получить токен: [@BotFather](https://t.me/BotFather) → `/newbot`

```bash
pm2 restart telegram-bot
```

### 2. Пароль администратора

```bash
nano backend/.env
```

Найдите и измените:
```bash
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_super_secure_password
```

```bash
pm2 restart telegram-backend
```

### 3. Домен (для production)

```bash
nano backend/.env
```

Измените:
```bash
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

```bash
pm2 restart telegram-backend
```

---

## 📊 Проверка статуса

```bash
# Статус всех сервисов
pm2 status

# Логи в реальном времени
pm2 logs

# Мониторинг
pm2 monit
```

**Должны быть online:**
- ✅ telegram-backend (порт 3002)
- ✅ telegram-bot (порт 3003)
- ✅ frontend (порт 3000)

---

## 🌐 Доступ к приложению

- **Frontend**: http://82.147.84.78:3000
- **Backend API**: http://82.147.84.78:3002
- **Telegram Bot**: работает автоматически

**Вход в админ-панель:**
- Email: из `backend/.env` (ADMIN_EMAIL)
- Password: из `backend/.env` (ADMIN_PASSWORD)

---

## 🔄 Обновление

```bash
cd telegram-ecommerce-cms
git pull origin main
bash setup-production.sh
```

---

## 🆘 Проблемы?

### Bot не отвечает
```bash
# Проверьте токен
cat bot/.env | grep TELEGRAM_BOT_TOKEN

# Перезапустите
pm2 restart telegram-bot

# Логи
pm2 logs telegram-bot
```

### Backend не работает
```bash
# Проверьте логи
pm2 logs telegram-backend --err

# Перезапустите
pm2 restart telegram-backend
```

### Порт занят
```bash
# Найдите процесс
netstat -tulpn | grep :3002

# Удалите все PM2 процессы
pm2 delete all

# Запустите заново
pm2 start config/services/ecosystem.config.cjs
pm2 save
```

---

## 📖 Полная документация

Подробное руководство: [SERVER_DEPLOYMENT_GUIDE.md](./SERVER_DEPLOYMENT_GUIDE.md)

---

## ✅ Чек-лист

- [ ] Репозиторий склонирован
- [ ] `setup-production.sh` выполнен
- [ ] Telegram Bot Token добавлен в `bot/.env`
- [ ] Пароль администратора изменен в `backend/.env`
- [ ] Все сервисы в статусе **online** (`pm2 status`)
- [ ] Frontend доступен на порту 3000
- [ ] Backend API отвечает на порту 3002
- [ ] Telegram бот отвечает на сообщения

**После этого можно использовать систему! 🎉**

