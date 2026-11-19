import { z } from 'zod';
import { ok, readJson } from '../../../lib/api';
import { adminOnly } from '../../../lib/auth/guards';
import { renderMarkdown } from '../../../lib/markdown';
import { postResolver } from '../../../lib/pages';
import { imageUrl, listPosts } from '../../../lib/posts';
import { postSlugs } from '../../../lib/references';

export const prerender = false;
const Body = z.object({
  markdown: z.string().max(500_000),
  lang: z.enum(['en', 'fa']).optional(),
  postId: z
    .string()
    .regex(/^[a-z0-9]{15}$/)
    .optional(),
});

/** Renders markdown with the exact pipeline the public site uses (admin-only). */
export const POST = adminOnly(async ({ request }) => {
  const body = await readJson(request, Body, 'Invalid request.', 600_000);
  if (!body.ok) return body.response;
  const lang = body.data.lang ?? 'en';
  // posts cited with [@post:slug] are looked up like on the public page
  const resolver = postSlugs(body.data.markdown).length
    ? postResolver(await listPosts({ lang }), lang).resolve
    : undefined;
  const { html, headings, references } = await renderMarkdown(body.data.markdown, {
    lang: body.data.lang,
    resolveImage: (name) => (body.data.postId ? imageUrl({ id: body.data.postId }, name) : name),
    resolvePost: resolver,
  });
  return ok({ html, headings, references });
});
