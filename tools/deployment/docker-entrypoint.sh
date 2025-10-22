#!/bin/sh
set -e

# =============================================================================
# Docker Entrypoint Script for Backend Service
# Production-ready startup sequence
# =============================================================================

echo "🚀 Starting Backend Service in Production Mode..."

# =============================================================================
# Environment Variables Validation
# =============================================================================
echo "📋 Validating environment variables..."

required_vars="DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET"
missing_vars=""

for var in $required_vars; do
    eval value=\$$var
    if [ -z "$value" ]; then
        missing_vars="$missing_vars $var"
    fi
done

if [ ! -z "$missing_vars" ]; then
    echo "❌ Missing required environment variables: $missing_vars"
    exit 1
fi

echo "✅ Environment variables validated"

# =============================================================================
# Database Connection Check
# =============================================================================
echo "🔗 Checking database connection..."

# Wait for database to be ready
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Attempting database connection (attempt $attempt/$max_attempts)..."
    
    if npx prisma db push --preview-feature --skip-generate > /dev/null 2>&1; then
        echo "✅ Database connection successful"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Could not connect to database after $max_attempts attempts"
        exit 1
    fi
    
    echo "⏳ Database not ready, waiting 5 seconds..."
    sleep 5
    attempt=$((attempt + 1))
done

# =============================================================================
# Database Migration & Setup
# =============================================================================
echo "📊 Running database migrations..."

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Apply database migrations
echo "🔄 Applying database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

# Seed database if needed (only on first run)
if [ "$SEED_DATABASE" = "true" ]; then
    echo "🌱 Seeding database..."
    if npx prisma db seed; then
        echo "✅ Database seeded successfully"
    else
        echo "⚠️ Database seeding failed (continuing anyway)"
    fi
fi

# =============================================================================
# Health Check Setup
# =============================================================================
echo "🔍 Setting up health checks..."

# Create health check endpoint test
health_check() {
    curl -f http://localhost:3001/health > /dev/null 2>&1
}

# =============================================================================
# Log Directory Setup
# =============================================================================
echo "📝 Setting up logging..."

# Ensure log directory exists and is writable
mkdir -p /app/logs
touch /app/logs/app.log
touch /app/logs/error.log
touch /app/logs/access.log

echo "✅ Logging setup complete"

# =============================================================================
# Upload Directory Setup
# =============================================================================
echo "📁 Setting up upload directories..."

# Ensure upload directories exist
mkdir -p /app/uploads/payment-proofs
mkdir -p /app/uploads/products
mkdir -p /app/uploads/temp

echo "✅ Upload directories setup complete"

# =============================================================================
# Process Management Setup
# =============================================================================
echo "⚙️ Setting up process management..."

# Set up signal handlers for graceful shutdown
handle_signal() {
    echo "🛑 Received termination signal, shutting down gracefully..."
    
    # Send SIGTERM to the Node.js process
    if [ ! -z "$NODE_PID" ]; then
        kill -TERM "$NODE_PID"
        wait "$NODE_PID"
    fi
    
    echo "✅ Graceful shutdown completed"
    exit 0
}

# Trap signals
trap 'handle_signal' TERM INT

# =============================================================================
# Performance Optimization
# =============================================================================
echo "🚀 Applying performance optimizations..."

# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=64"

# Enable V8 optimizations
export UV_THREADPOOL_SIZE=4

echo "✅ Performance optimizations applied"

# =============================================================================
# Start Application
# =============================================================================
echo "🎯 Starting application..."

# Start the Node.js application
node dist/index.js &
NODE_PID=$!

echo "🚀 Backend service started successfully (PID: $NODE_PID)"

# =============================================================================
# Readiness Check
# =============================================================================
echo "⏳ Waiting for application to be ready..."

# Wait for application to be ready
ready_attempts=30
ready_attempt=1

while [ $ready_attempt -le $ready_attempts ]; do
    if health_check; then
        echo "✅ Application is ready and healthy"
        break
    fi
    
    if [ $ready_attempt -eq $ready_attempts ]; then
        echo "❌ Application failed to become ready"
        exit 1
    fi
    
    echo "⏳ Application not ready yet, waiting... (attempt $ready_attempt/$ready_attempts)"
    sleep 2
    ready_attempt=$((ready_attempt + 1))
done

# =============================================================================
# Monitoring Loop
# =============================================================================
echo "👀 Starting monitoring loop..."

# Monitor the application process
while true; do
    # Check if the process is still running
    if ! kill -0 "$NODE_PID" 2>/dev/null; then
        echo "❌ Application process died unexpectedly"
        exit 1
    fi
    
    # Optional: Perform health check
    if [ "$ENABLE_HEALTH_MONITORING" = "true" ]; then
        if ! health_check; then
            echo "⚠️ Health check failed"
        fi
    fi
    
    sleep 30
done
