import { anonPb, isRejected, pbStatus } from '../pb';
import type { SessionUser } from './session';
import { toSessionUser } from './user';

export type RefreshResult =
  | { status: 'ok'; user: SessionUser; pbToken: string }
  | { status: 'invalid' | 'unavailable' };

/**
 * The only database-touching step after login: PocketBase re-validates the token and the user.
 * 'invalid' = token rejected (clear cookies); 'unavailable' = PocketBase down (keep cookies, stay anonymous).
 */
export async function refreshFromPocketBase(pbToken: string): Promise<RefreshResult> {
  const pb = anonPb();
  pb.authStore.save(pbToken, null);
  try {
    const { token, record } = await pb.collection('users').authRefresh();
    return { status: 'ok', user: toSessionUser(record), pbToken: token };
  } catch (err) {
    return { status: isRejected(pbStatus(err)) ? 'invalid' : 'unavailable' };
  }
}
