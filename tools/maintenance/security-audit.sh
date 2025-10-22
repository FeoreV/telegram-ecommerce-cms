#!/bin/bash

# =============================================================================
# Security Audit Script for Telegram E-commerce Bot Platform
# Comprehensive security check for production deployment
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REPORT_FILE="security-audit-$(date +%Y%m%d_%H%M%S).txt"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$REPORT_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$REPORT_FILE"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$REPORT_FILE"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$REPORT_FILE"
    ((FAILED_CHECKS++))
}

log_header() {
    echo "" | tee -a "$REPORT_FILE"
    echo -e "${BOLD}=== $1 ===${NC}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
}

check_test() {
    ((TOTAL_CHECKS++))
}

# =============================================================================
# Environment Security Checks
# =============================================================================

check_environment_files() {
    log_header "Environment Security"
    
    # Check .env files permissions
    check_test
    if [ -f ".env.production" ]; then
        local perms=$(stat -c "%a" .env.production 2>/dev/null || stat -f "%A" .env.production 2>/dev/null)
        if [ "$perms" = "600" ] || [ "$perms" = "0600" ]; then
            log_success "Environment file has correct permissions (600)"
        else
            log_error "Environment file permissions too open: $perms (should be 600)"
        fi
    else
        log_warning "Production environment file not found"
    fi
    
    # Check for secrets in .env files
    check_test
    if [ -f ".env.production" ]; then
        if grep -q "your_.*_password\|changeme\|secret123\|admin123\|password123" .env.production 2>/dev/null; then
            log_error "Default/weak secrets found in environment file"
        else
            log_success "No obvious weak secrets found in environment file"
        fi
    fi
    
    # Check for .env files in git
    check_test
    if git check-ignore .env.production > /dev/null 2>&1; then
        log_success "Environment files are properly ignored by git"
    else
        if [ -f ".env.production" ]; then
            log_error "Environment file is not ignored by git - risk of secret exposure"
        else
            log_warning "Environment file doesn't exist to check git ignore status"
        fi
    fi
}

# =============================================================================
# Docker Security Checks
# =============================================================================

check_docker_security() {
    log_header "Docker Security"
    
    # Check if containers run as non-root
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps > /dev/null 2>&1; then
        local root_containers=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q | xargs -r docker inspect --format '{{.Config.User}} {{.Name}}' | grep -c "^root\|^$" || echo "0")
        if [ "$root_containers" -eq 0 ]; then
            log_success "No containers running as root user"
        else
            log_warning "$root_containers containers running as root user"
        fi
    else
        log_warning "Cannot check container users - services not running"
    fi
    
    # Check Docker daemon security
    check_test
    if groups "$USER" | grep -q docker; then
        log_warning "Current user is in docker group (full docker access)"
    else
        log_success "Current user not in docker group (limited access)"
    fi
    
    # Check for exposed Docker socket
    check_test
    if [ -e "/var/run/docker.sock" ] && [ -r "/var/run/docker.sock" ]; then
        local sock_perms=$(stat -c "%a" /var/run/docker.sock 2>/dev/null || stat -f "%A" /var/run/docker.sock 2>/dev/null)
        if [ "$sock_perms" = "660" ] || [ "$sock_perms" = "0660" ]; then
            log_success "Docker socket has appropriate permissions"
        else
            log_warning "Docker socket permissions may be too open: $sock_perms"
        fi
    else
        log_success "Docker socket not accessible to current user"
    fi
    
    # Check for privileged containers
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps > /dev/null 2>&1; then
        local privileged_containers=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q | xargs -r docker inspect --format '{{.HostConfig.Privileged}} {{.Name}}' | grep -c "true" || echo "0")
        if [ "$privileged_containers" -eq 0 ]; then
            log_success "No privileged containers found"
        else
            log_error "$privileged_containers containers running in privileged mode"
        fi
    fi
}

# =============================================================================
# Network Security Checks
# =============================================================================

