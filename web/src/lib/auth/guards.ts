import type { APIContext, APIRoute } from 'astro';
import type PocketBase from 'pocketbase';
import { json } from '../http';
import { PB_TOKEN_COOKIE, userPb } from '../pb';
import type { SessionUser } from './session';

export interface Session {
  user: SessionUser;
  /** PocketBase client acting as this user. */
  pb: PocketBase;
  /** The user's raw PocketBase token (for proxying). */
  token: string;
}

type Handler = (ctx: APIContext, session: Session) => Response | Promise<Response>;

function guard(handler: Handler, adminOnly: boolean): APIRoute {
  return (ctx) => {
    const user = ctx.locals.user;
    if (!user) return json(401, { error: 'Sign in first' });
    if (adminOnly && user.role !== 'admin') return json(403, { error: 'Admins only' });
    const pb = userPb(ctx.cookies);
    const token = ctx.cookies.get(PB_TOKEN_COOKIE)?.value;
    if (!pb || !token) return json(401, { error: 'Sign in again' });
    return handler(ctx, { user, pb, token });
  };
}

/** Route handler that requires a signed-in user (401 otherwise). */
export const authed = (handler: Handler): APIRoute => guard(handler, false);

/** Route handler that requires an admin (401/403 otherwise). PocketBase re-checks the real role on every call. */
export const adminOnly = (handler: Handler): APIRoute => guard(handler, true);
