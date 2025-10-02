## Monitoring (Prometheus + Grafana)

Unified quick start, configuration pointers, usage, and troubleshooting.

### Quick start
- Start all services (includes monitoring): `docker-compose up -d`
- React Admin monitoring: `http://localhost:3000/monitoring`
- Grafana: `http://localhost:3030` (admin/admin)
- Prometheus: `http://localhost:9090`
- Backend metrics: `http://localhost:3001/metrics`

### Configuration locations
- Prometheus: `config/prometheus/prometheus.yml`
- Alerts: `config/prometheus/alerts/backend-alerts.yml`
- Grafana provisioning: `config/grafana/provisioning/`
- Grafana config: `config/grafana/grafana.ini`

### In-app usage
- Roles: OWNER/ADMIN can access `/monitoring` in React Admin
- JSON summary endpoint: `/api/metrics` (requires auth)

### Troubleshooting
- Prometheus config error about `storage.*`: set retention/path via Docker Compose args, not in `prometheus.yml`
- Dashboards empty: ensure backend target is UP in Prometheus; verify datasource; check time range
- Grafana iframe blank: enable `allow_embedding` and `cookie_samesite = none` in `grafana.ini`, restart Grafana

### Helpful commands
```bash
docker-compose logs -f grafana
docker-compose logs -f prometheus
curl http://localhost:3001/metrics
curl http://localhost:9090/api/v1/targets
```