check_network_security() {
    log_header "Network Security"
    
    # Check open ports
    check_test
    local dangerous_ports="22 3306 5432 6379 9090"
    local exposed_ports=""
    for port in $dangerous_ports; do
        if netstat -tln 2>/dev/null | grep -q ":$port "; then
            local binding=$(netstat -tln | grep ":$port " | awk '{print $4}' | head -n1)
            if [[ "$binding" == "0.0.0.0:$port" ]] || [[ "$binding" == "*:$port" ]]; then
                exposed_ports="$exposed_ports $port"
            fi
        fi
    done
    
    if [ -z "$exposed_ports" ]; then
        log_success "No dangerous ports exposed to 0.0.0.0"
    else
        log_error "Dangerous ports exposed to internet:$exposed_ports"
    fi
    
    # Check firewall status
    check_test
    if command -v ufw > /dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        log_success "UFW firewall is active"
    elif command -v firewall-cmd > /dev/null && firewall-cmd --state 2>/dev/null | grep -q "running"; then
        log_success "Firewalld is active"
    else
        log_warning "No active firewall detected (UFW/Firewalld)"
    fi
    
    # Check for fail2ban
    check_test
    if systemctl is-active fail2ban > /dev/null 2>&1; then
        log_success "Fail2ban is active and running"
    else
        log_warning "Fail2ban not detected - consider installing for intrusion prevention"
    fi
}

# =============================================================================
# SSL/TLS Security Checks
# =============================================================================

