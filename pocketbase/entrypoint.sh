#!/bin/sh
set -e
# Create/update the superuser from env on every boot (idempotent).
if [ -n "$PB_SUPERUSER_EMAIL" ] && [ -n "$PB_SUPERUSER_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir=/pb_data --migrationsDir=/pb/pb_migrations
fi
exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks
