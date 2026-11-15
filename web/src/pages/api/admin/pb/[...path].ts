import type { APIRoute } from 'astro';
import { fail, ok } from '../../../../lib/api';
import { adminOnly } from '../../../../lib/auth/guards';
import { getConfig } from '../../../../lib/config';
import { getLog } from '../../../../lib/log';

export const prerender = false;

/** Collections the back office may touch, record endpoints only (no schema, settings, backups, logs, superusers). */
const ALLOWED =
  /^api\/collections\/(posts|post_translations|projects|project_translations|comments|subscribers|users|cv_files)\/records(\/[a-z0-9]{15})?$/;

interface PbError {
  message?: string;
  data?: Record<string, { message?: string }>;
}

/**
 * Thin authenticated proxy so the admin UI can use the PocketBase SDK from the browser without ever holding
 * the PocketBase token (it lives in an httpOnly cookie). PocketBase rules (`role = "admin"`) are the real gate;
 * the guard's role check is a fast first filter. PocketBase's JSON is wrapped in the standard envelope
 * (`data` = PocketBase's payload); the admin client unwraps it again.
 */
const proxy: APIRoute = adminOnly(async ({ request, params, url }, { user, token }) => {
  const log = getLog();
  const path = params.path ?? '';
  if (!ALLOWED.test(path)) {
    log.warn({ userId: user.id, path }, 'admin proxy refused a path outside the allow-list');
    return fail(404, 'not_found', 'Not found.');
  }

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
    const payload = res.status === 204 ? null : await res.json().catch(() => null);
    if (hasBody)
      log.info(
        { userId: user.id, method: request.method, path, upstreamStatus: res.status },
        'admin write',
      );
    if (res.ok) return ok(payload, { status: 200, code: 'ok' });

    const error = (payload ?? {}) as PbError;
    const fields = Object.fromEntries(
      Object.entries(error.data ?? {}).map(([k, v]) => [k, v?.message ?? 'invalid']),
    );
    if (res.status >= 500)
      log.error(
        { upstreamStatus: res.status, path, error },
        'PocketBase error through admin proxy',
      );
    return fail(res.status, 'upstream_error', error.message ?? 'Request failed.', fields);
  } catch (err) {
    log.error({ err, path }, 'admin proxy could not reach PocketBase');
    return fail(503, 'upstream_unavailable', 'PocketBase unavailable.');
  }
});

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
