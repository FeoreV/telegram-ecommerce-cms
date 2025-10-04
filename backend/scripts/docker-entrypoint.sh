#!/bin/sh
set -e

echo "🚀 Starting Backend Service..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} -U ${POSTGRES_USER:-postgres}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379}; do
  echo "Redis is unavailable - sleeping"
  sleep 2
done

echo "✅ Redis is ready!"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Optional: Seed database if flag is set
if [ "$RUN_DB_SEED" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️ Seeding failed or already seeded"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p /app/uploads /app/logs /app/storage/secure

# Set proper permissions
chown -R backend:nodejs /app/uploads /app/logs /app/storage 2>/dev/null || true

echo "✅ Initialization complete!"
echo "🎯 Starting application..."

# Start the application
exec node dist/index.js

