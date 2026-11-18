# Deploying amir-zouerami.dev to a VPS

> Nothing here has been run against a real server yet. The VPS work is intentionally the last step.
> Everything below is idempotent and can be done by hand or scripted.

## 0. Prerequisites
- A VPS (≥ 2 GB RAM, 2 vCPU is plenty), Debian/Ubuntu, with a public IPv4.
- DNS: `A amir-zouerami.dev → <ip>` and `A www.amir-zouerami.dev → <ip>` (switch these only when the stack is ready; .dev needs HTTPS so the site is unreachable until step 4).
- An SMTP provider (Resend/Brevo) with SPF + DKIM records for `amir-zouerami.dev`, an S3-compatible bucket for backups (Backblaze B2 / R2 / S3), optional GitHub/Google OAuth apps.

## 1. Harden the server (ask before locking yourself out)
```sh
adduser deploy && usermod -aG sudo deploy          # non-root deploy user
# copy your public key to /home/deploy/.ssh/authorized_keys, then in /etc/ssh/sshd_config:
#   PermitRootLogin no · PasswordAuthentication no   (verify a second session works BEFORE reloading ssh)
ufw default deny incoming && ufw allow 22,80,443/tcp && ufw enable
apt install -y fail2ban unattended-upgrades
```

## 2. Docker
Install Docker Engine + compose plugin from Docker's apt repository, then `usermod -aG docker deploy`.

## 3. Get the code and configure
```sh
git clone <repo> /srv/zouerami && cd /srv/zouerami
cp .env.example .env && chmod 600 .env
```
Edit `.env` (all required in production):
| Variable | Notes |
|---|---|
| `SITE_URL` | `https://amir-zouerami.dev` (https ⇒ cookies get `Secure`) |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `PB_SUPERUSER_EMAIL/PASSWORD` | strong, unique; creates the admin on boot |
| `SMTP_*`, `MAIL_FROM` | verification, reset and newsletter mail |
| `S3_BACKUP_*` | nightly off-site backup (see §6) |
| `SERVER_NAME`, `CACHE_TTL` | `amir-zouerami.dev`, `60` |

Build images locally or in CI (`.github/workflows/release.yml` pushes `ghcr.io/<owner>/zouerami-{web,pocketbase}`); set `WEB_IMAGE` / `POCKETBASE_IMAGE` in `.env` to pull them instead of building on the VPS.

## 4. First start and TLS
Certificates are handled by the `caddy` container (wildcard `*.amir-zouerami.dev` + `amir-zouerami.dev`, DNS-01 through the Parspack API); nginx only reads them from a shared read-only volume and reloads every 12 h. Everything about issuing, renewing, forcing a renewal and troubleshooting is in `docs/cert-auto-renewal.md`. `compose.prod.yaml up -d` starts caddy first; nginx waits until caddy is healthy (both certificates exist).

## 5. First content
Write in the back office at `https://amir-zouerami.dev/admin`: first sign up on the site, verify your email, then `docker compose -f compose.prod.yaml exec web bun run make-admin …` is not available in the runtime image, so promote yourself from the PocketBase dashboard instead (users → your row → role = admin) via the tunnel below.

PocketBase's own admin UI is **not public**. Tunnel to it: `ssh -L 8090:127.0.0.1:8090 deploy@<ip>` then open <http://127.0.0.1:8090/_/>.
- Create posts (`posts`), then one `post_translations` row per language (`en` / `fa`). Status `draft` is invisible; set `preview_token` to preview a draft at `/blog/<slug>?token=<token>`.
- Moderate comments in `comments` (change `status` from `pending` to `approved`/`rejected`). A user's first comment is held; later ones publish automatically.
- OAuth: Collections → users → Options → OAuth2 → enable GitHub/Google; redirect URL `https://amir-zouerami.dev/api/auth/oauth/callback`.
- Search Console / Bing: verify the domain (DNS TXT) and submit `https://amir-zouerami.dev/sitemap.xml`.
- After publishing, run `sh deploy/purge-cache.sh` to show it immediately (otherwise it appears within `CACHE_TTL` seconds).

## 6. Backups (non-negotiable)
PocketBase runs its own backup job at 03:00 every night (7 kept in the data volume) and copies each archive to the S3 bucket configured in `S3_BACKUP_*`. Verify after the first night:
```sh
docker compose -f compose.prod.yaml exec pocketbase ls /pb_data/backups
```
**Restore:** stop the stack, replace the `pb_data` volume contents with the unzipped backup (`data.db`, `auxiliary.db`, `storage/`), start again. Test a restore on a scratch machine once.

## 7. Automatic deploys (GitHub Actions)
Pushing to `main` runs: tests (`ci.yml`) → builds both images and pushes them to GHCR → copies `compose.prod.yaml`, `nginx/` and `deploy/` to the server over SSH → runs `deploy/deploy.sh`, which pulls the new images, restarts, checks health and **rolls back to the previous images if the check fails**. `.env` is never touched by CI; it lives only on the server.

One-time setup:
1. Make a deploy key on your machine: `ssh-keygen -t ed25519 -f deploy_key -N "" -C github-deploy`
2. On the server as root: `DEPLOY_PUBKEY="<contents of deploy_key.pub>" sh bootstrap-server.sh` (copy `deploy/bootstrap-server.sh` there first). Then create `/srv/zouerami/.env` from `.env.example` (§3), `chmod 600`, owned by `deploy`.
3. GitHub → repo → Settings → Secrets and variables → Actions → add secrets `DEPLOY_SSH_KEY` (contents of `deploy_key`, the private half) and `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 193.151.146.197`, checked against the fingerprint your host shows). Optional variables: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` (defaults: `193.151.146.197`, `deploy`, `/srv/zouerami`). Create an environment named `production` (Settings → Environments); add yourself as a required reviewer if you want a click-to-approve gate.
4. Certificates: nothing to do by hand. Put `PARSPACK_API_TOKEN` in `/srv/zouerami/.env` (see `docs/cert-auto-renewal.md`); the `caddy` container gets and renews them, and nginx starts once they exist.
5. Delete the local `deploy_key` files when done.

## 8. Updating by hand and rollback
```sh
git pull && docker compose -f compose.prod.yaml build web pocketbase   # or pull new image tags
docker compose -f compose.prod.yaml up -d
```
Rollback: check out the previous commit/tag and repeat. Migrations are forward-only; the pre-deploy nightly backup is the safety net.

## Security notes
- Through nginx the browser can reach only four PocketBase endpoints (uploaded files, the view beacon, newsletter confirm/unsubscribe, health); every other `/pb/*` path is 404, so sign-up, comments and writes always go through the web app (the bot guard, validation, rate limits). The web app talks to PocketBase on the private Docker network.
- Rate limits: sign-in/up/reset 10 req/min/IP, writes 30/min, pages 600/min (nginx `limit_req`).
- Cookies: `session` (10 min JWT) and `refresh` are httpOnly, SameSite=Lax, Secure over HTTPS; state-changing API calls also check `Origin`.
- CSP allows only this site itself; there are no third-party fonts or analytics.
