import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json, readBody } from '../../../lib/http';
import { anonPb } from '../../../lib/pb';

export const prerender = false;
const Body = z.object({ token: z.string().min(20).max(2000) });

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid link' });
  try {
    await anonPb().collection('users').confirmVerification(body.token);
    return json(200, { ok: true });
  } catch {
    return json(400, { error: 'This link is invalid or has expired' });
  }
};
