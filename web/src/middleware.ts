import { defineMiddleware } from 'astro:middleware';
import {
  clearAuthCookies,
  refreshFromPocketBase,
  setAccessCookie,
  setRefreshCookie,
} from './lib/auth-cookies';
import { loadEnv } from './lib/env';
import { getAuthSecret, REFRESH_COOKIE, SESSION_COOKIE, verifySession } from './lib/session';

/**
 * `locals.user` comes from the short-lived signed access cookie (no DB/Redis call).
 * Only when it is missing/expired do we use the refresh cookie, which asks PocketBase once.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies } = context;
  // CSRF: state-changing API calls must come from this site (SameSite=Lax is the second layer).
  if (!SAFE.has(context.request.method) && context.url.pathname.startsWith('/api/')) {
    const origin = context.request.headers.get('origin');
    if (origin) {
      let host = '';
      try {
        host = new URL(origin).host;
      } catch {
        /* malformed origin is rejected below */
      }
      // nginx forwards Host without the port, so also accept the configured public site host
      if (host !== context.url.host && host !== new URL(loadEnv().SITE_URL).host) {
        return new Response(JSON.stringify({ error: 'Cross-site request blocked' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
  }
  const access = cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = access ? await verifySession(access, getAuthSecret()) : null;

  const refresh = cookies.get(REFRESH_COOKIE)?.value;
  if (!context.locals.user && refresh && context.url.pathname !== '/api/auth/logout') {
    const r = await refreshFromPocketBase(refresh);
    if (r.status === 'ok') {
      context.locals.user = r.user;
      await setAccessCookie(cookies, r.user);
      setRefreshCookie(cookies, r.pbToken);
    } else if (r.status === 'invalid') {
      clearAuthCookies(cookies);
    }
  }
  return next();
});
