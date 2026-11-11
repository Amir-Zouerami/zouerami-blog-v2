import { defineMiddleware } from 'astro:middleware';
import { clearAuthCookies, startSession } from './lib/auth/cookies';
import { refreshFromPocketBase } from './lib/auth/refresh';
import { REFRESH_COOKIE, SESSION_COOKIE, verifySession } from './lib/auth/session';
import { getConfig } from './lib/config';
import { isCrossSiteWrite } from './lib/csrf';
import { json } from './lib/http';

/**
 * 1. CSRF: state-changing API calls must originate from this site.
 * 2. `locals.user` comes from the short-lived signed access cookie (no database or Redis call).
 *    Only when it is missing/expired is the refresh cookie used, which asks PocketBase once.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, request, url } = context;
  const config = getConfig();

  // nginx forwards Host without the port, so the configured public host is accepted too
  if (
    url.pathname.startsWith('/api/') &&
    isCrossSiteWrite(request.method, request.headers.get('origin'), [url.host, config.siteHost])
  ) {
    return json(403, { error: 'Cross-site request blocked' });
  }

  const access = cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = access ? await verifySession(access, config.authSecret) : null;

  const refresh = cookies.get(REFRESH_COOKIE)?.value;
  if (!context.locals.user && refresh && url.pathname !== '/api/auth/logout') {
    const result = await refreshFromPocketBase(refresh);
    if (result.status === 'ok') {
      context.locals.user = result.user;
      await startSession(cookies, result.user, result.pbToken);
    } else if (result.status === 'invalid') {
      clearAuthCookies(cookies);
    }
  }
  return next();
});
