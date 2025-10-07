# ⚡ Быстрая настройка HTTPS

## Два способа настройки HTTPS:

### 🟢 Способ 1: Caddy (РЕКОМЕНДУЕТСЯ - самый простой)

Caddy автоматически получает и обновляет SSL сертификаты. Настройка занимает 5 минут!

```bash
# На сервере
cd ~/telegram-ecommerce-cms
git pull
chmod +x scripts/setup-caddy.sh
sudo ./scripts/setup-caddy.sh
```

Скрипт спросит ваш домен и всё настроит автоматически!

---

### 🔵 Способ 2: Nginx (больше контроля)

Для продвинутых пользователей:

```bash
# На сервере
cd ~/telegram-ecommerce-cms
git pull
chmod +x scripts/setup-https.sh
sudo ./scripts/setup-https.sh
```

---

## Что вам нужно ПЕРЕД началом:

1. **Домен** - купите или используйте бесплатный (DuckDNS, FreeDNS)
2. **DNS настройки** - добавьте A записи:
   ```
   mystore.com          →  82.147.84.78
   www.mystore.com      →  82.147.84.78
   api.mystore.com      →  82.147.84.78
   ```
3. **Подождите** 5-60 минут пока DNS обновится

### Проверить DNS:
```bash
nslookup mystore.com
# Должно показать: 82.147.84.78
```

---

## После установки:

1. **Пересобрать приложения:**
```bash
# Backend
cd ~/telegram-ecommerce-cms/backend
npm run build
pm2 restart backend

# Frontend
cd ~/telegram-ecommerce-cms/frontend
npm run build
pm2 restart frontend
```

2. **Проверить что работает:**
```bash
# Должны увидеть замочек в браузере
firefox https://mystore.com
firefox https://api.mystore.com/health
```

---

## Полная документация:

- **HTTPS_SETUP_GUIDE.md** - подробное руководство
- **nginx-config-example.conf** - пример конфигурации Nginx
- **Caddyfile.example** - пример конфигурации Caddy

---

## Часто задаваемые вопросы:

### У меня нет домена
Используйте бесплатные сервисы:
- **DuckDNS** - https://www.duckdns.org (бесплатный поддомен)
- **FreeDNS** - https://freedns.afraid.org
- **No-IP** - https://www.noip.com

### Как проверить что SSL работает?
```bash
curl -I https://mystore.com
# Ищите: HTTP/2 200
```

Или откройте в браузере и проверьте наличие замочка 🔒

### Сертификат не обновляется автоматически

**Для Caddy:** Обновление автоматическое, проверьте логи:
```bash
journalctl -u caddy -f
```

**Для Nginx:**
```bash
# Проверить автообновление
sudo certbot renew --dry-run

# Статус таймера
sudo systemctl status certbot.timer
```

### CORS ошибки после включения HTTPS

Убедитесь что в `.env` все URL используют `https://`:
```bash
cd ~/telegram-ecommerce-cms/backend
nano .env

# Проверьте:
FRONTEND_URL=https://mystore.com
CORS_WHITELIST=https://mystore.com,https://api.mystore.com
```

Затем перезапустите:
```bash
npm run build
pm2 restart backend
```

---

## Безопасность

✅ После настройки HTTPS:
- Все данные шифруются
- Cookies работают корректно
- Telegram Login Widget работает
- Google индексирует сайт лучше
- Браузеры не показывают предупреждения

⚠️ **Не забудьте:**
- Обновить URL в Telegram Bot Settings
- Обновить URL в настройках платежей (если есть)
- Проверить webhook URL для Telegram

---

## Поддержка

Если что-то не работает:

1. **Проверьте логи:**
```bash
# Caddy
journalctl -u caddy -f

# Nginx
sudo tail -f /var/log/nginx/error.log

# Backend
pm2 logs backend

# Frontend
pm2 logs frontend
```

2. **Проверьте firewall:**
```bash
sudo ufw status
# Должны быть открыты порты 80 и 443
```

3. **Проверьте что сервисы запущены:**
```bash
pm2 status
sudo systemctl status nginx  # или caddy
```

---

**Готово!** 🎉 Ваш сайт теперь работает по HTTPS!

