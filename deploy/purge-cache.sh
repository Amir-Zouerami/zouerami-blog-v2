#!/bin/sh
# Drops nginx's cached HTML so a just-published post shows immediately (otherwise it appears within CACHE_TTL seconds).
set -eu
docker compose -f "${COMPOSE_FILE:-compose.prod.yaml}" exec nginx sh -c 'rm -rf /var/cache/nginx/html/*'
echo "nginx page cache purged."
