# Maintenance Tools

Scripts for system maintenance, monitoring, and health checks.

## 📁 Available Tools

### `backup.sh`
Comprehensive backup script for all critical data.

**Usage:**
```bash
chmod +x tools/maintenance/backup.sh
./tools/maintenance/backup.sh [options]
```

**Options:**
- `--full` - Full backup (database + files + config)
- `--database-only` - Database only
- `--files-only` - Files only (uploads, storage)
- `--encrypt` - Encrypt backup with GPG
- `--remote` - Upload to remote storage (S3, etc.)

**What it backs up:**
- Database (full dump)
- User uploads
- Storage files
- Configuration files
- Environment variables (sanitized)
- SSL certificates
- Logs (optional)

**Example:**
```bash
# Full encrypted backup
./tools/maintenance/backup.sh --full --encrypt

# Database only
./tools/maintenance/backup.sh --database-only

# Full backup with remote upload
./tools/maintenance/backup.sh --full --remote
```

**Backup location:** `storage/backups/`

**Backup naming:** `backup-{timestamp}-{type}.tar.gz`

**Retention policy:** 
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

---

### `health-check.js`
System health check script that verifies all services are running correctly.

**Usage:**
```bash
# Quick check
node tools/maintenance/health-check.js

# Detailed check
node tools/maintenance/health-check.js --verbose

# JSON output (for monitoring)
node tools/maintenance/health-check.js --json

# Check specific service
node tools/maintenance/health-check.js --service backend
```

**What it checks:**

#### Services Status
- ✅ Backend API (HTTP endpoint)
- ✅ Frontend availability
- ✅ Bot service
- ✅ Database connection
- ✅ Redis connection

#### System Resources
- 📊 CPU usage
- 📊 Memory usage
- 📊 Disk space
- 📊 Network connectivity

#### Application Health
- 🔍 Database query performance
- 🔍 API response times
- 🔍 Error rates
- 🔍 Active sessions
- 🔍 Queue status

**Exit codes:**
- `0` - All systems healthy
- `1` - Warning (non-critical issues)
- `2` - Critical (immediate attention needed)

**Integration with monitoring:**
```bash
# Cron job example (every 5 minutes)
*/5 * * * * /path/to/project/tools/maintenance/health-check.js --json >> /var/log/health-check.log 2>&1
```

---

### `security-audit.sh`
Security audit script that checks for vulnerabilities and misconfigurations.

**Usage:**
```bash
chmod +x tools/maintenance/security-audit.sh
./tools/maintenance/security-audit.sh [--fix]
```

**What it audits:**

#### Dependencies
- NPM packages vulnerabilities
- Outdated packages
- Known CVEs

#### Configuration
- Environment variables exposure
- Weak secrets detection
- Insecure defaults
- File permissions

#### Application Security
- Authentication configuration
- CORS settings
- Rate limiting
- SQL injection risks
- XSS vulnerabilities

#### Infrastructure
- Docker image vulnerabilities
- SSL/TLS configuration
- Open ports
- Firewall rules

**Options:**
- `--fix` - Automatically fix issues where possible
- `--report` - Generate detailed PDF report
- `--critical-only` - Show only critical issues

**Output:**
```
🔒 Security Audit Report
========================

✅ Dependencies: 0 vulnerabilities
⚠️  Configuration: 2 warnings
✅ Application: All checks passed
❌ Infrastructure: 1 critical issue

Details:
--------
[CRITICAL] Port 22 exposed to public
[WARNING] JWT_SECRET less than 32 characters
[WARNING] CORS allows all origins

Recommendations: ...
```

**Schedule:** Run weekly or before production deployments

---

## 🔄 Maintenance Schedules

### Daily Tasks (Automated)

```bash
# Crontab example
0 2 * * * /path/to/tools/maintenance/backup.sh --database-only
*/15 * * * * /path/to/tools/maintenance/health-check.js --json >> /var/log/health.log
```

### Weekly Tasks

```bash
# Every Sunday at 3 AM
0 3 * * 0 /path/to/tools/maintenance/backup.sh --full --encrypt --remote
0 4 * * 0 /path/to/tools/database/optimize-database.sh
0 5 * * 0 /path/to/tools/maintenance/security-audit.sh --report
```

