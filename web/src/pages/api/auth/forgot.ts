import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, ok, readJson } from '../../../lib/api';
import { getLog, maskEmail } from '../../../lib/log';
import { anonPb } from '../../../lib/pb';
import { verifyTurnstile } from '../../../lib/turnstile';

export const prerender = false;
const Body = z.object({ email: z.email().max(200), turnstile: z.string().optional() });

/** Always the same answer: never reveals whether an address is registered. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const log = getLog();
  const body = await readJson(request, Body, 'Enter a valid email address.');
  if (!body.ok) return body.response;
  if (!(await verifyTurnstile(body.data.turnstile, clientAddress))) {
    log.warn('password reset refused: Turnstile verification failed');
    return fail(400, 'verification_failed', 'Verification failed. Please try again.');
  }
  const email = body.data.email.trim().toLowerCase();
  await anonPb()
    .collection('users')
    .requestPasswordReset(email)
    .catch((err) => log.warn({ err, email: maskEmail(email) }, 'password reset request failed'));
  log.info({ email: maskEmail(email) }, 'password reset requested');
  return ok(null, { message: 'If that address has an account, a reset link is on its way.' });
};
