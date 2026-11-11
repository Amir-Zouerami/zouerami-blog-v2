import { defineMiddleware } from 'astro:middleware';
import {
  clearAuthCookies,
  refreshFromPocketBase,
  setAccessCookie,
  setRefreshCookie,
} from './lib/auth-cookies';
import { getAuthSecret, REFRESH_COOKIE, SESSION_COOKIE, verifySession } from './lib/session';

/**
 * `locals.user` comes from the short-lived signed access cookie (no DB/Redis call).
 * Only when it is missing/expired do we use the refresh cookie, which asks PocketBase once.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies } = context;
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
