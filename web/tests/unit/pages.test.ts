import { describe, expect, it } from 'vitest';
import { allTags, filterPosts, groupByYear, load } from '../../src/lib/pages';
import { UpstreamError } from '../../src/lib/pb';
import type { PostSummary } from '../../src/lib/schemas';

const p = (o: Partial<PostSummary>): PostSummary => ({
  id: 'aaaaaaaaaaaaaaa',
  featured: false,
  slug: 'a',
  date: '2026-05-01',
  tags: [],
  langs: ['en'],
  titleLang: 'en',
  title: 'Hello',
  summary: '',
  cover: null,
  ...o,
});

describe('load', () => {
  it('maps null to notfound, data to ok and UpstreamError to unavailable', async () => {
    expect(await load('t', async () => null)).toEqual({ kind: 'notfound' });
    expect(await load('t', async () => 5)).toEqual({ kind: 'ok', data: 5 });
    expect(
      await load('t', async () => {
        throw new UpstreamError('down');
      }),
    ).toEqual({ kind: 'unavailable' });
  });
  it('lets programming errors bubble up', async () => {
    await expect(
      load('t', async () => {
        throw new TypeError('bug');
      }),
    ).rejects.toThrow('bug');
  });
});

describe('blog filtering', () => {
  const posts = [
    p({ slug: 'a', title: 'Astro islands', tags: ['Web'] }),
    p({ slug: 'b', title: 'Docker', summary: 'nginx tips', tags: ['DevOps'], date: '2025-01-01' }),
  ];
  it('filters by tag and by text across title, summary and tags', () => {
    expect(filterPosts(posts, { tag: 'Web', q: '' }).map((x) => x.slug)).toEqual(['a']);
    expect(filterPosts(posts, { tag: 'all', q: 'NGINX' }).map((x) => x.slug)).toEqual(['b']);
    expect(filterPosts(posts, { tag: 'all', q: 'devops' }).map((x) => x.slug)).toEqual(['b']);
    expect(filterPosts(posts, { tag: 'Web', q: 'docker' })).toEqual([]);
    expect(filterPosts(posts, { tag: 'all', q: '(' })).toEqual([]);
  });
  it('lists sorted unique tags and years in order of appearance', () => {
    expect(allTags(posts)).toEqual(['DevOps', 'Web']);
    expect(groupByYear(posts, 'en').map((g) => g.year)).toEqual(['2026', '2025']);
  });
  it('groups by Jalali year on the Persian site (2026-11-02 is 1405, 2025-01-01 is 1403)', () => {
    const groups = groupByYear(posts, 'fa');
    expect(groups.map((g) => g.year)).toEqual(['۱۴۰۵', '۱۴۰۳']);
    expect(groups[0]?.posts.map((p) => p.slug)).toEqual(['a']);
  });
});
