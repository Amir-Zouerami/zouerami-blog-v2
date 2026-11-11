import type { AstroCookies } from 'astro';
import PocketBase from 'pocketbase';
import { type Config, getConfig } from './config';

/** Raised when PocketBase is unreachable or answers with an unexpected error. */
export class UpstreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'UpstreamError';
  }
}

/** Cookie holding the signed-in user's own PocketBase token (httpOnly, scoped to /api). */
export const PB_TOKEN_COOKIE = 'refresh';

let shared: PocketBase | undefined;

/** Server-side client for public reads (internal Compose URL). Unauthenticated: sees published content only. */
export function getPb(config: Config = getConfig()): PocketBase {
  if (!shared) {
    shared = new PocketBase(config.pbUrl);
    shared.autoCancellation(false);
  }
  return shared;
}

/** A fresh anonymous client (for credential flows that must not share auth state). */
export function anonPb(config: Config = getConfig()): PocketBase {
  const pb = new PocketBase(config.pbUrl);
  pb.autoCancellation(false);
  return pb;
}

/** A client acting as the signed-in user, from their PocketBase token cookie; null when absent. */
export function userPb(cookies: AstroCookies, config: Config = getConfig()): PocketBase | null {
  const token = cookies.get(PB_TOKEN_COOKIE)?.value;
  if (!token) return null;
  const pb = anonPb(config);
  pb.authStore.save(token, null);
  return pb;
}

export const pbStatus = (err: unknown): number => (err as { status?: number }).status ?? 0;

/** The token was understood and rejected (as opposed to PocketBase being down). */
export const isRejected = (status: number): boolean => [400, 401, 403, 404].includes(status);

/** Wraps any PocketBase failure in an UpstreamError; contract (zod) errors pass through unchanged. */
export function toUpstream(error: unknown): never {
  if (error instanceof UpstreamError) throw error;
  if (error instanceof Error && error.name === '$ZodError') throw error;
  const status = pbStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  throw new UpstreamError(
    `PocketBase request failed${status ? ` (${status})` : ''}: ${message}`,
    error,
  );
}
