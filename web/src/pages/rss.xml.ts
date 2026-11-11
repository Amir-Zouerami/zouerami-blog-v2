import type { APIRoute } from 'astro';
import { getConfig } from '../lib/config';
import { rssXml } from '../lib/feeds';
import { getLog } from '../lib/log';
import { UpstreamError } from '../lib/pb';
import { listPosts } from '../lib/posts';

export const prerender = false;

/** Posts that exist in this language, newest first, with titles in this language. */
export const GET: APIRoute = async () => {
  try {
    const posts = (await listPosts({ lang: 'en' })).filter((p) => p.langs.includes('en'));
    // list titles are in each post's primary language; fetch the right one only when it differs
    const { getPost } = await import('../lib/posts');
    const items = await Promise.all(
      posts.map(async (p) => {
        if (p.titleLang === 'en') return p;
        const full = await getPost(p.slug, 'en');
        return full ? { ...p, title: full.title, summary: full.summary } : p;
      }),
    );
    return new Response(rssXml(getConfig().siteUrl, 'en', items.slice(0, 30)), {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=600',
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      getLog().error({ err }, 'rss (en) unavailable');
      return new Response('Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    throw err;
  }
};
