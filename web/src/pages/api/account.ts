import { z } from 'zod';
import { clearAuthCookies } from '../../lib/auth/cookies';
import { authed } from '../../lib/auth/guards';
import { json, logError, readBody } from '../../lib/http';
import { anonPb, isRejected, pbStatus } from '../../lib/pb';

export const prerender = false;
const Body = z.object({ password: z.string().max(128).optional() });

/**
 * Deletes the signed-in account and everything it owns (comments, likes and bookmarks cascade in PocketBase).
 * Accounts with a password must confirm it; accounts that only ever signed in through GitHub/Google have none.
 */
export const DELETE = authed(async ({ request, cookies }, { user, pb }) => {
  const body = (await readBody(request, Body)) ?? {};
  try {
    const linked = await pb
      .collection('_externalAuths')
      .getList(1, 1, { filter: pb.filter('recordRef = {:id}', { id: user.id }), skipTotal: true });
    const hasExternalAuth = linked.items.length > 0;
    if (body.password || !hasExternalAuth) {
      try {
        await anonPb()
          .collection('users')
          .authWithPassword(user.email, body.password ?? '');
      } catch (err) {
        if (isRejected(pbStatus(err))) return json(403, { error: 'Wrong password' });
        throw err;
      }
    }
    await pb.collection('users').delete(user.id);
  } catch (err) {
    logError('delete-account', err);
    return json(isRejected(pbStatus(err)) ? 401 : 503, { error: 'Could not delete the account' });
  }
  clearAuthCookies(cookies);
  return json(204);
});
