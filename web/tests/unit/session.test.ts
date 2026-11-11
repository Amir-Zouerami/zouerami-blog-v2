import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '../../src/lib/session';

const secret = 'x'.repeat(40);
const user = { id: 'u1', email: 'a@b.co', name: 'Ami' };

describe('session JWT', () => {
  it('round-trips the user claims without any lookup', async () => {
    const token = await signSession(user, secret);
    expect(await verifySession(token, secret)).toEqual(user);
  });
  it('rejects a token signed with another secret', async () => {
    const token = await signSession(user, 'y'.repeat(40));
    expect(await verifySession(token, secret)).toBeNull();
  });
  it('rejects a tampered token', async () => {
    const token = await signSession(user, secret);
    const bad = `${token.slice(0, -2)}${token.endsWith('aa') ? 'bb' : 'aa'}`;
    expect(await verifySession(bad, secret)).toBeNull();
  });
  it('rejects an expired token', async () => {
    const token = await signSession(user, secret, -10);
    expect(await verifySession(token, secret)).toBeNull();
  });
  it('rejects alg=none and garbage', async () => {
    expect(await verifySession('abc.def.ghi', secret)).toBeNull();
    expect(await verifySession('', secret)).toBeNull();
    const forged = await new SignJWT({ email: 'a@b.co', name: 'x' })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject('u1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    expect(await verifySession(forged, secret)).toBeNull();
  });
  it('refuses a short secret', async () => {
    await expect(signSession(user, 'short')).rejects.toThrow(/AUTH_SECRET/);
  });
});
