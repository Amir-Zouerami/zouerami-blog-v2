import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture rules that keep the response contract and logging from eroding:
 *  - every JSON endpoint answers through lib/api (the { meta, data, traceId } envelope);
 *  - server code logs through pino, never console.
 */
const root = join(import.meta.dirname, '../../src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const rel = (p: string) => relative(root, p);
const read = (p: string) => readFileSync(p, 'utf8');

const apiRoutes = walk(join(root, 'pages/api')).filter((p) => p.endsWith('.ts'));
/** Redirect-only endpoints (OAuth hops) legitimately return no JSON. */
const REDIRECT_ONLY = new Set([
  'pages/api/auth/oauth/[provider].ts',
  'pages/api/auth/oauth/callback.ts',
]);

describe('API response contract', () => {
  it('finds the routes', () => {
    expect(apiRoutes.length).toBeGreaterThan(15);
  });
  it.each(apiRoutes.map((p) => [rel(p), p]))(
    '%s answers through lib/api and never builds raw Responses',
    (name, path) => {
      const src = read(path);
      expect(src, `${name} must not construct a Response by hand`).not.toMatch(/new Response\(/);
      expect(src, `${name} must not use the removed json() helper`).not.toMatch(/\bjson\(\d/);
      if (!REDIRECT_ONLY.has(name as string))
        expect(src, `${name} must import the envelope helpers`).toMatch(
          /lib\/api'|lib\/auth\/guards'/,
        );
    },
  );
});

describe('logging', () => {
  const serverFiles = [
    ...walk(join(root, 'lib')),
    ...walk(join(root, 'pages')),
    join(root, 'middleware.ts'),
  ].filter((p) => /\.(ts|astro)$/.test(p));
  it.each(serverFiles.map((p) => [rel(p), p]))('%s does not use console', (name, path) => {
    // browser-side modules (client-api, context-menu) log with console, which is the right tool there
    if (name === 'lib/client-api.ts' || name.startsWith('lib/context-menu/')) return;
    expect(read(path), `${name} must log through pino (lib/log)`).not.toMatch(
      /\bconsole\.(log|warn|error|info|debug)\(/,
    );
  });
});

describe('readJson size limit', () => {
  it('rejects an oversized body with 413 before parsing it', async () => {
    const { readJson } = await import('../../src/lib/api');
    const { z } = await import('zod');
    const big = JSON.stringify({ a: 'x'.repeat(200_000) });
    const res = await readJson(
      new Request('http://x/', { method: 'POST', body: big }),
      z.object({ a: z.string() }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(413);
    const fine = await readJson(
      new Request('http://x/', { method: 'POST', body: '{"a":"b"}' }),
      z.object({ a: z.string() }),
    );
    expect(fine.ok).toBe(true);
  });
});
