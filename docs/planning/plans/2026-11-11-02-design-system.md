# Design System Port Implementation Plan (Plan 2 of 8)


**Goal:** Port the "Signal, refined" look and behaviour (tokens, fonts, layout, header/footer, wipe transition, XP cursor, ⌘K palette, 404, home page) onto the Astro app, English/LTR first, with a light/dark theme.

**Architecture:** Mockup CSS custom properties become the single source of truth in `src/styles/tokens.css` (dark default, `[data-theme='light']` override), exposed to Tailwind through `@theme`. Static chrome is `.astro`; only interactive pieces are React islands (palette, hero name morph, theme toggle) or tiny vanilla scripts (cursor, wipe overlay) that persist across Astro's client router. Mockup `shared/core.js` sample data is **not** ported: pages read real data from `src/lib/posts.ts`.

**Tech Stack:** Astro 7 (`ClientRouter`, `transition:persist`), React 19 + compiler, Tailwind 4, `@fontsource-variable/*` self-hosted fonts, Vitest, Playwright.

**Spec:** `docs/planning/specs/2026-11-10-zouerami-blog-v2-design.md` (§4 design decisions, §5 RTL note). Visual source: `../../design-mockups/round-2/s-signal-refined/` + `round-2/shared/{base.css,core.js,engine.js}`.

## Global Constraints

- **Design = "Signal, refined" only** (`design-mockups/round-2/s-signal-refined/`, chosen by the owner). `shared/base.css|core.js|engine.js` are used only as that mockup loads them; never pull colours, fonts, layouts or transitions from any other `round-2/*` variant. If the mockup and this plan disagree, the mockup wins; ask before deviating.
- Port, do not redesign (spec header). Tokens copied verbatim from `shared/base.css` `:root` + `s-signal-refined/style.css`.
- Dark default: `--bg #0a0a0b`, `--fg #ecece6`, `--acc #d4ff3a`, `--on-acc #0a0a0b`. Light: `--bg #f1f0ea`, `--fg #0d0d0e`, `--acc #2a3bff`, `--on-acc #fff`.
- Fonts self-hosted, no Google Fonts requests: Bricolage Grotesque (variable, opsz/wdth/wght), Instrument Serif, JetBrains Mono, Vazirmatn, JetBrains Mono **Nerd Font** for code blocks.
- Only the Blueprint "wipe + destination name" transition. XP-style pixel cursor everywhere, no hover growth. Green spotlight on post pages only (wired in Plan 3, component built here).
- Respect `prefers-reduced-motion`: no wipe, no spotlight, no letter morph, no marquee animation.
- Hero name morph is Latin-only. No JS shipped to pages that don't need it: pages other than those using an island ship no React.
- Use CSS logical properties (`margin-inline-start`, `inset-inline-*`, `text-align: start`) in all new CSS so Plan 5's RTL audit is cheap.
- Strict TS; `bun run check`, unit, integration and e2e suites stay green; Biome clean.

## Review Focus

- JS disabled: page renders fully, theme falls back to dark, no layout shift from missing hero script.
- Stored theme in `localStorage` throws/blocked (private mode): page still renders, no exception.
- Theme flash: light-theme user must not see a dark flash on load or after a client-router navigation.
- `prefers-reduced-motion: reduce`: navigation completes with no overlay and no stuck "pending" cover.
- Navigation to a 404/failed fetch while the wipe overlay is up: overlay must clear (never leave the screen covered).
- ⌘K/Ctrl+K opens palette, Esc closes, focus is trapped and restored; usable with keyboard only and with PocketBase down (static commands still work, search shows an error row, not a crash).
- Touch devices: custom cursor is not rendered (`pointer: coarse`).

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/styles/tokens.css` | CSS variables for both themes + `@theme` mapping |
| `web/src/styles/global.css` | Reset, base typography, grid background, utility classes ported from `base.css` (modify; imports tokens + fonts) |
| `web/src/styles/fonts.css` | `@import` of fontsource packages + Nerd Font `@font-face` |
| `web/public/fonts/JetBrainsMonoNerdFont-*.woff2` | Self-hosted code font |
| `web/src/lib/theme.ts` | `THEME_KEY`, `readTheme()`, `applyTheme()` – pure, storage-safe |
| `web/src/layouts/Base.astro` | `<html>`, head, inline theme boot script, `ClientRouter`, Header, Footer, persisted overlay/cursor |
| `web/src/components/Header.astro`, `Footer.astro` | Chrome |
| `web/src/components/ThemeToggle.tsx` | Island: toggle theme |
| `web/src/components/HeroName.tsx` | Island: variable-font letter morph |
| `web/src/components/CommandPalette.tsx` + `web/src/lib/commands.ts` | ⌘K island and its command list/filter (pure) |
| `web/src/scripts/cursor.ts`, `web/src/scripts/wipe.ts` | Vanilla persisted behaviours |
| `web/src/components/Spotlight.astro` | Cursor spotlight (used by post pages in Plan 3) |
| `web/src/pages/index.astro`, `web/src/pages/404.astro` | Home and terminal 404 |
| `web/src/components/PostRow.astro`, `ProjectTile.astro` | Row and bento tile used by home (and later lists) |

---

### Task 1: Tokens, fonts, global styles

**Files:**
- Create: `web/src/styles/tokens.css`, `web/src/styles/fonts.css`, `web/src/lib/theme.ts`, `web/public/fonts/` (Nerd Font woff2)
- Modify: `web/src/styles/global.css`, `web/package.json`
- Test: `web/tests/unit/theme.test.ts`, `web/tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: `export const THEME_KEY = 'sig-theme'`; `export type Theme = 'dark' | 'light'`; `export function readTheme(storage?: Pick<Storage,'getItem'>): Theme` (returns `'dark'` on null, invalid value, or a throwing storage); `export function applyTheme(t: Theme, root?: HTMLElement, storage?: Pick<Storage,'setItem'>): void` (sets `root.dataset.theme`, swallows storage errors).

