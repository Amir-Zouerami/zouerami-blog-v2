#!/bin/sh
# Runs ON THE SERVER. Removes old images from the server's own registry, keeping the ones given as arguments
# (image references such as 127.0.0.1:5000/zouerami-web:TAG). Called by deploy.sh after a successful deploy.
set -eu
REG=${REGISTRY_URL:-http://127.0.0.1:5000}
cd "$(dirname "$0")/.."
ACCEPT='Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'

# "name:tag" for every reference we must keep (name = the last path part: zouerami-web)
KEEP=$(for ref in "$@"; do printf '%s\n' "${ref##*/}"; done)

digest() { # name tag
  curl -fsSI -H "$ACCEPT" "$REG/v2/$1/manifests/$2" | tr -d '\r' | awk 'tolower($1)=="docker-content-digest:" {print $2}'
}

for name in zouerami-web zouerami-pocketbase zouerami-caddy; do
  tags=$(curl -fsS "$REG/v2/$name/tags/list" | sed -n 's/.*"tags":\[\(.*\)\].*/\1/p' | tr ',' '\n' | tr -d '"')
  [ -n "$tags" ] || continue
  # digests of the tags we keep: two tags can share one digest, and that one must not be deleted
  keepd=""
  for t in $tags; do
    if printf '%s\n' "$KEEP" | grep -qxF "$name:$t"; then keepd="$keepd $(digest "$name" "$t")"; fi
  done
  for t in $tags; do
    printf '%s\n' "$KEEP" | grep -qxF "$name:$t" && continue
    d=$(digest "$name" "$t")
    [ -n "$d" ] || continue
    case " $keepd " in *" $d "*) continue ;; esac
    curl -fsS -X DELETE "$REG/v2/$name/manifests/$d" >/dev/null && echo "removed $name:$t"
  done
done
# free the space of the removed layers
docker compose -f compose.prod.yaml exec -T registry registry garbage-collect --delete-untagged /etc/docker/registry/config.yml >/dev/null 2>&1 || true
