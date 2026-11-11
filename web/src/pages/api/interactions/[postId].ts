import type { APIRoute } from 'astro';
import type PocketBase from 'pocketbase';
import { z } from 'zod';
import { authed } from '../../../lib/auth/guards';
import { json, logError, readBody } from '../../../lib/http';
import { anonPb, isRejected, pbStatus, userPb } from '../../../lib/pb';

export const prerender = false;
const Id = z.string().regex(/^[a-z0-9]{15}$/);
const Body = z.object({ kind: z.enum(['like', 'bookmark']) });
const COLLECTION = { like: 'likes', bookmark: 'bookmarks' } as const;

/** Public like count plus, for a signed-in user, whether they liked/saved this post. */
async function stateFor(postId: string, userClient: PocketBase | null) {
  const post = await anonPb().collection('posts').getOne(postId, { fields: 'likes' });
  const likes = (post.likes as number | undefined) ?? 0;
  if (!userClient) return { likes, liked: false, bookmarked: false, signedIn: false };
  const filter = userClient.filter('post = {:p}', { p: postId });
  const [liked, bookmarked] = await Promise.all(
    (['likes', 'bookmarks'] as const).map((c) =>
      userClient
        .collection(c)
        .getList(1, 1, { filter, skipTotal: true })
        .then((r) => r.items.length > 0),
    ),
  );
  return { likes, liked: !!liked, bookmarked: !!bookmarked, signedIn: true };
}

export const GET: APIRoute = async ({ params, cookies, locals }) => {
  const id = Id.safeParse(params.postId);
  if (!id.success) return json(400, { error: 'Invalid post' });
  try {
    return json(200, await stateFor(id.data, locals.user ? userPb(cookies) : null));
  } catch (err) {
    if (pbStatus(err) === 404) return json(404, { error: 'Not found' });
    logError('interactions-get', err);
    return json(503, { error: 'Unavailable' });
  }
};

/** Toggles a like or bookmark for the signed-in user. */
export const POST = authed(async ({ params, request }, { user, pb }) => {
  const id = Id.safeParse(params.postId);
  const body = await readBody(request, Body);
  if (!id.success || !body) return json(400, { error: 'Invalid request' });
  const collection = COLLECTION[body.kind];
  try {
    const existing = await pb
      .collection(collection)
      .getList(1, 1, { filter: pb.filter('post = {:p}', { p: id.data }), skipTotal: true });
    const first = existing.items[0];
    if (first) await pb.collection(collection).delete(first.id);
    else await pb.collection(collection).create({ post: id.data, user: user.id });
    return json(200, await stateFor(id.data, pb));
  } catch (err) {
    const status = pbStatus(err);
    if (status === 401) return json(401, { error: 'Sign in again' });
    if (isRejected(status)) return json(404, { error: 'Not found' });
    logError('interactions-toggle', err);
    return json(503, { error: 'Could not update' });
  }
});
