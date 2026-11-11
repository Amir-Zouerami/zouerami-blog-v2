import type { APIRoute } from 'astro';
import { z } from 'zod';
import { authed } from '../../lib/auth/guards';
import { json, logError, readBody } from '../../lib/http';
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
  if (!post.success) return json(400, { error: 'Invalid post' });
  const pb = (locals.user && userPb(cookies)) || anonPb();
  try {
    const rows = (await pb.collection('comments').getFullList({
      filter: pb.filter('post = {:p}', { p: post.data }),
      sort: 'created',
      fields: 'id,body,created,parent,user,status,author_name',
    })) as unknown as Row[];
    return json(200, {
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
    logError('comments-list', err);
    return json(503, { error: 'Comments are temporarily unavailable' });
  }
};

export const POST = authed(async ({ request, clientAddress }, { user, pb }) => {
  const body = await readBody(request, Create);
  if (!body) return json(400, { error: 'Write between 1 and 2000 characters.' });
  if (!(await verifyTurnstile(body.turnstile, clientAddress))) {
    return json(400, { error: 'Verification failed. Please try again.' });
  }
  try {
    let parent = body.parent;
    if (parent) {
      const p = (await pb.collection('comments').getOne(parent)) as unknown as Row;
      if (p.post !== body.post) return json(400, { error: 'Invalid reply' });
      if (p.parent) parent = p.parent; // threads are one level deep
    }
    const rec = (await pb.collection('comments').create({
      post: body.post,
      user: user.id,
      body: body.body,
      ...(parent ? { parent } : {}),
    })) as unknown as Row;
    return json(201, { id: rec.id, pending: rec.status !== 'approved' });
  } catch (err) {
    const status = pbStatus(err);
    if (status === 401) return json(401, { error: 'Sign in again' });
    if (isRejected(status)) return json(403, { error: 'Verify your email before commenting.' });
    logError('comments-create', err);
    return json(503, { error: 'Comments are temporarily unavailable' });
  }
});

export const DELETE = authed(async ({ url }, { pb }) => {
  const id = Id.safeParse(url.searchParams.get('id'));
  if (!id.success) return json(400, { error: 'Invalid comment' });
  try {
    await pb.collection('comments').delete(id.data);
    return json(204);
  } catch (err) {
    if (isRejected(pbStatus(err))) return json(404, { error: 'Not found' });
    logError('comments-delete', err);
    return json(503, { error: 'Could not delete' });
  }
});