### Monthly Tasks

```bash
# First day of month
0 1 1 * * /path/to/tools/maintenance/cleanup-old-logs.sh
0 2 1 * * /path/to/tools/maintenance/rotate-secrets.sh
```

---

## 🚨 Incident Response

### Service Down

```bash
# 1. Check health status
./tools/maintenance/health-check.js --verbose

# 2. View recent logs
docker-compose logs --tail=100

# 3. Restart services
docker-compose restart

# 4. If database issue
./tools/database/optimize-database.sh --emergency
```

### Performance Issues

```bash
# 1. Check system resources
docker stats

# 2. Analyze database
./tools/database/optimize-database.sh --analyze

# 3. Check application metrics
curl http://82.147.84.78:3001/metrics

# 4. Review slow queries
./tools/database/slow-query-log.sh
```

### Security Breach

```bash
# 1. Run immediate audit
./tools/maintenance/security-audit.sh --critical-only

# 2. Check access logs
./tools/security/analyze-access-logs.sh

# 3. Rotate all secrets
./tools/deployment/generate-secrets.sh
./tools/vault/key-rotation-automation.sh

# 4. Create incident backup
./tools/maintenance/backup.sh --full --encrypt --label "incident-$(date +%Y%m%d)"
```

---

## 📊 Monitoring Integration

### Prometheus Metrics

Health check script exposes metrics compatible with Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'health-check'
    static_configs:
      - targets: ['82.147.84.78:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboards

Import pre-configured dashboards from `config/grafana/provisioning/`

### Alert Rules

Example alert configuration:

```yaml
groups:
  - name: application
    rules:
      - alert: ServiceDown
        expr: up{job="backend"} == 0
        for: 5m
        annotations:
          summary: "Backend service is down"
          
      - alert: HighErrorRate
        expr: rate(http_errors_total[5m]) > 0.05
        for: 10m
        annotations:
          summary: "High error rate detected"
```

---

## 🗄️ Backup Management

### Manual Backup

```bash
# Before major changes
./tools/maintenance/backup.sh --full --encrypt --label "pre-deployment"

# Before migrations
./tools/maintenance/backup.sh --database-only --label "pre-migration"
```

### Restore Backup

```bash
# List available backups
./tools/maintenance/list-backups.sh

# Restore specific backup
./tools/maintenance/restore-backup.sh backup-20250930-full.tar.gz

# Verify backup integrity
./tools/maintenance/verify-backup.sh backup-20250930-full.tar.gz
```

### Remote Backup Storage

Configure in `.env`:
```env
BACKUP_S3_BUCKET=my-backups
BACKUP_S3_REGION=us-east-1
BACKUP_RETENTION_DAYS=30
```

---

## 🔧 Maintenance Mode

Enable maintenance mode during updates:

```bash
# Enable
./tools/maintenance/maintenance-mode.sh enable

# Disable
./tools/maintenance/maintenance-mode.sh disable

# Status
./tools/maintenance/maintenance-mode.sh status
```

Users will see a maintenance page during this time.

---

## 📈 Performance Monitoring

```bash
# Generate performance report
./tools/maintenance/performance-report.sh

# Monitor in real-time
./tools/maintenance/monitor-realtime.sh

# Analyze trends
./tools/maintenance/analyze-metrics.sh --period 7d
```

---

## 🧹 Cleanup Tasks

```bash
# Clean old logs
./tools/maintenance/cleanup-logs.sh --older-than 30d

# Clean temp files
./tools/maintenance/cleanup-temp.sh

# Clean old backups
./tools/maintenance/cleanup-backups.sh --keep-last 10

# Prune Docker resources
docker system prune -a --volumes --force
```

---

## 📞 Support

For maintenance issues:
- Check logs: `storage/logs/`
- Review documentation: `docs/deployment/`
- Create issue on GitHub

---

## 📚 Additional Resources

- [Production Deployment Guide](../../docs/deployment/production-deployment.md)
- [Disaster Recovery Plan](../../docs/security/disaster-recovery-documentation.md)
- [Monitoring Setup](../../docs/deployment/monitoring.md)
