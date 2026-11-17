import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/lib/http';

describe('safeNext', () => {
  it('allows same-site paths', () => {
    expect(safeNext('/blog/x?y=1#z')).toBe('/blog/x?y=1#z');
    expect(safeNext('/fa/account')).toBe('/fa/account');
  });
  it('rejects open redirects and junk', () => {
    for (const bad of [
      '//evil.com',
      'https://evil.com',
      '/\\evil.com',
      'javascript:alert(1)',
      '',
      null,
      undefined,
      '/a\nb',
    ])
      expect(safeNext(bad as string)).toBe('/');
  });
  it('uses the fallback', () => {
    expect(safeNext('//x', '/account')).toBe('/account');
  });
});
