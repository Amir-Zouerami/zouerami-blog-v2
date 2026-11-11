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

## Back office (`/admin`)
Write and manage everything without touching PocketBase's dashboard: posts (split Markdown editor with a live preview rendered by the same pipeline as the site, image upload/paste/drop, EN/FA tabs, draft preview links, publish/unpublish), projects, comment moderation, subscribers (CSV export) and users.
Make an account an admin: `cd web && bun run make-admin you@example.com` (creates the user with a password as a 2nd arg if it doesn't exist). In dev, `bun run seed` creates `dev-admin@example.com` / `dev-admin-password-1`.
Security model: the web app never holds PocketBase superuser credentials. Admin requests go through `/api/admin/pb/*`, which forwards the signed-in user's own PocketBase token; PocketBase rules (`role = "admin"`) are the real gate, and only content collections are reachable.

## Logs and trace ids
`docker compose -f compose.yaml -f compose.dev.yaml logs -f web` shows coloured pino logs (`LOG_LEVEL`, `LOG_PRETTY` in `.env`). Every API response carries a `traceId` (also the `x-trace-id` header); grep it in the logs to see that request's story. Browser failures print `[api] … trace=<id>` in the console, and server-side failures show `(ref xxxxxxxx)` in the UI.

## Emails
Verification, password reset and newsletter confirmation use one design ("Signal Dark", English only) defined in `web/scripts/emails/design.ts`. After editing it run `cd web && bun run build:emails` to regenerate `pocketbase/pb_hooks/emails/*` (a unit test fails if they drift). Dev mail lands in Mailpit at <http://127.0.0.1:8025>.
