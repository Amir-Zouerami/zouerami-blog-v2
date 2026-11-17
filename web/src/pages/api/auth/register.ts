import type { APIRoute } from 'astro';
import { z } from 'zod';
import { created, fail, readJson } from '../../../lib/api';
import { verifyGuard } from '../../../lib/guard';
import { cleanText } from '../../../lib/http';
import { getLog, maskEmail } from '../../../lib/log';
import { anonPb, pbStatus } from '../../../lib/pb';

export const prerender = false;

export const Body = z.object({
  email: z.email().max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  name: z.string().trim().min(1).max(60),
  guard: z.string().optional(),
  website: z.string().max(200).optional(),
});

/** Creates the account and emails a verification link. Existing addresses get the same answer (no enumeration). */
export const POST: APIRoute = async ({ request }) => {
  const log = getLog();
  const body = await readJson(
    request,
    Body,
    'Please check the form: valid email, name and a password of at least 10 characters.',
  );
  if (!body.ok) return body.response;
  if (!verifyGuard(body.data.guard, body.data.website)) {
    log.warn('register refused: bot guard failed');
    return fail(400, 'verification_failed', 'Verification failed. Please try again.');
  }

  const pb = anonPb();
  const email = body.data.email.trim().toLowerCase();
  const sent = created({ verificationSent: true }, 'Check your inbox for a verification link.');
  try {
    const user = await pb.collection('users').create({
      email,
      password: body.data.password,
      passwordConfirm: body.data.password,
      name: cleanText(body.data.name),
      emailVisibility: false,
    });
    await pb.collection('users').requestVerification(email);
    log.info(
      { userId: user.id, email: maskEmail(email) },
      'account created; verification email requested',
    );
    return sent;
  } catch (err) {
    const data = (err as { response?: { data?: Record<string, { code?: string }> } }).response
      ?.data;
    if (pbStatus(err) === 400 && data?.email?.code === 'validation_not_unique') {
      log.info(
        { email: maskEmail(email) },
        'register for an existing address (answered as success to avoid enumeration)',
      );
      return sent;
    }
    if (pbStatus(err) === 400) {
      log.warn(
        { err, fields: Object.keys(data ?? {}) },
        'register rejected by PocketBase validation',
      );
      return fail(400, 'validation_failed', 'Please check the form and try a stronger password.');
    }
    log.error({ err }, 'register failed: PocketBase unavailable');
    return fail(503, 'upstream_unavailable', 'Sign-up is temporarily unavailable.');
  }
};
