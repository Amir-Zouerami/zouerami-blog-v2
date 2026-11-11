import type { AstroCookies } from 'astro';
import PocketBase from 'pocketbase';
import { loadEnv } from './env';
import {
  getAuthSecret,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionUser,
  signSession,
} from './session';

function opts(maxAge: number, path: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: loadEnv().SITE_URL.startsWith('https:'),
    path,
    maxAge,
  };
}

/** Non-sensitive hint so the page can skip the "who am I" call for anonymous visitors. */
function setHint(cookies: AstroCookies, on: boolean) {
  if (on)
    cookies.set('signed_in', '1', {
      httpOnly: false,
      sameSite: 'lax',
      secure: loadEnv().SITE_URL.startsWith('https:'),
      path: '/',
      maxAge: REFRESH_TTL_SECONDS,
    });
  else cookies.delete('signed_in', { path: '/' });
}

export async function setAccessCookie(cookies: AstroCookies, user: SessionUser) {
  setHint(cookies, true);
  cookies.set(
    SESSION_COOKIE,
    await signSession(user, getAuthSecret()),
    opts(SESSION_TTL_SECONDS, '/'),
  );
}

export function setRefreshCookie(cookies: AstroCookies, pbToken: string) {
  cookies.set(REFRESH_COOKIE, pbToken, opts(REFRESH_TTL_SECONDS, '/api'));
}

export function clearAuthCookies(cookies: AstroCookies) {
  setHint(cookies, false);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(REFRESH_COOKIE, { path: '/api' });
}

export const toSessionUser = (r: { id: string; email: string; name?: string }): SessionUser => ({
  id: r.id,
  email: r.email,
  name: r.name || r.email,
});

/**
 * The only DB-touching step after login: PocketBase re-validates the token and the user.
 * 'invalid' = token rejected (clear cookies); 'unavailable' = PocketBase down (keep cookies, stay anonymous).
 */
export async function refreshFromPocketBase(
  pbToken: string,
): Promise<
  { status: 'ok'; user: SessionUser; pbToken: string } | { status: 'invalid' | 'unavailable' }
> {
  const pb = new PocketBase(loadEnv().PB_URL);
  pb.autoCancellation(false);
  pb.authStore.save(pbToken, null);
  try {
    const { token, record } = await pb.collection('users').authRefresh();
    return { status: 'ok', user: toSessionUser(record as never), pbToken: token };
  } catch (err) {
    const status = (err as { status?: number }).status;
    return {
      status:
        status === 400 || status === 401 || status === 403 || status === 404
          ? 'invalid'
          : 'unavailable',
    };
  }
}
