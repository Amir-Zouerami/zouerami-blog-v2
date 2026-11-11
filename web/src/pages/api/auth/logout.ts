import type { APIRoute } from 'astro';
import { clearAuthCookies } from '../../../lib/auth-cookies';

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  clearAuthCookies(cookies);
  return new Response(null, { status: 204 });
};
