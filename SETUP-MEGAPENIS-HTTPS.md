# Настройка HTTPS для megapenis.work.gd

## Шаг 1: Установка Certbot (Let's Encrypt)

```bash
# Для Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Для CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

## Шаг 2: Получение SSL сертификата

```bash
# Остановите nginx если он запущен
sudo systemctl stop nginx

# Получите сертификат
sudo certbot certonly --standalone -d megapenis.work.gd -d www.megapenis.work.gd

# Следуйте инструкциям:
# - Введите email для уведомлений
# - Согласитесь с условиями (Y)
# - Выберите, хотите ли делиться email (N или Y)
```

## Шаг 3: Установка Nginx конфигурации

```bash
# Скопируйте конфигурацию
sudo cp nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd

# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/megapenis.work.gd /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию если нужно
sudo rm /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
sudo nginx -t

# Запустите nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Шаг 4: Настройка автообновления сертификата

```bash
# Certbot автоматически создаст cron job для обновления
# Проверьте, что он работает:
sudo certbot renew --dry-run

# Если всё ок, сертификат будет автоматически обновляться
```

## Шаг 5: Пересборка и запуск приложения

```bash
# Пересоберите frontend с новыми переменными окружения
cd frontend
npm run build

# Перезапустите backend
cd ../backend
npm run build
pm2 restart all

# Или если используете docker:
docker-compose down
docker-compose up -d --build
```

## Шаг 6: Проверка

Откройте в браузере:
- localhost - должен работать frontend
- localhost/api/health - должен вернуть статус API
- localhost/admin - админ панель

## Альтернатива: Если у вас нет доступа к серверу для установки Certbot

Используйте Cloudflare:

1. Зарегистрируйтесь на cloudflare.com
2. Добавьте домен megapenis.work.gd
3. Измените DNS серверы у регистратора на Cloudflare NS
4. В Cloudflare включите SSL/TLS (Full или Flexible)
5. Cloudflare автоматически выдаст SSL сертификат

В этом случае nginx конфигурация может быть упрощена (без SSL секции), так как Cloudflare будет обрабатывать HTTPS.

## Проблемы и решения

### Ошибка "Connection refused"
- Проверьте, что backend запущен на порту 3001: `netstat -tlnp | grep 3001`
- Проверьте, что frontend запущен на порту 3000: `netstat -tlnp | grep 3000`

### Ошибка "502 Bad Gateway"
- Backend не запущен или упал
- Проверьте логи: `sudo tail -f /var/log/nginx/megapenis-error.log`
- Проверьте логи backend: `pm2 logs` или `docker-compose logs backend`

### Mixed Content ошибки
- Убедитесь, что все URL в frontend/.env используют https://
- Пересоберите frontend: `npm run build`

### CORS ошибки
- Проверьте CORS_WHITELIST в backend/.env
- Должен содержать: `localhost`
