import type { APIRoute } from 'astro';
import { z } from 'zod';
import { clearAuthCookies } from '../../lib/auth-cookies';
import { anonPb, json, pbStatus, readBody, userPb } from '../../lib/http';

export const prerender = false;
const Body = z.object({ password: z.string().min(1).max(128).optional() });

/** Deletes the signed-in account and everything it owns (comments, likes, bookmarks cascade in PocketBase). */
export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json(401, { error: 'Sign in first' });
  const body = (await readBody(request, Body)) ?? {};
  // Password users must confirm with their password; OAuth-only users have none to confirm.
  if (body.password !== undefined) {
    try {
      await anonPb().collection('users').authWithPassword(locals.user.email, body.password);
    } catch {
      return json(403, { error: 'Wrong password' });
    }
  }
  const pb = userPb(cookies);
  if (!pb) return json(401, { error: 'Sign in again' });
  try {
    await pb.collection('users').delete(locals.user.id);
  } catch (err) {
    return json(pbStatus(err) === 401 || pbStatus(err) === 403 ? 401 : 503, {
      error: 'Could not delete the account',
    });
  }
  clearAuthCookies(cookies);
  return json(204);
};
