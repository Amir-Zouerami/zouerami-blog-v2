import { defineMiddleware } from 'astro:middleware';
import { fail, TRACE_HEADER } from './lib/api';
import { clearAuthCookies, startSession } from './lib/auth/cookies';
import { refreshFromPocketBase } from './lib/auth/refresh';
import { REFRESH_COOKIE, SESSION_COOKIE, verifySession } from './lib/auth/session';
import { getConfig } from './lib/config';
import { isCrossSiteWrite } from './lib/csrf';
import { rootLogger, runWithContext } from './lib/log';
import { isUuid, uuidv7 } from './lib/uuid7';
import { warmMarkdown } from './lib/warmup';

/** Static assets: not worth a log line each. */
const QUIET = /^\/(_astro|fonts)\/|^\/favicon\.svg$/;

let announced = false;

function announce(): void {
  if (announced) return;
  announced = true;
  warmMarkdown();
  const c = getConfig();
  rootLogger().info(
    {
      siteUrl: c.siteUrl,
      pbUrl: c.pbUrl,
      turnstileEnabled: !!c.turnstile.secret,
      logLevel: c.log.level,
    },
    'web server ready',
  );
  // without a secret every sign-up, comment and subscribe skips the bot check: fine locally, a mistake in production
  if (c.secureCookies && !c.turnstile.secret)
    rootLogger().warn(
      'TURNSTILE_SECRET is not set: bot protection is OFF on a production (https) site',
    );
}

/** `x-trace-id` on the response; rebuilds the Response when its headers are immutable (proxied/redirect responses). */
function withTrace(res: Response, traceId: string): Response {
  try {
    res.headers.set(TRACE_HEADER, traceId);
    return res;
  } catch {
    const headers = new Headers(res.headers);
    headers.set(TRACE_HEADER, traceId);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

/**
 * Per request:
 *  1. assign a UUIDv7 trace id (or accept a valid one from a trusted proxy) and bind a logger to it;
 *  2. CSRF check for state-changing API calls;
 *  3. resolve `locals.user` from the short-lived signed JWT (no database call), refreshing through
 *     PocketBase only when it has expired;
 *  4. log the outcome and stamp `x-trace-id` on the response.
 */
export const onRequest = defineMiddleware((context, next) => {
  const { cookies, request, url } = context;
  const inbound = request.headers.get(TRACE_HEADER);
  const traceId = isUuid(inbound) ? inbound : uuidv7();
  const log = rootLogger().child({ traceId });
  context.locals.traceId = traceId;
  context.locals.log = log;

  return runWithContext({ traceId, log }, async () => {
    announce();
    const started = performance.now();
    const config = getConfig();
    const isApi = url.pathname.startsWith('/api/');
    let response: Response;
    try {
      if (
        isApi &&
        isCrossSiteWrite(request.method, request.headers.get('origin'), [url.host, config.siteHost])
      ) {
        log.warn(
          { origin: request.headers.get('origin'), path: url.pathname },
          'cross-site write blocked',
        );
        response = fail(403, 'cross_site_blocked', 'Cross-site request blocked');
      } else {
        const access = cookies.get(SESSION_COOKIE)?.value;
        context.locals.user = access ? await verifySession(access, config.authSecret) : null;

        const refresh = cookies.get(REFRESH_COOKIE)?.value;
        if (!context.locals.user && refresh && url.pathname !== '/api/auth/logout') {
          const result = await refreshFromPocketBase(refresh);
          if (result.status === 'ok') {
            context.locals.user = result.user;
            await startSession(cookies, result.user, result.pbToken);
            log.debug({ userId: result.user.id }, 'session refreshed from PocketBase');
          } else if (result.status === 'invalid') {
            clearAuthCookies(cookies);
            log.info('refresh token rejected; session cleared');
          } else {
            log.warn('PocketBase unavailable during session refresh');
          }
        }
        response = await next();
      }
    } catch (err) {
      log.error({ err, method: request.method, path: url.pathname }, 'unhandled error');
      if (!isApi) throw err; // Astro renders its error page
      response = fail(500, 'internal_error', 'Something went wrong on our side.');
    }

    const status = response.status;
    if (!QUIET.test(url.pathname)) {
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      log[level](
        {
          method: request.method,
          path: url.pathname,
          status,
          ms: Math.round(performance.now() - started),
          userId: context.locals.user?.id,
        },
        `${request.method} ${url.pathname} → ${status}`,
      );
    }
    return withTrace(response, traceId);
  });
});
