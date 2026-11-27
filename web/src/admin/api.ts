import PocketBase, { type RecordModel } from 'pocketbase';
import { api, parseEnvelope } from '../lib/client-api';

/** PocketBase SDK pointed at the authenticated admin proxy: the browser never holds a PocketBase token. */
export const pb = new PocketBase('/api/admin/pb');
pb.autoCancellation(false);
pb.authStore.clear();
// The proxy wraps PocketBase's JSON in { meta, data, traceId }. Hand the SDK what it expects:
// the payload on success, and a PocketBase-shaped error body (plus the traceId) on failure.
pb.afterSend = (response, body) => {
  const env = parseEnvelope<unknown>(response.status, body, response.headers.get('x-trace-id'));
  if (env.code === 'bad_response') return body;
  if (response.status >= 400) {
    return {
      message: env.message || 'Request failed',
      data: Object.fromEntries(Object.entries(env.fields).map(([k, v]) => [k, { message: v }])),
      traceId: env.traceId,
    };
  }
  return env.data;
};

export type Rec = RecordModel;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function randomToken(n = 24): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export const fileUrl = (collection: string, id: string, name: string, thumb?: string) =>
  `/pb/api/files/${collection}/${id}/${name}${thumb ? `?thumb=${thumb}` : ''}`;

/** Human-readable text for a failed admin request, with the server's traceId so it can be found in the logs. */
export function errText(e: unknown): string {
  const r = e as {
    response?: { message?: string; data?: Record<string, { message?: string }>; traceId?: string };
    message?: string;
  };
  const fields = r.response?.data
    ? Object.entries(r.response.data).map(([k, v]) => `${k}: ${v?.message}`)
    : [];
  const trace = r.response?.traceId ? ` [trace ${r.response.traceId}]` : '';
  return [r.response?.message ?? r.message ?? 'Request failed', ...fields].join(' — ') + trace;
}

export async function previewMarkdown(
  markdown: string,
  postId: string | undefined,
  signal: AbortSignal,
  lang?: 'en' | 'fa',
  collection?: 'posts' | 'projects',
) {
  const r = await api<{ html: string; headings: { id: string; text: string }[] }>(
    '/api/admin/preview',
    {
      json: { markdown, postId, lang, collection },
      signal,
    },
  );
  if (!r.ok || !r.data) throw new Error(`preview ${r.status} ${r.code}`);
  return r.data;
}
