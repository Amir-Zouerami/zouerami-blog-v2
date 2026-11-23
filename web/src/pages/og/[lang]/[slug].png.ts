import type { APIRoute } from 'astro';
import { formatDate } from '../../../i18n';
import { getConfig } from '../../../lib/config';
import { getLog } from '../../../lib/log';
import { renderOg } from '../../../lib/og';
import { UpstreamError } from '../../../lib/pb';
import { getPost } from '../../../lib/posts';
import { LangSchema } from '../../../lib/schemas';

export const prerender = false;

/**
 * The post's own cover as the social card: PocketBase crops it to 1200x630 (the Open Graph size) and re-encodes it,
 * so it stays small. Anything that goes wrong returns null and the generated card is used instead.
 */
async function coverCard(cover: string): Promise<Response | null> {
  const at = cover.indexOf('/api/files/');
  if (at < 0) return null;
  try {
    const res = await fetch(`${getConfig().pbUrl}${cover.slice(at)}?thumb=1200x630`, {
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return null;
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return null;
  }
}

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
    const fromCover = post.cover ? await coverCard(post.cover) : null;
    if (fromCover) return fromCover;
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
