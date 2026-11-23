import type { APIRoute } from 'astro';
import { formatDate } from '../../../i18n';
import { getLog } from '../../../lib/log';
import { renderOg } from '../../../lib/og';
import { UpstreamError } from '../../../lib/pb';
import { getPost } from '../../../lib/posts';
import { LangSchema } from '../../../lib/schemas';

export const prerender = false;

const png = (body: Uint8Array, cache = 'public, max-age=86400, stale-while-revalidate=604800') =>
  new Response(body as unknown as BodyInit, {
    status: 200,
    headers: { 'content-type': 'image/png', 'cache-control': cache },
  });

/** Per-post, per-language Open Graph card (1200×630). Only published posts; unknown → 404. */
export const GET: APIRoute = async ({ params }) => {
  const lang = LangSchema.safeParse(params.lang);
  const slug = params.slug ?? '';
  if (!lang.success) return new Response('Not found', { status: 404 });
  if (slug === 'default') {
    return png(
      renderOg({
        title: lang.data === 'fa' ? 'امیر زوارمی' : 'Amir Zouerami',
        lang: lang.data,
        meta: lang.data === 'fa' ? 'مهندس ارشد بک‌اند' : 'Senior backend engineer',
      }),
    );
  }
  try {
    const post = await getPost(slug, lang.data);
    if (!post)
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    return png(
      renderOg({
        title: post.title,
        lang: post.lang,
        meta: formatDate(post.date, post.lang),
        tags: post.tags,
      }),
    );
  } catch (err) {
    if (err instanceof UpstreamError) {
      getLog().error({ err }, 'og image unavailable');
      return new Response('Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    throw err;
  }
};
