import { expect } from '@playwright/test';

export interface Env<T = unknown> {
  meta: { status: number; code: string; message?: string; fields?: Record<string, string> };
  data: T | null;
  traceId: string;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Parses a response as the standard envelope and checks the contract (shape, UUIDv7 traceId, header match). */
export async function envelope<T = unknown>(res: {
  json(): Promise<unknown>;
  status(): number;
  headers(): Record<string, string>;
}): Promise<Env<T>> {
  const body = (await res.json()) as Env<T>;
  expect(Object.keys(body).sort(), 'envelope keys').toEqual(['data', 'meta', 'traceId']);
  expect(body.meta.status).toBe(res.status());
  expect(typeof body.meta.code).toBe('string');
  expect(body.traceId).toMatch(UUID_V7);
  expect(res.headers()['x-trace-id']).toBe(body.traceId);
  return body;
}

/** `data` of a successful response. */
export async function dataOf<T>(res: Parameters<typeof envelope>[0]): Promise<T> {
  const body = await envelope<T>(res);
  expect(body.meta.status, JSON.stringify(body.meta)).toBeLessThan(300);
  return body.data as T;
}
