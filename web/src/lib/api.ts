/**
 * The one response contract for every JSON endpoint:
 *
 *   { "meta": { "status", "code", "message"?, "fields"? }, "data": <payload | null>, "traceId": "<uuidv7>" }
 *
 * The same traceId is sent as the `x-trace-id` header and attached to every log line of the request,
 * so a response seen in the browser can be found in the logs.
 */
import { type ZodType, z } from 'zod';
import { currentTraceId } from './log';

export interface Meta {
  /** Mirrors the HTTP status. */
  status: number;
  /** Stable machine-readable outcome (`ok`, `created`, `validation_failed`, `unauthorized`, …). */
  code: string;
  /** Human-readable summary, safe to show to the user. */
  message?: string;
  /** Per-field validation problems. */
  fields?: Record<string, string>;
}

export interface Envelope<T> {
  meta: Meta;
  data: T | null;
  traceId: string;
}

export const EnvelopeSchema = z.object({
  meta: z.object({
    status: z.number(),
    code: z.string(),
    message: z.string().optional(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
  data: z.unknown(),
  traceId: z.string(),
});

export const TRACE_HEADER = 'x-trace-id';

function respond<T>(
  meta: Meta,
  data: T | null,
  extraHeaders: Record<string, string> = {},
): Response {
  const traceId = currentTraceId();
  const body: Envelope<T> = { meta, data, traceId };
  return new Response(JSON.stringify(body), {
    status: meta.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [TRACE_HEADER]: traceId,
      ...extraHeaders,
    },
  });
}

export const ok = <T>(
  data: T | null = null,
  opts: { status?: number; code?: string; message?: string } = {},
) =>
  respond<T>({ status: opts.status ?? 200, code: opts.code ?? 'ok', message: opts.message }, data);

export const created = <T>(data: T | null = null, message?: string) =>
  ok(data, { status: 201, code: 'created', message });

/** Failure envelope: `data` is always null. */
export const fail = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) => respond<never>({ status, code, message, fields }, null);

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parses and validates a JSON request body; on failure returns a ready-made 400 envelope. */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  message = 'Please check the form and try again.',
  /** Largest body accepted (bytes). Every form here is tiny; only the admin markdown preview needs more. */
  maxBytes = 100_000,
): Promise<BodyResult<T>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes)
    return { ok: false, response: fail(413, 'payload_too_large', 'That request is too large.') };
  const text = await request.text().catch(() => '');
  if (text.length > maxBytes)
    return { ok: false, response: fail(413, 'payload_too_large', 'That request is too large.') };
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    raw = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fields: Record<string, string> = {};
  if (raw === undefined) fields.body = 'A JSON body is required';
  else
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'body'] ??= issue.message;
  return { ok: false, response: fail(400, 'validation_failed', message, fields) };
}
