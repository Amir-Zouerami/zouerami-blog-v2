import { z } from 'zod';
import { fail, ok } from '../../lib/api';
import { authed } from '../../lib/auth/guards';
import { getLog } from '../../lib/log';

export const prerender = false;
const Lang = z.enum(['en', 'fa']).catch('en');

interface PostRef {
  id: string;
  slug: string;
  date: string;
  status: string;
}

/** The signed-in user's saved posts, titled in the requested language when it exists. */
export const GET = authed(async ({ url }, { user, pb }) => {
  const lang = Lang.parse(url.searchParams.get('lang'));
  try {
    const rows = await pb.collection('bookmarks').getFullList({
      sort: '-created',
      expand: 'post',
      fields: 'id,expand.post.id,expand.post.slug,expand.post.date,expand.post.status',
    });
    const posts = rows
      .map((r) => (r.expand as { post?: PostRef } | undefined)?.post)
      .filter((p): p is PostRef => !!p && p.status === 'published');
    if (!posts.length) return ok({ bookmarks: [] });

    const filter = posts.map((_, i) => `post = {:p${i}}`).join(' || ');
    const params = Object.fromEntries(posts.map((p, i) => [`p${i}`, p.id]));
    const translations = await pb
      .collection('post_translations')
      .getFullList({ filter: pb.filter(filter, params), fields: 'post,lang,title' });
    return ok({
      bookmarks: posts.map((p) => {
        const mine = translations.filter((t) => t.post === p.id);
        const tr = mine.find((t) => t.lang === lang) ?? mine[0];
        return {
          slug: p.slug,
          title: tr?.title ?? p.slug,
          lang: tr?.lang ?? 'en',
          date: p.date.slice(0, 10),
        };
      }),
    });
  } catch (err) {
    getLog().error({ err, userId: user.id }, 'listing bookmarks failed');
    return fail(503, 'upstream_unavailable', 'Temporarily unavailable.');
  }
});
