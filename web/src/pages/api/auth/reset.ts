import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json, readBody } from '../../../lib/http';
import { anonPb } from '../../../lib/pb';

export const prerender = false;
const Body = z.object({
  token: z.string().min(20).max(2000),
  password: z.string().min(10).max(128),
});

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Use a password of at least 10 characters.' });
  try {
    await anonPb()
      .collection('users')
      .confirmPasswordReset(body.token, body.password, body.password);
    return json(200, { ok: true });
  } catch {
    return json(400, { error: 'This link is invalid or has expired' });
  }
};
