## Docker and Runtime Troubleshooting

Consolidated fixes for common issues: Docker not running, rebuilds, Redis, and Prometheus config.

### Docker Desktop not running (Windows)
- Error: connect ENOENT \\.\pipe\dockerDesktopEngine
- Fix: start Docker Desktop; verify with `docker info`

### Rebuild images
- All services: docker-compose up -d --build
- Only bot: docker-compose stop bot && docker-compose rm -f bot && docker-compose build --no-cache bot && docker-compose up -d bot

### Redis quick fix
- For dev without Redis: run bot with REDIS_URL unset → in‑memory sessions
- With Docker: docker-compose up -d redis

### Prometheus config error
- Do not set storage in prometheus.yml; set retention/path via Docker Compose command args

### Store cleanup helper
- To delete a problematic test store, use scripts in backend/scripts or tools/bots as appropriate

### Startup checklist
- .env files present and valid
- Prisma migrations applied; database reachable
- Telegram token configured
- Optional: Redis available in production


