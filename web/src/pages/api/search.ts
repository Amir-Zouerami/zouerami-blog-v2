import type { APIRoute } from 'astro';
import { getPb, UpstreamError } from '../../lib/pb';
import { SlugSchema } from '../../lib/schemas';

export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Published post search over title + summary (any language). Parameter-bound filter: no injection. */
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return json(200, { results: [] });
  const pb = getPb();
  try {
    const trs = await pb.collection('post_translations').getList(1, 40, {
      filter: pb.filter('post.status = "published" && (title ~ {:q} || summary ~ {:q})', { q }),
      expand: 'post',
      fields: 'title,summary,lang,expand.post.slug',
      sort: '-created',
    });
    const seen = new Set<string>();
    const results: { title: string; slug: string; summary: string }[] = [];
    for (const t of trs.items) {
      const slug = (t.expand as { post?: { slug?: string } } | undefined)?.post?.slug;
      if (!slug || !SlugSchema.safeParse(slug).success || seen.has(slug)) continue;
      seen.add(slug);
      results.push({ title: t.title, slug, summary: t.summary });
      if (results.length >= 8) break;
    }
    return json(200, { results });
  } catch (err) {
    if (err instanceof UpstreamError || (err as { status?: number }).status !== 400) {
      return json(503, { error: 'Search unavailable' });
    }
    return json(200, { results: [] });
  }
};
