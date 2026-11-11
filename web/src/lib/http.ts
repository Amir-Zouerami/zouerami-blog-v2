import type { ZodType } from 'zod';

export const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

/** Parses a JSON body with zod. Returns null when the body is missing, malformed or invalid. */
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T | null> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function hasControl(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 32) return true;
  return false;
}

/** Removes control characters and angle brackets from user-supplied display text. */
export function cleanText(s: string): string {
  let out = '';
  for (const ch of s) if (ch.charCodeAt(0) >= 32 && ch !== '<' && ch !== '>') out += ch;
  return out.trim();
}

/** Only same-site relative paths are allowed as post-login redirects (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (hasControl(next)) return fallback;
  return next;
}

/** Logs an unexpected server-side failure with context; never throws. */
export function logError(scope: string, err: unknown): void {
  console.error(`[${scope}]`, err instanceof Error ? `${err.name}: ${err.message}` : err);
}
