#!/bin/sh
# One-time setup of a fresh Debian/Ubuntu VPS. Run as root:
#   DEPLOY_PUBKEY="$(cat deploy_key.pub)" sh bootstrap-server.sh
# Creates a non-root `deploy` user (key-only), installs Docker, a firewall and fail2ban, and /srv/zouerami.
# It does NOT disable root/password SSH logins: do that yourself after checking the deploy user can log in.
set -eu
: "${DEPLOY_PUBKEY:?set DEPLOY_PUBKEY to the public key GitHub Actions will use}"
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

apt-get update -y
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys 2>/dev/null || echo "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

install -d -o deploy -g deploy /srv/zouerami

ufw default deny incoming
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
echo "Server ready. Next: put /srv/zouerami/.env in place (see the private server notes), then push to main."
