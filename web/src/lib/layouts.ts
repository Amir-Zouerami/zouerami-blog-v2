import type PocketBase from 'pocketbase';
import { getLog } from './log';
import { getPb } from './pb';
import type { PostSummary } from './schemas';
import { LAYOUT_MAX } from './tiles';

/** The two places whose posts, and their order, the back office can choose. */
export type LayoutKey = 'home' | 'featured';

export { LAYOUT_MAX } from './tiles';

/**
 * The post ids chosen for a place, in layout order. Empty means "automatic": nothing chosen, or the layout could
 * not be read; the site then shows what it always did, so a problem here never takes a page down.
 */
export async function getLayout(key: LayoutKey, pb: PocketBase = getPb()): Promise<string[]> {
  try {
    const rec = await pb.collection('layouts').getFirstListItem(pb.filter('key = {:key}', { key }));
    return idList(rec.posts);
  } catch (error) {
    if ((error as { status?: number }).status !== 404)
      getLog().warn({ err: error, key }, 'layout unreadable');
    return [];
  }
}

/** A stored value as a clean list of distinct ids. */
export function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((x): x is string => typeof x === 'string' && /^[a-z0-9]{15}$/.test(x))),
  ];
}

/** The chosen published posts in the chosen order (unknown or unpublished ids are skipped), at most `max`. */
export function pickInOrder(all: PostSummary[], ids: string[], max = LAYOUT_MAX): PostSummary[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is PostSummary => !!p)
    .slice(0, max);
}

/**
 * The featured posts: the ones marked featured, those the layout lists first in its order, the rest after them
 * newest first (the order `all` already has).
 */
export function orderFeatured(all: PostSummary[], ids: string[], max = LAYOUT_MAX): PostSummary[] {
  const rank = (p: PostSummary) => {
    const at = ids.indexOf(p.id);
    return at < 0 ? Number.POSITIVE_INFINITY : at;
  };
  return all
    .filter((p) => p.featured)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (rank(a.p) === rank(b.p) ? a.i - b.i : rank(a.p) - rank(b.p)))
    .map((x) => x.p)
    .slice(0, max);
}
