import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, ok, readJson } from '../../../lib/api';
import { startSession } from '../../../lib/auth/cookies';
import { toSessionUser } from '../../../lib/auth/user';
import { getLog, maskEmail } from '../../../lib/log';
import { anonPb, isRejected, pbStatus } from '../../../lib/pb';

export const prerender = false;

const Body = z.object({ email: z.email(), password: z.string().min(1) });

/** The only auth call that checks a password: PocketBase verifies it once, then we issue our own JWT. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const log = getLog();
  const body = await readJson(request, Body, 'Enter your email and password.');
  if (!body.ok) return body.response;

  const pb = anonPb();
  try {
    const { record } = await pb
      .collection('users')
      .authWithPassword(body.data.email, body.data.password);
    if (!record.verified) {
      log.info({ userId: record.id }, 'login refused: email not verified');
      return fail(403, 'unverified', 'Please verify your email first.');
    }
    const user = toSessionUser(record);
    await startSession(cookies, user, pb.authStore.token);
    log.info({ userId: user.id, role: user.role }, 'login succeeded');
    return ok(user, { message: 'Signed in.' });
  } catch (err) {
    if (isRejected(pbStatus(err))) {
      log.warn({ email: maskEmail(body.data.email) }, 'login failed: invalid credentials');
      return fail(401, 'invalid_credentials', 'Invalid email or password.');
    }
    log.error({ err }, 'login failed: PocketBase unavailable');
    return fail(503, 'upstream_unavailable', 'Sign-in is temporarily unavailable.');
  }
};
