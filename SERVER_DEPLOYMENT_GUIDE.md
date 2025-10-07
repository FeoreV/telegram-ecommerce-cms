# 🚀 Полное Руководство по Развертыванию Сервера

## 📋 Предварительные Требования

### Системные требования
- **OS**: Ubuntu 20.04/22.04 или Debian 11+
- **Node.js**: >= 18.0.0
- **Memory**: минимум 2GB RAM (рекомендуется 4GB+)
- **Disk**: минимум 10GB свободного места
- **Права**: root или sudo доступ

### Необходимое ПО
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка базовых зависимостей
sudo apt install -y curl git build-essential openssl

# Установка Node.js (через nvm рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Установка PM2 глобально
npm install -g pm2

# Установка pnpm (опционально, для разработки)
npm install -g pnpm@8.15.0
```

---

## 📦 Шаг 1: Клонирование Репозитория

```bash
# Перейти в рабочую директорию
cd /root  # или /var/www или /home/username

# Клонировать репозиторий
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> telegram-ecommerce-cms
cd telegram-ecommerce-cms

# Проверить текущую ветку
git branch
git status
```

---

## ⚙️ Шаг 2: Автоматическая Настройка (Рекомендуется)

```bash
# Запустить автоматическую настройку
bash setup-production.sh
```

Скрипт автоматически:
- ✅ Создаст `.env` файлы с безопасными ключами
- ✅ Установит все зависимости (backend, bot, frontend)
- ✅ Запустит миграции базы данных
- ✅ Соберет все приложения
- ✅ Настроит и запустит PM2
- ✅ Сохранит конфигурацию PM2

---

## 🔧 Шаг 3: Настройка Environment Variables

### Backend Environment (backend/.env)

⚠️ **ВАЖНО**: Отредактируйте следующие значения:

```bash
nano backend/.env
```

**Обязательные изменения:**

```bash
# Database (если используете PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/telegram_ecommerce"

# Admin Credentials (ИЗМЕНИТЕ!)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_super_secure_password_here

# Frontend URL (укажите ваш домен)
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Email (если нужна отправка почты)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@yourdomain.com

# Redis (если установлен)
REDIS_URL=redis://localhost:6379
```

**Ключи безопасности** уже сгенерированы автоматически ✅

### Bot Environment (bot/.env)

```bash
nano bot/.env
```

**Обязательно добавьте:**

```bash
NODE_ENV=production
API_URL=http://localhost:3002
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
```

Где взять токен:
1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot` или `/token`
3. Скопируйте токен формата `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

---

## 🔄 Шаг 4: Перезапуск Сервисов

После изменения `.env` файлов:

```bash
cd /root/telegram-ecommerce-cms

# Перезапустить все сервисы
pm2 restart all

# Проверить статус
pm2 status

# Просмотреть логи
pm2 logs
```

---

## ✅ Шаг 5: Проверка Работоспособности

### Проверка PM2

```bash
pm2 status
```

Должны быть **online**:
- ✅ telegram-backend
- ✅ telegram-bot
- ✅ frontend

### Проверка Портов

```bash
# Backend (порт 3002)
curl http://localhost:3002

# Frontend (порт 3000)
curl http://localhost:3000

# Проверка занятых портов
netstat -tulpn | grep -E ':(3000|3002|3003)'
```

### Проверка Логов

```bash
# Все логи
pm2 logs --lines 50

# Только ошибки
pm2 logs --err

# Конкретный сервис
pm2 logs telegram-backend
pm2 logs telegram-bot
pm2 logs frontend
```

---

## 🌐 Шаг 6: Настройка Nginx (Production)

### Установка Nginx

```bash
sudo apt install -y nginx
```

### Конфигурация

Создайте конфигурацию:

```bash
sudo nano /etc/nginx/sites-available/telegram-ecommerce
```

Вставьте:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/telegram-ecommerce /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Шаг 7: Настройка HTTPS (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификатов
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Автопродление (уже настроено автоматически)
sudo certbot renew --dry-run
```

---

## 🔥 Шаг 8: Настройка Firewall

```bash
# UFW (рекомендуется для Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Проверка статуса
sudo ufw status
```

---

## 🚀 Шаг 9: Автозапуск PM2

```bash
# Настроить автозапуск при перезагрузке сервера
pm2 startup systemd

# Скопируйте и выполните команду, которую выведет pm2 startup
# Например: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Сохранить текущий список процессов
pm2 save
```

---

## 📊 Мониторинг и Обслуживание

### PM2 Мониторинг

```bash
# Интерактивный мониторинг
pm2 monit

# Статус процессов
pm2 status

# Информация о процессе
pm2 show telegram-backend

# Использование ресурсов
pm2 describe 0
```

