import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react({ compiler: true })],
  vite: {
    // fonts stay real files: a data: URI font is blocked by the site's Content-Security-Policy (font-src 'self')
    build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
    plugins: [tailwindcss()],
    ssr: { external: ['@resvg/resvg-js', 'pino', 'pino-pretty'] },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  server: { host: true, port: 4321 },
});
