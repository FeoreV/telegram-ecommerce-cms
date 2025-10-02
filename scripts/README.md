# 📜 Скрипты проекта

Организованные скрипты для управления проектом BotRT.

## 📁 Структура

```
scripts/
├── docker/          # Docker-скрипты
│   ├── dev.bat/sh                      # Запуск в режиме разработки
│   ├── dev-stop.bat/sh                 # Остановка dev-окружения
│   ├── start.bat/sh                    # Запуск production
│   ├── start-with-monitoring.bat/sh    # Запуск с мониторингом
│   ├── prod.sh                         # Production deployment
│   ├── rebuild-all.bat/ps1             # Пересборка всех контейнеров
│   └── health-check.js                 # Проверка здоровья контейнеров
│
├── monitoring/      # Скрипты мониторинга
│   ├── start.bat/sh                    # Запуск Prometheus + Grafana
│   └── stop.bat/sh                     # Остановка мониторинга
│
└── utils/           # Утилиты
    ├── check-docker.bat/ps1            # Проверка установки Docker
    └── check-monitoring.bat/sh         # Проверка статуса мониторинга
```

## 🚀 Основные команды

### Docker - Разработка

```bash
# Windows
.\scripts\docker\dev.bat

# Linux/Mac
./scripts/docker/dev.sh
```

### Docker - Production

```bash
# Windows
.\scripts\docker\start.bat

# Linux/Mac
./scripts/docker/start.sh
```

### Docker - С мониторингом

```bash
# Windows
.\scripts\docker\start-with-monitoring.bat

# Linux/Mac
./scripts/docker/start-with-monitoring.sh
```

### Мониторинг

```bash
# Запуск
# Windows: .\scripts\monitoring\start.bat
# Linux/Mac: ./scripts/monitoring/start.sh

# Остановка
# Windows: .\scripts\monitoring\stop.bat
# Linux/Mac: ./scripts/monitoring/stop.sh
```

### Утилиты

```bash
# Проверка Docker
# Windows: .\scripts\utils\check-docker.bat
# Linux/Mac: .\scripts\utils\check-docker.ps1

# Проверка мониторинга
# Windows: .\scripts\utils\check-monitoring.bat
# Linux/Mac: ./scripts/utils/check-monitoring.sh
```

## 📝 Описание скриптов

### Docker

| Скрипт | Описание |
|--------|----------|
| `dev.bat/sh` | Запускает проект в режиме разработки с hot-reload |
| `dev-stop.bat/sh` | Останавливает dev-окружение |
| `start.bat/sh` | Запускает production версию |
| `start-with-monitoring.bat/sh` | Запускает с Prometheus и Grafana |
| `prod.sh` | Production deployment скрипт |
| `rebuild-all.bat/ps1` | Пересобирает все Docker образы |
| `health-check.js` | Проверяет здоровье всех контейнеров |

### Мониторинг

| Скрипт | Описание |
|--------|----------|
| `start.bat/sh` | Запускает Prometheus и Grafana |
| `stop.bat/sh` | Останавливает мониторинг |

### Утилиты

| Скрипт | Описание |
|--------|----------|
| `check-docker.bat/ps1` | Проверяет установку и версию Docker |
| `check-monitoring.bat/sh` | Проверяет статус мониторинга |

## 💡 Подсказки

### Сделать скрипты исполняемыми (Linux/Mac)

```bash
chmod +x scripts/docker/*.sh
chmod +x scripts/monitoring/*.sh
chmod +x scripts/utils/*.sh
```

### Использование из корня проекта

Все скрипты можно вызывать из корня проекта:

```bash
# Windows
.\scripts\docker\dev.bat

# Linux/Mac
./scripts/docker/dev.sh
```

### Альтернатива через pnpm

Вместо прямого вызова скриптов, используйте команды из корневого `package.json`:

```bash
pnpm dev              # Запуск через pnpm
pnpm compose:up       # Docker Compose up
```

## 🔧 Разработка

При добавлении новых скриптов:

1. Размещайте их в соответствующей категории
2. Создавайте версии для Windows (.bat/.ps1) и Linux/Mac (.sh)
3. Обновляйте этот README
4. Документируйте параметры и примеры использования

---

**Все скрипты готовы к использованию!** 🚀

