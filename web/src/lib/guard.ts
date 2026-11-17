import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig } from './config';
import { Lru } from './lru';

/**
 * Bot guard for the forms that create something (sign-up, password reset, comments, newsletter).
 * Everything runs on our own server, so it keeps working when the international internet is cut:
 *
 *  1. the page fetches a signed challenge from /api/guard (stateless: an HMAC with AUTH_SECRET),
 *  2. the browser spends a moment finding a number n so that SHA-256(challenge + ":" + n) starts with `GUARD_BITS`
 *     zero bits (proof of work: one visitor never notices, a bot sending thousands of requests pays every time),
 *  3. the form sends `challenge~n`; the server checks the signature, the age, the work, and that the challenge
 *     was not used before.
 *
 * A hidden "website" field catches simple bots that fill every input.
 */
export const GUARD_BITS = 18;
const TTL_MS = 15 * 60 * 1000;
/** Challenges already spent (kept until they would expire anyway). */
const spent = new Lru<number>(50_000);

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(`guard:${payload}`).digest('base64url');

export function issueChallenge(
  now = Date.now(),
  secret = getConfig().authSecret,
): { challenge: string; bits: number } {
  const payload = `${now}.${randomBytes(12).toString('base64url')}`;
  return { challenge: `${payload}.${sign(payload, secret)}`, bits: GUARD_BITS };
}

function leadingZeroBits(digest: Buffer): number {
  let n = 0;
  for (const byte of digest) {
    if (byte === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(byte) - 24;
  }
  return n;
}

export interface GuardOptions {
  now?: number;
  secret?: string;
  bits?: number;
}

/** True when the request carries a valid, unused solution and the hidden field is empty. */
export function verifyGuard(
  guard: string | undefined | null,
  honeypot: string | undefined | null,
  opts: GuardOptions = {},
): boolean {
  if (honeypot) return false;
  if (!guard || guard.length > 300) return false;
  const now = opts.now ?? Date.now();
  const secret = opts.secret ?? getConfig().authSecret;
  const bits = opts.bits ?? GUARD_BITS;

  const [challenge, counter, extra] = guard.split('~');
  if (!challenge || !counter || extra !== undefined || !/^\d{1,12}$/.test(counter)) return false;
  const parts = challenge.split('.');
  if (parts.length !== 3) return false;
  const [stamp, nonce, mac] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${stamp}.${nonce}`, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  const issued = Number(stamp);
  if (!Number.isFinite(issued) || now - issued > TTL_MS || issued - now > 60_000) return false;
  if ((spent.get(nonce) ?? 0) > now) return false;

  const digest = createHash('sha256').update(`${challenge}:${counter}`).digest();
  if (leadingZeroBits(digest) < bits) return false;

  spent.set(nonce, issued + TTL_MS);
  return true;
}
