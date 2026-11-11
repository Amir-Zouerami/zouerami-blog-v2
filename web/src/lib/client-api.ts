/**
 * Browser-side client for our JSON endpoints. Every endpoint answers with `{ meta, data, traceId }`;
 * this turns that (or a network/proxy failure) into one predictable result shape.
 */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** Stable outcome code, e.g. `ok`, `created`, `unverified`, `network_error`. */
  code: string;
  /** User-presentable message from the server (empty when none). */
  message: string;
  fields: Record<string, string>;
  data: T | null;
  /** Correlates this response with the server logs (also in the `x-trace-id` header). */
  traceId: string;
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  body?: BodyInit;
  signal?: AbortSignal;
  keepalive?: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Maps a parsed response body onto ApiResult; tolerates bodies that are not our envelope (e.g. an nginx 502 page). */
export function parseEnvelope<T>(
  status: number,
  body: unknown,
  headerTraceId: string | null,
): ApiResult<T> {
  if (isObject(body) && isObject(body.meta) && typeof body.traceId === 'string') {
    const meta = body.meta;
    return {
      ok: status >= 200 && status < 300,
      status,
      code: typeof meta.code === 'string' ? meta.code : 'unknown',
      message: typeof meta.message === 'string' ? meta.message : '',
      fields: isObject(meta.fields) ? (meta.fields as Record<string, string>) : {},
      data: (body.data ?? null) as T | null,
      traceId: body.traceId,
    };
  }
  return {
    ok: false,
    status,
    code: 'bad_response',
    message: '',
    fields: {},
    data: null,
    traceId: headerTraceId ?? '',
  };
}

export async function api<T = unknown>(
  url: string,
  opts: RequestOptions = {},
): Promise<ApiResult<T>> {
  const method = opts.method ?? (opts.json !== undefined || opts.body ? 'POST' : 'GET');
  let result: ApiResult<T>;
  try {
    const res = await fetch(url, {
      method,
      headers:
        opts.json !== undefined
          ? { 'content-type': 'application/json', accept: 'application/json' }
          : { accept: 'application/json' },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
      signal: opts.signal,
      keepalive: opts.keepalive,
    });
    const body = await res.json().catch(() => null);
    result = parseEnvelope<T>(res.status, body, res.headers.get('x-trace-id'));
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    result = {
      ok: false,
      status: 0,
      code: 'network_error',
      message: '',
      fields: {},
      data: null,
      traceId: '',
    };
  }
  if (!result.ok)
    console.warn(
      `[api] ${method} ${url} → ${result.status} ${result.code}`,
      result.traceId ? `trace=${result.traceId}` : '',
    );
  return result;
}

/** Text for the user: the server's message, plus a reference they can quote for server-side failures. */
export function describe(result: ApiResult<unknown>, fallback: string): string {
  const text = result.message || fallback;
  return result.status >= 500 && result.traceId
    ? `${text} (ref ${result.traceId.slice(-8)})`
    : text;
}
