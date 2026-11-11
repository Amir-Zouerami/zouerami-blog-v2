import { jwtVerify, SignJWT } from 'jose';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** Convenience for the UI only: PocketBase re-checks the real role on every admin request. */
  role: 'user' | 'admin';
}

export const SESSION_COOKIE = 'session';
/** Access token: short, stateless. Revocation latency is bounded by this. */
export const SESSION_TTL_SECONDS = 60 * 10;
/** Refresh cookie holds PocketBase's own auth token; refreshing re-checks the user in the DB. */
export const REFRESH_COOKIE = 'refresh';
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

function key(secret: string): Uint8Array {
  if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export function getAuthSecret(source: Record<string, string | undefined> = process.env): string {
  const secret = source.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Missing or too short environment variable: AUTH_SECRET (min 32 chars)');
  }
  return secret;
}

/** Stateless session token: verified by signature + expiry only, no DB/Redis lookup. */
export async function signSession(
  user: SessionUser,
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role === 'admin' ? 'admin' : 'user',
    };
  } catch {
    return null;
  }
}
