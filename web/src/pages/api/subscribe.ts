import type { APIRoute } from 'astro';
import { z } from 'zod';
import { anonPb, json } from '../../lib/http';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;
const Body = z.object({
  email: z.email().max(200),
  locale: z.enum(['en', 'fa']).default('en'),
  turnstile: z.string().optional(),
});

/**
 * Newsletter sign-up (double opt-in: PocketBase mails a confirmation link).
 * Works with JSON (island) and with a plain HTML form post (no JS). Duplicate addresses get the same answer.
 */
export const POST: APIRoute = async ({ request, redirect, clientAddress }) => {
  const isForm = (request.headers.get('content-type') ?? '').includes('form');
  let raw: unknown = null;
  if (isForm) {
    const f = await request.formData().catch(() => null);
    raw = f && {
      email: f.get('email'),
      locale: f.get('locale') ?? 'en',
      turnstile: f.get('cf-turnstile-response') ?? undefined,
    };
  } else {
    raw = await request.json().catch(() => null);
  }
  const body = Body.safeParse(raw);
  if (!body.success)
    return isForm
      ? redirect('/?subscribe=invalid#sub')
      : json(400, { error: 'Please enter a valid email address.' });
  if (!(await verifyTurnstile(body.data.turnstile, clientAddress))) {
    return isForm
      ? redirect('/?subscribe=failed#sub')
      : json(400, { error: 'Verification failed. Please try again.' });
  }
  try {
    await anonPb()
      .collection('subscribers')
      .create({ email: body.data.email.trim().toLowerCase(), locale: body.data.locale });
  } catch (err) {
    const status = (err as { status?: number }).status;
    // duplicate address (400) looks like success; outages do not
    if (status !== 400)
      return isForm
        ? redirect('/?subscribe=failed#sub')
        : json(503, { error: 'Sign-up is temporarily unavailable' });
  }
  const back = body.data.locale === 'fa' ? '/fa' : '';
  return isForm ? redirect(`${back}/?subscribe=ok#sub`, 303) : json(200, { ok: true });
};
