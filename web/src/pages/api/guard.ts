import type { APIRoute } from 'astro';
import { ok } from '../../lib/api';
import { issueChallenge } from '../../lib/guard';

export const prerender = false;

/** A fresh proof-of-work challenge for the next form submit (see lib/guard.ts). */
export const GET: APIRoute = () => {
  const res = ok(issueChallenge());
  res.headers.set('cache-control', 'no-store');
  return res;
};
