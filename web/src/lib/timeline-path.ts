/**
 * Geometry for the About page's time line: one long curve that swings left and right through every event,
 * plus fainter "ghost" strands around it. Pure and deterministic so it can be rendered on the server and tested.
 * Coordinates live in a 1000-wide box; `height` grows with the number of events.
 */
export const BOX_W = 1000;
export const ROW = 340;
const TOP = 170;

export interface Point {
  x: number;
  y: number;
}
export interface TimelineGeometry {
  height: number;
  points: Point[];
  main: string;
  ghosts: string[];
  /** Small decorative rings scattered along the line. */
  rings: { x: number; y: number; r: number }[];
}

const f = (n: number) => Number(n.toFixed(1));

/** Smooth swooping curve through `pts`, starting at the top centre; `swing` scales how wide the S-bends are. */
function strand(pts: Point[], height: number, swing: number, dx = 0, dy = 0): string {
  let d = `M ${f(BOX_W / 2 + dx)} ${f(0 + dy)}`;
  let prev: Point = { x: BOX_W / 2, y: 0 };
  for (const p of pts) {
    const dir = Math.sign(p.x - prev.x) || 1;
    const rise = (p.y - prev.y) * 0.42;
    d += ` C ${f(prev.x + dir * swing + dx)} ${f(prev.y + rise + dy)}, ${f(p.x - dir * swing + dx)} ${f(p.y - rise + dy)}, ${f(p.x + dx)} ${f(p.y + dy)}`;
    prev = p;
  }
  // a last easing curve that drifts out toward the bottom centre
  d += ` S ${f(BOX_W / 2 + dx)} ${f(height - 60 + dy)}, ${f(BOX_W / 2 + dx)} ${f(height + dy)}`;
  return d;
}

export function timelineGeometry(count: number): TimelineGeometry {
  const n = Math.max(0, count);
  const points: Point[] = Array.from({ length: n }, (_, i) => ({
    x: i % 2 === 0 ? 270 : 730,
    y: TOP + i * ROW,
  }));
  const height = TOP + Math.max(0, n - 1) * ROW + TOP + 80;
  if (n === 0) return { height, points, main: '', ghosts: [], rings: [] };
  const main = strand(points, height, 420);
  const ghosts = [
    strand(points, height, 300, -46, 18),
    strand(points, height, 520, 52, -14),
    strand(points, height, 360, 110, 40),
  ];
  const rings = points.flatMap((p, i) => [
    { x: p.x, y: p.y, r: 34 },
    { x: p.x, y: p.y, r: 62 },
    { x: BOX_W - p.x + (i % 3) * 18, y: p.y + ROW * 0.5, r: 6 + (i % 3) * 3 },
  ]);
  return { height, points, main, ghosts, rings };
}
