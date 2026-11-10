import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/lib/env';

describe('loadEnv', () => {
  it('fails fast naming the missing variable', () => {
    expect(() => loadEnv({})).toThrow(/PB_URL/);
  });
  it('treats an empty value as missing', () => {
    expect(() => loadEnv({ PB_URL: '', PB_PUBLIC_URL: '/pb', SITE_URL: 'http://x' })).toThrow(
      /PB_URL/,
    );
  });
  it('returns the three values when all are set', () => {
    const env = loadEnv({
      PB_URL: 'http://pb:8090',
      PB_PUBLIC_URL: '/pb',
      SITE_URL: 'http://localhost:8080',
    });
    expect(env).toEqual({
      PB_URL: 'http://pb:8090',
      PB_PUBLIC_URL: '/pb',
      SITE_URL: 'http://localhost:8080',
    });
  });
});
