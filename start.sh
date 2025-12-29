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
echo "   - DATABASE_USER: ${DATABASE_USER:+✅ Set}"
echo "   - DATABASE_PASSWORD: ${DATABASE_PASSWORD:+✅ Set}"
echo "   - DATABASE_NAME: ${DATABASE_NAME:+✅ Set}"
echo "   - DATABASE_SSL: ${DATABASE_SSL:+✅ Set}"
echo "   - JWT_SECRET: ${JWT_SECRET:+✅ Set}"
echo "   - JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:+✅ Set}"
echo "   - REDIS_HOST: ${REDIS_HOST:+✅ Set}"
echo "   - REDIS_PORT: ${REDIS_PORT:+✅ Set}"
echo "   - REDIS_PASSWORD: ${REDIS_PASSWORD:+✅ Set}"
echo "   - REDIS_TLS: ${REDIS_TLS:+✅ Set}"
echo "   - OPENAI_API_KEY: ${OPENAI_API_KEY:+✅ Set}"
echo "   - PORT: ${PORT:+✅ Set (${PORT})}"
echo "   - NODE_ENV: ${NODE_ENV:+✅ Set (${NODE_ENV})}"

echo "🚀 Starting NestJS application..."
echo "📁 Checking dist/main.js exists..."
if [ -f "dist/main.js" ]; then
  echo "✅ dist/main.js found"
  ls -la dist/main.js
  exec node dist/main.js
else
  echo "❌ dist/main.js not found!"
  ls -la dist/
  exit 1
fi
