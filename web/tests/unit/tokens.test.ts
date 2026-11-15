import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(new URL(`../../src/styles/${f}`, import.meta.url), 'utf8');

describe('Signal refined tokens', () => {
  const tokens = read('tokens.css');
  it('dark default and light override match the mockup', () => {
    expect(tokens).toContain('--acc: #d4ff3a');
    expect(tokens).toContain('--bg: #0a0a0b');
    expect(tokens).toMatch(/\[data-theme=['"]light['"]\][^}]*--acc: #cf1f5a/);
    expect(tokens).toMatch(/\[data-theme=['"]light['"]\][^}]*--bg: #f1f0ea/);
  });
  it('never loads fonts from a third party', () => {
    for (const f of ['tokens.css', 'signal.css', 'fonts.css', 'global.css'])
      expect(read(f)).not.toMatch(/googleapis|gstatic/);
  });
  it('respects reduced motion', () => {
    expect(read('signal.css')).toContain('prefers-reduced-motion');
  });
});

describe('light accent contrast', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  it('the light accent is readable as text on the page background and carries white text', () => {
    expect(ratio('#cf1f5a', '#f1f0ea')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#cf1f5a', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
