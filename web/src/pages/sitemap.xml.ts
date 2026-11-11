import type { APIRoute } from 'astro';
import { loadEnv } from '../lib/env';
import { buildSitemap } from '../lib/feeds';
import { UpstreamError } from '../lib/pb';
import { listPosts } from '../lib/posts';
import { listProjects } from '../lib/projects';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [posts, projects] = await Promise.all([listPosts(), listProjects()]);
    return new Response(buildSitemap(loadEnv().SITE_URL, posts, projects), {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError)
      return new Response('Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    throw err;
  }
};
