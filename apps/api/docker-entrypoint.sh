#!/bin/sh
set -eu

cd /app/apps/api

echo "[entrypoint] Applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "[entrypoint] Seeding demo data..."
  ./node_modules/.bin/tsx prisma/seed.ts
fi

echo "[entrypoint] Starting API..."
exec node dist/main.js
