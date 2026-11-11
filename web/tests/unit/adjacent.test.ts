import { describe, expect, it } from 'vitest';
import { adjacent } from '../../src/lib/posts';
import type { PostSummary } from '../../src/lib/schemas';

const p = (slug: string): PostSummary => ({
  slug,
  date: '2026-01-01',
  tags: [],
  langs: ['en'],
  titleLang: 'en',
  title: slug,
  summary: '',
  cover: null,
});
const all = [p('c'), p('b'), p('a')]; // newest first

describe('adjacent', () => {
  it('previous is older, next is newer', () => {
    expect(adjacent(all, 'b')).toEqual({ previous: p('a'), next: p('c') });
  });
  it('wraps around at the ends', () => {
    expect(adjacent(all, 'c').next).toEqual(p('a'));
    expect(adjacent(all, 'a').previous).toEqual(p('c'));
  });
  it('is empty for a single post or unknown slug', () => {
    expect(adjacent([p('a')], 'a')).toEqual({ previous: null, next: null });
    expect(adjacent(all, 'zzz')).toEqual({ previous: null, next: null });
  });
});
