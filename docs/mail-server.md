# Mail server (Stalwart) for amir-zouerami.dev

Installed 2026-11-19. Stalwart **v1.1.1** (`stalwartlabs/stalwart:v1.1.1`), a single container that does SMTP, IMAP and a web admin.
It sends the website's emails (sign-up verification, password reset, newsletter confirmation) and receives mail for `hello@amir-zouerami.dev`.

## 1. Overview

| Item | Value |
|---|---|
| Mail host name | `mail.amir-zouerami.dev` -> `193.151.146.197` (A record; reverse DNS/PTR set by Asiatech to the same name) |
| Public ports | **25** (SMTP, other servers deliver here), **465** (SMTPS: mail clients and the website send here), **993** (IMAPS: mail apps read here) |
| Web admin / webmail / JMAP | `https://mail.amir-zouerami.dev/admin` and `/account`: **only through the VPN** (`docs/vpn.md`); from anywhere else nginx answers 403 |
| TLS certificate | the wildcard `*.amir-zouerami.dev` from Caddy (`docs/cert-auto-renewal.md`), copied by the `mail-certs` container |
| Where it runs | `/srv/zouerami`, services `mail` and `mail-certs` in `compose.prod.yaml` |
| Data | Docker volumes `zouerami_mail_data` (mail, accounts, settings), `zouerami_mail_etc` (`config.json`), `zouerami_mail_certs` (certificate copy) |
| Memory limit | 768 MB (`mail`), 32 MB (`mail-certs`) |

## 2. Accounts

Passwords are in `/srv/zouerami/mail-accounts.txt` on the server (owner `deploy`, mode 600; **not** in the repository).

| Address | Use |
|---|---|
| `hello@amir-zouerami.dev` | your mailbox. Also receives `postmaster@`, `abuse@`, `security@` (aliases) and the DMARC/TLS reports. |
| `no-reply@amir-zouerami.dev` | used by the website (PocketBase) to send mail. Its password is `SMTP_PASS` in `/srv/zouerami/.env`. |
| `admin@amir-zouerami.dev` | administrator of the mail server (web admin, CLI). Do not use it as a mailbox. |

**Mail app settings** (Android: FairEmail or K-9 Mail; laptop: Thunderbird):

| | |
|---|---|
| User name | the full address, e.g. `hello@amir-zouerami.dev` |
| Incoming (IMAP) | `mail.amir-zouerami.dev`, port **993**, SSL/TLS |
| Outgoing (SMTP) | `mail.amir-zouerami.dev`, port **465**, SSL/TLS |

Change your password after the first sign-in: with the VPN on, open `https://mail.amir-zouerami.dev/account`, sign in with the full address, and use the credentials section.

## 3. How the website sends mail

PocketBase reads these lines from `/srv/zouerami/.env` at start-up:
```
SMTP_HOST=mail.amir-zouerami.dev
SMTP_PORT=465
SMTP_USER=no-reply@amir-zouerami.dev
SMTP_PASS=<password of no-reply@>
SMTP_TLS=true
MAIL_FROM=no-reply@amir-zouerami.dev
```
Inside Docker the name `mail.amir-zouerami.dev` is a network alias of the `mail` container (`compose.prod.yaml`), so PocketBase connects to it directly and the certificate matches.
After changing `.env`: `docker compose -f compose.prod.yaml up -d --force-recreate pocketbase` (an environment change needs the container recreated, a restart is not enough).

## 4. DNS records (all at Parspack)

| Name | Type | Value | Why |
|---|---|---|---|
| `@` | MX | `10 mail.amir-zouerami.dev.` | where other servers deliver the domain's mail |
| `@` | TXT | `v=spf1 mx ~all` | only the MX host may send for the domain (`~all` = soft fail, can become `-all`) |
| `mail` | TXT | `v=spf1 a -all` | SPF for the server's own host name |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:hello@amir-zouerami.dev` | what receivers do with failing mail (`none` = only report, can become `quarantine`/`reject`) |
| `v1-rsa-20261119._domainkey` | TXT | `v=DKIM1; k=rsa; h=sha256; p=...` (2048-bit RSA public key) | DKIM, checked by Gmail and others |
| `v1-ed25519-20261119._domainkey` | TXT | `v=DKIM1; k=ed25519; h=sha256; p=...` | second DKIM signature (not all receivers use it) |
| reverse DNS (PTR) of `193.151.146.197` | | `mail.amir-zouerami.dev` | set by Asiatech (cloud.ir) |

Not published on purpose: the DANE `TLSA` records (they need DNSSEC, which we do not have), `MTA-STS`/`TLS-RPT`, `SRV` and autoconfig records. They are optional; the mail apps are configured by hand (section 2).
The server computes the full list for the domain: `stalwart-cli get Domain <id> --fields dnsZoneFile` (section 7).

**DKIM key rotation:** Stalwart creates new DKIM keys now and then (names like `v1-rsa-20261119`). When the zone file shows a new selector, publish its TXT record before the old one is removed (`docs` link in section 9).
The records were added through the Parspack API with the token from `.env`.

## 5. Firewall

`ufw` allows `25/tcp`, `465/tcp`, `993/tcp` (and `22`, `80`, `443`, `51820/udp`). Check: `ufw status`.
Stalwart's other ports (143, 587, 995, 4190, 443) exist inside the container only and are not published.

## 6. Certificates

