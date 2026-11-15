import { describe, expect, it } from 'vitest';
import { type TileVariant, tileVariants } from '../../src/lib/tiles';

/** Columns a tile occupies on the 6-column grid, and how many rows it spans (1 row = a bottom-row tile). */
const SPAN: Record<TileVariant, [number, number]> = {
  hero: [6, 2],
  big: [4, 2],
  tall: [2, 2],
  side: [2, 1],
  half: [3, 1],
  full: [6, 1],
  third: [2, 1],
};

describe('tileVariants', () => {
  it('returns one variant per post', () => {
    for (let n = 0; n <= 8; n++) expect(tileVariants(n)).toHaveLength(n);
  });
  it('always fills the grid completely (no holes), for 1 to 5 posts', () => {
    for (let n = 1; n <= 5; n++) {
      const area = tileVariants(n).reduce((sum, v) => sum + SPAN[v][0] * SPAN[v][1], 0);
      // the block is 6 columns x (2 rows + a third row when there are four or five posts)
      const rows = n >= 4 ? 3 : 2;
      expect(area).toBe(6 * rows);
    }
  });
  it('starts with the large tile', () => {
    expect(tileVariants(3)[0]).toBe('big');
    expect(tileVariants(1)[0]).toBe('hero');
  });
});
