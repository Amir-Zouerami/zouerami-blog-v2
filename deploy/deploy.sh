#!/bin/sh
# Runs ON THE SERVER (called by .github/workflows/release.yml over SSH), from the app directory (/srv/zouerami).
#   WEB_IMAGE=ghcr.io/o/zouerami-web:sha-… POCKETBASE_IMAGE=ghcr.io/o/zouerami-pocketbase:sha-… [CADDY_IMAGE=ghcr.io/o/zouerami-caddy:sha-…] sh deploy/deploy.sh
# Pulls the two images, restarts the stack, waits for it to be healthy, and puts the previous images back if it is not.
set -eu
: "${WEB_IMAGE:?}"
: "${POCKETBASE_IMAGE:?}"
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env is missing on the server (see docs/deploy.md)"; exit 1; }
COMPOSE="docker compose -f compose.prod.yaml"

setenv() { # setenv KEY VALUE  (idempotent edit of .env)
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
getenv() { grep "^$1=" .env | head -1 | cut -d= -f2- || true; }

PREV_WEB=$(getenv WEB_IMAGE)
PREV_PB=$(getenv POCKETBASE_IMAGE)
PREV_CADDY=$(getenv CADDY_IMAGE)
setenv WEB_IMAGE "$WEB_IMAGE"
setenv POCKETBASE_IMAGE "$POCKETBASE_IMAGE"
SERVICES="web pocketbase"
if [ -n "${CADDY_IMAGE:-}" ]; then
  setenv CADDY_IMAGE "$CADDY_IMAGE"
  SERVICES="$SERVICES caddy"
fi

$COMPOSE pull $SERVICES
$COMPOSE up -d --remove-orphans

healthy() {
  for _ in $(seq 1 40); do
    if $COMPOSE exec -T pocketbase wget -q --spider http://127.0.0.1:8090/api/health 2>/dev/null \
      && $COMPOSE exec -T nginx wget -q --spider --no-check-certificate https://127.0.0.1/ 2>/dev/null; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# nginx config is a bind mount: recreate is not triggered by file changes, so reload it explicitly
$COMPOSE exec -T nginx nginx -s reload 2>/dev/null || true

if healthy; then
  echo "Deployed: $WEB_IMAGE"
  docker image prune -f >/dev/null
else
  echo "Health check failed, rolling back"
  if [ -n "$PREV_WEB" ] && [ -n "$PREV_PB" ]; then
    setenv WEB_IMAGE "$PREV_WEB"
    setenv POCKETBASE_IMAGE "$PREV_PB"
    [ -n "$PREV_CADDY" ] && setenv CADDY_IMAGE "$PREV_CADDY"
    $COMPOSE up -d --remove-orphans
  fi
  $COMPOSE logs --tail=60 web nginx || true
  exit 1
fi
