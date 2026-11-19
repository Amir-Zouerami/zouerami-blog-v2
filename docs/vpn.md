# VPN (WireGuard) to the server

Set up 2026-11-19. Purpose: reach things that must not be public (the PocketBase dashboard, the mail server's web admin) from the
laptop and the Android phone.

## 1. How it is built

| Item | Value |
|---|---|
| Server | `193.151.146.197` (the VPS), VPN address **10.8.0.1** |
| Private network | `10.8.0.0/24` |
| Laptop | `10.8.0.2` |
| Phone | `10.8.0.3` |
| Port | **UDP 51820** (open in `ufw`) |
| Server config | `/etc/wireguard/wg0.conf` (mode 600; server private key in `/etc/wireguard/server.key`) |
| Service | `systemctl status wg-quick@wg0` (starts at boot, before Docker: `/etc/systemd/system/docker.service.d/after-wireguard.conf`) |
| Client files | `/media/amir/Development/Projects/Personal/zouerami-blog-v2/secrets/vpn/` on the laptop (`laptop.conf`, `phone.conf`, `phone-qr.png`) |

**Split tunnel:** the client configs route only `10.8.0.0/24` **and `193.151.146.197/32`** through the VPN. Everything else on your devices goes the normal way.
The server's own public address is included on purpose: nginx lets `https://mail.amir-zouerami.dev` through only to requests that come from the VPN network,
and with this route a VPN client's request to the server's public address arrives at the server from `10.8.0.x`.

## 2. What is reachable through the VPN

| What | Address (VPN on) |
|---|---|
| PocketBase dashboard | `http://10.8.0.1:8090/_/` (login: superuser `admin@amir-zouerami.dev`, password = `PB_SUPERUSER_PASSWORD` in `/srv/zouerami/.env`) |
| Mail server web admin and webmail | `https://mail.amir-zouerami.dev/admin` (see `docs/mail-server.md`) |
| SSH | `ssh root@10.8.0.1` or the usual address |

PocketBase publishes `10.8.0.1:8090` through `compose.prod.yaml` (`ports:` of the `pocketbase` service). It is **not** published on the public address.

## 3. Using it

**Android:** install the WireGuard app, `+` -> "Scan from QR code" -> `phone-qr.png` (or import `phone.conf`), switch the tunnel on.
**Laptop (Linux):** `sudo wg-quick up /media/amir/Development/Projects/Personal/zouerami-blog-v2/secrets/vpn/laptop.conf` / `sudo wg-quick down ...`. Or import into NetworkManager:
`nmcli connection import type wireguard file laptop.conf`.
The client files hold private keys: keep them private, delete the QR and `phone.conf` after importing.

Check from the server: `wg show wg0` shows each peer's last handshake and traffic.

## 4. Adding a device (a new phone, a tablet)

On the laptop:
```sh
wg genkey | tee newdevice.key | wg pubkey > newdevice.pub
```
On the server, add a block to `/etc/wireguard/wg0.conf`:
```
[Peer]
# new device
PublicKey = <contents of newdevice.pub>
AllowedIPs = 10.8.0.4/32      # next free address
```
Apply without dropping other peers: `wg syncconf wg0 <(wg-quick strip wg0)`.
Client config (same as `phone.conf`, with the new private key and `Address = 10.8.0.4/32`):
```
[Interface]
PrivateKey = <newdevice.key>
Address = 10.8.0.4/32

[Peer]
PublicKey = YXiDf1E8/igSrW5+v9c/v3/EFLqGnWgju5TL3FqL7gA=
Endpoint = 193.151.146.197:51820
AllowedIPs = 10.8.0.0/24, 193.151.146.197/32
PersistentKeepalive = 25
```
The server's public key is also in `/etc/wireguard/server.pub`.

## 5. Removing a device or rotating a key

Delete its `[Peer]` block from `/etc/wireguard/wg0.conf`, then `wg syncconf wg0 <(wg-quick strip wg0)`. A lost phone: do this at once.

## 6. If it does not connect

| Symptom | Likely cause | What to do |
|---|---|---|
| no handshake in `wg show` on the server | UDP 51820 filtered on the way (some mobile networks/ISPs block WireGuard) | try another network; as a fallback use an SSH tunnel: `ssh -L 8090:127.0.0.1:8090 root@193.151.146.197` and open `http://127.0.0.1:8090/_/` |
| handshake works, page does not load | the tunnel is up but `AllowedIPs` lacks `10.8.0.0/24` or the server address | compare with the client config in section 4 |
| `https://mail.amir-zouerami.dev` answers 403 | the request did not come through the tunnel | check the client config contains `193.151.146.197/32`; reconnect |
| after a server reboot the PocketBase dashboard is unreachable | Docker started before `wg0` existed | `systemctl status wg-quick@wg0`, then `docker compose -f compose.prod.yaml up -d pocketbase` in `/srv/zouerami` |

## 7. Security notes

- WireGuard only answers peers whose public key is listed; unknown packets get no reply, so the port looks closed to scanners.
- Keys: each client has its own private key, the server's private key never leaves `/etc/wireguard`. No shared secrets.
- The VPN is the only way to reach the PocketBase dashboard and the mail admin: treat the devices that hold a config as trusted (lock screen, disk encryption).
