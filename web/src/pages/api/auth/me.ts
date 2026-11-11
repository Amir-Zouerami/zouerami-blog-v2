import type { APIRoute } from 'astro';
import { fail, ok } from '../../../lib/api';

export const prerender = false;

/** The signed-in user (from the signed JWT: no database call), or 401. */
export const GET: APIRoute = ({ locals }) =>
  locals.user ? ok({ user: locals.user }) : fail(401, 'unauthorized', 'Not signed in.');