- [ ] **Step 1: Failing tests.** `theme.test.ts`: `readTheme` returns `'light'` for stored `'light'`; `'dark'` for `null`, `'banana'`, and for a storage whose `getItem` throws; `applyTheme('light', root, throwingStorage)` sets `root.dataset.theme === 'light'` and does not throw. `tokens.test.ts`: reads `src/styles/tokens.css` and asserts it contains `--acc: #d4ff3a`, `[data-theme='light']` with `--acc: #2a3bff`, and does not contain `googleapis`.
- [ ] **Step 2:** `bun run test` → new tests FAIL (modules missing).
- [ ] **Step 3:** `bun add @fontsource-variable/bricolage-grotesque @fontsource/instrument-serif @fontsource-variable/jetbrains-mono @fontsource-variable/vazirmatn` (check the exact package names exist; pin exact versions, record in `docs/versions.md`). Download JetBrains Mono Nerd Font woff2 (Regular + Bold) from the official `ryanoasis/nerd-fonts` release into `web/public/fonts/`; record source/licence (OFL) in `docs/versions.md`. Write `fonts.css` (`font-display: swap`; Nerd Font as `'JetBrainsMono Nerd Font'`). Write `tokens.css` by copying the variables from `base.css` `:root` and both `style.css` blocks, with `--sans: 'Bricolage Grotesque Variable', 'Vazirmatn Variable', system-ui, sans-serif`, and an `@theme inline` block mapping `--color-bg/fg/acc/...` to them. Port the generic rules of `base.css` (reset, `body`, `.pad`, `.mono`, `.muted`, `.it`, `::selection`, grid background, `.btn`, `.sec-label`) into `global.css` converting physical properties to logical ones.
- [ ] **Step 4:** `bun run test && bun run check` → PASS; `bun run build` exits 0.
- [ ] **Step 5:** Commit `feat: design tokens, self-hosted fonts, global styles`.

---

### Task 2: Base layout, header, footer, theme toggle

**Files:**
- Create: `web/src/layouts/Base.astro`, `web/src/components/Header.astro`, `Footer.astro`, `ThemeToggle.tsx`
- Modify: `web/src/pages/index.astro` (wrap in `Base`, content stays minimal until Task 5)
- Test: `web/tests/e2e/layout.spec.ts`

**Interfaces:**
- Consumes: `readTheme/applyTheme/THEME_KEY` (Task 1).
- Produces: `Base.astro` props `{ title: string; description?: string; nav?: 'home'|'blog'|'work'|'about'; spotlight?: boolean }`; slot for main content. Header nav links: `/`, `/blog`, `/work`, `/about` (targets may 404 until Plans 3-4; the link set is final). Header exposes a button `[data-palette-open]` and `ThemeToggle` island (`client:load`).

- [ ] **Step 1: Failing e2e tests** (`layout.spec.ts`): `GET /` response HTML contains `<html lang="en" dir="ltr"`, an inline script that runs before `</head>`, and the four nav links; with a context `addInitScript(() => localStorage.setItem('sig-theme','light'))` then `page.goto('/')`, `documentElement.dataset.theme === 'light'` **before** `DOMContentLoaded` completes (assert via `page.evaluate` on first `domcontentloaded`); clicking the theme toggle flips `data-theme` and persists after reload; with `javaScriptEnabled: false` the page contains `<footer` and `data-theme` is absent or `dark`; with `localStorage` replaced by a throwing getter via init script, the page still loads with no `pageerror`.
- [ ] **Step 2:** Run `bun run test:e2e -g layout` → FAIL.
- [ ] **Step 3:** Implement. The theme boot script is a minimal inline `<script is:inline>` in `<head>` that mirrors `readTheme` (cannot import); re-apply on `astro:after-swap` so client-router swaps don't flash. `ThemeToggle` calls `applyTheme` and dispatches `themechange`. Header/Footer markup ported from `engine.js` "chrome" section (brand `zouerami<sup>`, nav, ⌘K hint pill).
- [ ] **Step 4:** Rebuild web image (`docker compose -f compose.yaml -f compose.dev.yaml up -d --build web`), run `bun run test:e2e` → all PASS.
- [ ] **Step 5:** Commit `feat: base layout, header, footer, theme toggle`.

