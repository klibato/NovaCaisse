#!/bin/bash
set -e

echo "=== NovaCaisse — Deployment ==="

# Check that .env.production exists
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found."
  echo "Copy .env.production.example to .env.production and fill in the values."
  exit 1
fi

# Load env file for compose
export $(grep -v '^#' .env.production | xargs)

echo "Pulling latest changes..."
git pull origin main

echo "Building production images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build

echo "Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "Waiting for database to be ready..."
docker compose -f docker-compose.prod.yml exec api sh -c 'until echo "SELECT 1" | npx prisma db execute --stdin --url "$DATABASE_URL" > /dev/null 2>&1; do sleep 1; done'

echo "Running database migrations..."
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

echo "=== Deployment complete ==="
echo "API:  https://api.novacaisse.fr"
echo "Web:  https://novacaisse.fr"
