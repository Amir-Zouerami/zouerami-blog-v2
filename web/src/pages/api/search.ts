import type { APIRoute } from 'astro';
import { fail, ok } from '../../lib/api';
import { getLog } from '../../lib/log';
import { getPb, pbStatus } from '../../lib/pb';
import { SlugSchema } from '../../lib/schemas';

export const prerender = false;

/** Published post search over title + summary (any language). Parameter-bound filter: no injection. */
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return ok({ results: [] });
  const pb = getPb();
  try {
    const translations = await pb.collection('post_translations').getList(1, 40, {
      filter: pb.filter('post.status = "published" && (title ~ {:q} || summary ~ {:q})', { q }),
      expand: 'post',
      fields: 'title,summary,lang,expand.post.slug',
      sort: '-created',
    });
    const seen = new Set<string>();
    const results: { title: string; slug: string; summary: string }[] = [];
    for (const t of translations.items) {
      const slug = (t.expand as { post?: { slug?: string } } | undefined)?.post?.slug;
      if (!slug || !SlugSchema.safeParse(slug).success || seen.has(slug)) continue;
      seen.add(slug);
      results.push({ title: t.title, slug, summary: t.summary });
      if (results.length >= 8) break;
    }
    return ok({ results });
  } catch (err) {
    if (pbStatus(err) === 400) return ok({ results: [] }); // a query PocketBase cannot parse simply matches nothing
    getLog().error({ err }, 'search failed');
    return fail(503, 'upstream_unavailable', 'Search unavailable.');
  }
};