---

### Task 3: Cursor and the wipe page transition

**Files:**
- Create: `web/src/scripts/cursor.ts`, `web/src/scripts/wipe.ts`, `web/src/components/Spotlight.astro`
- Modify: `Base.astro` (add `<ClientRouter />`, overlay element with `transition:persist`, import scripts), `global.css` (overlay + cursor + spotlight styles)
- Test: `web/tests/unit/wipe.test.ts`, `web/tests/e2e/transition.spec.ts`

**Interfaces:**
- Produces (`wipe.ts`): `export function destinationLabel(url: URL): string` – `/`→`Home`, `/blog`→`Blog`, `/work`→`Work`, `/about`→`About`, `/blog/<slug>`→`Blog`, unknown→`zouerami`; `export function shouldAnimate(reduced: boolean): boolean`; `initWipe(): void` – hooks `astro:before-preparation` (cover with accent, show label), `astro:after-swap`/`astro:page-load` (reveal), and a **2500 ms safety timeout** plus `astro:fetch-error`-style failure path that always clears the cover.
- Produces (`cursor.ts`): `initCursor(): void` – no-op when `matchMedia('(pointer: coarse)')` or `(prefers-reduced-motion)` is... (cursor still shown under reduced motion; only motion effects are disabled); pixel arrow default, pixel pointer over `a,button,[role=button]`, I-beam over inputs/textarea; **no scale on hover**.

- [ ] **Step 1: Failing tests.** `wipe.test.ts`: the `destinationLabel` table above (including `/blog/some-slug`, `/nope`); `shouldAnimate(true) === false`, `shouldAnimate(false) === true`. `transition.spec.ts`: click a header link and assert the overlay element `#wipe` gains class `on`, then loses it within 3 s, and the URL changed; with `reducedMotion: 'reduce'` emulation, `#wipe` never gets `on`; navigating to a non-existent route (`/blog/missing`) still ends with `#wipe` not `on`; with `page.emulateMedia` + `hasTouch` coarse pointer emulation (use `isMobile: true`) the cursor element `#cursor` is absent from the DOM.
- [ ] **Step 2:** `bun run test` and `bun run test:e2e -g transition` → FAIL.
- [ ] **Step 3:** Implement per Interfaces. Port the pixel bitmaps and the `wipe` branch of `play()` from `engine.js` (lines ~12-24 and 88-122); drop the other five transition styles and the style switcher. The overlay and cursor live in `Base.astro` with `transition:persist` so they survive swaps; `initCursor/initWipe` are idempotent (guard with a `window.__sig` flag) because the script re-runs under the router.
- [ ] **Step 4:** Rebuild image; all unit + e2e PASS.
- [ ] **Step 5:** Commit `feat: pixel cursor and wipe transition`.

---

### Task 4: ⌘K command palette

**Files:**
- Create: `web/src/lib/commands.ts`, `web/src/components/CommandPalette.tsx`, `web/src/pages/api/search.ts`
- Modify: `Base.astro` (mount island `client:idle`), `Header.astro` (`[data-palette-open]` dispatches the same open event)
- Test: `web/tests/unit/commands.test.ts`, `web/tests/integration/search.test.ts`, `web/tests/e2e/palette.spec.ts`

**Interfaces:**
- Produces (`commands.ts`): `export interface Command { id: string; label: string; hint: string; href?: string; run?: 'toggle-theme' }`; `export const STATIC_COMMANDS: Command[]` (Home, Blog, Work, About, Toggle theme); `export function filterCommands(all: Command[], query: string): Command[]` – case-insensitive substring on `label`, order preserved, max 14.
- Produces (`api/search.ts`): `GET /api/search?q=` → `200 { results: {title,slug,summary}[] }` published posts only, max 8, `q` shorter than 2 chars → `200 {results: []}`; PocketBase down → `503 {error}`. Uses the published-only data layer from Plan 1; the `q` value is escaped before use in a PocketBase filter (use `pb.filter()` parameter binding).
- Event contract: `window.dispatchEvent(new Event('palette:open'))` opens it.

