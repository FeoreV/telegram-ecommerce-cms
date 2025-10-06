#!/bin/bash

# Temporary script to disable CSRF for testing
# Use ONLY for development/debugging!

echo "⚠️  Temporarily disabling CSRF protection for testing"
echo "This is NOT recommended for production!"
echo ""

# Add DISABLE_CSRF to backend .env
if ! grep -q "^DISABLE_CSRF=" backend/.env 2>/dev/null; then
    echo "DISABLE_CSRF=true" >> backend/.env
    echo "✅ Added DISABLE_CSRF=true to backend/.env"
else
    sed -i 's/^DISABLE_CSRF=.*/DISABLE_CSRF=true/' backend/.env
    echo "✅ Updated DISABLE_CSRF=true in backend/.env"
fi

# Restart backend
echo ""
echo "Restarting backend..."
pm2 restart telegram-backend

echo ""
echo "✅ CSRF disabled temporarily"
echo ""
echo "To re-enable CSRF:"
echo "1. Edit backend/.env and set: DISABLE_CSRF=false"
echo "2. Run: pm2 restart telegram-backend"
echo ""
echo "Test store creation now at: http://82.147.84.78:3000"

