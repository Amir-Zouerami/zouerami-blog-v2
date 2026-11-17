import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/lib/config';

const ok = {
  PB_URL: 'http://pb:8090/',
  PB_PUBLIC_URL: '/pb',
  SITE_URL: 'https://amir-zouerami.dev/',
  AUTH_SECRET: 'x'.repeat(40),
};

describe('parseConfig', () => {
  it('names every missing variable', () => {
    expect(() => parseConfig({})).toThrow(/PB_URL.*PB_PUBLIC_URL.*SITE_URL.*AUTH_SECRET/s);
  });
  it('treats blank values as missing', () => {
    expect(() => parseConfig({ ...ok, PB_URL: '   ' })).toThrow(/PB_URL/);
  });
  it('normalises URLs and derives secure cookies from https', () => {
    const c = parseConfig(ok);
    expect(c).toMatchObject({
      pbUrl: 'http://pb:8090',
      pbPublicUrl: '/pb',
      siteUrl: 'https://amir-zouerami.dev',
      siteHost: 'amir-zouerami.dev',
      secureCookies: true,
    });
    expect(parseConfig({ ...ok, SITE_URL: 'http://localhost:8088' }).secureCookies).toBe(false);
  });
  it('rejects short and placeholder secrets', () => {
    expect(() => parseConfig({ ...ok, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET.*32/);
    expect(() =>
      parseConfig({ ...ok, AUTH_SECRET: 'replace-with-openssl-rand-base64-48-output' }),
    ).toThrow(/placeholder/);
  });
  it('rejects a malformed SITE_URL', () => {
    expect(() => parseConfig({ ...ok, SITE_URL: 'not a url' })).toThrow(/SITE_URL/);
  });
  it('turnstile keys are optional', () => {
    expect(parseConfig(ok).turnstile).toEqual({ siteKey: undefined, secret: undefined });
    expect(parseConfig({ ...ok, TURNSTILE_SECRET: 's' }).turnstile.secret).toBe('s');
  });
});
