import type { APIRoute } from 'astro';
import { ok } from '../../../lib/api';
import { clearAuthCookies } from '../../../lib/auth/cookies';
import { getLog } from '../../../lib/log';

export const prerender = false;

export const POST: APIRoute = ({ cookies, locals }) => {
  clearAuthCookies(cookies);
  getLog().info({ userId: locals.user?.id }, 'signed out');
  return ok(null, { message: 'Signed out.' });
};
