import { describe, expect, it } from 'vitest';
import { Lanyard } from '../../src/lib/lanyard-physics';

const make = () =>
  new Lanyard({
    anchor: { x: 200, y: 0 },
    segments: 5,
    segLen: 26,
    cardLen: 300,
    minX: 0,
    maxX: 400,
  });
const run = (l: Lanyard, steps: number) => {
  for (let i = 0; i < steps; i++) l.step(1 / 120);
};

describe('Lanyard physics', () => {
  it('hangs straight down from the anchor once settled', () => {
    const l = make();
    l.nudge(400);
    run(l, 120 * 14);
    expect(l.top.x).toBeCloseTo(200, 0);
    expect(l.bottom.x).toBeCloseTo(200, 0);
    expect(l.bottom.y).toBeGreaterThan(l.top.y);
    expect(Math.abs(l.angle)).toBeLessThan(0.02);
    expect(l.energy()).toBeLessThan(0.01);
  });
  it('keeps the rope and card lengths (it never stretches)', () => {
    const l = make();
    l.startDrag(l.center);
    l.dragTo({ x: 390, y: 40 });
    run(l, 240);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    expect(d(l.top, l.bottom)).toBeGreaterThan(285);
    expect(d(l.top, l.bottom)).toBeLessThan(315);
    for (let i = 0; i < 5; i++)
      expect(d(l.pts[i] as never, l.pts[i + 1] as never)).toBeLessThan(26 * 1.15);
  });
  it('follows the pointer while dragged, swings after release, then settles again', () => {
    const l = make();
    const start = l.center;
    l.startDrag(start);
    expect(l.dragging).toBe(true);
    l.dragTo({ x: start.x + 120, y: start.y - 20 });
    run(l, 120);
    expect(l.center.x).toBeGreaterThan(start.x + 40);
    l.endDrag();
    expect(l.dragging).toBe(false);
    run(l, 30);
    expect(l.energy()).toBeGreaterThan(0.05); // still swinging
    run(l, 120 * 20);
    expect(l.energy()).toBeLessThan(0.01);
    expect(l.top.x).toBeCloseTo(200, 0);
  });
  it('keeps the pinned point fixed and stays inside the bounds', () => {
    const l = make();
    l.startDrag(l.center);
    l.dragTo({ x: 5000, y: 200 });
    run(l, 300);
    expect(l.pts[0]).toMatchObject({ x: 200, y: 0 });
    for (const p of l.pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(400);
    }
  });
  it('is deterministic', () => {
    const a = make();
    const b = make();
    a.nudge(300);
    b.nudge(300);
    run(a, 200);
    run(b, 200);
    expect(a.center).toEqual(b.center);
  });
});
