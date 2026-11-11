import { z } from 'zod';
import { adminOnly } from '../../../lib/auth/guards';
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
export const POST = adminOnly(async ({ request }) => {
  const body = await readBody(request, Body);
  if (!body) return json(400, { error: 'Invalid request' });
  const { html, headings } = await renderMarkdown(body.markdown, {
    resolveImage: (name) => (body.postId ? imageUrl({ id: body.postId }, name) : name),
  });
  return json(200, { html, headings });
});
