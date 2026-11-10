import type PocketBase from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { UpstreamError } from '../../src/lib/pb';
import { getPost, imageUrl, listPosts } from '../../src/lib/posts';

type Rec = Record<string, unknown>;
const P = (o: Rec): Rec => ({
  id: 'p1',
  slug: 'a',
  cover: '',
  date: '2026-11-02 00:00:00.000Z',
  status: 'published',
  tags: [],
  images: [],
  ...o,
});
const T = (o: Rec): Rec => ({
  id: 't',
  post: 'p1',
  lang: 'en',
  title: 'T',
  summary: 'S',
  body_md: 'B',
  ...o,
});

/** Minimal stand-in for the two collections the data layer reads. */
const calls: { name: string; opts: Rec }[] = [];
function stub(posts: Rec[], trs: Rec[], fail?: Error): PocketBase {
  return {
    collection: (name: string) => ({
      getFullList: async (opts: Rec = {}) => {
        calls.push({ name, opts });
        if (fail) throw fail;
        return name === 'posts' ? posts : trs;
      },
      getFirstListItem: async (filter: string) => {
        if (fail) throw fail;
        const slug = /slug = "([^"]+)"/.exec(filter)?.[1];
        const hit = posts.find((p) => p.slug === slug);
        if (!hit) throw Object.assign(new Error('not found'), { status: 404 });
        return hit;
      },
    }),
    files: { getURL: (r: Rec, f: string) => `/pb/api/files/${r.id}/${f}` },
  } as unknown as PocketBase;
}

describe('listPosts', () => {
  it('does not fetch post bodies when listing', async () => {
    calls.length = 0;
    await listPosts({}, stub([P({})], [T({})]));
    const tr = calls.find((c) => c.name === 'post_translations');
    expect(tr?.opts.fields).toBeDefined();
    expect(String(tr?.opts.fields)).not.toContain('body_md');
  });
  it('maps a Persian-only post to titleLang fa with its Persian title', async () => {
    const pb = stub([P({ id: 'p1', slug: 'fa-only' })], [T({ lang: 'fa', title: 'عنوان' })]);
    const [post] = await listPosts({}, pb);
    expect(post).toMatchObject({ slug: 'fa-only', langs: ['fa'], titleLang: 'fa', title: 'عنوان' });
  });
  it('uses English as the primary language when both exist', async () => {
    const pb = stub(
      [P({})],
      [T({ lang: 'fa', title: 'فا', id: 't2' }), T({ lang: 'en', title: 'En' })],
    );
    const [post] = await listPosts({}, pb);
    expect(post).toMatchObject({ langs: ['en', 'fa'], titleLang: 'en', title: 'En' });
  });
  it('orders newest first', async () => {
    const pb = stub(
      [
        P({ id: 'a', slug: 'old', date: '2025-01-01 00:00:00.000Z' }),
        P({ id: 'b', slug: 'new', date: '2026-01-01 00:00:00.000Z' }),
      ],
      [T({ post: 'a' }), T({ post: 'b', id: 't2' })],
    );
    expect((await listPosts({}, pb)).map((p) => p.slug)).toEqual(['new', 'old']);
  });
  it('skips posts that have no translation at all', async () => {
    expect(await listPosts({}, stub([P({})], []))).toEqual([]);
  });
  it('wraps network failures in UpstreamError', async () => {
    await expect(listPosts({}, stub([], [], new Error('fetch failed')))).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });
  it('rejects a malformed record with the field name in the message', async () => {
    const pb = stub([P({ status: 'archived' })], [T({})]);
    await expect(listPosts({}, pb)).rejects.toThrow(/status/);
  });
});

describe('imageUrl', () => {
  it('builds a browser-facing PocketBase file URL', () => {
    expect(imageUrl({ id: 'x1' }, 'a.png', '/pb')).toBe('/pb/api/files/posts/x1/a.png');
  });
});

describe('getPost', () => {
  it('returns null for a malformed slug without querying', async () => {
    expect(await getPost('Bad Slug"; drop', 'en', stub([P({})], [T({})]))).toBeNull();
  });
  it('wraps network failures in UpstreamError', async () => {
    await expect(
      getPost('a', 'en', stub([], [], new Error('fetch failed'))),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
  it('returns null for an unknown slug', async () => {
    expect(await getPost('nope', 'en', stub([], []))).toBeNull();
  });
  it('returns null when the requested language does not exist', async () => {
    expect(await getPost('a', 'fa', stub([P({})], [T({ lang: 'en' })]))).toBeNull();
  });
  it('returns the requested translation body', async () => {
    const post = await getPost('a', 'en', stub([P({})], [T({ body_md: '# hi' })]));
    expect(post).toMatchObject({ slug: 'a', lang: 'en', bodyMd: '# hi' });
  });
});
