#!/bin/sh

echo "🚀 Railway startup script"
echo "📊 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"
echo "🏠 Working directory: $(pwd)"

# Check if dist/main.js exists
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js not found!"
  ls -la
  exit 1
fi

echo "✅ Application files found"

# Check environment variables
echo "🔧 Checking environment variables:"
echo "   - DATABASE_HOST: ${DATABASE_HOST:+✅ Set}"
echo "   - DATABASE_PORT: ${DATABASE_PORT:+✅ Set}"
echo "   - JWT_SECRET: ${JWT_SECRET:+✅ Set}"
echo "   - REDIS_HOST: ${REDIS_HOST:+✅ Set}"

echo "🚀 Starting NestJS application..."
exec node dist/main.js
