import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, ok, readJson } from '../../../lib/api';
import { getLog } from '../../../lib/log';
import { anonPb } from '../../../lib/pb';

export const prerender = false;
const Body = z.object({
  token: z.string().min(20).max(2000),
  password: z.string().min(10).max(128),
});

export const POST: APIRoute = async ({ request }) => {
  const log = getLog();
  const body = await readJson(request, Body, 'Use a password of at least 10 characters.');
  if (!body.ok) return body.response;
  try {
    await anonPb()
      .collection('users')
      .confirmPasswordReset(body.data.token, body.data.password, body.data.password);
    log.info('password reset completed');
    return ok(null, { message: 'Password updated.' });
  } catch (err) {
    log.warn({ err }, 'password reset failed (invalid or expired token)');
    return fail(400, 'invalid_token', 'This link is invalid or has expired.');
  }
};
