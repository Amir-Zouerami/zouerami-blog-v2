import { describe, expect, it } from 'vitest';
import { idList, orderFeatured, pickInOrder } from '../../src/lib/layouts';
import type { PostSummary } from '../../src/lib/schemas';

const id = (n: number) => String(n).padStart(15, 'a');
const post = (n: number, featured = false): PostSummary => ({
  id: id(n),
  slug: `p${n}`,
  featured,
  date: `2026-01-${String(30 - n).padStart(2, '0')}`,
  tags: [],
  langs: ['en'],
  titleLang: 'en',
  title: `Post ${n}`,
  summary: '',
  cover: null,
});
// newest first, like listPosts
const all = [1, 2, 3, 4, 5, 6, 7].map((n) => post(n, n % 2 === 0));

describe('layouts', () => {
  it('idList keeps only distinct, well-formed ids', () => {
    expect(idList([id(1), id(1), 'nope', 5, id(2)])).toEqual([id(1), id(2)]);
    expect(idList(null)).toEqual([]);
    expect(idList('x')).toEqual([]);
  });

  it('pickInOrder follows the chosen order, skips unknown ids and caps at five', () => {
    expect(pickInOrder(all, [id(4), id(1), id(99), id(3)]).map((p) => p.slug)).toEqual([
      'p4',
      'p1',
      'p3',
    ]);
    expect(pickInOrder(all, [1, 2, 3, 4, 5, 6, 7].map(id))).toHaveLength(5);
    expect(pickInOrder(all, [])).toEqual([]);
  });

  it('orderFeatured: marked posts only, chosen order first, the rest newest first', () => {
    // marked: 2, 4, 6
    expect(orderFeatured(all, []).map((p) => p.slug)).toEqual(['p2', 'p4', 'p6']);
    expect(orderFeatured(all, [id(6), id(2)]).map((p) => p.slug)).toEqual(['p6', 'p2', 'p4']);
    // an id that is not marked as featured is not shown
    expect(orderFeatured(all, [id(3), id(4)]).map((p) => p.slug)).toEqual(['p4', 'p2', 'p6']);
  });
});
