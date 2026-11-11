import type { APIRoute } from 'astro';
import PocketBase from 'pocketbase';
import { z } from 'zod';
import { setAccessCookie, setRefreshCookie, toSessionUser } from '../../../lib/auth-cookies';
import { loadEnv } from '../../../lib/env';

export const prerender = false;

const Body = z.object({ email: z.email(), password: z.string().min(1) });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The only auth call that touches PocketBase: verify the password once, then issue our own JWT. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid request' });

  const pb = new PocketBase(loadEnv().PB_URL);
  pb.autoCancellation(false);
  let record: { id: string; email: string; name?: string };
  try {
    ({ record } = await pb
      .collection('users')
      .authWithPassword(parsed.data.email, parsed.data.password));
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return json(401, { error: 'Invalid email or password' });
    }
    return json(503, { error: 'Sign-in is temporarily unavailable' });
  }

  const user = toSessionUser(record);
  await setAccessCookie(cookies, user);
  setRefreshCookie(cookies, pb.authStore.token);
  return json(200, user);
};
