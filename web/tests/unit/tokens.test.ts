import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(new URL(`../../src/styles/${f}`, import.meta.url), 'utf8');

describe('Signal refined tokens', () => {
  const tokens = read('tokens.css');
  it('dark default and light override match the mockup', () => {
    expect(tokens).toContain('--acc: #d4ff3a');
    expect(tokens).toContain('--bg: #0a0a0b');
    expect(tokens).toMatch(/\[data-theme=['"]light['"]\][^}]*--acc: #2a3bff/);
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
