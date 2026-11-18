# HTTPS certificates: automatic issuing and renewal

Everything about how `amir-zouerami.dev` gets its Let's Encrypt certificates and keeps them renewed.
Written 2026-11-18. Repo root below means `/media/amir/Development/Projects/Personal/zouerami-blog-v2/code/zouerami-blog-v2`
on the laptop and `/srv/zouerami` on the server (`193.151.146.197`, user `deploy`).

## 1. What exists

| Piece | Where | What it does |
|---|---|---|
| `caddy` container | `compose.prod.yaml` (service `caddy`), image built from `caddy/Dockerfile` | Asks Let's Encrypt for certificates and renews them. Serves nothing and publishes no port. |
| `caddy/Caddyfile` | repo, baked into the image | Says which names to get certificates for and how to prove ownership. |
| Parspack API token | server file `/srv/zouerami/.env`, variable `PARSPACK_API_TOKEN` | Lets Caddy create and delete the temporary `_acme-challenge` TXT records at Parspack. |
| `caddy_data` volume | Docker volume `zouerami_caddy_data` on the server | Holds the certificates and private keys (and the ACME account). **Back this up or you re-issue everything.** |
| `nginx` container | `compose.prod.yaml`, config `nginx/prod.conf` | Serves the site over HTTPS using the files Caddy wrote. Reads the volume read-only. Reloads itself every 12 hours to pick up renewed files. |

The old `certbot` container and `deploy/init-letsencrypt.sh` are gone (the script file may still be in the repo: delete it, it no longer works).

## 2. Why wildcard needs DNS

Let's Encrypt only issues wildcard certificates (`*.amir-zouerami.dev`) if you prove ownership through DNS: a temporary TXT record
`_acme-challenge.amir-zouerami.dev` is created, Let's Encrypt looks for it, then it is deleted. Caddy does this through the Parspack API.
No port needs to be open for this and nothing has to be reachable from the internet.

## 3. The two certificates

Caddy keeps **two** certificates, because a wildcard does not cover the bare domain:

| Certificate | Covers | Used by |
|---|---|---|
| `*.amir-zouerami.dev` | `www`, `mail`, and any other subdomain | the `www` redirect in nginx, the mail server (later) |
| `amir-zouerami.dev` | the bare domain | the main nginx site |

