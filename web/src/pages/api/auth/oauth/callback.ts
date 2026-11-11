import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';
import { startSession } from '../../../../lib/auth/cookies';
import { toSessionUser } from '../../../../lib/auth/user';
import { getConfig } from '../../../../lib/config';
import { safeNext } from '../../../../lib/http';
import { getLog } from '../../../../lib/log';
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
    const user = toSessionUser(record);
    await startSession(cookies, user, pb.authStore.token);
    getLog().info({ userId: user.id, provider: payload.p }, 'oauth login succeeded');
    return redirect(safeNext(String(payload.n), '/account'));
  } catch (err) {
    getLog().warn({ err }, 'oauth callback failed');
    return redirect('/login?error=oauth');
  }
};
