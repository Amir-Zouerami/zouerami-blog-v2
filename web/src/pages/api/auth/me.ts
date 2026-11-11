import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ locals }) =>
  new Response(JSON.stringify({ user: locals.user }), {
    status: locals.user ? 200 : 401,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
