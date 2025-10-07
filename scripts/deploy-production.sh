#!/bin/bash

# =============================================================================
# Production Deployment Script for Telegram E-commerce Platform
# =============================================================================

# SECURITY FIX: Enhanced error handling (CWE-754)
# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Trap errors and cleanup
trap 'error_handler $? $LINENO' ERR
trap cleanup EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
COMPOSE_FILE="config/docker/docker-compose.postgres-prod.yml"
ENV_FILE=".env.production"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Error handler function
error_handler() {
    local exit_code=$1
    local line_number=$2
    print_error "Error occurred in script at line $line_number with exit code $exit_code"
    cleanup
}

# Cleanup function
cleanup() {
    # Add cleanup logic here if needed
    # For example: remove temporary files, restore backups on failure, etc.
    :
}

# Check prerequisites
check_prerequisites() {
    print_header "Проверка предварительных условий"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker не установлен!"
        exit 1
    fi
    print_success "Docker установлен"

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose не установлен!"
        exit 1
    fi
    print_success "Docker Compose установлен"

    # Check if .env.production exists
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Файл $ENV_FILE не найден!"
        print_info "Создайте его из шаблона: cp env.production.example .env.production"
        exit 1
    fi
    print_success "Файл окружения найден"

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Docker Compose файл не найден: $COMPOSE_FILE"
        exit 1
    fi
    print_success "Docker Compose конфигурация найдена"
}

# Create backup
create_backup() {
    print_header "Создание резервной копии"

    mkdir -p "$BACKUP_DIR"

    # Check if database container exists and is running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "postgres.*Up"; then
        print_info "Создание бэкапа базы данных..."

        # Load environment variables
        export $(cat $ENV_FILE | grep -v '^#' | xargs)

        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-telegram_ecommerce}" \
            > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

        # Compress backup
        gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

        print_success "Бэкап создан: db_backup_$TIMESTAMP.sql.gz"
    else
        print_warning "База данных не запущена, бэкап не создан"
    fi
}

# Build images
build_images() {
    print_header "Сборка Docker образов"

    export $(cat $ENV_FILE | grep -v '^#' | xargs)

    print_info "Сборка образов..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache

    print_success "Образы успешно собраны"
}

# Run database migrations
run_migrations() {
    print_header "Выполнение миграций базы данных"

    export $(cat $ENV_FILE | grep -v '^#' | xargs)

    print_info "Запуск миграций..."
    docker-compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy

    print_success "Миграции выполнены"
}

# Start services
start_services() {
    print_header "Запуск сервисов"

    export $(cat $ENV_FILE | grep -v '^#' | xargs)

    print_info "Остановка старых контейнеров..."
    docker-compose -f "$COMPOSE_FILE" down

    print_info "Запуск новых контейнеров..."
    docker-compose -f "$COMPOSE_FILE" up -d

    print_success "Сервисы запущены"
}

# Health checks
run_health_checks() {
    print_header "Проверка работоспособности сервисов"

    export $(cat $ENV_FILE | grep -v '^#' | xargs)

    print_info "Ожидание запуска сервисов (30 секунд)..."
    sleep 30

    # Check PostgreSQL
    print_info "Проверка PostgreSQL..."
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; then
        print_success "PostgreSQL работает"
    else
        print_error "PostgreSQL не отвечает"
    fi

    # Check Redis
    print_info "Проверка Redis..."
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis работает"
    else
        print_error "Redis не отвечает"
    fi

    # Check Backend
    print_info "Проверка Backend..."
    if docker-compose -f "$COMPOSE_FILE" exec -T backend curl -f http://82.147.84.78:3001/health > /dev/null 2>&1; then
        print_success "Backend работает"
    else
        print_warning "Backend не отвечает (может потребоваться больше времени)"
    fi

    # Show service status
    print_info "Статус сервисов:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Cleanup old images
cleanup() {
    print_header "Очистка старых образов"

    print_info "Удаление неиспользуемых образов..."
    docker image prune -f

    print_success "Очистка завершена"
}

# Show deployment summary
show_summary() {
    print_header "Сводка деплоя"

    export $(cat $ENV_FILE | grep -v '^#' | xargs)

    echo ""
    print_info "Сервисы доступны по адресам:"
    echo "  🌐 Frontend: http://82.147.84.78:${FRONTEND_PORT:-3000}"
    echo "  🔧 Backend API: http://82.147.84.78:${BACKEND_PORT:-3001}"
    echo "  🤖 Bot Webhook: Port ${BOT_WEBHOOK_PORT:-8443}"
    echo "  📊 Grafana: http://82.147.84.78:${GRAFANA_PORT:-3030}"
    echo "  📈 Prometheus: http://82.147.84.78:${PROMETHEUS_PORT:-9090}"
    echo "  🔍 Kibana: http://82.147.84.78:${KIBANA_PORT:-5601}"
    echo ""
    print_info "Полезные команды:"
    echo "  Логи всех сервисов:    docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Логи backend:          docker-compose -f $COMPOSE_FILE logs -f backend"
    echo "  Логи bot:              docker-compose -f $COMPOSE_FILE logs -f bot"
    echo "  Статус сервисов:       docker-compose -f $COMPOSE_FILE ps"
    echo "  Остановить все:        docker-compose -f $COMPOSE_FILE down"
    echo ""
}

# Main deployment flow
main() {
    print_header "🚀 Запуск деплоя в production"

    # Parse arguments
    SKIP_BACKUP=false
    SKIP_BUILD=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --help)
                echo "Использование: $0 [опции]"
                echo ""
                echo "Опции:"
                echo "  --skip-backup    Пропустить создание бэкапа"
                echo "  --skip-build     Пропустить пересборку образов"
                echo "  --help           Показать эту справку"
                exit 0
                ;;
            *)
                print_error "Неизвестная опция: $1"
                exit 1
                ;;
        esac
    done

    # Confirmation
    echo ""
    print_warning "Вы собираетесь задеплоить приложение в PRODUCTION!"
    read -p "Продолжить? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        print_info "Деплой отменен"
        exit 0
    fi

    # Run deployment steps
    check_prerequisites

    if [ "$SKIP_BACKUP" = false ]; then
        create_backup
    else
        print_warning "Бэкап пропущен (--skip-backup)"
    fi

    if [ "$SKIP_BUILD" = false ]; then
        build_images
    else
        print_warning "Сборка образов пропущена (--skip-build)"
    fi

    run_migrations
    start_services
    run_health_checks
    cleanup
    show_summary

    print_header "✅ Деплой успешно завершен!"
}

# Run main function
main "$@"

