import type { APIRoute } from 'astro';
import { z } from 'zod';
import { created, fail, ok, readJson } from '../../lib/api';
import { authed } from '../../lib/auth/guards';
import { getLog } from '../../lib/log';
import { anonPb, isRejected, pbStatus, userPb } from '../../lib/pb';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const Id = z.string().regex(/^[a-z0-9]{15}$/);
const Create = z.object({
  post: Id,
  body: z.string().trim().min(1).max(2000),
  parent: Id.optional(),
  turnstile: z.string().optional(),
});

interface Row {
  id: string;
  post: string;
  body: string;
  created: string;
  parent: string;
  user: string;
  status: string;
  author_name: string;
}

/** Approved comments for a post, plus the signed-in user's own held ones. Plain text only (never rendered as HTML). */
export const GET: APIRoute = async ({ url, cookies, locals }) => {
  const post = Id.safeParse(url.searchParams.get('post'));
  if (!post.success)
    return fail(400, 'validation_failed', 'Invalid post.', { post: 'Expected a post id' });
  const pb = (locals.user && userPb(cookies)) || anonPb();
  try {
    const rows = (await pb.collection('comments').getFullList({
      filter: pb.filter('post = {:p}', { p: post.data }),
      sort: 'created',
      fields: 'id,body,created,parent,user,status,author_name',
    })) as unknown as Row[];
    return ok({
      comments: rows.map((r) => ({
        id: r.id,
        body: r.body,
        created: r.created,
        parent: r.parent || null,
        author: r.author_name || 'Anonymous',
        pending: r.status !== 'approved',
        mine: !!locals.user && r.user === locals.user.id,
      })),
    });
  } catch (err) {
    getLog().error({ err, postId: post.data }, 'listing comments failed');
    return fail(503, 'upstream_unavailable', 'Comments are temporarily unavailable.');
  }
};

export const POST = authed(async ({ request, clientAddress }, { user, pb }) => {
  const log = getLog();
  const body = await readJson(request, Create, 'Write between 1 and 2000 characters.');
  if (!body.ok) return body.response;
  if (!(await verifyTurnstile(body.data.turnstile, clientAddress))) {
    log.warn({ userId: user.id }, 'comment refused: Turnstile verification failed');
    return fail(400, 'verification_failed', 'Verification failed. Please try again.');
  }
  try {
    let parent = body.data.parent;
    if (parent) {
      const p = (await pb.collection('comments').getOne(parent)) as unknown as Row;
      if (p.post !== body.data.post)
        return fail(400, 'validation_failed', 'Invalid reply.', {
          parent: 'Belongs to another post',
        });
      if (p.parent) parent = p.parent; // threads are one level deep
    }
    const rec = (await pb.collection('comments').create({
      post: body.data.post,
      user: user.id,
      body: body.data.body,
      ...(parent ? { parent } : {}),
    })) as unknown as Row;
    const pending = rec.status !== 'approved';
    log.info(
      { userId: user.id, commentId: rec.id, postId: body.data.post, pending, reply: !!parent },
      'comment created',
    );
    return created({ id: rec.id, pending });
  } catch (err) {
    const status = pbStatus(err);
    if (status === 401) return fail(401, 'unauthorized', 'Please sign in again.');
    if (isRejected(status)) {
      log.warn({ err, userId: user.id }, 'comment rejected by PocketBase rules');
      return fail(403, 'forbidden', 'Verify your email before commenting.');
    }
    log.error({ err, userId: user.id }, 'creating comment failed');
    return fail(503, 'upstream_unavailable', 'Comments are temporarily unavailable.');
  }
});

export const DELETE = authed(async ({ url }, { user, pb }) => {
  const log = getLog();
  const id = Id.safeParse(url.searchParams.get('id'));
  if (!id.success)
    return fail(400, 'validation_failed', 'Invalid comment.', { id: 'Expected a comment id' });
  try {
    await pb.collection('comments').delete(id.data);
    log.info({ userId: user.id, commentId: id.data }, 'comment deleted by its author');
    return ok(null, { message: 'Comment deleted.' });
  } catch (err) {
    if (isRejected(pbStatus(err))) return fail(404, 'not_found', 'Comment not found.');
    log.error({ err, commentId: id.data }, 'deleting comment failed');
    return fail(503, 'upstream_unavailable', 'Could not delete the comment.');
  }
});
