# Pinned versions (recorded at scaffold, 2026-11-10)

Resolved from npm at scaffold time and pinned exactly in `web/package.json`:

- @astrojs/node 11.1.11
- @astrojs/react 7.1.5
- @tailwindcss/vite 4.3.5
- astro 7.4.9
- pocketbase 0.28.2
- react 19.3.1
- react-dom 19.3.1
- tailwindcss 4.3.5
- zod 4.6.7
- @astrojs/check 0.9.12
- @biomejs/biome 2.6.6
- @playwright/test 1.65.0
- @types/node 26.6.6
- @types/react 19.3.0
- @types/react-dom 19.3.0
- oxc-transform-react 0.158.0
- typescript 6.0.3
- vitest 5.1.0

Notes:
- `@astrojs/react` is pinned to 7.1.5: 7.1.6 imports `@astrojs/internal-helpers/renderer`, which internal-helpers 0.13.1 does not export (build fails).
- `typescript` is pinned to 6.0.3: `astro check` does not yet support TypeScript 7.
- React Compiler is enabled with `react({ compiler: true })` + `oxc-transform-react` (the integration's documented path); `babel-plugin-react-compiler` is not used.
