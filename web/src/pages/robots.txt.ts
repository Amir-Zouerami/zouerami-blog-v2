import type { APIRoute } from 'astro';
import { loadEnv } from '../lib/env';
import { robotsTxt } from '../lib/feeds';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(robotsTxt(loadEnv().SITE_URL), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
