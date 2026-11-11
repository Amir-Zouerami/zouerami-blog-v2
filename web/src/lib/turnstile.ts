export interface TurnstileConfig {
  secret?: string;
  fetch?: typeof fetch;
}

/**
 * Verifies a Cloudflare Turnstile token. When no secret is configured (local dev) verification
 * is skipped and succeeds. A configured secret with a missing token always fails.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp: string | undefined,
  cfg: TurnstileConfig = { secret: process.env.TURNSTILE_SECRET },
): Promise<boolean> {
  if (!cfg.secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: cfg.secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await (cfg.fetch ?? fetch)(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return false;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false; // fail closed
  }
}
