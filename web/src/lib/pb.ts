import PocketBase from 'pocketbase';
import { type Env, loadEnv } from './env';

/** Raised when PocketBase is unreachable or answers with an unexpected error. */
export class UpstreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'UpstreamError';
  }
}

let shared: PocketBase | undefined;

/** Server-side client (internal Compose URL). Public, unauthenticated: it can only see published content. */
export function getPb(env: Env = loadEnv()): PocketBase {
  if (!shared) {
    shared = new PocketBase(env.PB_URL);
    shared.autoCancellation(false);
  }
  return shared;
}
