import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';
import { setAccessCookie, setRefreshCookie, toSessionUser } from '../../../../lib/auth-cookies';
import { loadEnv } from '../../../../lib/env';
import { anonPb, safeNext } from '../../../../lib/http';
import { getAuthSecret } from '../../../../lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const flowCookie = cookies.get('oauth_flow')?.value;
  cookies.delete('oauth_flow', { path: '/api/auth/oauth' });
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!flowCookie || !code || !state) return redirect('/login?error=oauth');
  try {
    const { payload } = await jwtVerify(flowCookie, new TextEncoder().encode(getAuthSecret()), {
      algorithms: ['HS256'],
    });
    if (payload.s !== state) return redirect('/login?error=oauth'); // CSRF: state must match
    const pb = anonPb();
    const redirectUrl = `${loadEnv().SITE_URL.replace(/\/$/, '')}/api/auth/oauth/callback`;
    const { record } = await pb
      .collection('users')
      .authWithOAuth2Code(String(payload.p), code, String(payload.v), redirectUrl);
    await setAccessCookie(cookies, toSessionUser(record as never));
    setRefreshCookie(cookies, pb.authStore.token);
    return redirect(safeNext(String(payload.n), '/account'));
  } catch {
    return redirect('/login?error=oauth');
  }
};
