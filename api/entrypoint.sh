#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until echo "SELECT 1" | npx prisma db execute --stdin > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Database is ready"

echo "📦 Running prisma generate..."
npx prisma generate

if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "🔧 Running prisma db push..."
  npx prisma db push --skip-generate
fi

echo "🚀 Starting server..."
exec npm run dev
