#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until echo "SELECT 1" | npx prisma db execute --stdin --url "$DATABASE_URL" > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Database is ready"

echo "📦 Running prisma generate..."
npx prisma generate

echo "🔧 Running prisma migrate deploy..."
npx prisma migrate deploy

echo "🚀 Starting server..."
if [ "$NODE_ENV" = "production" ]; then
  exec npm run start
else
  exec npm run dev
fi
