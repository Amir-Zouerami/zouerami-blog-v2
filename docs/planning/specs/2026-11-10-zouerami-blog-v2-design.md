# zouerami.dev — blog + portfolio v2 (design spec)

Owner: Amir Zouerami (امیر زوارمی). Status: agreed in conversation, written up 2026-11-10.
Visual source of truth: `../../../../../design-mockups/round-2/s-signal-refined/` (+ `round-2/shared/`) — the "Signal, refined" mockups. The mockups are static HTML/CSS/JS; port them, don't redesign them.

## 1. Intent
A personal blog that doubles as a portfolio. Written mostly in English, sometimes Persian, sometimes both. v1 (Next.js + PocketBase) has been dead for a year; this replaces it. Success = fast pages, a distinctive design the owner loves, easy writing, and ranking for the owner's name in English and Persian.

## 2. Goals / non-goals / anti-goals
Goals: static-feeling speed, bilingual (EN default, FA full mirror), per-post translations, SEO + link previews, accounts/comments/likes/bookmarks/view counts, Dockerised deploy on a future VPS.
Non-goals (v1): custom admin panel (v2 project), newsletter *sending* (collect emails only), analytics, git-based content, mobile-first editing.
Anti-goals: shipping JS to pages that don't need it; a Persian page that is just a JS text swap; auto-redirecting visitors by browser language; hiding text for SEO.

