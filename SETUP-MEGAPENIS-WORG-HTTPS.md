# Настройка HTTPS для megapenis.worg.gd

## Шаг 1: Установка Certbot (если еще не установлен)

```bash
# Для Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

## Шаг 2: Получение SSL сертификата

```bash
# Остановите nginx если он запущен
sudo systemctl stop nginx

# Получите сертификат для нового домена
sudo certbot certonly --standalone -d megapenis.worg.gd -d www.megapenis.worg.gd

# Или если nginx уже настроен и запущен:
sudo certbot --nginx -d megapenis.worg.gd -d www.megapenis.worg.gd
```

## Шаг 3: Копирование конфигурации nginx

```bash
# Скопируйте конфиг в директорию nginx
sudo cp nginx-megapenis.worg.gd.conf /etc/nginx/sites-available/megapenis.worg.gd

# Создайте символическую ссылку
sudo ln -sf /etc/nginx/sites-available/megapenis.worg.gd /etc/nginx/sites-enabled/

# Удалите старый конфиг если он есть
sudo rm -f /etc/nginx/sites-enabled/megapenis.work.gd
sudo rm -f /etc/nginx/sites-enabled/default
```

## Шаг 4: Проверка и перезапуск nginx

```bash
# Проверьте конфигурацию
sudo nginx -t

# Если все ок, перезапустите nginx
sudo systemctl restart nginx

# Проверьте статус
sudo systemctl status nginx
```

## Шаг 5: Настройка автообновления сертификата

```bash
# Проверьте, что автообновление работает
sudo certbot renew --dry-run

# Certbot автоматически добавляет задачу в cron для обновления
```

## Шаг 6: Пересборка и перезапуск приложения

```bash
# Перейдите в директорию проекта
cd /root/telegram-ecommerce-cms

# Пересоберите frontend с новыми переменными окружения
cd frontend
npm run build

# Перезапустите backend
cd ../backend
pm2 restart all

# Или если используете systemd
sudo systemctl restart telegram-cms-backend
```

## Проверка работы

1. Откройте https://megapenis.worg.gd в браузере
2. Проверьте, что SSL сертификат валидный (зеленый замок)
3. Проверьте API: https://megapenis.worg.gd/api/health
4. Проверьте WebSocket соединение в консоли браузера

## Важные файлы обновлены:

- ✅ `.env` - обновлены URL на https://megapenis.worg.gd
- ✅ `backend/.env` - обновлены FRONTEND_URL и CORS_WHITELIST
- ✅ `frontend/.env` - обновлены VITE_API_URL и VITE_SOCKET_URL
- ✅ `nginx-megapenis.worg.gd.conf` - новый конфиг для домена

## Troubleshooting

### Если nginx не запускается:
```bash
# Проверьте логи
sudo tail -f /var/log/nginx/error.log

# Проверьте синтаксис
sudo nginx -t
```

### Если SSL сертификат не получается:
```bash
# Убедитесь, что домен указывает на ваш сервер
nslookup megapenis.worg.gd

# Проверьте, что порты 80 и 443 открыты
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Если WebSocket не работает:
```bash
# Проверьте, что backend запущен
pm2 status

# Проверьте логи backend
pm2 logs

# Проверьте nginx логи
sudo tail -f /var/log/nginx/megapenis-worg-error.log
```
