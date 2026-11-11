import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, ok, readJson } from '../../lib/api';
import { getLog, maskEmail } from '../../lib/log';
import { anonPb, pbStatus } from '../../lib/pb';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;
const Body = z.object({
  email: z.email().max(200),
  locale: z.enum(['en', 'fa']).default('en'),
  turnstile: z.string().optional(),
});

/** Reads the sign-up from JSON (island) or from a plain HTML form post (no JS). */
async function readSubscription(request: Request, isForm: boolean) {
  if (!isForm) return readJson(request, Body, 'Please enter a valid email address.');
  const form = await request.formData().catch(() => null);
  const parsed = Body.safeParse(
    form && {
      email: form.get('email'),
      locale: form.get('locale') ?? 'en',
      turnstile: form.get('cf-turnstile-response') ?? undefined,
    },
  );
  return parsed.success
    ? ({ ok: true, data: parsed.data } as const)
    : ({
        ok: false,
        response: fail(400, 'validation_failed', 'Please enter a valid email address.', {
          email: 'Invalid email address',
        }),
      } as const);
}

/**
 * Newsletter sign-up (double opt-in: PocketBase mails a confirmation link).
 * Works with JSON and with a plain HTML form post. Duplicate addresses get the same answer.
 */
export const POST: APIRoute = async ({ request, redirect, clientAddress }) => {
  const log = getLog();
  const isForm = (request.headers.get('content-type') ?? '').includes('form');
  const body = await readSubscription(request, isForm);
  const back = (status: 'ok' | 'invalid' | 'failed', locale: string) =>
    redirect(`${locale === 'fa' ? '/fa' : ''}/?subscribe=${status}#sub`, 303);
  if (!body.ok) return isForm ? back('invalid', 'en') : body.response;

  const { email, locale, turnstile } = body.data;
  if (!(await verifyTurnstile(turnstile, clientAddress))) {
    log.warn('subscription refused: Turnstile verification failed');
    return isForm
      ? back('failed', locale)
      : fail(400, 'verification_failed', 'Verification failed. Please try again.');
  }
  try {
    await anonPb().collection('subscribers').create({ email: email.trim().toLowerCase(), locale });
    log.info({ email: maskEmail(email), locale }, 'newsletter subscription requested');
  } catch (err) {
    if (pbStatus(err) !== 400) {
      log.error({ err }, 'newsletter subscription failed');
      return isForm
        ? back('failed', locale)
        : fail(503, 'upstream_unavailable', 'Sign-up is temporarily unavailable.');
    }
    log.info(
      { email: maskEmail(email) },
      'newsletter subscription for an existing address (answered as success)',
    );
  }
  return isForm ? back('ok', locale) : ok(null, { message: 'Check your inbox to confirm.' });
};
