#!/bin/bash

# Monitoring Stop Script for Telegram E-commerce Platform
# Stops all monitoring services

set -e

echo "🛑 Stopping Monitoring Stack..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop all monitoring services
docker-compose -f docker-compose.monitoring.yml down

echo ""
echo -e "${GREEN}✅ Monitoring Stack Stopped!${NC}"
echo ""
echo "💡 To remove all data, run:"
echo "  docker-compose -f docker-compose.monitoring.yml down -v"
echo ""