Both are renewed automatically about **30 days before expiry** (Let's Encrypt certificates last 90 days). There is nothing to run by hand.

## 4. Where the files are

Inside the Docker volume `zouerami_caddy_data`, mounted at `/data` in the caddy container and at `/caddy-data` (read-only) in nginx:

```
/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
    amir-zouerami.dev/amir-zouerami.dev.crt        # certificate + chain (use as ssl_certificate)
    amir-zouerami.dev/amir-zouerami.dev.key        # private key
    wildcard_.amir-zouerami.dev/wildcard_.amir-zouerami.dev.crt
    wildcard_.amir-zouerami.dev/wildcard_.amir-zouerami.dev.key
```

On the server's disk the volume lives under `/var/lib/docker/volumes/zouerami_caddy_data/_data/` (root only).
For the staging CA the directory is `acme-staging-v02.api.letsencrypt.org-directory` instead (see section 7).

nginx finds them through `CERT_DIR` (set in `compose.prod.yaml`) and the paths in `nginx/prod.conf`.

## 5. The Parspack token

- Created in the Parspack panel: **CDN section -> API token**.
- Required scopes: **list services, list DNS records, create DNS record, update DNS record, delete DNS record**.
  (A token without "list services" fails with `Token has not access to this action`: Caddy cannot find the zone.)
- Parspack blocks API requests from some IPs (it answered "IP Blocked" to the laptop and worked from the Iranian VPS). Issuance runs on the VPS, so this is fine.
- **Token format:** Parspack shows the token as `1234567|abc...` (a number, a pipe, then 48 letters and digits). Put **only the 48 characters after the `|`** into `PARSPACK_API_TOKEN`: the Caddy module refuses anything else ("API Token appears invalid").
- Stored only in `/srv/zouerami/.env` (permissions 600). **Never commit it.** To change it: edit that line, then `docker compose -f compose.prod.yaml up -d caddy`.
- If the token is deleted or expires, renewal fails silently until the old certificates are close to expiry. Check `docker compose -f compose.prod.yaml logs caddy` after changing anything.

## 6. Everyday commands (run on the server in `/srv/zouerami`)

```sh
cd /srv/zouerami
docker compose -f compose.prod.yaml ps                      # is caddy "healthy"?
docker compose -f compose.prod.yaml logs --tail=100 caddy   # issuing / renewal messages and errors

# when does the live certificate expire?
echo | openssl s_client -connect amir-zouerami.dev:443 -servername amir-zouerami.dev 2>/dev/null | openssl x509 -noout -dates -issuer
echo | openssl s_client -connect amir-zouerami.dev:443 -servername www.amir-zouerami.dev 2>/dev/null | openssl x509 -noout -dates -subject

# the same, from the files themselves
docker compose -f compose.prod.yaml exec caddy sh -c 'for f in /data/caddy/certificates/*/*/*.crt; do echo "$f"; openssl x509 -in "$f" -noout -enddate; done'
```

### Force a renewal now
Caddy renews on its own. To force it (for example after changing the token), remove the stored certificate and restart Caddy:
```sh
docker compose -f compose.prod.yaml stop nginx caddy
docker run --rm -v zouerami_caddy_data:/data alpine sh -c 'rm -rf /data/caddy/certificates'
docker compose -f compose.prod.yaml up -d caddy      # re-issues both certificates (takes about 2 minutes)
docker compose -f compose.prod.yaml up -d nginx
```
Let's Encrypt allows 5 certificates per exact set of names per week: do not do this in a loop. Use staging (section 7) when testing.

### Make nginx use a renewed certificate immediately
```sh
docker compose -f compose.prod.yaml exec nginx nginx -s reload
```
(It also happens by itself every 12 hours.)

## 7. Testing without burning Let's Encrypt limits (staging)

In `/srv/zouerami/.env` add both lines (the second one tells nginx where staging certificates are stored):
```
ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
ACME_CA_DIR=acme-staging-v02.api.letsencrypt.org-directory
```
Then `docker compose -f compose.prod.yaml up -d caddy nginx`. Browsers will show a warning (staging certificates are untrusted); that is expected.
To go back to real certificates remove both lines, delete the stored certificates as in section 6, and bring caddy up again.

## 8. Adding another domain or subdomain

- **Another subdomain of amir-zouerami.dev** (`blog.`, `status.`, ...): nothing to do for the certificate, the wildcard covers it. Add the DNS record at Parspack and an nginx `server` block that uses the wildcard certificate paths from `nginx/prod.conf`.
- **A different domain you own** (`example.com`): it needs its own certificate, and Caddy must be able to edit that domain's DNS.
  If that domain is also at Parspack, add its names to `caddy/Caddyfile` (another site block, e.g. `*.example.com, example.com { tls { propagation_delay 45s } respond 404 }`), rebuild the image (section 9) and add the matching nginx paths.
  If it is at another DNS provider, use that provider's Caddy DNS module (`github.com/caddy-dns/<provider>`) and add it to `caddy/Dockerfile` (`--with ...`).

## 9. Changing the Caddy image or Caddyfile

The image is built by GitHub Actions on every push to `main` (`.github/workflows/release.yml`, matrix entry `caddy`) and pulled by `deploy/deploy.sh`.
To build it by hand (needed on an Iranian network: `proxy.golang.org` answers 403 for some modules there):
```sh
docker build --build-arg GOPROXY=https://goproxy.cn,https://goproxy.io,direct -t zouerami-caddy:local caddy
# copy it to the server without a registry:
docker save zouerami-caddy:local | ssh -i ~/.ssh/id_rsa_vps root@193.151.146.197 docker load
```
Check the Caddyfile before shipping it:
```sh
docker run --rm -e SERVER_NAME=amir-zouerami.dev -e PARSPACK_API_TOKEN=x zouerami-caddy:local caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```
Settings you may want to change in `caddy/Caddyfile`:
- `propagation_delay 45s`: how long Caddy waits after creating the TXT record before asking Let's Encrypt to check. Parspack's name servers are several machines that sync with a delay; raise it if validation fails with "no TXT record found".
- `propagation_timeout 5m`: how long Caddy keeps checking before giving up.

## 10. If something breaks

| Symptom | Likely cause | What to do |
|---|---|---|
| `caddy` never becomes healthy, nginx does not start | certificates not issued | `docker compose -f compose.prod.yaml logs caddy`, then the rows below |
| log: `Token has not access to this action` | token lacks a scope (usually "list services") | create a new Parspack token with all five scopes, update `.env`, `up -d caddy` |
| log: `IP Blocked` / 403 from my.parspack.com | Parspack blocked the server's IP | open a Parspack ticket; test from the server with `curl -H "Authorization: Bearer $PARSPACK_API_TOKEN" https://my.parspack.com/cdnapi/external/api/v1/zones` |
| log: `no TXT record found` / challenge failed | name servers still syncing | raise `propagation_delay` in `caddy/Caddyfile`, rebuild, deploy |
| log: `too many certificates already issued` | Let's Encrypt weekly limit | wait, or use staging (section 7) |
| browser shows an expired certificate | renewal failing for weeks | check the caddy logs, fix the cause, force a renewal (section 6), `nginx -s reload` |
| `cannot load certificate ... No such file` in nginx | `ACME_CA_DIR` does not match the CA that issued | remove `ACME_CA`/`ACME_CA_DIR` or set both for staging, as in section 7 |

## 11. Backup

The certificates themselves can always be re-issued, but the ACME account and keys live in `zouerami_caddy_data`. A copy:
```sh
docker run --rm -v zouerami_caddy_data:/data -v "$PWD":/backup alpine tar czf /backup/caddy-data.tgz -C /data .
```
Keep that file private (it contains private keys).
