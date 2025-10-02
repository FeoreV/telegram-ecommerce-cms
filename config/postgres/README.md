# PostgreSQL Configuration

PostgreSQL configuration files for production deployment with security and initialization scripts.

## 📁 Files Overview

### Configuration Files

#### `postgresql.conf`
**Purpose:** Main PostgreSQL server configuration

**Key settings:**
- Performance tuning
- Connection limits
- Memory allocation
- WAL (Write-Ahead Logging) configuration
- Logging settings
- Replication configuration

**Usage:**
```bash
# Copy to PostgreSQL data directory
sudo cp config/postgres/postgresql.conf /var/lib/postgresql/data/

# Or mount in Docker
volumes:
  - ./config/postgres/postgresql.conf:/var/lib/postgresql/data/postgresql.conf
```

---

#### `pg_hba.conf`
**Purpose:** Host-Based Authentication configuration

**Controls:**
- Client authentication methods
- IP address access control
- SSL/TLS requirements
- Database access permissions

**Example entries:**
```conf
# Local connections
local   all   all   peer

# IPv4 local connections with password
host    all   all   127.0.0.1/32   scram-sha-256

# IPv4 connections with SSL
hostssl all   all   0.0.0.0/0      scram-sha-256
```

**Usage:**
```bash
sudo cp config/postgres/pg_hba.conf /var/lib/postgresql/data/
sudo systemctl reload postgresql
```

---

### Initialization Scripts

These SQL scripts are executed when the database is first initialized.

#### `init-sessions-table.sql`
**Purpose:** Create sessions table for application session management

**Creates:**
- `sessions` table with proper indexes
- Session expiration mechanism
- Automatic cleanup function

**Auto-execution in Docker:**
```yaml
services:
  postgres:
    volumes:
      - ./config/postgres/init-sessions-table.sql:/docker-entrypoint-initdb.d/01-sessions.sql
```

---

#### `init-revoked-tokens-table.sql`
**Purpose:** JWT token revocation list

**Creates:**
- `revoked_tokens` table
- Token blacklist mechanism
- Automatic expiration cleanup
- Indexes for fast lookup

**Use case:** Logout functionality, token invalidation

---

#### `init-payment-security-tables.sql`
**Purpose:** Payment processing security tables

**Creates:**
- Payment verification logs
- Transaction audit trail
- Fraud detection tables
- PCI DSS compliance tables

**Security features:**
- Encrypted sensitive fields
- Audit logging
- Access controls
- Data retention policies

---

#### `init-rls-security.sql`
**Purpose:** Row-Level Security (RLS) policies

**Implements:**
- Multi-tenant data isolation
- Store-specific access control
- User role-based filtering
- Automatic security policies

**Example:**
```sql
-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see products from their store
CREATE POLICY products_isolation ON products
  FOR SELECT
  USING (store_id = current_setting('app.current_store_id')::uuid);
```

---

#### `init-encryption.sql`
**Purpose:** Database-level encryption setup

**Implements:**
- pgcrypto extension
- Encryption/decryption functions
- Sensitive data protection
- Key management

**Functions:**
```sql
-- Encrypt sensitive data
encrypt_data(plaintext, key)

-- Decrypt sensitive data
decrypt_data(encrypted, key)
```

---

## 🚀 Setup & Deployment

### Docker Setup

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: telegram_ecommerce
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      # Configuration
      - ./config/postgres/postgresql.conf:/var/lib/postgresql/data/postgresql.conf
      - ./config/postgres/pg_hba.conf:/var/lib/postgresql/data/pg_hba.conf
      
      # Initialization scripts (executed in order)
      - ./config/postgres/init-sessions-table.sql:/docker-entrypoint-initdb.d/01-sessions.sql
      - ./config/postgres/init-revoked-tokens-table.sql:/docker-entrypoint-initdb.d/02-tokens.sql
      - ./config/postgres/init-payment-security-tables.sql:/docker-entrypoint-initdb.d/03-payments.sql
      - ./config/postgres/init-rls-security.sql:/docker-entrypoint-initdb.d/04-rls.sql
      - ./config/postgres/init-encryption.sql:/docker-entrypoint-initdb.d/05-encryption.sql
      
      # Data persistence
      - postgres_data:/var/lib/postgresql/data
```

### Manual Setup

```bash
# 1. Install PostgreSQL
sudo apt install postgresql-16

# 2. Copy configuration
sudo cp config/postgres/postgresql.conf /etc/postgresql/16/main/
sudo cp config/postgres/pg_hba.conf /etc/postgresql/16/main/

# 3. Create database
sudo -u postgres createdb telegram_ecommerce

