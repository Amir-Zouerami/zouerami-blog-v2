import { describe, expect, it } from 'vitest';
import { burstPlan, CONFETTI_COLORS } from '../../src/lib/confetti';

/** hue 0–360 of a #rrggbb colour */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

describe('confetti', () => {
  it('uses a real party palette: many distinct hues, nothing grey', () => {
    const hues = new Set(CONFETTI_COLORS.map((c) => Math.round(hue(c) / 30)));
    expect(hues.size).toBeGreaterThanOrEqual(6);
    expect(CONFETTI_COLORS.length).toBeGreaterThanOrEqual(8);
  });
  it('is a big burst: 250+ particles in several waves, larger than the library default', () => {
    const plan = burstPlan({ x: 0.5, y: 0.5 });
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.reduce((n, w) => n + w.particleCount, 0)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...plan.map((w) => w.scalar))).toBeGreaterThan(1.5);
    for (const w of plan) {
      expect(w.origin).toEqual({ x: 0.5, y: 0.5 });
      expect(w.zIndex).toBeGreaterThanOrEqual(700);
      expect(w.disableForReducedMotion).toBe(true);
    }
  });
});
