# 🚀 Быстрый деплой - исправление всех ошибок

## Что исправлено:

✅ **require() в ErrorBoundary** - заменен на ES6 import  
✅ **500 ошибка на /api/health** - создан упрощенный health endpoint  
✅ **Nginx конфигурация** - настроена отдача статических файлов  

## Команды для выполнения на сервере:

```bash
# 1. Перейти в директорию проекта
cd /root/telegram-ecommerce-cms

# 2. Получить последние изменения
git pull

# 3. Установить зависимости (если нужно)
cd backend
npm install
cd ..

# 4. Собрать бэкенд
cd backend
npm run build
cd ..

# 5. Собрать фронтенд
cd frontend
npm run build
cd ..

# 6. Обновить nginx конфигурацию
sudo cp nginx-megapenis.work.gd.conf /etc/nginx/sites-available/megapenis.work.gd.conf

# 7. Проверить nginx
sudo nginx -t

# 8. Перезагрузить nginx
sudo systemctl reload nginx

# 9. Перезапустить бэкенд
pm2 restart telegram-backend || (cd backend && pm2 start npm --name "telegram-backend" -- start)

# 10. Проверить статус
pm2 status
```

## Или используйте скрипт автоматического деплоя:

```bash
cd /root/telegram-ecommerce-cms
chmod +x deploy-production.sh
./deploy-production.sh
```

## Проверка после деплоя:

### 1. Проверьте health endpoint:
```bash
curl http://localhost:3001/api/health
```

Должен вернуть:
```json
{
  "status": "OK",
  "timestamp": "2025-10-22T...",
  "uptime": 123,
  "version": "1.0.0",
  "environment": "production",
  "system": { ... }
}
```

### 2. Проверьте фронтенд:
```bash
curl -I https://megapenis.work.gd
```

Должен вернуть `200 OK` и `Content-Type: text/html`

### 3. Проверьте API через nginx:
```bash
curl https://megapenis.work.gd/api/health
```

### 4. Проверьте CSRF token:
```bash
curl https://megapenis.work.gd/api/csrf-token
```

### 5. Откройте в браузере:
```
https://megapenis.work.gd
```

Не должно быть ошибок в консоли браузера.

## Если что-то не работает:

### Проверьте логи бэкенда:
```bash
pm2 logs telegram-backend --lines 100
```

### Проверьте логи nginx:
```bash
sudo tail -f /var/log/nginx/megapenis-error.log
```

### Проверьте, что бэкенд слушает порт 3001:
```bash
sudo netstat -tlnp | grep 3001
```

### Проверьте, что фронтенд собран:
```bash
ls -la /root/telegram-ecommerce-cms/frontend/dist/
```

Должны быть файлы: `index.html`, `assets/`, и т.д.

### Если бэкенд не запускается:
```bash
cd /root/telegram-ecommerce-cms/backend

# Проверьте .env файл
cat .env | grep -E "DATABASE_URL|PORT|NODE_ENV"

# Попробуйте запустить вручную
npm start
```

### Если фронтенд не собирается:
```bash
cd /root/telegram-ecommerce-cms/frontend

# Очистите кэш и пересоберите
rm -rf node_modules dist
npm install
npm run build
```

## Ожидаемый результат:

После выполнения всех команд:

1. ✅ Сайт https://megapenis.work.gd открывается без ошибок
2. ✅ В консоли браузера нет ошибок `require is not defined`
3. ✅ API `/api/health` возвращает 200 OK
4. ✅ API `/api/csrf-token` возвращает токен
5. ✅ WebSocket подключается (если бэкенд запущен)
6. ✅ Статические файлы загружаются быстро (кэшируются)

## Дополнительно - настройка автоматического деплоя:

Создайте systemd service для автоматического запуска:

```bash
sudo nano /etc/systemd/system/telegram-backend.service
```

Содержимое:
```ini
[Unit]
Description=Telegram E-commerce Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/telegram-ecommerce-cms/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-backend
sudo systemctl start telegram-backend
sudo systemctl status telegram-backend
```

Теперь бэкенд будет автоматически запускаться при перезагрузке сервера.
