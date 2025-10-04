# 📚 Документация Telegram E-commerce Bot Platform

Добро пожаловать в полную документацию платформы для создания многомагазинных e-commerce ботов в Telegram.

## 🎯 Быстрые ссылки

- ⚡ **[Быстрая справка](../QUICK_REFERENCE.md)** - Команды и ссылки одним взглядом
- 📖 **[Главный README](../README.md)** - Обзор проекта и быстрый старт
- 🐳 **[Docker Quick Start](../DOCKER_QUICK_START.md)** - Запуск через Docker
- 🏗️ **[Структура проекта](../PROJECT_STRUCTURE.md)** - Полная структура файлов
- 🤝 **[Contributing](../CONTRIBUTING.md)** - Руководство для контрибьюторов
- 🔒 **[Security](../SECURITY.md)** - Политика безопасности

## 🗂️ Структура документации

### 🔎 Обзор

- **[Overview](overview.md)** — краткий обзор платформы, ключевые ссылки и возможности

### 🚀 Начало работы (Development)

Документы для разработчиков, которые хотят начать работу с проектом:

- **[Quick Start с Docker](development/quick-start-docker.md)** - Быстрый запуск проекта через Docker
- **[Настройка окружения (.env)](development/environment-setup.md)** - Подробная настройка переменных окружения
- **[Руководство для разработчиков](development/dev-quickstart.md)** - Полное руководство по разработке
- **[Статус разработки](development/development-status.md)** - Текущее состояние проекта
- **[Plan миграции](development/migration-plan.md)** - План развития и миграций
- **[Обработка 404 ошибок](development/404-handling-test-plan.md)** - План тестирования ошибок
- **[Конструктор ботов](development/bot-constructor-guide.md)** - Создание собственных ботов
- **[Real-time функции](development/realtime-features.md)** - WebSocket и уведомления
- **[Настройка XAMPP](development/xampp-setup.md)** - Локальная разработка с XAMPP
- **[Админ-панель](development/admin-panel-complete.md)** - Работа с админ-панелью
- **[Исправление аутентификации](development/fix-auth-issue.md)** - Решение проблем с авторизацией
- **[Итоги проекта](development/project-completion-summary.md)** - Резюме по завершенным задачам

### 🏗️ Архитектура (Architecture)

Документы описывающие архитектуру и устройство системы:

- **[Структура проекта](architecture/project-structure.md)** - Организация кода и файлов
- **[Архитектура админ-панели](architecture/admin-architecture.md)** - Устройство админ-интерфейса
- **[CMS архитектура](architecture/cms-architecture.md)** - Интеграция с внешними CMS
- **[P2P CMS интеграция](architecture/p2p-cms-integration.md)** - Прямая интеграция с CMS товарами

### 🚀 Развертывание (Deployment)

Документы для деплоя и настройки продакшен-окружения:

- **[Docker Setup](deployment/docker-setup.md)** - Полная настройка Docker окружения
- **[Monitoring](deployment/monitoring.md)** - Сводное руководство по Prometheus и Grafana
- **[Docker Troubleshooting](deployment/docker-troubleshooting.md)** - Частые проблемы и решения
- **[Production Deployment](deployment/production-deployment.md)** - Развертывание в продакшене
- **[Миграция на MySQL](deployment/migrate-to-mysql.md)** - Переход с SQLite на MySQL
- **[Настройка Telegram бота](deployment/telegram-bot-setup.md)** - Конфигурация Telegram бота
- **[Vault Setup](deployment/vault-setup-guide.md)** - Настройка HashiCorp Vault
- **[Безопасность](deployment/security.md)** - Рекомендации по безопасности
- **[Инструкции по входу](deployment/login-instructions.md)** - Доступ к системе
- **[Вход владельца](deployment/owner-login-guide.md)** - Доступ для владельцев магазинов

### 🔒 Безопасность (Security)

Документы по безопасности и защите данных:

- **[Статус реализации безопасности](security/implementation-status.md)** - Текущий статус системы безопасности
- **[Обзор архитектуры безопасности](security/security-architecture-overview.md)** - Общая архитектура защиты
- **[Иерархия ключей](security/key-hierarchy-specification.md)** - Система управления ключами шифрования
- **[Disaster Recovery](security/disaster-recovery-documentation.md)** - План восстановления после сбоев
- **[Penetration Testing](security/penetration-testing-guide.md)** - Руководство по тестированию на проникновение
- **[Краткий справочник](security/quick-reference-guide.md)** - Быстрые команды и чеклисты
- **[Изоляция скомпрометированного сервера](security/server-compromise-containment.md)** - Действия при взломе
- **[Сводка реализации](security/implementation-summary.md)** - Итоги внедрения систем безопасности

### 📡 API

Документы по API и интеграциям:

- **[Примеры конфигурации API](api/config-api-examples.md)** - Примеры работы с API
- **[Telegram Store Integration](api/telegram-store-integration.md)** - Интеграция с Telegram магазинами

## 🎯 Быстрые ссылки

### Для AI/автоматизации
- [AI Index](ai/index.md)
- [RBAC](ai/rbac.md)
- [Data models](ai/data-models.md)
- [Order flow](ai/order-flow.md)
- [Telegram integration](ai/telegram.md)

### Для новых разработчиков
1. [Quick Start с Docker](development/quick-start-docker.md)
2. [Настройка окружения](development/environment-setup.md)
3. [Структура проекта](architecture/project-structure.md)

### Для DevOps
1. [Docker Setup](deployment/docker-setup.md)
2. [Monitoring](deployment/monitoring.md)
3. [Docker Troubleshooting](deployment/docker-troubleshooting.md)
4. [Production Deployment](deployment/production-deployment.md)
5. [Безопасность](deployment/security.md)

### Для Security Engineers
1. [Security Architecture](security/security-architecture-overview.md)
2. [Key Hierarchy](security/key-hierarchy-specification.md)
3. [Disaster Recovery](security/disaster-recovery-documentation.md)

## 📖 Дополнительные ресурсы

- Обзор проекта теперь смотрите в: [docs/overview.md](overview.md)
- **[Docker конфигурации](../config/docker/README.md)** - Docker Compose файлы
- **[Tools](../tools/README.md)** - Утилиты и вспомогательные скрипты

## 🤝 Участие в проекте

Если вы нашли ошибку в документации или хотите что-то улучшить:
1. Создайте issue с описанием проблемы
2. Или отправьте pull request с исправлениями

## 📝 Лицензия

Подробности см. в корневом файле LICENSE проекта.

---

*Последнее обновление: Сентябрь 2025*
