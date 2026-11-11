import type { APIRoute } from 'astro';
import { z } from 'zod';
import { cleanText, json, readBody } from '../../../lib/http';
import { anonPb, pbStatus } from '../../../lib/pb';
import { verifyTurnstile } from '../../../lib/turnstile';

export const prerender = false;

export const Body = z.object({
  email: z.email().max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  name: z.string().trim().min(1).max(60),
  turnstile: z.string().optional(),
});

/** Creates the account and emails a verification link. Existing addresses get the same answer (no enumeration). */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await readBody(request, Body);
  if (!body)
    return json(400, {
      error: 'Please check the form: valid email, name and a password of at least 10 characters.',
    });
  if (!(await verifyTurnstile(body.turnstile, clientAddress)))
    return json(400, { error: 'Verification failed. Please try again.' });

  const pb = anonPb();
  const email = body.email.trim().toLowerCase();
  try {
    await pb.collection('users').create({
      email,
      password: body.password,
      passwordConfirm: body.password,
      name: cleanText(body.name),
      emailVisibility: false,
    });
    await pb.collection('users').requestVerification(email);
  } catch (err) {
    const data = (err as { response?: { data?: Record<string, { code?: string }> } }).response
      ?.data;
    if (pbStatus(err) === 400 && data?.email?.code === 'validation_not_unique') {
      return json(201, { ok: true }); // pretend success: do not reveal registered addresses
    }
    if (pbStatus(err) === 400)
      return json(400, { error: 'Please check the form and try a stronger password.' });
    return json(503, { error: 'Sign-up is temporarily unavailable' });
  }
  return json(201, { ok: true });
};
