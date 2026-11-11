import { defineMiddleware } from 'astro:middleware';
import { getAuthSecret, SESSION_COOKIE, verifySession } from './lib/session';

/** Resolves `locals.user` from the signed session cookie alone: no PocketBase or Redis call. */
export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = token ? await verifySession(token, getAuthSecret()) : null;
  return next();
});
