import type { APIRoute } from 'astro';
import { z } from 'zod';
import { anonPb, json, readBody } from '../../../lib/http';

export const prerender = false;
const Body = z.object({ email: z.email().max(200) });

/** Always 204: never reveals whether an address is registered. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid email' });
  await anonPb()
    .collection('users')
    .requestVerification(body.email.trim().toLowerCase())
    .catch(() => {});
  return json(204);
};
