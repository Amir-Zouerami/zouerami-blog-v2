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

describe('Lanyard drop (folded start)', () => {
  const folded = () =>
    new Lanyard({
      anchor: { x: 200, y: -480 },
      segments: 27,
      segLen: 22,
      cardLen: 314,
      minX: 0,
      maxX: 400,
      folded: true,
    });
  it('starts bunched up above the visible area, all of it above y = 0', () => {
    const l = folded();
    for (const p of l.pts) expect(p.y).toBeLessThan(0);
  });
  it('falls under gravity, goes taut and settles hanging under the anchor with the clip near its old rest position', () => {
    const l = folded();
    l.nudge(150);
    let maxSpeed = 0;
    for (let i = 0; i < 120 * 30; i++) {
      l.step(1 / 120);
      maxSpeed = Math.max(maxSpeed, Math.sqrt(l.energy()));
    }
    expect(maxSpeed).toBeGreaterThan(1); // it actually fell (fast), it was not slid into place
    expect(l.energy()).toBeLessThan(0.01);
    expect(l.top.x).toBeCloseTo(200, 0);
    expect(l.top.y).toBeGreaterThan(80);
    expect(l.top.y).toBeLessThan(130);
  });
  it('really accelerates: the card is falling faster half-way down than at the start', () => {
    const l = folded();
    const speeds: number[] = [];
    for (let i = 0; i < 60; i++) {
      const y0 = l.bottom.y;
      l.step(1 / 120);
      speeds.push(l.bottom.y - y0);
    }
    expect(speeds[50] as number).toBeGreaterThan((speeds[5] as number) * 3);
  });
});
