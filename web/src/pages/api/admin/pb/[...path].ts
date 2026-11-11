import type { APIRoute } from 'astro';
import { adminOnly } from '../../../../lib/auth/guards';
import { getConfig } from '../../../../lib/config';
import { json, logError } from '../../../../lib/http';

export const prerender = false;

/** Collections the back office may touch, record endpoints only (no schema, settings, backups, logs, superusers). */
const ALLOWED =
  /^api\/collections\/(posts|post_translations|projects|project_translations|comments|subscribers|users)\/records(\/[a-z0-9]{15})?$/;

/**
 * Thin authenticated proxy so the admin UI can use the PocketBase SDK from the browser without ever holding
 * the PocketBase token (it lives in an httpOnly cookie). PocketBase rules (`role = "admin"`) are the real gate;
 * the guard's role check is a fast first filter.
 */
const proxy: APIRoute = adminOnly(async ({ request, params, url }, { token }) => {
  const path = params.path ?? '';
  if (!ALLOWED.test(path)) return json(404, { error: 'Not found' });

  const headers: Record<string, string> = { authorization: token };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  try {
    const res = await fetch(`${getConfig().pbUrl}/${path}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(res.status === 204 ? null : res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    logError('admin-proxy', err);
    return json(503, { error: 'PocketBase unavailable' });
  }
});

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