- [ ] **Step 1: Failing tests.** Unit: `filterCommands(STATIC_COMMANDS,'th')` → Toggle theme only; empty query returns all in order; query with regex chars `'('` returns `[]` without throwing. Integration (real PB, `REQUIRE_PB=1`): `q=pocketbase` returns the seeded published match; a draft post's title never appears; `q='" || 1=1 || "'` returns `[]` and does not error; `q='a'` returns `[]`. E2E: `Control+k` opens `role=dialog`, typing filters, `Enter` navigates, `Escape` closes and restores focus to the previously focused element; Tab stays inside the dialog; with PocketBase stopped, opening and typing shows a row containing "Search unavailable" and static commands still work.
- [ ] **Step 2:** Run all three suites → FAIL.
- [ ] **Step 3:** Implement. Palette debounces search 150 ms, aborts stale requests, shows static commands immediately. Port markup/classes from `engine.js` lines ~124-147.
- [ ] **Step 4:** Rebuild image; unit, integration, e2e PASS.
- [ ] **Step 5:** Commit `feat: command palette with published-post search`.

---

### Task 5: Home page, hero name morph, 404

**Files:**
- Create: `web/src/components/HeroName.tsx`, `PostRow.astro`, `ProjectTile.astro`, `web/src/pages/404.astro`
- Modify: `web/src/pages/index.astro`
- Test: `web/tests/unit/morph.test.ts`, `web/tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `listPublishedPosts()` and the projects equivalent from `src/lib/posts.ts` (use the exact exported names already there; if no projects lister exists add `listPublishedProjects()` returning the same shape pattern, with a unit test).
- Produces (`HeroName.tsx`): `export function morphSettings(distance: number, radius = 300): string` returning a `font-variation-settings` string, `wght 250→800`-style interpolation copied from `engine.js` `morph()`; clamps for `distance >= radius` and `distance <= 0`. Component renders SSR text "Amir Zouerami" in `<h1 aria-label="Amir Zouerami">` with per-letter spans; the morph only runs after hydration (`client:visible`) and not under reduced motion.

- [ ] **Step 1: Failing tests.** Unit: `morphSettings(0)` is the max-weight string, `morphSettings(300)` and `morphSettings(9999)` equal the rest string, monotonic in between. E2E: `/` shows the h1 with accessible name "Amir Zouerami" **in the SSR HTML** (fetch with JS disabled); section labels `[01] Latest writing` and `[02] Selected work` present; published post titles are listed and the draft is absent; with seeded data empty (use route interception to return 503 from PB is not possible server-side, so instead stop PocketBase) `/` returns 503 with the existing friendly message and the Base chrome; `GET /does-not-exist` returns **status 404** with body containing `4`, `0`, `4`, the echoed path in a `.tty` block and a "Home" link; the echoed path is HTML-escaped (`/<script>` renders as text, no script element).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Port `index.html` structure (hero, marquee, rows, bento, subscribe placeholder form with `disabled` submit and a "coming soon" note since subscribers land in Plan 6). Replace the plain list/placeholder button from Plan 1. 404 uses `Astro.url.pathname` (escaped by Astro templating) and sets `Astro.response.status = 404`.
- [ ] **Step 4:** Rebuild image; run the **full** verification: `bun run check`, `bun run test`, `REQUIRE_PB=1 bun run test:integration`, `bun run test:e2e` → all PASS.
- [ ] **Step 5:** Commit `feat: home page, hero morph, terminal 404`.

---

### Task 6: Cross-cutting verification and docs

**Files:**
- Modify: `README.md`, `docs/versions.md`
- Test: `web/tests/e2e/a11y-smoke.spec.ts`

- [ ] **Step 1:** Add e2e: every page in `['/', '/does-not-exist']` has exactly one `<h1>`, a `lang` attribute, `main` landmark, and no console errors; Lighthouse-style check is out of scope. Home HTML for JS-disabled load is < 100 KB and requests no `fonts.googleapis.com` (assert via `page.on('request')`).
- [ ] **Step 2:** Run `bun run test:e2e` → expected PASS.
- [ ] **Step 3:** Document fonts (sources, licences), the theme storage key, and the palette event contract in README/versions.
- [ ] **Step 4:** Commit `docs: design system notes`; then request a whole-branch review.

---

## Self-review notes

- Spec §4 coverage: tokens/themes (T1-2), fonts incl. Nerd Font (T1), wipe-only transition (T3), XP cursor (T3), spotlight component built (T3, mounted in Plan 3), ⌘K palette (T4), terminal 404 (T5), `/01` numbering and `+` bullets belong to markdown/post pages (Plan 3), bento + rows (T5), reduced motion (T3, T5).
- Deferred: RTL/Vazirmatn behaviour and `/fa` (Plan 5), post page + language dropdown (Plan 3), `/work` and `/about` pages (Plan 4), real subscribe form (Plan 6).
- Open risk: `ClientRouter` re-executes inline scripts; all behaviours are idempotent and guarded.
