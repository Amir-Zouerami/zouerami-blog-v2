/**
 * Tiny verlet-integration physics for the hero lanyard: a pinned rope of equal segments with a rigid card hung at
 * its end (two particles, the lower one heavier so the card swings like a real badge). Pure and deterministic, so it
 * can be unit-tested; the component only reads positions and draws them.
 */
export interface Vec {
  x: number;
  y: number;
}

interface Particle extends Vec {
  px: number;
  py: number;
  /** Inverse mass: 0 = pinned. */
  inv: number;
}

export interface LanyardOptions {
  anchor: Vec;
  /** Rope segments (the rope has `segments + 1` points, the first pinned to `anchor`). */
  segments: number;
  segLen: number;
  /** Distance from the card's attachment point to its bottom. */
  cardLen: number;
  gravity?: number;
  /** Velocity kept per step (1 = no friction). */
  damping?: number;
  iterations?: number;
  minX?: number;
  maxX?: number;
}

export class Lanyard {
  readonly pts: Particle[] = [];
  private readonly rest: number[] = [];
  private readonly o: Required<Omit<LanyardOptions, 'anchor'>> & { anchor: Vec };
  private grab: { dx: number; dy: number; tx: number; ty: number } | null = null;

  constructor(opts: LanyardOptions) {
    this.o = {
      gravity: 2600,
      damping: 0.992,
      iterations: 10,
      minX: -Infinity,
      maxX: Infinity,
      ...opts,
    };
    const { anchor, segments, segLen, cardLen } = this.o;
    for (let i = 0; i <= segments; i++) this.add(anchor.x, anchor.y + i * segLen, i === 0 ? 0 : 1);
    this.add(anchor.x, anchor.y + segments * segLen + cardLen, 3); // card bottom: heavy
    for (let i = 0; i < segments; i++) this.rest.push(segLen);
    this.rest.push(cardLen);
  }

  private add(x: number, y: number, inv: number) {
    this.pts.push({ x, y, px: x, py: y, inv });
  }

  /** Attachment point of the card (where the strap clips on). */
  get top(): Vec {
    return this.pts[this.o.segments] as Vec;
  }
  get bottom(): Vec {
    return this.pts[this.o.segments + 1] as Vec;
  }
  get center(): Vec {
    const a = this.top;
    const b = this.bottom;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  /** Clockwise screen rotation (radians) of an upright card hanging from `top`. */
  get angle(): number {
    return Math.atan2(-(this.bottom.x - this.top.x), this.bottom.y - this.top.y);
  }
  get dragging(): boolean {
    return this.grab !== null;
  }

  setAnchor(anchor: Vec, minX?: number, maxX?: number): void {
    this.o.anchor = anchor;
    if (minX !== undefined) this.o.minX = minX;
    if (maxX !== undefined) this.o.maxX = maxX;
    const p = this.pts[0] as Particle;
    p.x = p.px = anchor.x;
    p.y = p.py = anchor.y;
  }

  /** Start dragging: `at` is where the pointer is, in the same coordinates as the particles. */
  startDrag(at: Vec): void {
    const c = this.center;
    this.grab = { dx: c.x - at.x, dy: c.y - at.y, tx: at.x, ty: at.y };
  }
  dragTo(at: Vec): void {
    if (this.grab) {
      this.grab.tx = at.x;
      this.grab.ty = at.y;
    }
  }
  endDrag(): void {
    this.grab = null;
  }

  /** A sideways kick (px/s) so the card swings on its own, e.g. when it first appears. */
  nudge(vx: number, dt = 1 / 120): void {
    for (const p of [this.top, this.bottom] as Particle[]) p.px = p.x - vx * dt;
  }

  step(dt: number): void {
    const { gravity, damping, iterations, minX, maxX } = this.o;
    for (const p of this.pts) {
      if (!p.inv) continue;
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + gravity * dt * dt;
    }
    if (this.grab) {
      const c = this.center;
      const k = 0.35;
      const mx = (this.grab.tx + this.grab.dx - c.x) * k;
      const my = (this.grab.ty + this.grab.dy - c.y) * k;
      for (const p of [this.top, this.bottom]) {
        p.x += mx;
        p.y += my;
      }
    }
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < this.rest.length; i++) {
        const a = this.pts[i] as Particle;
        const b = this.pts[i + 1] as Particle;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const w = a.inv + b.inv;
        if (!w) continue;
        const diff = (d - (this.rest[i] as number)) / d / w;
        a.x += dx * diff * a.inv;
        a.y += dy * diff * a.inv;
        b.x -= dx * diff * b.inv;
        b.y -= dy * diff * b.inv;
      }
      const pin = this.pts[0] as Particle;
      pin.x = this.o.anchor.x;
      pin.y = this.o.anchor.y;
    }
    for (const p of this.pts) {
      if (p.x < minX) p.x = minX;
      else if (p.x > maxX) p.x = maxX;
    }
  }

  /** Sum of squared speeds (px/step): ~0 when everything has come to rest. */
  energy(): number {
    let e = 0;
    for (const p of this.pts) e += (p.x - p.px) ** 2 + (p.y - p.py) ** 2;
    return e;
  }
}
