import type { APIRoute } from 'astro';
import { z } from 'zod';
import { startSession } from '../../../lib/auth/cookies';
import { toSessionUser } from '../../../lib/auth/user';
import { json, logError, readBody } from '../../../lib/http';
import { anonPb, isRejected, pbStatus } from '../../../lib/pb';

export const prerender = false;

const Body = z.object({ email: z.email(), password: z.string().min(1) });

/** The only auth call that checks a password: PocketBase verifies it once, then we issue our own JWT. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid request' });

  const pb = anonPb();
  try {
    const { record } = await pb.collection('users').authWithPassword(body.email, body.password);
    if (!record.verified)
      return json(403, { error: 'Please verify your email first', code: 'unverified' });
    const user = toSessionUser(record);
    await startSession(cookies, user, pb.authStore.token);
    return json(200, user);
  } catch (err) {
    if (isRejected(pbStatus(err))) return json(401, { error: 'Invalid email or password' });
    logError('login', err);
    return json(503, { error: 'Sign-in is temporarily unavailable' });
  }
};
