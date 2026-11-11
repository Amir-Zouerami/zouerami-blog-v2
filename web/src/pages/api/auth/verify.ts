import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, ok, readJson } from '../../../lib/api';
import { getLog } from '../../../lib/log';
import { anonPb } from '../../../lib/pb';

export const prerender = false;
const Body = z.object({ token: z.string().min(20).max(2000) });

export const POST: APIRoute = async ({ request }) => {
  const log = getLog();
  const body = await readJson(request, Body, 'Invalid link.');
  if (!body.ok) return body.response;
  try {
    await anonPb().collection('users').confirmVerification(body.data.token);
    log.info('email verified');
    return ok(null, { message: 'Email verified.' });
  } catch (err) {
    log.warn({ err }, 'email verification failed (invalid or expired token)');
    return fail(400, 'invalid_token', 'This link is invalid or has expired.');
  }
};
