import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/lib/http';
import { verifyTurnstile } from '../../src/lib/turnstile';

const ok = async () => new Response(JSON.stringify({ success: true }));
const no = async () => new Response(JSON.stringify({ success: false }));

describe('verifyTurnstile', () => {
  it('skips verification when no secret is configured (dev)', async () => {
    expect(await verifyTurnstile(undefined, undefined, {})).toBe(true);
  });
  it('requires a token when a secret is configured', async () => {
    expect(await verifyTurnstile('', undefined, { secret: 's', fetch: ok })).toBe(false);
    expect(await verifyTurnstile(undefined, undefined, { secret: 's', fetch: ok })).toBe(false);
  });
  it('accepts only success:true', async () => {
    expect(await verifyTurnstile('t', '1.2.3.4', { secret: 's', fetch: ok })).toBe(true);
    expect(await verifyTurnstile('t', undefined, { secret: 's', fetch: no })).toBe(false);
  });
  it('fails closed on network errors and non-200', async () => {
    const boom = async () => {
      throw new Error('net');
    };
    expect(await verifyTurnstile('t', undefined, { secret: 's', fetch: boom })).toBe(false);
    const five = async () => new Response('x', { status: 500 });
    expect(await verifyTurnstile('t', undefined, { secret: 's', fetch: five })).toBe(false);
  });
});

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
