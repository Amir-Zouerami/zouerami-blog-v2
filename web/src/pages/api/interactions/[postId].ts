import type { APIRoute } from 'astro';
import type PocketBase from 'pocketbase';
import { z } from 'zod';
import { fail, ok, readJson } from '../../../lib/api';
import { authed } from '../../../lib/auth/guards';
import { getLog } from '../../../lib/log';
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
  if (!id.success)
    return fail(400, 'validation_failed', 'Invalid post.', { postId: 'Expected a post id' });
  try {
    return ok(await stateFor(id.data, locals.user ? userPb(cookies) : null));
  } catch (err) {
    if (pbStatus(err) === 404) return fail(404, 'not_found', 'Post not found.');
    getLog().error({ err, postId: id.data }, 'reading like/bookmark state failed');
    return fail(503, 'upstream_unavailable', 'Temporarily unavailable.');
  }
};

/** Toggles a like or bookmark for the signed-in user. */
export const POST = authed(async ({ params, request }, { user, pb }) => {
  const log = getLog();
  const id = Id.safeParse(params.postId);
  if (!id.success)
    return fail(400, 'validation_failed', 'Invalid post.', { postId: 'Expected a post id' });
  const body = await readJson(request, Body, 'Invalid request.');
  if (!body.ok) return body.response;
  const collection = COLLECTION[body.data.kind];
  try {
    const existing = await pb
      .collection(collection)
      .getList(1, 1, { filter: pb.filter('post = {:p}', { p: id.data }), skipTotal: true });
    const first = existing.items[0];
    if (first) await pb.collection(collection).delete(first.id);
    else await pb.collection(collection).create({ post: id.data, user: user.id });
    log.info(
      { userId: user.id, postId: id.data, kind: body.data.kind, active: !first },
      'interaction toggled',
    );
    return ok(await stateFor(id.data, pb));
  } catch (err) {
    const status = pbStatus(err);
    if (status === 401) return fail(401, 'unauthorized', 'Please sign in again.');
    if (isRejected(status)) return fail(404, 'not_found', 'Post not found.');
    log.error({ err, userId: user.id, postId: id.data }, 'toggling interaction failed');
    return fail(503, 'upstream_unavailable', 'Could not update.');
  }
});