## 3. Stack (decided)
| Concern | Choice |
|---|---|
| Framework | Astro, server-rendered on demand (Node adapter), React 19 islands + React Compiler |
| Package manager / scripts | Bun. **Production runtime is Node** (Astro's adapter targets Node). Confirm current Bun/Astro compatibility when scaffolding. |
| Language | TypeScript, strict. zod validates PocketBase responses, env, forms. |
| Styling | Tailwind (v4). Signal's tokens become theme variables; dark + light themes. |
| Data/auth/files | PocketBase (pinned version; migrations in repo). Email+password and GitHub/Google OAuth. |
| Markdown | unified (remark + rehype); GFM; heading slugs (drives `/01` numbering + TOC); footnotes rendered as margin sidenotes later; Shiki via @shikijs/rehype, dual light/dark themes. |
| Icons | astro-icon + Lucide (inline SVG). |
| Confetti | canvas-confetti, lazy-loaded (likes etc). |
| Search (⌘K) | Query PocketBase (title/summary), no external service. |
| Infra | Docker Compose: nginx (TLS, caching, rate limits), web (Astro/Node), pocketbase. Dev compose + prod compose. |
| Dropped | TanStack Query (until custom admin), Umami/analytics, Pagefind, git-based CMS. |
My calls (override freely): Biome for lint/format; Vitest + Playwright smoke tests; GitHub Actions CI.

## 4. Design decisions locked from mockup review
Signal "refined": lime-on-black dark / ink-blue-on-paper light; Bricolage Grotesque (variable, name morphs on cursor proximity — Latin only), Instrument Serif accents, JetBrains Mono UI; **code blocks use JetBrains Mono Nerd Font** (self-hosted). `/01` heading numbers, `+` list bullets, terminal-style 404, ⌘K command palette, bento work collage. **Only the Blueprint "wipe + destination name" page transition.** XP-style pixel cursor everywhere, no hover growth. Green cursor spotlight on post pages only. Post rows: no hover image; smaller titles. Per-post language dropdown; missing translations crossed out. Respect `prefers-reduced-motion`.
Page transitions use Astro's client router with the wipe overlay persisted across navigations.

## 5. Languages and URLs
- English at root (`/`, `/blog/<slug>`, `/work`, `/about`); Persian mirror under `/fa/` (`/fa/blog/<slug>` …). Latin slugs only.
- Toggle in header links to the equivalent URL in the other language; remembers the choice; **never auto-redirects**. `x-default` = English.
- Hero name stays Latin on both versions. On `/fa/` the Persian name **امیر زوارمی** is visible text directly under the hero.
- Persian: Vazirmatn, RTL via CSS logical properties (Signal CSS needs an RTL audit), Jalali dates (Gregorian in English). UI strings in a dictionary.
- A post may exist in EN, FA, or both. Lists on both site versions show all posts with EN/FA badges (missing = crossed out); a post opens in its available language. Post-page toggle crosses out a missing side.

## 6. Data model (PocketBase)
- `users` (auth: password + OAuth; display name, avatar).
- `posts`: slug, cover (file), date, status (draft/published, publish date), tags, `images` (multi-file; markdown references `![](img:<filename>)` and the renderer resolves to PocketBase file URLs).
- `post_translations`: post, lang (`en`|`fa`), title, summary/description, body_md. Unique (post, lang). Absent record = untranslated.
- `projects` + `project_translations` (same pattern; cover, stack, links, metric, year, category).
- `comments` (post, user, body, status: pending/approved; a user's first comment is held), `likes`, `bookmarks` (post, user), `post_views` / counter, `subscribers` (email, confirmed).
- About/timeline content: TS data files in the repo (rarely changes), with EN/FA text.
- Access rules per collection written explicitly; public reads only published content.

## 7. SEO and link previews
- Per page: `<html lang>`/`dir`, canonical, `hreflang` pairs, Open Graph + Twitter card (1200×630), `og:locale` (+alternate), `article:published_time`, tags.
- **Per-post, per-language OG image** generated in Signal style. Risk: Satori may mis-shape Persian; spike first, fall back to headless-browser rendering.
- JSON-LD: `BlogPosting`, `Person` (`name` Amir Zouerami, `alternateName` امیر زوارمی, `sameAs` GitHub/LinkedIn/X), `WebSite`, breadcrumbs.
- Sitemap with language alternates, RSS per language, `robots.txt`, correct 404 status for missing slugs.
- Persian pages carry Persian `<title>`/description, e.g. «امیر زوارمی — توسعه‌دهنده و نویسنده». Search Console + Bing verification after launch. No redirects needed from v1 (dead).

## 8. Accounts, interaction, abuse
- Email+password and GitHub/Google. Email verification + password reset via SMTP (provider TBD: Resend/Brevo; SPF/DKIM on zouerami.dev).
- Cloudflare Turnstile on signup + comments; nginx rate limits; first-comment moderation.
- View counts: tiny client beacon (pages are cached), once per visitor per day, bots ignored, no personal data.
- Likes/bookmarks/comments are React islands; like fires a lazy canvas-confetti burst.
- Privacy page and account deletion.

## 9. Infrastructure
- Domain zouerami.dev (HTTPS-only TLD: TLS is mandatory). **No VPS yet**: develop locally with Compose; production compose + nginx + Let's Encrypt (certbot) written for the future VPS.
- nginx: caches rendered HTML briefly and invalidates/short-TTLs on publish; long-cache for fingerprinted assets; proxies `/pb/` to PocketBase.
- **Nightly PocketBase backups copied off-site** (object storage). Non-negotiable.
- Admin for v1 = PocketBase's built-in dashboard. A custom admin is a separate later project.

## 10. Phasing
1. Scaffold: repo, Compose (dev), Astro+React+Tailwind+Bun, PocketBase with migrations/seed, CI, lint/test.
2. Design system port: tokens, layout, header/footer, palette, transition, cursor, 404 (EN, then RTL audit).
3. Content: posts list/detail, markdown pipeline + Shiki, translations/dropdown, views, draft preview.
4. Portfolio + about.
5. Persian mirror (`/fa`), UI dictionary, Jalali dates, hreflang.
6. Accounts, comments, likes, bookmarks, confetti, moderation, SMTP, Turnstile.
7. SEO: meta, JSON-LD, OG images (spike Persian early), sitemap, RSS.
8. Prod: production compose, nginx, TLS, backups, deploy docs.

## 11. Left to the builder
Exact versions (pin and record), folder layout, component boundaries, nginx cache-invalidation mechanism, testing depth, seed content, Tailwind token naming.
