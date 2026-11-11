import { describe, expect, it } from 'vitest';
import { pbIsUp } from './helpers';

const up = await pbIsUp();
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8088';
const search = (q: string) => fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`);

describe.skipIf(!up)('GET /api/search (through nginx)', () => {
  it('finds a seeded published post', async () => {
    const body = (await (await search('rebuilt')).json()) as {
      data: { results: { slug: string }[] };
    };
    expect(body.data.results.map((r) => r.slug)).toContain('hello-bilingual');
  });
  it('searches Persian titles', async () => {
    const body = (await (await search('وبلاگم')).json()) as {
      data: { results: { slug: string }[] };
    };
    expect(body.data.results.map((r) => r.slug)).toContain('hello-bilingual');
  });
  it('never returns drafts', async () => {
    const body = (await (await search('unfinished')).json()) as {
      data: { results: { slug: string }[] };
    };
    expect(body.data.results.map((r) => r.slug)).not.toContain('draft-post');
  });
  it('treats filter syntax as plain text', async () => {
    const res = await search('" || 1=1 || "');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { results: unknown[] } }).data.results).toEqual([]);
  });
  it('returns nothing for one-character queries', async () => {
    expect(
      ((await (await search('a')).json()) as { data: { results: unknown[] } }).data.results,
    ).toEqual([]);
  });
});
