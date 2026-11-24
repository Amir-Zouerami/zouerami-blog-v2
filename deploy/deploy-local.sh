#!/usr/bin/env bash
# Deploy from THIS machine, without GitHub (for when GitHub or the international internet is out).
#
#   deploy/deploy-local.sh            run the quick checks, build the three images here, send them to the server, deploy
#   deploy/deploy-local.sh --fast     the same without the checks
#
# What it does: builds the images from the code in your working tree, opens an SSH tunnel to the server's own image
# registry (it listens on the server's 127.0.0.1:5000 only), pushes the images through it, then runs deploy/deploy.sh on
# the server, which pulls from that registry, restarts the stack, checks health and rolls back if it is not healthy.
# Only layers the server does not have yet travel, so after the first time a deploy is small.
#
# Settings come from deploy/local.env (not committed; copy deploy/local.env.example) or from the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy/local.env ] && . deploy/local.env
: "${DEPLOY_HOST:?set DEPLOY_HOST in deploy/local.env (see deploy/local.env.example)}"
DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_PATH=${DEPLOY_PATH:-/srv/zouerami}
TUNNEL_PORT=${TUNNEL_PORT:-15000}
FAST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    -h | --help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg (see --help)"; exit 2 ;;
  esac
done

SSH_OPTS=(-o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ConnectTimeout=20)
[ -n "${SSH_KEY:-}" ] && SSH_OPTS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
DIRTY=""
[ -n "$(git status --porcelain 2>/dev/null)" ] && DIRTY="-dirty"
TAG="local-$SHORT$DIRTY-$(date +%Y%m%d-%H%M%S)"
NAMES=(web pocketbase caddy)
echo "==> Deploying $TAG to $TARGET"

echo "==> Can we reach the server?"
remote "echo reachable; cd '$DEPLOY_PATH' && test -f .env"

if [ "$FAST" = 0 ]; then
  echo "==> Quick checks (lint, types, unit tests)"
  (cd web && bun run check && bun run test)
fi

# Same build settings as `docker compose build` uses here (compose.yaml: BUILD_NETWORK / BUILD_PROXY): Docker then
# reuses the layers it already has, and a build needs the internet (through your proxy) only for what is new.
BUILD_ARGS=()
[ -n "${BUILD_NETWORK:-}" ] && BUILD_ARGS+=(--network "$BUILD_NETWORK")
if [ -n "${BUILD_PROXY:-}" ]; then
  for v in http_proxy https_proxy HTTP_PROXY HTTPS_PROXY; do BUILD_ARGS+=(--build-arg "$v=$BUILD_PROXY"); done
fi

echo "==> Building the images here"
for n in "${NAMES[@]}"; do
  docker build "${BUILD_ARGS[@]}" -t "127.0.0.1:$TUNNEL_PORT/zouerami-$n:$TAG" "$n"
done

echo "==> Sending compose, nginx, caddy and deploy files"
tar czf - --exclude=deploy/local.env compose.prod.yaml nginx deploy caddy \
  | remote "mkdir -p '$DEPLOY_PATH' && tar xzf - -C '$DEPLOY_PATH'"
remote "cd '$DEPLOY_PATH' && docker compose -f compose.prod.yaml up -d registry"

CTL=$(mktemp -u /tmp/zdeploy-XXXXXX.sock)
cleanup() { ssh -S "$CTL" -O exit "$TARGET" >/dev/null 2>&1 || true; }
trap cleanup EXIT
echo "==> Opening the tunnel to the server's registry"
ssh "${SSH_OPTS[@]}" -f -N -M -S "$CTL" -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:$TUNNEL_PORT:127.0.0.1:5000" "$TARGET"
for _ in $(seq 1 20); do curl --noproxy "*" -fs "http://127.0.0.1:$TUNNEL_PORT/v2/" >/dev/null && break; sleep 1; done
curl --noproxy "*" -fs "http://127.0.0.1:$TUNNEL_PORT/v2/" >/dev/null || { echo "the registry on the server does not answer"; exit 1; }

echo "==> Pushing the images (only the layers the server lacks)"
for n in "${NAMES[@]}"; do
  ok=0
  for _ in 1 2 3; do
    if docker push "127.0.0.1:$TUNNEL_PORT/zouerami-$n:$TAG"; then ok=1; break; fi
    echo "push failed, trying again…"; sleep 5
  done
  [ "$ok" = 1 ] || { echo "could not push zouerami-$n"; exit 1; }
done
cleanup
trap - EXIT

echo "==> Deploying on the server"
remote "cd '$DEPLOY_PATH' && WEB_IMAGE=127.0.0.1:5000/zouerami-web:$TAG POCKETBASE_IMAGE=127.0.0.1:5000/zouerami-pocketbase:$TAG CADDY_IMAGE=127.0.0.1:5000/zouerami-caddy:$TAG sh deploy/deploy.sh"

# local images with the tunnel's name are only needed for the push; keep the last two builds, drop older ones
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E "^127\.0\.0\.1:$TUNNEL_PORT/zouerami-" | grep -v ":$TAG\$" | sort -r | tail -n +4 | xargs -r docker rmi >/dev/null 2>&1 || true
echo "==> Done: $TAG is live."
