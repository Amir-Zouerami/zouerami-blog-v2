import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react({ compiler: true })],
  vite: { plugins: [tailwindcss()], ssr: { external: ['@resvg/resvg-js', 'pino', 'pino-pretty'] } },
  server: { host: true, port: 4321 },
});
