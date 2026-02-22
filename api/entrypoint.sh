#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until echo "SELECT 1" | npx prisma db execute --stdin > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Database is ready"

if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "🔧 Running prisma migrate dev..."
  npx prisma migrate dev --name auto
fi

echo "📦 Running prisma generate..."
npx prisma generate

echo "🚀 Starting server..."
exec npm run dev