Caddy renews the wildcard certificate (`docs/cert-auto-renewal.md`). The `mail-certs` container checks every 6 hours: when the file changed it copies it into the `mail_certs` volume
(owner uid 2000, the mail server's user) and sends Stalwart a "reload certificates" request using the login in `/srv/zouerami/mail-reload.auth`
(base64 of `admin@amir-zouerami.dev:<password>`, mode 600). In Stalwart: Settings -> TLS -> Certificates shows the certificate and its expiry.
If you ever change the admin password, update `mail-reload.auth` too: `printf '%s' 'admin@amir-zouerami.dev:NEWPASSWORD' | base64 -w0 > /srv/zouerami/mail-reload.auth` and `docker compose -f compose.prod.yaml up -d --force-recreate mail-certs`.
Manual reload: `stalwart-cli create Action/ReloadTlsCertificates` (section 7).

## 7. Managing it from the command line

Stalwart's HTTP management port is published **only on the server's loopback**. Open a tunnel from the laptop, then use the CLI
(download the binary `stalwart-cli-x86_64-unknown-linux-musl.tar.xz` from <https://github.com/stalwartlabs/cli/releases>, version 2.0.0 was used):
```sh
ssh -i ~/.ssh/id_rsa_vps -f -N -L 18080:127.0.0.1:8080 root@193.151.146.197
export CLI="stalwart-cli --url http://127.0.0.1:18080 --user admin@amir-zouerami.dev --password '<admin password>'"
$CLI query Account                               # list accounts
$CLI query Domain                                # list domains (note the id, e.g. b)
$CLI get Domain b --fields dnsZoneFile           # DNS records the server wants
$CLI update Account d --field 'credentials/0/secret=new password'   # reset a password (d = account id from "query Account")
$CLI describe Account                            # fields of an object type
```
Create an account: `$CLI create Account/User --field name=jane --field domainId=b --field 'credentials={"0":{"@type":"Password","secret":"..."}}'`.

**The first configuration was applied as a plan** (`apply --file plan.ndjson`): domain (manual certificate, automatic DKIM, manual DNS), default host name `mail.amir-zouerami.dev`,
a certificate object reading `/etc/stalwart/tls/fullchain.pem` + `privkey.pem`, `Http.clientIpSource = xForwardedFor` (the real client address behind nginx) and the three accounts.
`stalwart-cli snapshot` writes the current configuration back as a plan.
If the data volumes are ever lost, the server shows its setup wizard again: start it in recovery mode and apply a plan (<https://stalw.art/docs/configuration/declarative-deployments/>).

## 8. Everyday checks

```sh
cd /srv/zouerami
docker compose -f compose.prod.yaml ps mail mail-certs                 # healthy?
docker compose -f compose.prod.yaml logs --tail=100 mail               # server log
docker compose -f compose.prod.yaml logs --tail=20 mail-certs          # certificate copies / reload requests
dig +short MX amir-zouerami.dev; dig +short TXT amir-zouerami.dev      # DNS as the world sees it
```
Send a test mail from the server: use `python3` with `smtplib.SMTP_SSL('mail.amir-zouerami.dev', 465)` and the `no-reply@` login (see section 3), to an address at Gmail.
In Gmail open the message -> "Show original" and check **SPF, DKIM, DMARC: PASS**. While `p=none`, DMARC cannot make mail fail.

## 9. Backups

Everything of the mail server is in two Docker volumes. Back them up while the server runs:
```sh
docker run --rm -v zouerami_mail_data:/data -v zouerami_mail_etc:/etc-stalwart -v "$PWD":/backup alpine \
  tar czf /backup/mail-backup-$(date +%F).tgz -C / data etc-stalwart
```
The file contains all mail and the server's secrets: keep it private. The PocketBase nightly backup does not include mail.
Restore: stop `mail`, unpack into the volumes, start `mail`.

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| the website's verification/reset emails do not arrive | `docker compose -f compose.prod.yaml logs pocketbase \| grep -i smtp`; is `SMTP_PASS` in `.env` the current `no-reply@` password; was pocketbase recreated after editing `.env` |
| mail goes to spam at Gmail | SPF/DKIM results in "Show original"; the DKIM TXT records resolve (`dig TXT v1-rsa-20261119._domainkey.amir-zouerami.dev`); reverse DNS is `mail.amir-zouerami.dev`; the IP's reputation (new/Iranian ranges are judged strictly: send a few real replies from `hello@` to Gmail contacts to build trust) |
| mail to the domain does not arrive | `dig MX amir-zouerami.dev`; port 25 reachable from outside (`nc -v 193.151.146.197 25` from another network); the Asiatech network allows inbound 25 |
| `https://mail.amir-zouerami.dev` gives 403 | the VPN is off or does not route the server's address (`docs/vpn.md`, section 6) |
| web admin sign-in says "Client metadata documents are disabled" | `STALWART_PUBLIC_URL` must be exactly `https://mail.amir-zouerami.dev` (set in `compose.prod.yaml`) and the page must be opened at that address |
| mail apps show a certificate error | the wildcard certificate expired or was not reloaded (section 6) |
| the `mail` container is `unhealthy` | its health check calls the HTTPS port inside the container; look at `docker compose ... logs mail` |

## 11. Limits and things to know

- Outbound mail leaves from `193.151.146.197` directly (port 25 to the receiving servers). Gmail/Outlook may be strict with a young domain and an Iranian address range: build reputation slowly, keep volume low, never send bulk mail.
- Every account can send; there is no open relay (a login is required for 465).
- After the first week of clean SPF/DKIM/DMARC results, tighten DMARC to `p=quarantine`, later `p=reject`, and SPF `~all` to `-all`.
- First start downloads the web interface and spam rules from GitHub, which is slow from Iran (several minutes); the data volume keeps them afterwards.
