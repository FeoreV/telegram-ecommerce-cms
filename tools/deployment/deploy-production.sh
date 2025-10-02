#!/bin/bash

# =============================================================================
# Production Deployment Script for Telegram E-commerce Bot Platform
# Automated deployment with health checks and rollback capabilities
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Deployment settings
PROJECT_NAME="telegram-ecommerce"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE="env.production.example"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment.log"

# Health check settings
HEALTH_CHECK_TIMEOUT=300
HEALTH_CHECK_INTERVAL=10

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local colored_message=""
    
    case $level in
        "INFO")
            colored_message="${BLUE}[INFO]${NC} ${message}"
            ;;
        "SUCCESS")
            colored_message="${GREEN}[SUCCESS]${NC} ${message}"
            ;;
        "WARNING")
            colored_message="${YELLOW}[WARNING]${NC} ${message}"
            ;;
        "ERROR")
            colored_message="${RED}[ERROR]${NC} ${message}"
            ;;
        *)
            colored_message="[${level}] ${message}"
            ;;
    esac
    
    echo -e "$colored_message"
    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
}

log_info() {
    log "INFO" "$1"
}

log_success() {
    log "SUCCESS" "$1"
}

log_warning() {
    log "WARNING" "$1"
}

log_error() {
    log "ERROR" "$1"
}

# =============================================================================
# Utility Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Required commands
    local required_commands="docker docker-compose git curl"
    for cmd in $required_commands; do
        if ! command -v $cmd > /dev/null 2>&1; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check required files exist
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file not found: $ENV_FILE"
        log_info "You may need to create .env.production file"
    fi
    
    # Create required directories
    mkdir -p logs backups config/{nginx,ssl,grafana,prometheus}
    
    log_success "Prerequisites check passed"
}

backup_current_deployment() {
    log_info "Creating backup of current deployment..."
    
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="${PROJECT_NAME}_backup_${backup_timestamp}"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR/$backup_name"
    
    # Backup database if running
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "Backing up PostgreSQL database..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U postgres telegram_ecommerce > "$BACKUP_DIR/$backup_name/database.sql" || {
            log_warning "Database backup failed, continuing anyway"
        }
    fi
    
    # Backup docker volumes
    log_info "Backing up Docker volumes..."
    docker run --rm -v "${PROJECT_NAME,,}_postgres_data":/source -v "$(pwd)/$BACKUP_DIR/$backup_name":/backup alpine tar czf /backup/postgres_data.tar.gz -C /source . || {
        log_warning "Postgres volume backup failed, continuing anyway"
    }
    
    # Backup configuration files
    log_info "Backing up configuration..."
    cp -r config "$BACKUP_DIR/$backup_name/" 2>/dev/null || true
    cp .env.* "$BACKUP_DIR/$backup_name/" 2>/dev/null || true
    
    echo "$backup_name" > "$BACKUP_DIR/latest_backup"
    
    log_success "Backup created: $backup_name"
}

pull_latest_images() {
    log_info "Pulling latest Docker images..."
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" pull; then
        log_success "Docker images pulled successfully"
    else
        log_error "Failed to pull Docker images"
        exit 1
    fi
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    local attempt=1
    local max_attempts=30
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            log_success "Database is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Database failed to become ready"
            return 1
        fi
        
        log_info "Database not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    # Run Prisma migrations
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T backend npx prisma migrate deploy; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        return 1
    fi
}

start_services() {
    log_info "Starting services..."
    
    # Start infrastructure services first
    log_info "Starting infrastructure services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis
    
    # Wait for infrastructure
    sleep 30
    
    # Start application services
    log_info "Starting application services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d backend bot
    
    # Wait for application services
    sleep 30
    
    # Start frontend and proxy
    log_info "Starting frontend and proxy services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d frontend nginx
    
    # Start monitoring services
    log_info "Starting monitoring services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d prometheus grafana elasticsearch logstash kibana
    
    log_success "All services started"
}

health_check() {
    log_info "Performing health checks..."
    
    local services=("backend:3001/health" "bot:8443/health" "frontend:80")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        local service_name=$(echo "$service" | cut -d: -f1)
        local health_url="http://localhost:$(echo "$service" | cut -d: -f2)"
        
        log_info "Checking $service_name health..."
        
        local attempt=1
        local healthy=false
        
        while [ $attempt -le $((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL)) ]; do
            if curl -sf "$health_url" > /dev/null 2>&1; then
                log_success "$service_name is healthy"
                healthy=true
                break
            fi
            
            log_info "$service_name not ready, waiting... (attempt $attempt)"
            sleep $HEALTH_CHECK_INTERVAL
            attempt=$((attempt + 1))
        done
        
        if [ "$healthy" = false ]; then
            log_error "$service_name health check failed"
            all_healthy=false
        fi
    done
    
    # Additional checks
    log_info "Checking database connectivity..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T backend node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect().then(() => {
            console.log('Database connected');
            process.exit(0);
        }).catch((e) => {
            console.error('Database connection failed:', e);
            process.exit(1);
        });
    "; then
        log_success "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        all_healthy=false
    fi
    
    if [ "$all_healthy" = true ]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "Some health checks failed"
        return 1
    fi
}

