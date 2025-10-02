# Redis Configuration

Redis configuration for caching, sessions, and real-time features.

## 📁 File

### `redis.conf`
Production-ready Redis configuration with security and performance optimizations.

**Key features:**
- Password authentication
- Persistence configuration (RDB + AOF)
- Memory limits and eviction policies
- Replication support
- Security hardening

**Usage in Docker:**
```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - ./config/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_data:/data
```

**Manual setup:**
```bash
sudo cp config/redis/redis.conf /etc/redis/redis.conf
sudo systemctl restart redis
```

## 🔧 Key Settings

### Security
```conf
# Require password
requirepass your-strong-password

# Bind to specific interface
bind 127.0.0.1 ::1

# Rename dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG-ADMIN-ONLY"
```

### Performance
```conf
# Max memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# AOF
appendonly yes
appendfsync everysec
```

## 📊 Monitoring

```bash
# Connect to Redis
redis-cli -h localhost -p 6379 -a your-password

# Check info
redis-cli INFO

# Monitor commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory

# Get stats
redis-cli INFO stats
```

## 🔗 Resources
- [Redis Official Documentation](https://redis.io/documentation)
- [Redis Security](https://redis.io/topics/security)
