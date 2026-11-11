import type { AstroCookies } from 'astro';
import { getConfig } from '../config';
import {
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionUser,
  signSession,
} from './session';

const HINT_COOKIE = 'signed_in';

function httpOnly(maxAge: number, path: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: getConfig().secureCookies,
    path,
    maxAge,
  };
}

/** Non-sensitive hint so pages can skip the "who am I" call for anonymous visitors. */
function setHint(cookies: AstroCookies, on: boolean) {
  if (!on) return void cookies.delete(HINT_COOKIE, { path: '/' });
  cookies.set(HINT_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'lax',
    secure: getConfig().secureCookies,
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export async function setAccessCookie(cookies: AstroCookies, user: SessionUser): Promise<void> {
  setHint(cookies, true);
  cookies.set(
    SESSION_COOKIE,
    await signSession(user, getConfig().authSecret),
    httpOnly(SESSION_TTL_SECONDS, '/'),
  );
}

export function setRefreshCookie(cookies: AstroCookies, pbToken: string): void {
  cookies.set(REFRESH_COOKIE, pbToken, httpOnly(REFRESH_TTL_SECONDS, '/api'));
}

/** Signs the user in: short-lived stateless JWT + PocketBase token for refreshes and user-scoped calls. */
export async function startSession(
  cookies: AstroCookies,
  user: SessionUser,
  pbToken: string,
): Promise<void> {
  await setAccessCookie(cookies, user);
  setRefreshCookie(cookies, pbToken);
}

export function clearAuthCookies(cookies: AstroCookies): void {
  setHint(cookies, false);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(REFRESH_COOKIE, { path: '/api' });
}
