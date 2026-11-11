import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';
import { startSession } from '../../../../lib/auth/cookies';
import { toSessionUser } from '../../../../lib/auth/user';
import { getConfig } from '../../../../lib/config';
import { logError, safeNext } from '../../../../lib/http';
import { anonPb } from '../../../../lib/pb';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const config = getConfig();
  const flowCookie = cookies.get('oauth_flow')?.value;
  cookies.delete('oauth_flow', { path: '/api/auth/oauth' });
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!flowCookie || !code || !state) return redirect('/login?error=oauth');
  try {
    const { payload } = await jwtVerify(flowCookie, new TextEncoder().encode(config.authSecret), {
      algorithms: ['HS256'],
    });
    if (payload.s !== state) return redirect('/login?error=oauth'); // CSRF: state must match
    const pb = anonPb();
    const { record } = await pb
      .collection('users')
      .authWithOAuth2Code(
        String(payload.p),
        code,
        String(payload.v),
        `${config.siteUrl}/api/auth/oauth/callback`,
      );
    await startSession(cookies, toSessionUser(record), pb.authStore.token);
    return redirect(safeNext(String(payload.n), '/account'));
  } catch (err) {
    logError('oauth-callback', err);
    return redirect('/login?error=oauth');
  }
};
