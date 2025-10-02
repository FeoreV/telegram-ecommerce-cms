# PgBouncer Configuration

PgBouncer connection pooling configuration for PostgreSQL.

## 📁 File

### `pgbouncer.ini`
PgBouncer configuration for database connection pooling.

**Benefits:**
- Connection pooling
- Reduced database load
- Better resource utilization
- Connection limit management

## 🚀 Usage

### Docker Compose

```yaml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    ports:
      - "6432:6432"
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASES_DBNAME: telegram_ecommerce
    volumes:
      - ./config/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
```

## ⚙️ Configuration

```ini
[databases]
telegram_ecommerce = host=postgres port=5432 dbname=telegram_ecommerce

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

### Pool Modes
- **session**: One connection per session (default)
- **transaction**: One connection per transaction (recommended)
- **statement**: One connection per statement

## 🔌 Application Connection

Instead of connecting directly to PostgreSQL, connect through PgBouncer:

```javascript
// Before
DATABASE_URL=postgresql://user:pass@postgres:5432/dbname

// After (with PgBouncer)
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/dbname
```

## 📊 Monitoring

```bash
# Connect to admin console
psql -h localhost -p 6432 -U pgbouncer pgbouncer

# Show statistics
SHOW STATS;

# Show pools
SHOW POOLS;

# Show clients
SHOW CLIENTS;

# Show servers
SHOW SERVERS;
```

## 📚 Resources
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [Configuration Guide](https://www.pgbouncer.org/config.html)
