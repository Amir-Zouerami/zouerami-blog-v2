import type { APIRoute } from 'astro';
import { z } from 'zod';
import { anonPb, json, pbStatus, readBody, userPb } from '../../../lib/http';

export const prerender = false;
const Id = z.string().regex(/^[a-z0-9]{15}$/);
const Body = z.object({ kind: z.enum(['like', 'bookmark']) });
const COLLECTION = { like: 'likes', bookmark: 'bookmarks' } as const;

async function state(postId: string, signedIn: boolean, cookies: Parameters<typeof userPb>[0]) {
  const likes =
    (
      (await anonPb().collection('posts').getOne(postId, { fields: 'likes' })) as unknown as {
        likes?: number;
      }
    ).likes ?? 0;
  let liked = false;
  let bookmarked = false;
  const pb = signedIn ? userPb(cookies) : null;
  if (pb) {
    const f = pb.filter('post = {:p}', { p: postId });
    [liked, bookmarked] = await Promise.all([
      pb
        .collection('likes')
        .getList(1, 1, { filter: f, skipTotal: true })
        .then((r) => r.items.length > 0),
      pb
        .collection('bookmarks')
        .getList(1, 1, { filter: f, skipTotal: true })
        .then((r) => r.items.length > 0),
    ]);
  }
  return { likes, liked, bookmarked, signedIn };
}

export const GET: APIRoute = async ({ params, cookies, locals }) => {
  const id = Id.safeParse(params.postId);
  if (!id.success) return json(400, { error: 'Invalid post' });
  try {
    return json(200, await state(id.data, !!locals.user, cookies));
  } catch (err) {
    return json(pbStatus(err) === 404 ? 404 : 503, { error: 'Unavailable' });
  }
};

/** Toggles a like or bookmark for the signed-in user. */
export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  if (!locals.user) return json(401, { error: 'Sign in first' });
  const id = Id.safeParse(params.postId);
  const body = await readBody(request, Body);
  if (!id.success || !body) return json(400, { error: 'Invalid request' });
  const pb = userPb(cookies);
  if (!pb) return json(401, { error: 'Sign in again' });
  const col = COLLECTION[body.kind];
  try {
    const existing = await pb
      .collection(col)
      .getList(1, 1, { filter: pb.filter('post = {:p}', { p: id.data }), skipTotal: true });
    const first = existing.items[0];
    if (first) await pb.collection(col).delete(first.id);
    else await pb.collection(col).create({ post: id.data, user: locals.user.id });
    return json(200, await state(id.data, true, cookies));
  } catch (err) {
    const s = pbStatus(err);
    return json(s === 401 ? 401 : s === 400 || s === 403 || s === 404 ? 404 : 503, {
      error: 'Could not update',
    });
  }
};
