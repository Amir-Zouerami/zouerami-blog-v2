import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ok, readJson } from '../../../lib/api';
import { getLog, maskEmail } from '../../../lib/log';
import { anonPb } from '../../../lib/pb';

export const prerender = false;
const Body = z.object({ email: z.email().max(200) });

/** Always the same answer: never reveals whether an address is registered. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request, Body, 'Enter a valid email address.');
  if (!body.ok) return body.response;
  const email = body.data.email.trim().toLowerCase();
  await anonPb()
    .collection('users')
    .requestVerification(email)
    .catch((err) => getLog().warn({ err, email: maskEmail(email) }, 'resend verification failed'));
  getLog().info({ email: maskEmail(email) }, 'verification email re-requested');
  return ok(null, { message: 'If that address needs verification, a new link is on its way.' });
};
