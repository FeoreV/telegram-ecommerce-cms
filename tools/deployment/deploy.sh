#!/bin/bash

# Production Deployment Script
# SECURITY FIX: Enhanced error handling (CWE-754)
set -euo pipefail

# Error handler
trap 'echo "❌ Error occurred at line $LINENO. Deployment failed." >&2' ERR

echo "🚀 Starting production deployment..."

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod file not found!"
    echo "Copy env.prod.example to .env.prod and update with production values"
    exit 1
fi

# Load production environment
# SECURITY FIX: Safer environment loading
set -a
source .env.prod
set +a

echo "📦 Building and pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

echo "🗄️ Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

echo "🌱 Seeding production data (if needed)..."
# Uncomment if you need to seed production data
# docker-compose -f docker-compose.prod.yml run --rm backend npx prisma db seed

echo "🔄 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

echo "🔍 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "✅ Deployment completed!"
echo ""
echo "Services are available at:"
echo "  Frontend: http://localhost (or your domain)"
echo "  Backend API: http://localhost:3001"
echo "  Bot: Running and connected to Telegram"
echo ""
echo "To check logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f [service-name]"
