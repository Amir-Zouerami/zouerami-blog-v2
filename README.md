# zouerami.dev — blog + portfolio v2

Astro (server-rendered) + React 19 islands + Tailwind, content/auth in PocketBase, nginx in front, all in Docker Compose.
Design source of truth: `../../design-mockups/round-2/s-signal-refined`. Spec and plans: `docs/planning/`.

## Quick start
```sh
cp .env.example .env                      # edit the superuser password
docker compose -f compose.yaml -f compose.dev.yaml up -d --build
cd web && bun install && bun run seed     # sample posts/projects
open http://localhost:8088                # site (nginx)   ·   PocketBase admin: http://127.0.0.1:8090/_/
```
Behind a host-side proxy (build containers without direct internet)? Set `BUILD_NETWORK=host` and `BUILD_PROXY=http://127.0.0.1:PORT` in `.env`.

## Day-to-day
| Task | Command (in `web/`) |
|---|---|
| Dev server with hot reload (against the Compose PocketBase) | `PB_URL=http://127.0.0.1:8090 PB_PUBLIC_URL=http://127.0.0.1:8090 SITE_URL=http://localhost:4321 bun run dev` |
| Lint + typecheck | `bun run check` |
| Unit tests | `bun run test` |
| Integration tests (needs PocketBase + seed) | `REQUIRE_PB=1 bun run test:integration` |
| End-to-end smoke (needs the full stack on :8088) | `bun run test:e2e` |

Pinned versions and why: `docs/versions.md`. PocketBase schema + access rules: `pocketbase/pb_migrations/`.

## Auth
Login (`POST /api/auth/login`) verifies the password against PocketBase once, then sets two httpOnly cookies: a 10-minute signed JWT (`session`, checked statelessly in middleware — no DB/Redis) and a `refresh` cookie holding PocketBase's own token. When the JWT expires, middleware calls PocketBase `authRefresh` once; a deleted user or changed password stops refreshing, so revocation takes at most 10 minutes. Needs `AUTH_SECRET` (≥32 chars).

## Accounts, comments, mail (dev)
Sign-up sends a verification email; in dev all mail lands in Mailpit at <http://127.0.0.1:8025>. Comments from a user's first post are held for moderation (PocketBase admin → `comments` → set `status`). Turnstile is skipped when `TURNSTILE_SECRET` is empty. Privacy page: `/privacy`.

## Production
See [`docs/deploy.md`](docs/deploy.md) and `compose.prod.yaml` / `nginx/prod.conf`. The VPS has not been touched yet.
