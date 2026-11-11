import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json, readBody } from '../../../lib/http';
import { renderMarkdown } from '../../../lib/markdown';
import { imageUrl } from '../../../lib/posts';

export const prerender = false;
const Body = z.object({
  markdown: z.string().max(500_000),
  postId: z
    .string()
    .regex(/^[a-z0-9]{15}$/)
    .optional(),
});

/** Renders markdown with the exact pipeline the public site uses (admin-only). */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json(401, { error: 'Sign in' });
  if (locals.user.role !== 'admin') return json(403, { error: 'Admins only' });
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid request' });
  const { html, headings } = await renderMarkdown(body.markdown, {
    resolveImage: (name) => (body.postId ? imageUrl({ id: body.postId }, name) : name),
  });
  return json(200, { html, headings });
};
