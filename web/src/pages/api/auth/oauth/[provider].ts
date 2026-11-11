import type { APIRoute } from 'astro';
import { SignJWT } from 'jose';
import { getConfig } from '../../../../lib/config';
import { safeNext } from '../../../../lib/http';
import { anonPb } from '../../../../lib/pb';

export const prerender = false;

/** Starts the OAuth flow: state + PKCE verifier live in a short-lived signed cookie. */
export const GET: APIRoute = async ({ params, url, cookies, redirect }) => {
  const name = params.provider ?? '';
  const next = safeNext(url.searchParams.get('next'), '/account');
  try {
    const methods = await anonPb().collection('users').listAuthMethods();
    const provider = methods.oauth2.providers.find((p) => p.name === name);
    if (!provider) return redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
    const redirectUrl = `${getConfig().siteUrl}/api/auth/oauth/callback`;
    const flow = await new SignJWT({
      p: provider.name,
      s: provider.state,
      v: provider.codeVerifier,
      n: next,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(getConfig().authSecret));
    cookies.set('oauth_flow', flow, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getConfig().secureCookies,
      path: '/api/auth/oauth',
      maxAge: 600,
    });
    return redirect(provider.authURL + encodeURIComponent(redirectUrl));
  } catch {
    return redirect('/login?error=unavailable');
  }
};
