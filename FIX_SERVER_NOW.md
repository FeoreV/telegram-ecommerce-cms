# 🔥 СРОЧНО: Исправление git pull на сервере

## Проблема
```
error: Your local changes to the following files would be overwritten by merge:
        backend/.env
        bot/.env
```

## ✅ РЕШЕНИЕ (Скопируй и выполни на сервере):

### Вариант 1: Автоматический (РЕКОМЕНДУЕТСЯ)

Выполни эти команды **по очереди** на сервере:

```bash
# 1. Перейди в директорию проекта
cd ~/telegram-ecommerce-cms

# 2. Создай бэкап .env файлов
mkdir -p backups
cp backend/.env backups/backend.env.backup.$(date +%s)
cp bot/.env backups/bot.env.backup.$(date +%s) 2>/dev/null || true
cp frontend/.env backups/frontend.env.backup.$(date +%s) 2>/dev/null || true

# 3. Сбрось изменения в логах (они не важны)
git checkout HEAD -- backend/logs/audit.json 2>/dev/null || true
git checkout HEAD -- bot/logs/bot-combined.log 2>/dev/null || true
git checkout HEAD -- bot/logs/bot-error.log 2>/dev/null || true

# 4. Временно спрячь .env файлы
git stash

# 5. Обнови код
git pull origin main

# 6. Верни .env файлы обратно
cp backups/backend.env.backup.* backend/.env
cp backups/bot.env.backup.* bot/.env 2>/dev/null || true
cp backups/frontend.env.backup.* frontend/.env 2>/dev/null || true

# 7. Обнови .gitignore чтобы это не повторялось
cat >> .gitignore << 'EOF'
backend/.env
frontend/.env
bot/.env
backend/logs/*.log
backend/logs/*.json
bot/logs/*.log
EOF

echo "✅ Git pull успешно выполнен!"
```

### Вариант 2: Используй скрипт (если уже скачал обновления)

```bash
cd ~/telegram-ecommerce-cms

# Сделай скрипт исполняемым
chmod +x scripts/safe-git-pull.sh

# Запусти
./scripts/safe-git-pull.sh
```

---

## 🔄 После успешного git pull:

### Пересобери и перезапусти приложения:

```bash
# Backend
cd ~/telegram-ecommerce-cms/backend
npm install
npm run build
pm2 restart backend

# Frontend
cd ~/telegram-ecommerce-cms/frontend
npm install
npm run build
pm2 restart frontend

# Проверь что всё работает
pm2 status
pm2 logs backend --lines 10
```

---

## 🚀 Полное обновление сервера (одна команда):

В следующий раз просто используй:

```bash
cd ~/telegram-ecommerce-cms
chmod +x scripts/server-update.sh
./scripts/server-update.sh
```

Этот скрипт сделает ВСЁ автоматически:
- ✅ Безопасный git pull
- ✅ Установит зависимости
- ✅ Соберёт проект
- ✅ Перезапустит сервисы

---

## ❓ Что-то пошло не так?

### Если потерял .env файл:
```bash
# Проверь бэкапы
ls -la backups/

# Восстанови из последнего бэкапа
cp backups/backend.env.backup.* backend/.env
```

### Если нет бэкапа .env:
Используй пример конфигурации:
```bash
cp config/environments/env.production.example backend/.env
nano backend/.env  # Отредактируй под свои данные
```

### Если PM2 не работает:
```bash
# Установи PM2
npm install -g pm2

# Запусти сервисы
cd backend && npm run start &
```

---

## 📖 Подробная документация:

Читай: `SERVER_UPDATE_INSTRUCTIONS.md`

---

**Успехов!** 🎉

