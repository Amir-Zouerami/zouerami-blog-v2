import { describe, expect, it } from 'vitest';
import { BOX_W, ROW, timelineGeometry } from '../../src/lib/timeline-path';

describe('timelineGeometry', () => {
  it('is empty and safe for zero events', () => {
    const g = timelineGeometry(0);
    expect(g.points).toEqual([]);
    expect(g.main).toBe('');
  });
  it('alternates sides, spaces events evenly and keeps every point inside the box', () => {
    const g = timelineGeometry(5);
    expect(g.points).toHaveLength(5);
    g.points.forEach((p, i) => {
      expect(p.x).toBe(i % 2 === 0 ? 270 : 730);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(BOX_W);
      if (i) expect(p.y - (g.points[i - 1] as { y: number }).y).toBe(ROW);
    });
    expect(g.height).toBeGreaterThan((g.points.at(-1) as { y: number }).y);
  });
  it('builds one bezier segment per event plus the closing ease, and strands that differ', () => {
    const g = timelineGeometry(4);
    expect(g.main.startsWith('M 500 0')).toBe(true);
    expect(g.main.match(/ C /g)).toHaveLength(4);
    expect(g.main).toContain(' S ');
    expect(g.ghosts).toHaveLength(3);
    expect(new Set([g.main, ...g.ghosts]).size).toBe(4);
    expect(g.main).not.toMatch(/NaN|undefined/);
  });
  it('is deterministic', () => {
    expect(timelineGeometry(6)).toEqual(timelineGeometry(6));
  });
  it('grows with the number of events', () => {
    expect(timelineGeometry(8).height).toBeGreaterThan(timelineGeometry(3).height);
  });
});
