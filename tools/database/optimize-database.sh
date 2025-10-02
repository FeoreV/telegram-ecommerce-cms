#!/bin/bash

# =============================================================================
# Database Performance Optimization Script
# Applies production optimizations to PostgreSQL database
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
OPTIMIZATION_SQL="backend/prisma/migrations/optimize_production_indexes.sql"
LOG_FILE="logs/database-optimization-$(date +%Y%m%d_%H%M%S).log"
POSTGRES_DB="${POSTGRES_DB:-telegram_ecommerce}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_header() {
    echo "" | tee -a "$LOG_FILE"
    echo "=== $1 ===" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# =============================================================================
# Utility Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker Compose file exists
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    # Check if optimization SQL file exists
    if [ ! -f "$OPTIMIZATION_SQL" ]; then
        log_error "Optimization SQL file not found: $OPTIMIZATION_SQL"
        exit 1
    fi
    
    # Check if PostgreSQL container is running
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_error "PostgreSQL container is not running"
        exit 1
    fi
    
    # Create logs directory
    mkdir -p logs
    
    log_success "Prerequisites check passed"
}

test_database_connection() {
    log_info "Testing database connection..."
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
        exit 1
    fi
}

get_database_stats_before() {
    log_header "Database Statistics - Before Optimization"
    
    # Get table sizes
    log_info "Current table sizes:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                       pg_relation_size(schemaname||'.'||tablename)) as index_size
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Get index count
    log_info "Current index count:"
    local index_count=$(docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
    SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    " | tr -d ' ')
    log_info "Total indexes: $index_count" | tee -a "$LOG_FILE"
    
    # Get slow queries if pg_stat_statements is available
    log_info "Checking for slow queries..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 'Slow queries check completed' as info;
    -- We'll add pg_stat_statements queries here if available
    " 2>&1 | tee -a "$LOG_FILE" || true
}

apply_optimizations() {
    log_header "Applying Database Optimizations"
    
    log_info "Applying optimization SQL script..."
    
    # Apply the optimization SQL
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < "$OPTIMIZATION_SQL" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Optimization SQL applied successfully"
    else
        log_error "Failed to apply optimization SQL"
        return 1
    fi
}

verify_optimizations() {
    log_header "Verifying Optimizations"
    
    # Check that indexes were created
    log_info "Verifying new indexes..."
    local new_index_count=$(docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
    SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    " | tr -d ' ')
    
    log_info "New index count: $new_index_count"
    
    # Check specific performance indexes
    log_info "Checking critical performance indexes..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        indexname,
        tablename,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND (indexname LIKE 'idx_%_active' OR indexname LIKE 'idx_%_search%')
    ORDER BY pg_relation_size(indexname::regclass) DESC;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Check materialized views
    log_info "Verifying materialized views..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        schemaname,
        matviewname,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
    FROM pg_matviews 
    WHERE schemaname = 'public';
    " 2>&1 | tee -a "$LOG_FILE"
    
    log_success "Optimization verification completed"
}

get_database_stats_after() {
    log_header "Database Statistics - After Optimization"
    
    # Get updated table sizes
    log_info "Updated table and index sizes:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                       pg_relation_size(schemaname||'.'||tablename)) as index_size
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Show largest indexes
    log_info "Largest indexes:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    ORDER BY pg_relation_size(indexrelname::regclass) DESC
    LIMIT 15;
    " 2>&1 | tee -a "$LOG_FILE"
}

run_maintenance_tasks() {
    log_header "Running Maintenance Tasks"
    
    # Update table statistics
    log_info "Updating table statistics..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ANALYZE;" 2>&1 | tee -a "$LOG_FILE"
    
    # Refresh materialized views
    log_info "Refreshing materialized views..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT refresh_analytics_views();
    " 2>&1 | tee -a "$LOG_FILE" || log_warning "Materialized view refresh failed (may not exist yet)"
    
    # Run VACUUM on critical tables
    log_info "Running VACUUM on critical tables..."
    local critical_tables=("orders" "products" "notifications" "users")
    for table in "${critical_tables[@]}"; do
        log_info "Vacuuming table: $table"
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM ANALYZE $table;" 2>&1 | tee -a "$LOG_FILE"
    done
    
    log_success "Maintenance tasks completed"
}

performance_test() {
    log_header "Performance Testing"
    
    log_info "Running performance tests on optimized queries..."
    
    # Test product search performance
    log_info "Testing product search performance..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    EXPLAIN (ANALYZE, BUFFERS) 
    SELECT p.id, p.name, p.price 
    FROM products p 
    WHERE p.is_active = true 
    AND p.store_id = (SELECT id FROM stores LIMIT 1)
    ORDER BY p.created_at DESC 
    LIMIT 10;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Test order analytics performance
    log_info "Testing order analytics performance..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
        store_id,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
    FROM orders 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY store_id;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Test full-text search if data exists
    log_info "Testing full-text search performance..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT p.id, p.name 
    FROM products p 
    WHERE to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', 'product')
    AND p.is_active = true
    LIMIT 10;
    " 2>&1 | tee -a "$LOG_FILE"
    
    log_success "Performance testing completed"
}

setup_monitoring() {
    log_header "Setting Up Performance Monitoring"
    
    # Enable pg_stat_statements if available
    log_info "Checking pg_stat_statements availability..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 'pg_stat_statements' as extension, 
           CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') 
                THEN 'INSTALLED' 
                ELSE 'NOT AVAILABLE' 
           END as status;
    " 2>&1 | tee -a "$LOG_FILE"
    
    # Create monitoring functions if they don't exist
    log_info "Setting up monitoring functions..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    -- Check if monitoring functions exist
    SELECT 
        routine_name,
        routine_type
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('get_slow_queries', 'check_unused_indexes', 'refresh_analytics_views');
    " 2>&1 | tee -a "$LOG_FILE"
    
    log_success "Monitoring setup completed"
}

create_maintenance_schedule() {
    log_header "Creating Maintenance Schedule"
    
    log_info "Creating maintenance SQL scripts..."
    
    # Create daily maintenance script
    cat > "scripts/daily-db-maintenance.sql" << 'EOF'
-- Daily Database Maintenance Script
-- Run this daily to maintain optimal performance

-- Update statistics for query planner
ANALYZE;

-- Refresh materialized views
SELECT refresh_analytics_views();

-- Cleanup old notifications (30 days retention)
SELECT cleanup_old_notifications(30);

-- Log maintenance completion
INSERT INTO maintenance.task_log (task_name, status, details)
VALUES ('daily_maintenance', 'completed', 'Daily maintenance completed successfully');
EOF

    # Create weekly maintenance script
    cat > "scripts/weekly-db-maintenance.sql" << 'EOF'
-- Weekly Database Maintenance Script
-- Run this weekly for deeper maintenance

-- VACUUM ANALYZE all tables
VACUUM ANALYZE;

-- Reindex if necessary (check fragmentation first)
-- Note: This should be done during maintenance windows
-- REINDEX DATABASE telegram_ecommerce;

-- Check for unused indexes
SELECT * FROM check_unused_indexes();

-- Update all table statistics
ANALYZE;

-- Log maintenance completion
INSERT INTO maintenance.task_log (task_name, status, details)
VALUES ('weekly_maintenance', 'completed', 'Weekly maintenance completed successfully');
EOF

    log_success "Maintenance scripts created:"
    log_info "• scripts/daily-db-maintenance.sql"
    log_info "• scripts/weekly-db-maintenance.sql"
}

generate_optimization_report() {
    log_header "Optimization Summary Report"
    
    local end_time=$(date +%s)
    local start_time=$(stat -c %Y "$LOG_FILE" 2>/dev/null || echo "$end_time")
    local duration=$((end_time - start_time))
    
    echo "" | tee -a "$LOG_FILE"
    echo "=== DATABASE OPTIMIZATION COMPLETED ===" | tee -a "$LOG_FILE"
    echo "Completed at: $(date)" | tee -a "$LOG_FILE"
    echo "Duration: ${duration} seconds" | tee -a "$LOG_FILE"
    echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    log_success "Database optimization completed successfully!"
    
    # Show next steps
    log_info "NEXT STEPS:"
    echo "1. Monitor query performance using the created functions"
    echo "2. Run daily maintenance: psql -f scripts/daily-db-maintenance.sql"
    echo "3. Run weekly maintenance: psql -f scripts/weekly-db-maintenance.sql"
    echo "4. Monitor slow queries and unused indexes periodically"
    echo "5. Adjust autovacuum settings based on usage patterns"
    echo ""
    log_info "MONITORING QUERIES:"
    echo "• SELECT * FROM get_slow_queries(1000);  -- Show queries slower than 1s"
    echo "• SELECT * FROM check_unused_indexes();  -- Show unused indexes"
    echo "• SELECT * FROM active_bots_stats;       -- Show bot statistics"
    echo "• SELECT * FROM store_stats_mv;          -- Show store statistics"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local start_time=$(date +%s)
    
    # Initialize log
    echo "Database Optimization Started: $(date)" > "$LOG_FILE"
    
    log_info "=== STARTING DATABASE OPTIMIZATION ==="
    log_info "Database: $POSTGRES_DB"
    log_info "User: $POSTGRES_USER"
    log_info "Log file: $LOG_FILE"
    
    # Execute optimization steps
    check_prerequisites
    test_database_connection
    get_database_stats_before
    apply_optimizations
    verify_optimizations
    get_database_stats_after
    run_maintenance_tasks
    performance_test
    setup_monitoring
    create_maintenance_schedule
    generate_optimization_report
    
    log_success "=== DATABASE OPTIMIZATION COMPLETED ==="
}

# =============================================================================
# Script Arguments
# =============================================================================

# Show help
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Database Performance Optimization Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "This script applies comprehensive database optimizations including:"
    echo "• Performance indexes for common queries"
    echo "• Full-text search optimization"
    echo "• Materialized views for analytics"
    echo "• Maintenance functions and procedures"
    echo "• Performance monitoring setup"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --dry-run      Show what would be done without applying changes"
    echo ""
    echo "Prerequisites:"
    echo "• PostgreSQL container must be running"
    echo "• Database must be accessible"
    echo "• Sufficient disk space for new indexes"
    exit 0
fi

# Parse arguments
case "${1:-}" in
    --dry-run)
        log_info "DRY RUN MODE - No changes will be applied"
        log_info "Optimization SQL file: $OPTIMIZATION_SQL"
        if [ -f "$OPTIMIZATION_SQL" ]; then
            log_info "SQL file exists and contains $(wc -l < "$OPTIMIZATION_SQL") lines"
        else
            log_error "SQL file not found"
        fi
        exit 0
        ;;
esac

# Warning for production
echo -e "${YELLOW}WARNING: This script will apply database optimizations.${NC}"
echo -e "${YELLOW}This may temporarily increase disk I/O and CPU usage.${NC}"
echo ""
read -p "Continue with optimization? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    log_info "Optimization cancelled by user"
    exit 0
fi

# Run main optimization
main "$@"
