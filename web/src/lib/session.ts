import { jwtVerify, SignJWT } from 'jose';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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
  return new SignJWT({ email: user.email, name: user.name })
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
    return { id: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