run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Test API endpoints
    local api_tests=(
        "GET /health"
        "GET /api/auth/status"
        "GET /api/stores"
    )
    
    for test in "${api_tests[@]}"; do
        local method=$(echo "$test" | cut -d' ' -f1)
        local endpoint=$(echo "$test" | cut -d' ' -f2)
        local url="http://localhost:3001$endpoint"
        
        log_info "Testing: $method $endpoint"
        
        if [ "$method" = "GET" ]; then
            if curl -sf "$url" > /dev/null 2>&1; then
                log_success "✓ $test"
            else
                log_warning "✗ $test (may require authentication)"
            fi
        fi
    done
    
    # Test webhook endpoint
    log_info "Testing webhook endpoint..."
    if curl -sf "http://localhost:8443/webhook/health" > /dev/null 2>&1; then
        log_success "✓ Webhook endpoint accessible"
    else
        log_warning "✗ Webhook endpoint test failed"
    fi
    
    log_success "Smoke tests completed"
}

rollback_deployment() {
    log_error "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Restore from backup if available
    if [ -f "$BACKUP_DIR/latest_backup" ]; then
        local backup_name=$(cat "$BACKUP_DIR/latest_backup")
        log_info "Restoring from backup: $backup_name"
        
        # Restore database
        if [ -f "$BACKUP_DIR/$backup_name/database.sql" ]; then
            log_info "Restoring database..."
            docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres
            sleep 30
            docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS telegram_ecommerce;"
            docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U postgres -c "CREATE DATABASE telegram_ecommerce;"
            docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U postgres telegram_ecommerce < "$BACKUP_DIR/$backup_name/database.sql"
        fi
        
        # Restore volumes
        if [ -f "$BACKUP_DIR/$backup_name/postgres_data.tar.gz" ]; then
            log_info "Restoring data volumes..."
            docker run --rm -v "${PROJECT_NAME,,}_postgres_data":/target -v "$(pwd)/$BACKUP_DIR/$backup_name":/backup alpine tar xzf /backup/postgres_data.tar.gz -C /target
        fi
    fi
    
    log_error "Rollback completed"
    exit 1
}

cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    # Remove unused images
    docker image prune -f > /dev/null 2>&1 || true
    
    # Remove unused volumes (be careful!)
    # docker volume prune -f > /dev/null 2>&1 || true
    
    # Clean up old backups (keep last 10)
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -maxdepth 1 -type d -name "${PROJECT_NAME}_backup_*" | sort -r | tail -n +11 | xargs rm -rf 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

show_deployment_summary() {
    log_success "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
    echo ""
    log_info "Service Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""
    log_info "Application URLs:"
    log_info "  • Frontend: https://yourdomain.com"
    log_info "  • API: https://yourdomain.com/api"
    log_info "  • Grafana: http://localhost:3001 (admin/admin)"
    log_info "  • Kibana: http://localhost:5601"
    log_info "  • Prometheus: http://localhost:9090"
    echo ""
    log_info "Logs:"
    log_info "  • Application logs: ./logs/"
    log_info "  • Docker logs: docker-compose -f $DOCKER_COMPOSE_FILE logs [service]"
    echo ""
    log_info "Backup created in: $BACKUP_DIR"
    echo ""
    log_success "Deployment completed at: $(date)"
}

# =============================================================================
# Main Deployment Function
# =============================================================================

main() {
    local start_time=$(date +%s)
    
    # Setup logging
    mkdir -p logs
    touch "$LOG_FILE"
    
    log_info "=== STARTING PRODUCTION DEPLOYMENT ==="
    log_info "Environment: $DEPLOY_ENV"
    log_info "Timestamp: $(date)"
    log_info "User: $(whoami)"
    log_info "Working directory: $(pwd)"
    
    # Trap errors for rollback
    trap rollback_deployment ERR
    
    # Deployment steps
    check_prerequisites
    backup_current_deployment
    pull_latest_images
    
    # Stop existing services gracefully
    log_info "Stopping existing services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans || true
    
    start_services
    run_database_migrations
    
    # Health checks and testing
    if health_check; then
        run_smoke_tests
        cleanup_old_resources
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        show_deployment_summary
        log_success "Total deployment time: ${duration} seconds"
        
        # Send success notification (if configured)
        if [ ! -z "${DEPLOY_WEBHOOK_URL:-}" ]; then
            curl -X POST "$DEPLOY_WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "{\"text\": \"✅ Production deployment completed successfully in ${duration}s\"}" > /dev/null 2>&1 || true
        fi
        
    else
        log_error "Health checks failed, deployment unsuccessful"
        exit 1
    fi
    
    # Remove error trap on success
    trap - ERR
}

# =============================================================================
# Script Execution
# =============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            DEPLOY_ENV="$2"
            shift 2
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --env ENV          Set deployment environment (default: production)"
            echo "  --skip-backup      Skip backup creation"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Confirmation for production deployment
if [ "$DEPLOY_ENV" = "production" ]; then
    echo -e "${YELLOW}You are about to deploy to PRODUCTION environment.${NC}"
    echo -e "${YELLOW}This will affect live services and users.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
fi

# Run main deployment
main "$@"
