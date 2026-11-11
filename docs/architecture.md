# Architecture

```
browser ── nginx ──┬── web (Astro SSR + React islands, Node)  ── PocketBase (internal network)
                   └── /pb/*  → PocketBase (public reads, file URLs, view beacon; admin UI blocked)
```

## `web/src` layout
| Path | Responsibility |
|---|---|
| `pages/` | Thin routes only. `*.astro` pages delegate to `views/`; `pages/api/**` are JSON endpoints. English at the root, Persian under `pages/fa/` (same views, `locale="fa"`). |
| `views/` | Page templates. They call one loader from `lib/pages.ts` and render `ok / notfound / unavailable`. No data fetching logic. |
| `layouts/`, `components/` | Chrome (`Base`, header/footer, SEO) and React islands (palette, comments, post actions, hero). |
| `lib/config.ts` | The only reader of `process.env`. Validates once (`AUTH_SECRET` ≥ 32 chars and not the example placeholder) and exposes typed settings. |
| `lib/pb.ts` | PocketBase clients: public (`getPb`), anonymous (`anonPb`), acting as the user (`userPb`); `UpstreamError`, status helpers. |
| `lib/posts.ts`, `projects.ts`, `schemas.ts` | Data layer. Zod-validated reads, published-only for the public client. |
| `lib/pages.ts` | Page loaders (`loadPostPage`, `loadHome`, …) + `load()` mapping missing → 404 and backend failure → 503. Rendered-markdown LRU. |
| `lib/markdown.ts` | unified pipeline (GFM, heading numbers/slugs, Shiki, `img:` resolution, safe links). Raw HTML in sources is dropped. |
| `lib/auth/` | `session.ts` (JWT), `cookies.ts`, `refresh.ts` (PocketBase re-validation), `user.ts`, `guards.ts` (`authed` / `adminOnly` route wrappers). |
| `lib/csrf.ts`, `http.ts`, `turnstile.ts` | Origin check, JSON helpers, Turnstile verification. |
| `i18n/` | `locale.ts` (paths, direction), `format.ts` (Jalali dates, digits), `en.ts` / `fa.ts` dictionaries, `index.ts` barrel. |
| `scripts/` | Browser behaviour as modules (`site`, `post`, `wipe`, `cursor`, `subscribe`, `auth-forms`); per-page listeners are torn down via `onPage()`. |
| `admin/` | Back-office React app: `pages/` (one per screen), shared `MarkdownEditor`, `LangTabs`, `ImageLibrary`. |
| `styles/` | `tokens.css` (Signal tokens + Tailwind `@theme`), `signal.css` (ported design), `admin.css`. |

## API contract and logging
- **Every JSON endpoint** (and the PocketBase hook endpoints) answers `{ "meta": { "status", "code", "message"?, "fields"? }, "data": …|null, "traceId": "<uuidv7>" }` — success and failure alike (no 204s). Helpers live in `lib/api.ts` (`ok`, `created`, `fail`, `readJson`); browser code uses `lib/client-api.ts`. A unit test fails if a route builds a raw `Response` or logs through `console`, and an e2e test walks every endpoint.
- **traceId**: middleware assigns a UUIDv7 per request (a valid inbound `x-trace-id` is reused), returns it in the header **and** body, binds it to a pino child logger, and stores it in an `AsyncLocalStorage` so any code can call `getLog()`. Find a response's logs with `docker compose logs web | grep <traceId>`.
- **Logs**: pino. `LOG_PRETTY=true` (dev compose) → coloured, multi-line; production → JSON lines. Passwords, tokens, cookies and Turnstile responses are redacted; emails are masked (`a***@example.com`). Every request logs method, path, status, duration and user id; domain events (login, register, comment, moderation, deletion…) log at info, rejected input at warn, failures at error.

## Authentication
1. `POST /api/auth/login` → PocketBase verifies the password once → we set two httpOnly cookies: a 10-minute signed **JWT** (`session`) and the user's **PocketBase token** (`refresh`, path `/api`).
2. Middleware validates the JWT by signature only (no database/Redis). When it expires, one PocketBase `authRefresh` re-checks the user (deleted / changed password ⇒ signed out) and re-issues the JWT.
3. Writes that need the user's identity use `userPb(cookies)` (PocketBase rules decide). Route handlers use `authed()` / `adminOnly()`.
4. Admin = `users.role = "admin"`, enforced by PocketBase rules. The web app never holds superuser credentials; `/api/admin/pb/*` forwards the admin's own token to content collections only.

## Content model
Posts and projects have one record plus one translation row per language (`en`, `fa`). A post exists in a language iff that translation exists. URLs: `/blog/<slug>` (EN) and `/fa/blog/<slug>`; a post opened in a language it lacks renders in its available language with a notice. Drafts are invisible except with the post's `preview_token`.

## Where to change things
- New page: add a loader in `lib/pages.ts`, a view in `views/`, two thin routes in `pages/` and `pages/fa/`, strings in `i18n/en.ts` + `fa.ts` (a unit test fails if keys diverge).
- New API route: wrap with `authed()` / `adminOnly()`, validate with zod via `readBody`, log unexpected errors with `logError`.
- New PocketBase collection: add a migration in `pocketbase/pb_migrations/` with explicit rules; add a rules test in `web/tests/integration/`.
