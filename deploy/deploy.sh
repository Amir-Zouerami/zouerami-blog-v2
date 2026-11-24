#!/bin/sh
# Runs ON THE SERVER (called by .github/workflows/release.yml over SSH, or by deploy/deploy-local.sh), from the app
# directory (/srv/zouerami).
#   WEB_IMAGE=127.0.0.1:5000/zouerami-web:TAG POCKETBASE_IMAGE=127.0.0.1:5000/zouerami-pocketbase:TAG [CADDY_IMAGE=…] sh deploy/deploy.sh
# The images normally come from the server's own registry (see compose.prod.yaml: `registry`), so nothing is downloaded
# from GitHub. Pulls them, restarts the stack, waits for it to be healthy, and puts the previous images back if it is not.
# The .env file is only changed once the images are here, so a failed download leaves everything exactly as it was.
set -eu
: "${WEB_IMAGE:?}"
: "${POCKETBASE_IMAGE:?}"
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env is missing on the server (see docs/deploy.md)"; exit 1; }
COMPOSE="docker compose -f compose.prod.yaml"
SITE_HOST=$(grep "^SERVER_NAME=" .env | head -1 | cut -d= -f2-)
SITE_HOST=${SITE_HOST:-amir-zouerami.dev}

setenv() { # setenv KEY VALUE  (idempotent edit of .env)
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
getenv() { grep "^$1=" .env | head -1 | cut -d= -f2- || true; }

PREV_WEB=$(getenv WEB_IMAGE)
PREV_PB=$(getenv POCKETBASE_IMAGE)
PREV_CADDY=$(getenv CADDY_IMAGE)
SERVICES="web pocketbase"
[ -n "${CADDY_IMAGE:-}" ] && SERVICES="$SERVICES caddy"

# the registry has to be up before anything can be pulled from it (a no-op when it already runs)
$COMPOSE up -d registry

# pull with the new tags in the environment only; .env stays untouched until this has worked
pull() {
  WEB_IMAGE="$WEB_IMAGE" POCKETBASE_IMAGE="$POCKETBASE_IMAGE" CADDY_IMAGE="${CADDY_IMAGE:-$PREV_CADDY}" $COMPOSE pull $SERVICES
}
n=0
until pull; do
  n=$((n + 1))
  [ "$n" -ge 3 ] && { echo "Could not pull the images; nothing was changed."; exit 1; }
  echo "Pull failed, trying again ($n/3)…"
  sleep 10
done

setenv WEB_IMAGE "$WEB_IMAGE"
setenv POCKETBASE_IMAGE "$POCKETBASE_IMAGE"
[ -n "${CADDY_IMAGE:-}" ] && setenv CADDY_IMAGE "$CADDY_IMAGE"

$COMPOSE up -d --remove-orphans

healthy() {
  for _ in $(seq 1 40); do
    if $COMPOSE exec -T pocketbase wget -q --spider http://127.0.0.1:8090/api/health 2>/dev/null \
      && $COMPOSE exec -T nginx wget -q --spider --no-check-certificate --header "Host: $SITE_HOST" https://127.0.0.1/ 2>/dev/null; then
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
  # housekeeping, never a reason to fail a deploy: drop old images (here and in the registry), keep this and the previous one
  KEEP="$WEB_IMAGE $POCKETBASE_IMAGE ${CADDY_IMAGE:-$(getenv CADDY_IMAGE)} $PREV_WEB $PREV_PB $PREV_CADDY"
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '(^|/)zouerami-(web|pocketbase|caddy):' | while read -r img; do
    case " $KEEP " in *" $img "*) ;; *) docker rmi "$img" >/dev/null 2>&1 || true ;; esac
  done
  sh deploy/registry-prune.sh $KEEP || echo "(registry cleanup skipped)"
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