check_ssl_security() {
    log_header "SSL/TLS Security"
    
    # Check SSL certificate files
    check_test
    if [ -d "config/ssl" ]; then
        local cert_files=$(find config/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null | wc -l)
        if [ "$cert_files" -gt 0 ]; then
            log_success "SSL certificate files found"
            
            # Check certificate expiration
            for cert in config/ssl/*.crt config/ssl/*.pem; do
                if [ -f "$cert" ]; then
                    local expiry=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2 || echo "")
                    if [ -n "$expiry" ]; then
                        local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
                        local current_epoch=$(date +%s)
                        local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
                        
                        if [ "$days_left" -gt 30 ]; then
                            log_success "SSL certificate valid for $days_left days: $(basename "$cert")"
                        elif [ "$days_left" -gt 0 ]; then
                            log_warning "SSL certificate expires in $days_left days: $(basename "$cert")"
                        else
                            log_error "SSL certificate expired: $(basename "$cert")"
                        fi
                    fi
                fi
            done
        else
            log_warning "No SSL certificate files found in config/ssl"
        fi
    else
        log_warning "SSL configuration directory not found"
    fi
    
    # Check SSL configuration in NGINX
    check_test
    if [ -f "config/nginx/nginx.conf" ]; then
        if grep -q "ssl_protocols.*TLSv1\.3\|ssl_protocols.*TLSv1\.2" config/nginx/nginx.conf; then
            log_success "Modern TLS protocols configured in NGINX"
        else
            log_warning "TLS protocol configuration not found or may be outdated"
        fi
        
        if grep -q "ssl_ciphers" config/nginx/nginx.conf; then
            log_success "SSL cipher configuration found"
        else
            log_warning "SSL cipher configuration not found"
        fi
    fi
}

# =============================================================================
# Application Security Checks
# =============================================================================

check_application_security() {
    log_header "Application Security"
    
    # Check for security headers
    check_test
    if [ -f "config/nginx/nginx.conf" ]; then
        local security_headers="Strict-Transport-Security X-Frame-Options X-Content-Type-Options Content-Security-Policy"
        local missing_headers=""
        
        for header in $security_headers; do
            if ! grep -q "$header" config/nginx/nginx.conf; then
                missing_headers="$missing_headers $header"
            fi
        done
        
        if [ -z "$missing_headers" ]; then
            log_success "All important security headers configured"
        else
            log_warning "Missing security headers:$missing_headers"
        fi
    fi
    
    # Check rate limiting configuration
    check_test
    if [ -f "config/nginx/nginx.conf" ]; then
        if grep -q "limit_req_zone\|limit_conn_zone" config/nginx/nginx.conf; then
            log_success "Rate limiting configured in NGINX"
        else
            log_warning "Rate limiting not configured"
        fi
    fi
    
    # Check for server tokens
    check_test
    if [ -f "config/nginx/nginx.conf" ]; then
        if grep -q "server_tokens.*off" config/nginx/nginx.conf; then
            log_success "Server tokens disabled (version hiding)"
        else
            log_warning "Server tokens not disabled - version information may leak"
        fi
    fi
    
    # Check JWT secret strength
    check_test
    if [ -f ".env.production" ] && grep -q "JWT_SECRET" .env.production; then
        local jwt_secret=$(grep "JWT_SECRET=" .env.production | cut -d= -f2- | tr -d '"' || echo "")
        if [ ${#jwt_secret} -ge 32 ]; then
            log_success "JWT secret appears to be strong (${#jwt_secret} characters)"
        else
            log_error "JWT secret too short (${#jwt_secret} characters, minimum 32 recommended)"
        fi
    else
        log_warning "JWT_SECRET not found in environment configuration"
    fi
}

# =============================================================================
# Database Security Checks
# =============================================================================

check_database_security() {
    log_header "Database Security"
    
    # Check PostgreSQL configuration
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres > /dev/null 2>&1; then
        # Check if PostgreSQL is not exposed to public internet
        if netstat -tln 2>/dev/null | grep ":5432" | grep -q "0.0.0.0:5432"; then
            log_error "PostgreSQL port exposed to internet (0.0.0.0:5432)"
        else
            log_success "PostgreSQL not exposed to public internet"
        fi
        
        # Check PostgreSQL version for known vulnerabilities
        local pg_version=$(docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U postgres -t -c "SELECT version();" 2>/dev/null | head -n1 || echo "unknown")
        if [[ "$pg_version" == *"PostgreSQL 1"[3-9]* ]] || [[ "$pg_version" == *"PostgreSQL "[2-9][0-9]* ]]; then
            log_success "PostgreSQL version appears to be recent"
        else
            log_warning "PostgreSQL version check failed or may be outdated"
        fi
    else
        log_warning "PostgreSQL container not running - cannot perform database checks"
    fi
    
    # Check Redis security
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps redis > /dev/null 2>&1; then
        if netstat -tln 2>/dev/null | grep ":6379" | grep -q "0.0.0.0:6379"; then
            log_error "Redis port exposed to internet (0.0.0.0:6379)"
        else
            log_success "Redis not exposed to public internet"
        fi
    fi
}

# =============================================================================
# File System Security Checks
# =============================================================================

check_filesystem_security() {
    log_header "File System Security"
    
    # Check critical file permissions
    local critical_files=(
        ".env.production:600"
        "config/nginx/.htpasswd:600"
        "scripts/deploy-production.sh:755"
        "scripts/backup.sh:755"
    )
    
    for file_perm in "${critical_files[@]}"; do
        check_test
        local file="${file_perm%:*}"
        local expected_perm="${file_perm#*:}"
        
        if [ -f "$file" ]; then
            local actual_perm=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
            if [ "$actual_perm" = "$expected_perm" ] || [ "$actual_perm" = "0$expected_perm" ]; then
                log_success "Correct permissions for $file ($expected_perm)"
            else
                log_error "Incorrect permissions for $file: $actual_perm (expected: $expected_perm)"
            fi
        else
            log_warning "File not found: $file"
        fi
    done
    
    # Check for world-writable files
    check_test
    local world_writable=$(find . -type f -perm -002 2>/dev/null | grep -v "\.git" | head -5)
    if [ -z "$world_writable" ]; then
        log_success "No world-writable files found"
    else
        log_warning "World-writable files found (security risk)"
        echo "$world_writable" | head -3 | tee -a "$REPORT_FILE"
    fi
    
    # Check for SUID/SGID files (in current directory)
    check_test
    local suid_files=$(find . -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | head -5)
    if [ -z "$suid_files" ]; then
        log_success "No SUID/SGID files found in project directory"
    else
        log_warning "SUID/SGID files found (verify they are necessary):"
        echo "$suid_files" | head -3 | tee -a "$REPORT_FILE"
    fi
}

# =============================================================================
# Monitoring Security Checks
# =============================================================================

check_monitoring_security() {
    log_header "Monitoring Security"
    
    # Check Grafana security
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps grafana > /dev/null 2>&1; then
        if [ -f ".env.production" ] && grep -q "GRAFANA_ADMIN_PASSWORD" .env.production; then
            local grafana_pass=$(grep "GRAFANA_ADMIN_PASSWORD=" .env.production | cut -d= -f2- | tr -d '"')
            if [ ${#grafana_pass} -ge 12 ]; then
                log_success "Grafana admin password appears to be strong"
            else
                log_error "Grafana admin password too weak"
            fi
        else
            log_warning "Grafana admin password not found in environment"
        fi
    fi
    
    # Check Prometheus security
    check_test
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps prometheus > /dev/null 2>&1; then
        if netstat -tln 2>/dev/null | grep ":9090" | grep -q "127.0.0.1:9090\|localhost:9090"; then
            log_success "Prometheus bound to localhost only"
        elif netstat -tln 2>/dev/null | grep -q "0.0.0.0:9090"; then
            log_warning "Prometheus exposed to all interfaces"
        fi
    fi
    
    # Check metrics endpoint security
    check_test
    if [ -f "config/nginx/nginx.conf" ]; then
        if grep -A 5 "location /metrics" config/nginx/nginx.conf | grep -q "deny all\|allow.*deny all"; then
            log_success "Metrics endpoint access restricted"
        else
            log_warning "Metrics endpoint may be publicly accessible"
        fi
    fi
}

# =============================================================================
# Compliance and Best Practices
# =============================================================================

check_compliance() {
    log_header "Compliance & Best Practices"
    
    # Check backup encryption
    check_test
    if [ -f "scripts/backup.sh" ] && grep -q "encryption\|encrypt\|gpg" scripts/backup.sh; then
        log_success "Backup script includes encryption"
    else
        log_warning "Backup encryption not detected"
    fi
    
    # Check log rotation
    check_test
    if [ -f "docker-compose.production.yml" ] && grep -q "max-size\|max-file" docker-compose.production.yml; then
        log_success "Docker log rotation configured"
    else
        log_warning "Docker log rotation not configured"
    fi
    
    # Check for update mechanism
    check_test
    if [ -f "scripts/deploy-production.sh" ]; then
        log_success "Automated deployment script exists"
    else
        log_warning "No automated deployment mechanism found"
    fi
    
    # Check for monitoring alerts
    check_test
    if [ -d "config/prometheus" ] && find config/prometheus -name "*.yml" -exec grep -l "alert" {} \; | grep -q .; then
        log_success "Prometheus alert rules found"
    else
        log_warning "No Prometheus alert rules detected"
    fi
}

# =============================================================================
# Vulnerability Scanning
# =============================================================================

check_vulnerabilities() {
    log_header "Vulnerability Scanning"
    
    # Check for known vulnerable packages (simplified check)
    check_test
    if [ -f "package.json" ] && command -v npm > /dev/null; then
        if npm audit --audit-level high > /dev/null 2>&1; then
            log_success "No high-severity npm vulnerabilities found"
        else
            log_warning "High-severity npm vulnerabilities detected - run 'npm audit' for details"
        fi
    fi
    
    # Check Docker image vulnerabilities (if trivy is available)
    check_test
    if command -v trivy > /dev/null; then
        local critical_vulns=$(trivy image --exit-code 1 --severity CRITICAL --quiet node:20-alpine 2>/dev/null | wc -l || echo "0")
        if [ "$critical_vulns" -eq 0 ]; then
            log_success "No critical vulnerabilities in base Docker image"
        else
            log_warning "Critical vulnerabilities found in Docker images"
        fi
    else
        log_warning "Trivy not available for vulnerability scanning"
    fi
    
    # Check for default passwords in configuration
    check_test
    local default_patterns="password123\|admin123\|changeme\|default\|secret123"
    if find . -name "*.yml" -o -name "*.yaml" -o -name "*.conf" | xargs grep -l "$default_patterns" 2>/dev/null; then
        log_error "Default passwords found in configuration files"
    else
        log_success "No obvious default passwords in configuration"
    fi
}

# =============================================================================
# Generate Security Report
# =============================================================================

generate_summary() {
    log_header "SECURITY AUDIT SUMMARY"
    
    local pass_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    echo "Audit completed at: $(date)" | tee -a "$REPORT_FILE"
    echo "Total checks performed: $TOTAL_CHECKS" | tee -a "$REPORT_FILE"
    echo "Checks passed: $PASSED_CHECKS" | tee -a "$REPORT_FILE"
    echo "Checks failed: $FAILED_CHECKS" | tee -a "$REPORT_FILE"
    echo "Warnings: $WARNING_CHECKS" | tee -a "$REPORT_FILE"
    echo "Pass rate: $pass_rate%" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNING_CHECKS" -eq 0 ]; then
        echo -e "${GREEN}🎉 EXCELLENT! All security checks passed!${NC}" | tee -a "$REPORT_FILE"
    elif [ "$FAILED_CHECKS" -eq 0 ]; then
        echo -e "${YELLOW}✓ GOOD! No critical security issues, but address warnings${NC}" | tee -a "$REPORT_FILE"
    elif [ "$pass_rate" -ge 80 ]; then
        echo -e "${YELLOW}⚠️ MODERATE! Most checks passed, but address critical issues${NC}" | tee -a "$REPORT_FILE"
    else
        echo -e "${RED}❌ CRITICAL! Multiple security issues need immediate attention${NC}" | tee -a "$REPORT_FILE"
    fi
    
    echo "" | tee -a "$REPORT_FILE"
    echo "Detailed report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
    
    # Return exit code based on failed checks
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Initialize report
    {
        echo "============================================================================="
        echo "SECURITY AUDIT REPORT"
        echo "Telegram E-commerce Bot Platform"
        echo "============================================================================="
        echo "Generated: $(date)"
        echo "Hostname: $(hostname)"
        echo "User: $(whoami)"
        echo "Working Directory: $(pwd)"
        echo "============================================================================="
    } > "$REPORT_FILE"
    
    log_info "Starting comprehensive security audit..."
    log_info "Report will be saved to: $REPORT_FILE"
    
    # Run all security checks
    check_environment_files
    check_docker_security
    check_network_security
    check_ssl_security
    check_application_security
    check_database_security
    check_filesystem_security
    check_monitoring_security
    check_compliance
    check_vulnerabilities
    
    # Generate summary and exit with appropriate code
    if generate_summary; then
        exit 0
    else
        exit 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "Security Audit Script for Telegram E-commerce Bot Platform"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --report FILE Set custom report filename"
        echo ""
        echo "This script performs comprehensive security checks including:"
        echo "• Environment and secrets security"
        echo "• Docker container security"
        echo "• Network and firewall configuration"
        echo "• SSL/TLS configuration"
        echo "• Application security headers"
        echo "• Database security"
        echo "• File system permissions"
        echo "• Monitoring security"
        echo "• Compliance and best practices"
        echo "• Basic vulnerability scanning"
        exit 0
        ;;
    --report)
        REPORT_FILE="$2"
        shift 2
        ;;
esac

# Run the audit
main "$@"
