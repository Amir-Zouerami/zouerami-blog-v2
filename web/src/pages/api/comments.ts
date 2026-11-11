import type { APIRoute } from 'astro';
import { z } from 'zod';
import { anonPb, cleanText, json, pbStatus, readBody, userPb } from '../../lib/http';
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
  body: string;
  created: string;
  parent: string;
  user: string;
  status: string;
  author_name: string;
}

/** Approved comments for a post, plus the signed-in user's own held ones. Plain text only. */
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
  } catch {
    return json(503, { error: 'Comments are temporarily unavailable' });
  }
};

export const POST: APIRoute = async ({ request, cookies, locals, clientAddress }) => {
  if (!locals.user) return json(401, { error: 'Sign in to comment' });
  const body = await readBody(request, Create);
  if (!body) return json(400, { error: 'Write between 1 and 2000 characters.' });
  if (!(await verifyTurnstile(body.turnstile, clientAddress)))
    return json(400, { error: 'Verification failed. Please try again.' });
  const pb = userPb(cookies);
  if (!pb) return json(401, { error: 'Sign in again' });
  try {
    let parent = body.parent;
    if (parent) {
      const p = (await pb.collection('comments').getOne(parent)) as unknown as Row & {
        post: string;
      };
      if (p.post !== body.post) return json(400, { error: 'Invalid reply' });
      if (p.parent) parent = p.parent; // threads are one level deep
    }
    const rec = (await pb.collection('comments').create({
      post: body.post,
      user: locals.user.id,
      body: cleanText(body.body).slice(0, 2000) || body.body.slice(0, 2000),
      ...(parent ? { parent } : {}),
    })) as unknown as Row;
    return json(201, { id: rec.id, pending: rec.status !== 'approved' });
  } catch (err) {
    const s = pbStatus(err);
    if (s === 400 || s === 403) return json(403, { error: 'Verify your email before commenting.' });
    if (s === 401) return json(401, { error: 'Sign in again' });
    return json(503, { error: 'Comments are temporarily unavailable' });
  }
};

export const DELETE: APIRoute = async ({ url, cookies, locals }) => {
  if (!locals.user) return json(401, { error: 'Sign in first' });
  const id = Id.safeParse(url.searchParams.get('id'));
  if (!id.success) return json(400, { error: 'Invalid comment' });
  const pb = userPb(cookies);
  if (!pb) return json(401, { error: 'Sign in again' });
  try {
    await pb.collection('comments').delete(id.data);
    return json(204);
  } catch (err) {
    return json(pbStatus(err) === 404 || pbStatus(err) === 403 ? 404 : 503, {
      error: 'Could not delete',
    });
  }
};
