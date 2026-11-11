import { z } from 'zod';
import { ok, readJson } from '../../../lib/api';
import { adminOnly } from '../../../lib/auth/guards';
import { renderMarkdown } from '../../../lib/markdown';
import { imageUrl } from '../../../lib/posts';

export const prerender = false;
const Body = z.object({
  markdown: z.string().max(500_000),
  numerals: z.enum(['latin', 'fa']).optional(),
  postId: z
    .string()
    .regex(/^[a-z0-9]{15}$/)
    .optional(),
});

/** Renders markdown with the exact pipeline the public site uses (admin-only). */
export const POST = adminOnly(async ({ request }) => {
  const body = await readJson(request, Body, 'Invalid request.');
  if (!body.ok) return body.response;
  const { html, headings } = await renderMarkdown(body.data.markdown, {
    numerals: body.data.numerals,
    resolveImage: (name) => (body.data.postId ? imageUrl({ id: body.data.postId }, name) : name),
  });
  return ok({ html, headings });
});
