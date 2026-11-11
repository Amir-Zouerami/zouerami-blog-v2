#!/bin/sh
# One-time certificate issuance for a fresh VPS. Run from the repo root AFTER DNS points at the server.
#   SERVER_NAME=zouerami.dev EMAIL=you@example.com sh deploy/init-letsencrypt.sh
set -eu
: "${SERVER_NAME:?set SERVER_NAME}"
: "${EMAIL:?set EMAIL}"
COMPOSE="docker compose -f compose.prod.yaml"

# nginx cannot start without a certificate, so create a short-lived self-signed one first.
$COMPOSE run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$SERVER_NAME &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj '/CN=localhost' \
    -keyout /etc/letsencrypt/live/$SERVER_NAME/privkey.pem \
    -out /etc/letsencrypt/live/$SERVER_NAME/fullchain.pem"
$COMPOSE up -d nginx

# replace it with the real certificate (webroot challenge served by nginx on :80)
$COMPOSE run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$SERVER_NAME /etc/letsencrypt/archive/$SERVER_NAME /etc/letsencrypt/renewal/$SERVER_NAME.conf &&
  certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos \
    --email $EMAIL -d $SERVER_NAME -d www.$SERVER_NAME"
$COMPOSE exec nginx nginx -s reload
echo "Certificate issued for $SERVER_NAME and www.$SERVER_NAME."
