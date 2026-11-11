import { z } from 'zod';
import { fail, ok, readJson } from '../../lib/api';
import { clearAuthCookies } from '../../lib/auth/cookies';
import { authed } from '../../lib/auth/guards';
import { getLog } from '../../lib/log';
import { anonPb, isRejected, pbStatus } from '../../lib/pb';

export const prerender = false;
const Body = z.object({ password: z.string().max(128).optional() });

/**
 * Deletes the signed-in account and everything it owns (comments, likes and bookmarks cascade in PocketBase).
 * Accounts with a password must confirm it; accounts that only ever signed in through GitHub/Google have none.
 */
export const DELETE = authed(async ({ request, cookies }, { user, pb }) => {
  const log = getLog();
  const body = await readJson(request, Body.default({}), 'Invalid request.');
  if (!body.ok) return body.response;
  try {
    const linked = await pb
      .collection('_externalAuths')
      .getList(1, 1, { filter: pb.filter('recordRef = {:id}', { id: user.id }), skipTotal: true });
    const hasExternalAuth = linked.items.length > 0;
    if (body.data.password || !hasExternalAuth) {
      try {
        await anonPb()
          .collection('users')
          .authWithPassword(user.email, body.data.password ?? '');
      } catch (err) {
        if (isRejected(pbStatus(err))) {
          log.warn({ userId: user.id }, 'account deletion refused: wrong password');
          return fail(403, 'invalid_credentials', 'Wrong password.');
        }
        throw err;
      }
    }
    await pb.collection('users').delete(user.id);
  } catch (err) {
    log.error({ err, userId: user.id }, 'account deletion failed');
    return isRejected(pbStatus(err))
      ? fail(401, 'unauthorized', 'Please sign in again.')
      : fail(503, 'upstream_unavailable', 'Could not delete the account.');
  }
  clearAuthCookies(cookies);
  log.info({ userId: user.id }, 'account deleted');
  return ok(null, { message: 'Account deleted.' });
});
