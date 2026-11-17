import { z } from 'zod';

const PLACEHOLDER = /replace-with|change-me|changeme|example-secret/i;

const Schema = z.object({
  /** Internal PocketBase URL (server-side, Compose network). */
  PB_URL: z.string().min(1),
  /** Browser-facing PocketBase URL (proxied by nginx, e.g. `/pb`). */
  PB_PUBLIC_URL: z.string().min(1),
  /** Canonical public origin, e.g. https://amir-zouerami.dev. https ⇒ Secure cookies. */
  SITE_URL: z.url(),
  /** Signs session JWTs. Never ship the placeholder from .env.example. */
  AUTH_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters')
    .refine((s) => !PLACEHOLDER.test(s), 'must not be the example placeholder'),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  /** Colourised, human-readable logs (dev). JSON lines otherwise. */
  LOG_PRETTY: z.enum(['true', 'false']).default('false'),
});

export interface Config {
  pbUrl: string;
  pbPublicUrl: string;
  /** Origin without a trailing slash. */
  siteUrl: string;
  siteHost: string;
  secureCookies: boolean;
  authSecret: string;
  turnstile: { siteKey?: string; secret?: string };
  log: { level: string; pretty: boolean };
}

/** Validates the environment once and returns typed, normalised settings. Throws naming every bad variable. */
export function parseConfig(source: Record<string, string | undefined>): Config {
  const blank = (v?: string) => (v?.trim() ? v.trim() : undefined);
  const result = Schema.safeParse({
    PB_URL: blank(source.PB_URL),
    PB_PUBLIC_URL: blank(source.PB_PUBLIC_URL),
    SITE_URL: blank(source.SITE_URL),
    AUTH_SECRET: blank(source.AUTH_SECRET),
    TURNSTILE_SITE_KEY: blank(source.TURNSTILE_SITE_KEY),
    TURNSTILE_SECRET: blank(source.TURNSTILE_SECRET),
    LOG_LEVEL: blank(source.LOG_LEVEL),
    LOG_PRETTY: blank(source.LOG_PRETTY),
  });
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')} (${i.message})`);
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  const e = result.data;
  const site = new URL(e.SITE_URL);
  return {
    pbUrl: e.PB_URL.replace(/\/$/, ''),
    pbPublicUrl: e.PB_PUBLIC_URL.replace(/\/$/, ''),
    siteUrl: site.origin,
    siteHost: site.host,
    secureCookies: site.protocol === 'https:',
    authSecret: e.AUTH_SECRET,
    turnstile: { siteKey: e.TURNSTILE_SITE_KEY, secret: e.TURNSTILE_SECRET },
    log: { level: e.LOG_LEVEL, pretty: e.LOG_PRETTY === 'true' },
  };
}

let cached: Config | undefined;

/** Process-wide configuration, parsed from `process.env` on first use. */
export function getConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
