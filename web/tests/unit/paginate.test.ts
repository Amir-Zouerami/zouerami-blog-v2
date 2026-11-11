import { describe, expect, it } from 'vitest';
import { pageParam, pageWindow, paginate } from '../../src/lib/paginate';

describe('paginate', () => {
  const list = Array.from({ length: 25 }, (_, i) => i);
  it('slices pages and counts them', () => {
    expect(paginate(list, 1, 10)).toMatchObject({ page: 1, pages: 3, total: 25 });
    expect(paginate(list, 3, 10).items).toEqual([20, 21, 22, 23, 24]);
  });
  it('clamps out-of-range pages and handles empty lists', () => {
    expect(paginate(list, 99, 10).page).toBe(3);
    expect(paginate(list, 0, 10).page).toBe(1);
    expect(paginate([], 4, 10)).toMatchObject({ items: [], page: 1, pages: 1, total: 0 });
  });
  it('parses ?page= safely', () => {
    expect(pageParam('3')).toBe(3);
    for (const bad of [null, undefined, '', 'x', '-2', '0']) expect(pageParam(bad)).toBe(1);
  });
});

describe('pageWindow', () => {
  it('shows everything when short', () => expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]));
  it('collapses long gaps and keeps ends', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, '…', 10]);
    expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageWindow(10, 10)).toEqual([1, '…', 9, 10]);
  });
  it('fills a one-page gap instead of an ellipsis', () =>
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]));
});
