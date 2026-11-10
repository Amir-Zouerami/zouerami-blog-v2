import { z } from 'zod';

const EnvSchema = z.object({
  /** Internal PocketBase URL (server-side, Compose network). */
  PB_URL: z.string().min(1),
  /** Browser-facing PocketBase URL (proxied by nginx, e.g. `/pb`). */
  PB_PUBLIC_URL: z.string().min(1),
  SITE_URL: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse({
    PB_URL: source.PB_URL,
    PB_PUBLIC_URL: source.PB_PUBLIC_URL,
    SITE_URL: source.SITE_URL,
  });
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or empty environment variable(s): ${names}`);
  }
  return result.data;
}
