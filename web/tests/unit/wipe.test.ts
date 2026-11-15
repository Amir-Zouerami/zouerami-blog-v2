import { describe, expect, it } from 'vitest';
import { destinationLabel, shouldAnimate } from '../../src/lib/wipe';

const u = (p: string) => new URL(p, 'http://x');

describe('wipe', () => {
  it('labels destinations', () => {
    expect(destinationLabel(u('/'))).toBe('Home');
    expect(destinationLabel(u('/blog'))).toBe('Blog');
    expect(destinationLabel(u('/blog/some-slug'))).toBe('Blog');
    expect(destinationLabel(u('/work/lumen'))).toBe('Work');
    expect(destinationLabel(u('/about'))).toBe('About');
    expect(destinationLabel(u('/fa/cv'))).toBe('CV');
    expect(destinationLabel(u('/fa/blog/x'))).toBe('Blog');
    expect(destinationLabel(u('/fa'))).toBe('Home');
    expect(destinationLabel(u('/nope'))).toBe('zouerami');
  });
  it('skips animation under reduced motion', () => {
    expect(shouldAnimate(true)).toBe(false);
    expect(shouldAnimate(false)).toBe(true);
  });
});
