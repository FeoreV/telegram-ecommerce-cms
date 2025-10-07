#!/bin/bash

# =============================================================================
# Quick Commands Helper Script
# Telegram E-commerce CMS Platform
# =============================================================================

COMPOSE_FILE="config/docker/docker-compose.postgres-prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Telegram E-commerce - Quick Commands${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "Использование: $0 <команда>"
    echo ""
    echo "Команды управления:"
    echo "  status          - Показать статус всех сервисов"
    echo "  start           - Запустить все сервисы"
    echo "  stop            - Остановить все сервисы"
    echo "  restart         - Перезапустить все сервисы"
    echo "  restart <srv>   - Перезапустить конкретный сервис"
    echo ""
    echo "Логи:"
    echo "  logs            - Показать логи всех сервисов"
    echo "  logs <service>  - Показать логи конкретного сервиса"
    echo "  errors          - Показать только ошибки"
    echo ""
    echo "База данных:"
    echo "  db-connect      - Подключиться к PostgreSQL"
    echo "  db-backup       - Создать бэкап базы данных"
    echo "  db-restore      - Восстановить из бэкапа"
    echo "  db-migrate      - Запустить миграции"
    echo ""
    echo "Мониторинг:"
    echo "  stats           - Показать статистику контейнеров"
    echo "  health          - Проверить health всех сервисов"
    echo "  disk            - Показать использование диска"
    echo ""
    echo "Обслуживание:"
    echo "  cleanup         - Очистить неиспользуемые ресурсы"
    echo "  update          - Обновить приложение"
    echo "  rebuild         - Пересобрать все образы"
    echo ""
    echo "Примеры:"
    echo "  $0 logs backend"
    echo "  $0 restart bot"
    echo "  $0 db-backup"
    echo ""
}

case "$1" in
    # Управление сервисами
    status)
        echo -e "${BLUE}📊 Статус сервисов:${NC}"
        docker-compose -f $COMPOSE_FILE ps
        ;;

    start)
        echo -e "${GREEN}▶️  Запуск сервисов...${NC}"
        docker-compose -f $COMPOSE_FILE up -d
        echo -e "${GREEN}✅ Сервисы запущены${NC}"
        ;;

    stop)
        echo -e "${YELLOW}⏹️  Остановка сервисов...${NC}"
        docker-compose -f $COMPOSE_FILE down
        echo -e "${YELLOW}✅ Сервисы остановлены${NC}"
        ;;

    restart)
        if [ -z "$2" ]; then
            echo -e "${BLUE}🔄 Перезапуск всех сервисов...${NC}"
            docker-compose -f $COMPOSE_FILE restart
        else
            echo -e "${BLUE}🔄 Перезапуск сервиса: $2${NC}"
            docker-compose -f $COMPOSE_FILE restart $2
        fi
        echo -e "${GREEN}✅ Перезапуск завершен${NC}"
        ;;

    # Логи
    logs)
        if [ -z "$2" ]; then
            echo -e "${BLUE}📝 Логи всех сервисов:${NC}"
            docker-compose -f $COMPOSE_FILE logs -f --tail=100
        else
            echo -e "${BLUE}📝 Логи сервиса: $2${NC}"
            docker-compose -f $COMPOSE_FILE logs -f --tail=100 $2
        fi
        ;;

    errors)
        echo -e "${RED}❌ Поиск ошибок в логах:${NC}"
        docker-compose -f $COMPOSE_FILE logs | grep -i "error\|exception\|fail"
        ;;

    # База данных
    db-connect)
        echo -e "${BLUE}🗄️  Подключение к PostgreSQL...${NC}"
        docker-compose -f $COMPOSE_FILE exec postgres psql -U postgres -d telegram_ecommerce
        ;;

    db-backup)
        echo -e "${BLUE}💾 Создание бэкапа базы данных...${NC}"
        mkdir -p backups
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        docker-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U postgres telegram_ecommerce | \
            gzip > backups/backup_${TIMESTAMP}.sql.gz
        echo -e "${GREEN}✅ Бэкап создан: backups/backup_${TIMESTAMP}.sql.gz${NC}"
        ;;

    db-restore)
        echo -e "${YELLOW}⚠️  Восстановление базы данных${NC}"
        echo "Доступные бэкапы:"
        ls -lh backups/*.sql.gz
        read -p "Введите имя файла для восстановления: " backup_file

        if [ -f "backups/$backup_file" ]; then
            echo -e "${BLUE}🔄 Восстановление из: $backup_file${NC}"
            gunzip < "backups/$backup_file" | \
                docker-compose -f $COMPOSE_FILE exec -T postgres psql -U postgres -d telegram_ecommerce
            echo -e "${GREEN}✅ Восстановление завершено${NC}"
        else
            echo -e "${RED}❌ Файл не найден!${NC}"
        fi
        ;;

    db-migrate)
        echo -e "${BLUE}🗄️  Запуск миграций...${NC}"
        docker-compose -f $COMPOSE_FILE exec backend npx prisma migrate deploy
        echo -e "${GREEN}✅ Миграции выполнены${NC}"
        ;;

    # Мониторинг
    stats)
        echo -e "${BLUE}📊 Статистика контейнеров:${NC}"
        docker stats --no-stream
        ;;

    health)
        echo -e "${BLUE}🏥 Проверка health endpoints:${NC}"
        echo ""

        echo -n "Backend API: "
        if curl -sf http://82.147.84.78:3001/health > /dev/null; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi

        echo -n "Frontend: "
        if curl -sf http://82.147.84.78:3000 > /dev/null; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi

        echo -n "PostgreSQL: "
        if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi

        echo -n "Redis: "
        if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
        ;;

    disk)
        echo -e "${BLUE}💿 Использование диска:${NC}"
        echo ""
        echo "Система:"
        df -h /
        echo ""
        echo "Docker:"
        docker system df
        ;;

    # Обслуживание
    cleanup)
        echo -e "${YELLOW}🧹 Очистка неиспользуемых ресурсов...${NC}"
        docker system prune -f
        echo -e "${GREEN}✅ Очистка завершена${NC}"
        ;;

    update)
        echo -e "${BLUE}🔄 Обновление приложения...${NC}"
        git pull origin main
        ./scripts/deploy-production.sh
        ;;

    rebuild)
        echo -e "${BLUE}🔨 Пересборка всех образов...${NC}"
        docker-compose -f $COMPOSE_FILE build --no-cache
        docker-compose -f $COMPOSE_FILE up -d
        echo -e "${GREEN}✅ Пересборка завершена${NC}"
        ;;

    # Help
    help|--help|-h|"")
        show_help
        ;;

    *)
        echo -e "${RED}❌ Неизвестная команда: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

