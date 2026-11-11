import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json, readBody } from '../../../lib/http';
import { anonPb } from '../../../lib/pb';
import { verifyTurnstile } from '../../../lib/turnstile';

export const prerender = false;
const Body = z.object({ email: z.email().max(200), turnstile: z.string().optional() });

/** Always 204: never reveals whether an address is registered. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid email' });
  if (!(await verifyTurnstile(body.turnstile, clientAddress)))
    return json(400, { error: 'Verification failed. Please try again.' });
  await anonPb()
    .collection('users')
    .requestPasswordReset(body.email.trim().toLowerCase())
    .catch(() => {});
  return json(204);
};
