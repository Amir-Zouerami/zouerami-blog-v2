import type { APIRoute } from 'astro';
import { getConfig } from '../lib/config';
import { robotsTxt } from '../lib/feeds';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(robotsTxt(getConfig().siteUrl), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
