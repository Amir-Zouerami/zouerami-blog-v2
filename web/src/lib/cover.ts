function rng(a: number) {
  let s = a | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic generated artwork (the Signal covers): same seed → same SVG. */
export function cover(seed: number): string {
  const r = rng(seed * 9973 + 7);
  const C = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  let s =
    '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="300" fill="var(--cv-bg)"/>';
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const c = C[Math.floor(r() * 3)];
    const t = r();
    const x = r() * 400;
    const y = r() * 300;
    if (t < 0.4)
      s += `<circle cx="${x | 0}" cy="${y | 0}" r="${(18 + r() * 80) | 0}" fill="${c}" opacity=".88"/>`;
    else if (t < 0.7)
      s += `<rect x="${x | 0}" y="${y | 0}" width="${(40 + r() * 140) | 0}" height="${(30 + r() * 100) | 0}" rx="${(r() * 40) | 0}" fill="${c}" opacity=".8" transform="rotate(${(r() * 60 - 30) | 0} ${x | 0} ${y | 0})"/>`;
    else
      s += `<circle cx="${x | 0}" cy="${y | 0}" r="${(30 + r() * 90) | 0}" fill="none" stroke="${c}" stroke-width="${(4 + r() * 14) | 0}" opacity=".9"/>`;
  }
  return `${s}</svg>`;
}

/** Stable numeric seed from a slug. */
export function seedOf(slug: string): number {
  let h = 7;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 1000;
}
