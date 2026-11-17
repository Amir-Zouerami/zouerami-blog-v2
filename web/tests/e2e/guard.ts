import type { APIRequestContext } from '@playwright/test';
import { solve } from '../../src/lib/sha256-pow';

/** Fetches a challenge from the running site and solves it, like the browser does. Add the result as `guard`. */
export async function guard(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/guard');
  const { data } = (await res.json()) as { data: { challenge: string; bits: number } };
  const n = solve(`${data.challenge}:`, data.bits);
  return `${data.challenge}~${n}`;
}
