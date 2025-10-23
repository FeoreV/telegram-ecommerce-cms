#!/bin/bash

# Monitoring Start Script for Telegram E-commerce Platform
# Starts Prometheus, Grafana and all exporters

set -e

echo "🚀 Starting Monitoring Stack..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    exit 1
fi

# Check if backend network exists, create if not
if ! docker network inspect botrt_default &> /dev/null; then
    echo -e "${YELLOW}⚠️  Backend network not found, creating...${NC}"
    docker network create botrt_default
fi

# Start monitoring stack
echo -e "${GREEN}📊 Starting Prometheus...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d prometheus

echo -e "${GREEN}📈 Starting Grafana...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d grafana

echo -e "${GREEN}🖥️  Starting Node Exporter...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d node-exporter

echo -e "${GREEN}🔴 Starting Redis Exporter...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d redis-exporter || echo -e "${YELLOW}⚠️  Redis Exporter failed (Redis may not be running)${NC}"

echo -e "${GREEN}🐘 Starting Postgres Exporter...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d postgres-exporter || echo -e "${YELLOW}⚠️  Postgres Exporter failed (PostgreSQL may not be running)${NC}"

echo ""
echo -e "${GREEN}✅ Monitoring Stack Started!${NC}"
echo ""
echo "📊 Access the services:"
echo "  - Grafana:        http://82.147.84.78:3030 (admin/admin)"
echo "  - Prometheus:     http://82.147.84.78:9090"
echo "  - Node Exporter:  http://82.147.84.78:9100/metrics"
echo "  - Backend Metrics: http://82.147.84.78:3001/metrics"
echo "  - AdminJS Monitor: http://82.147.84.78:3001/admin → Monitoring"
echo ""
echo "📝 Check status:"
echo "  docker-compose -f docker-compose.monitoring.yml ps"
echo ""
echo "📋 View logs:"
echo "  docker-compose -f docker-compose.monitoring.yml logs -f"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check Prometheus
if curl -s http://82.147.84.78:9090/-/healthy > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Prometheus is healthy${NC}"
else
    echo -e "${RED}❌ Prometheus is not responding${NC}"
fi

# Check Grafana
if curl -s http://82.147.84.78:3030/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Grafana is healthy${NC}"
else
    echo -e "${RED}❌ Grafana is not responding${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