# 4. Run initialization scripts
sudo -u postgres psql telegram_ecommerce < config/postgres/init-sessions-table.sql
sudo -u postgres psql telegram_ecommerce < config/postgres/init-revoked-tokens-table.sql
sudo -u postgres psql telegram_ecommerce < config/postgres/init-payment-security-tables.sql
sudo -u postgres psql telegram_ecommerce < config/postgres/init-rls-security.sql
sudo -u postgres psql telegram_ecommerce < config/postgres/init-encryption.sql

# 5. Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 🔧 Configuration Tuning

### Performance Optimization

Edit `postgresql.conf`:

```conf
# Memory Settings (adjust based on available RAM)
shared_buffers = 256MB          # 25% of RAM
effective_cache_size = 1GB      # 50-75% of RAM
work_mem = 16MB                 # RAM / max_connections
maintenance_work_mem = 128MB    # For VACUUM, CREATE INDEX

# Connection Settings
max_connections = 100
max_prepared_transactions = 100

# Write-Ahead Log
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB

# Checkpoints
checkpoint_completion_target = 0.9
```

### Security Hardening

Edit `pg_hba.conf`:

```conf
# Require SSL for all remote connections
hostssl all all 0.0.0.0/0 scram-sha-256

# Local connections only via socket
local all all peer

# No password authentication
# (use scram-sha-256 instead of md5 or trust)
```

Edit `postgresql.conf`:

```conf
# Enable SSL
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_ca_file = '/etc/postgresql/ssl/ca.crt'

# Logging
log_connections = on
log_disconnections = on
log_duration = on
log_statement = 'mod'  # Log modifications

# Authentication
password_encryption = scram-sha-256
```

---

## 🔐 Security Features

### Row-Level Security (RLS)

Verify RLS is active:
```sql
-- Check enabled tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE rowsecurity = true;

-- View policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies;
```

Test RLS:
```sql
-- Set context (simulating a user from store X)
SET app.current_store_id = 'store-uuid-here';

-- Query will only return data for that store
SELECT * FROM products;
```

### Encryption

Use encryption functions:
```sql
-- Encrypt credit card
UPDATE payments 
SET encrypted_card_number = pgp_sym_encrypt(card_number, 'encryption-key')
WHERE id = 123;

-- Decrypt when needed
SELECT pgp_sym_decrypt(encrypted_card_number, 'encryption-key') 
FROM payments 
WHERE id = 123;
```

### Audit Logging

Check audit logs:
```sql
-- Payment security logs
SELECT * FROM payment_security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Access logs
SELECT * FROM audit_log
WHERE action_type = 'PAYMENT_PROCESSED'
ORDER BY timestamp DESC
LIMIT 100;
```

---

## 📊 Monitoring & Maintenance

### Check Database Status

```bash
# Connection to database
psql -h localhost -U postgres -d telegram_ecommerce

# Database size
SELECT pg_size_pretty(pg_database_size('telegram_ecommerce'));

# Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Active connections
SELECT count(*) FROM pg_stat_activity;

# Slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Vacuum & Analyze

```sql
-- Manual vacuum
VACUUM ANALYZE;

-- Vacuum specific table
VACUUM ANALYZE products;

-- Check last vacuum times
SELECT schemaname, relname, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
ORDER BY last_vacuum DESC;
```

### Backup

```bash
# Full backup
pg_dump -h localhost -U postgres telegram_ecommerce > backup.sql

# Compressed backup
pg_dump -h localhost -U postgres telegram_ecommerce | gzip > backup.sql.gz

# Schema only
pg_dump -h localhost -U postgres --schema-only telegram_ecommerce > schema.sql

# Restore
psql -h localhost -U postgres telegram_ecommerce < backup.sql
```

---

## 🆘 Troubleshooting

### Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Test connection
psql -h localhost -U postgres -c "SELECT version();"
```

### Authentication Problems

```bash
# Check pg_hba.conf
sudo cat /etc/postgresql/16/main/pg_hba.conf

# Reload configuration
sudo systemctl reload postgresql

# Check authentication methods
SELECT * FROM pg_hba_file_rules;
```

### Performance Issues

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Check locks
SELECT * FROM pg_locks
WHERE NOT granted;

-- Kill long-running query
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';
```

---

## 🔄 Migration from Other Databases

### From MySQL

```bash
# Use pgloader
pgloader mysql://user:pass@localhost/dbname \
         postgresql://user:pass@localhost/telegram_ecommerce
```

### From SQLite

```bash
# Export from SQLite
sqlite3 dev.db .dump > sqlite_dump.sql

# Convert and import
# (manual conversion may be needed for syntax differences)
```

---

## 📚 Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [pgcrypto Extension](https://www.postgresql.org/docs/current/pgcrypto.html)
- [Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Database Optimization Guide](../../tools/database/README.md)
- [Security Best Practices](../../docs/security/)
