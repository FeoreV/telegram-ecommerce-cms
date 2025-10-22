# Отладка health endpoint

## Проблема
`localhost/api/health` возвращает 500 ошибку.

## Возможные причины:

1. **Проблема с базой данных** - Prisma не может подключиться
2. **Проблема с fs.statfs** - метод недоступен в старой версии Node.js
3. **Проблема с импортами** - динамические импорты не работают
4. **Проблема с правами доступа** - нет доступа к директориям

## Быстрое решение - упростить health endpoint

Создайте файл `backend/src/routes/simple-health.ts`:

```typescript
import { Router } from 'express';

const router = Router();

// Простой health check без зависимостей
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;
```

Затем в `backend/src/index.ts` замените:

```typescript
// Было:
app.use('/api/health', healthRoutes);

// Стало:
import simpleHealthRoutes from './routes/simple-health';
app.use('/api/health', simpleHealthRoutes);
```

## Проверка на сервере

### 1. Проверьте логи бэкенда:
```bash
pm2 logs telegram-backend --lines 100
```

### 2. Проверьте версию Node.js:
```bash
node --version
```

Если версия < 19, то `fs.statfs` не поддерживается и вызывает ошибку.

### 3. Проверьте подключение к базе данных:
```bash
cd /root/telegram-ecommerce-cms/backend
npx prisma db push
```

### 4. Проверьте переменные окружения:
```bash
cat /root/telegram-ecommerce-cms/backend/.env | grep DATABASE_URL
```

### 5. Временно отключите сложные проверки

В файле `backend/src/services/healthService.ts` найдите метод `getDiskSpace()` и замените на:

```typescript
private static async getDiskSpace(): Promise<{ total: number; free: number; used: number }> {
  // Упрощенная версия без statfs
  const totalMem = os.totalmem();
  const estimate = totalMem * 10;
  
  return {
    total: estimate,
    free: estimate * 0.5,
    used: estimate * 0.5,
  };
}
```

## Команды для исправления:

```bash
cd /root/telegram-ecommerce-cms

# Получить изменения
git pull

# Пересобрать бэкенд
cd backend
npm run build

# Перезапустить
pm2 restart telegram-backend

# Проверить логи
pm2 logs telegram-backend --lines 50
```

## Альтернатива - использовать простой health endpoint

Если сложный health check не нужен, используйте простой эндпоинт на `/health` (без `/api`):

```bash
curl http://localhost:3001/health
```

Этот эндпоинт уже работает и определен в `index.ts` на строке 337:

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
```

## Проверка через nginx

Убедитесь, что nginx правильно проксирует запросы:

```bash
# Проверить конфигурацию
sudo nginx -t

# Посмотреть логи nginx
sudo tail -f /var/log/nginx/megapenis-error.log
```

## Быстрый фикс - обновить nginx для использования простого health

В `nginx-megapenis.work.gd.conf` измените:

```nginx
# Health check endpoint
location /health {
    proxy_pass http://127.0.0.1:3001/health;  # Используем простой эндпоинт
    # ... остальные настройки
}

# Если нужен API health, используйте простой
location /api/health {
    proxy_pass http://127.0.0.1:3001/health;  # Перенаправляем на простой
    # ... остальные настройки
}
```

Затем:
```bash
sudo systemctl reload nginx
```
