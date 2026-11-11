import type { APIRoute } from 'astro';
import { loadEnv } from '../../../../lib/env';
import { json } from '../../../../lib/http';
import { REFRESH_COOKIE } from '../../../../lib/session';

export const prerender = false;

/** Collections the back office may touch, record endpoints only (no schema, settings, backups, logs, superusers). */
const ALLOWED =
  /^api\/collections\/(posts|post_translations|projects|project_translations|comments|subscribers|users)\/records(\/[a-z0-9]{15})?$/;

/**
 * Thin authenticated proxy so the admin UI can use the PocketBase SDK from the browser without ever holding
 * the PocketBase token (it lives in an httpOnly cookie). PocketBase rules (`role = "admin"`) are the real gate;
 * the role check here is a fast first filter.
 */
const handle: APIRoute = async ({ request, params, locals, cookies, url }) => {
  if (!locals.user) return json(401, { error: 'Sign in' });
  if (locals.user.role !== 'admin') return json(403, { error: 'Admins only' });
  const path = params.path ?? '';
  if (!ALLOWED.test(path)) return json(404, { error: 'Not found' });
  const token = cookies.get(REFRESH_COOKIE)?.value;
  if (!token) return json(401, { error: 'Sign in again' });

  const headers: Record<string, string> = { authorization: token };
  const ct = request.headers.get('content-type');
  if (ct) headers['content-type'] = ct;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  try {
    const res = await fetch(`${loadEnv().PB_URL}/${path}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(30000),
    });
    return new Response(res.status === 204 ? null : res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return json(503, { error: 'PocketBase unavailable' });
  }
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
