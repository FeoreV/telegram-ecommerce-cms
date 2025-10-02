# Docker Configurations

This directory contains all Docker Compose configurations for different deployment scenarios.

## Available Configurations

### Development

- **`docker-compose.dev.yml`** - Development environment with MySQL
  - Hot reload enabled
  - Debug mode
  - Local volumes mounted
  - Usage: `docker-compose -f config/docker/docker-compose.dev.yml up -d`

### Production

- **`docker-compose.mysql-prod.yml`** - Production with MySQL database
  - Optimized for production
  - Uses MySQL 8.0
  - Registry-based images
  - Usage: `docker-compose -f config/docker/docker-compose.mysql-prod.yml up -d`

- **`docker-compose.postgres-prod.yml`** - Production with PostgreSQL database
  - Optimized for production
  - Uses PostgreSQL 16
  - Full observability stack (ELK: Elasticsearch, Logstash, Kibana)
  - Usage: `docker-compose -f config/docker/docker-compose.postgres-prod.yml --env-file .env.production up -d`

### Specialized Configurations

- **`docker-compose.secure-infrastructure.yml`** - Security-hardened infrastructure
  - Enhanced security features
  - Network isolation
  - Security scanning

- **`docker-compose.mtls.yml`** - Mutual TLS configuration
  - Certificate-based authentication
  - Encrypted service-to-service communication

- **`docker-compose.medusa.yml`** - Medusa CMS integration
  - E-commerce backend with Medusa
  - Currently in development (services commented out)

### Vault Configuration

- **`../vault/docker-compose.vault.yml`** - HashiCorp Vault for secrets management
  - Centralized secrets storage
  - Dynamic credentials

## Quick Start Scripts

For convenience, use the scripts in the project root:

### Linux/Mac:
- `./docker-start.sh` - Start development environment
- `./docker-dev.sh` - Start with database migrations and seeding
- `./docker-dev-stop.sh` - Stop development environment
- `./docker-prod.sh` - Start production environment (PostgreSQL)

### Windows:
- `docker-start.bat` - Start development environment
- `docker-dev.bat` - Start with database migrations and seeding
- `docker-dev-stop.bat` - Stop development environment

## Environment Variables

Copy the appropriate environment template from `config/environments/`:
- `env.example` - Development environment
- `env.production.example` - Production environment
- `security.env.example` - Security-specific variables
- `vault.env.example` - Vault configuration
- `bot.env.production.example` - Bot-specific production config

Copy to `.env` or `.env.production` in project root and configure as needed.

## Network Architecture

All services communicate through Docker networks:
- `telegram_network` (dev) / `botrt_network` (prod) - Main application network
- Service-to-service communication uses container names as hostnames

## Volumes

### Development:
- Source code mounted for hot reload
- Database data persisted in named volumes

### Production:
- Only data volumes mounted
- Application code baked into images
- Backup volumes for disaster recovery

## Health Checks

All critical services include health checks:
- Database: Connection testing
- Redis: Ping command
- Backend: HTTP endpoint checks
- Frontend: HTTP availability

## Monitoring (Production)

The PostgreSQL production setup includes:
- **Kibana** (http://localhost:5601) - Log analysis
- **Built-in /metrics** (http://localhost:3001/metrics) - Application metrics (JSON)

## Security Considerations

1. Never commit `.env` files with real credentials
2. Use strong passwords for production databases
3. Enable SSL/TLS for external access
4. Restrict network access in production
5. Regularly update base images
6. Use the secure-infrastructure or mtls configurations for sensitive deployments

## Troubleshooting

### Container won't start
```bash
docker-compose -f config/docker/docker-compose.dev.yml logs <service-name>
```

### Database connection issues
```bash
docker-compose -f config/docker/docker-compose.dev.yml exec database mysql -u telegram_user -p
```

### Reset everything
```bash
docker-compose -f config/docker/docker-compose.dev.yml down -v
```

## Migration Between Databases

To migrate from SQLite to MySQL or PostgreSQL, see: `docs/deployment/migrate-to-mysql.md`