### Логи

```bash
# Просмотр логов в реальном времени
pm2 logs

# Очистка логов
pm2 flush

# Ротация логов (установка модуля)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Обновление Приложения

```bash
cd /root/telegram-ecommerce-cms

# Получить последние изменения
git pull origin main

# Пересобрать
bash setup-production.sh

# Или вручную:
cd backend && npm install && npm run build && cd ..
cd bot && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..

# Перезапустить
pm2 restart all
```

---

## 🛠️ Устранение Проблем

### Backend не запускается

```bash
# Проверить логи
pm2 logs telegram-backend --err --lines 100

# Проверить .env
cat backend/.env | grep -v SECRET

# Проверить базу данных
cd backend
npx prisma migrate status
npx prisma generate
```

### Frontend показывает ошибку подключения

```bash
# Проверить CORS в backend/.env
nano backend/.env
# Убедитесь что ALLOWED_ORIGINS правильный

# Перезапустить backend
pm2 restart telegram-backend
```

### Bot не отвечает

```bash
# Проверить токен
cat bot/.env | grep TELEGRAM_BOT_TOKEN

# Проверить логи
pm2 logs telegram-bot --lines 50

# Проверить подключение к Telegram API
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Перезапустить бота
pm2 restart telegram-bot
```

### Порт уже занят

```bash
# Найти процесс
sudo lsof -i :3002
sudo lsof -i :3000

# Убить процесс
sudo kill -9 <PID>

# Перезапустить PM2
pm2 restart all
```

### База данных заблокирована (SQLite)

```bash
cd backend/prisma

# Бэкап текущей БД
cp dev.db dev.db.backup

# Пересоздать БД
rm dev.db
npx prisma migrate deploy

# Или форсировать
npx prisma db push --force-reset
```

---

## 📝 Полезные Команды

```bash
# PM2
pm2 start ecosystem.config.cjs    # Запустить все
pm2 stop all                       # Остановить все
pm2 restart all                    # Перезапустить все
pm2 delete all                     # Удалить все процессы
pm2 save                           # Сохранить список
pm2 resurrect                      # Восстановить сохраненный список

# Git
git pull origin main               # Получить обновления
git status                         # Статус репозитория
git log --oneline -10              # Последние 10 коммитов

# Системные
df -h                              # Дисковое пространство
free -h                            # Память
top                                # Процессы
htop                               # Улучшенный top
journalctl -xe                     # Системные логи

# Nginx
sudo systemctl status nginx        # Статус
sudo systemctl restart nginx       # Перезапуск
sudo nginx -t                      # Проверка конфигурации
sudo tail -f /var/log/nginx/error.log  # Логи ошибок
```

---

## 🔐 Безопасность

### Обязательные действия после установки:

1. **Изменить пароль администратора**
   - Войдите в систему
   - Перейдите в профиль
   - Измените пароль

2. **Настроить CORS**
   ```bash
   nano backend/.env
   # ALLOWED_ORIGINS=https://yourdomain.com
   pm2 restart telegram-backend
   ```

3. **Включить HTTPS**
   - Следуйте Шагу 7 выше

4. **Настроить Firewall**
   - Следуйте Шагу 8 выше

5. **Регулярные обновления**
   ```bash
   sudo apt update && sudo apt upgrade -y
   npm update -g pm2
   ```

6. **Бэкапы базы данных**
   ```bash
   # Создать скрипт бэкапа
   mkdir -p /root/backups
   cp backend/prisma/dev.db /root/backups/dev.db.$(date +%Y%m%d_%H%M%S)
   
   # Добавить в cron
   crontab -e
   # 0 2 * * * cp /root/telegram-ecommerce-cms/backend/prisma/dev.db /root/backups/dev.db.$(date +\%Y\%m\%d_\%H\%M\%S)
   ```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs --lines 200`
2. Проверьте статус: `pm2 status`
3. Проверьте конфигурацию: `cat backend/.env | grep -v SECRET`
4. Перезапустите сервисы: `pm2 restart all`

---

## ✨ Готово!

Ваш сервер настроен и готов к работе!

**Доступ к приложению:**
- Frontend: `http://localhost:3000` (или `https://yourdomain.com`)
- Backend API: `http://localhost:3002` (или `https://api.yourdomain.com`)
- Telegram Bot: работает автоматически

**Первый вход:**
- Email: указанный в `backend/.env` (ADMIN_EMAIL)
- Password: указанный в `backend/.env` (ADMIN_PASSWORD)

**Не забудьте изменить пароль администратора после первого входа!**

