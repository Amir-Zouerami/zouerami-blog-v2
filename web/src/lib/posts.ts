import type PocketBase from 'pocketbase';
import { getConfig } from './config';
import { getPb, toUpstream } from './pb';
import {
  type Lang,
  type Post,
  type PostRecord,
  PostRecordSchema,
  type PostSummary,
  type PostTranslationListItem,
  PostTranslationListSchema,
  type PostTranslationRecord,
  PostTranslationRecordSchema,
  SlugSchema,
} from './schemas';

const LANG_ORDER: Lang[] = ['en', 'fa'];

/** Browser-facing URL of a file attached to a post (`/pb` is proxied to PocketBase by nginx). */
export function imageUrl(
  post: { id: string },
  filename: string,
  publicUrl: string = getConfig().pbPublicUrl,
): string {
  return `${publicUrl}/api/files/posts/${post.id}/${filename}`;
}

/** `prefer`: the reader's language; used for the title/summary when the post exists in it. */
function summarize(
  post: PostRecord,
  trs: PostTranslationListItem[],
  prefer?: Lang,
): PostSummary | null {
  const langs = LANG_ORDER.filter((l) => trs.some((t) => t.lang === l));
  const primary = prefer && langs.includes(prefer) ? prefer : langs[0];
  if (!primary) return null;
  const tr = trs.find((t) => t.lang === primary) as PostTranslationListItem;
  return {
    slug: post.slug,
    date: post.date,
    tags: post.tags,
    langs,
    titleLang: primary,
    title: tr.title,
    summary: tr.summary,
    cover: post.cover ? imageUrl(post, post.cover) : null,
  };
}

/** Published posts, newest first. Posts without any translation are skipped. */
export async function listPosts(
  opts: { limit?: number; tag?: string; lang?: Lang } = {},
  pb: PocketBase = getPb(),
): Promise<PostSummary[]> {
  let postRecords: PostRecord[];
  let trRecords: PostTranslationListItem[];
  try {
    const [rawPosts, rawTrs] = await Promise.all([
      pb.collection('posts').getFullList({ sort: '-date', filter: 'status = "published"' }),
      pb
        .collection('post_translations')
        .getFullList({ filter: 'post.status = "published"', fields: 'id,post,lang,title,summary' }),
    ]);
    postRecords = rawPosts.map((r) => PostRecordSchema.parse(r));
    trRecords = rawTrs.map((r) => PostTranslationListSchema.parse(r));
  } catch (error) {
    toUpstream(error);
  }
  const items = postRecords
    .filter((p) => p.status === 'published' && (!opts.tag || p.tags.includes(opts.tag)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) =>
      summarize(
        p,
        trRecords.filter((t) => t.post === p.id),
        opts.lang,
      ),
    )
    .filter((s): s is PostSummary => s !== null);
  return opts.limit ? items.slice(0, opts.limit) : items;
}

export interface GetPostOptions {
  /** Serve another existing language when the requested one is missing. */
  fallback?: boolean;
  /** Draft preview token (matches the post's `preview_token`; PocketBase enforces it). */
  token?: string;
}

/**
 * One post in the requested language, or null (unknown slug, draft without a valid token,
 * or no such translation and no fallback requested).
 */
export async function getPost(
  slug: string,
  lang: Lang,
  pb: PocketBase = getPb(),
  opts: GetPostOptions = {},
): Promise<Post | null> {
  if (!SlugSchema.safeParse(slug).success) return null;
  const query = opts.token ? { token: opts.token } : undefined;
  let record: PostRecord;
  let trs: PostTranslationRecord[];
  try {
    record = PostRecordSchema.parse(
      await pb
        .collection('posts')
        .getFirstListItem(
          opts.token
            ? pb.filter('slug = {:slug}', { slug })
            : pb.filter('slug = {:slug} && status = "published"', { slug }),
          { query },
        ),
    );
    trs = (
      await pb.collection('post_translations').getFullList({
        filter: pb.filter('post = {:id}', { id: record.id }),
        query,
      })
    )
      .map((r) => PostTranslationRecordSchema.parse(r))
      .filter((t) => t.post === record.id);
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    toUpstream(error);
  }
  const preview = record.status !== 'published';
  if (preview && !opts.token) return null;
  let tr = trs.find((t) => t.lang === lang);
  let fellBack = false;
  if (!tr && opts.fallback) {
    tr = LANG_ORDER.map((l) => trs.find((t) => t.lang === l)).find(Boolean);
    fellBack = !!tr;
  }
  const summary = summarize(record, trs);
  if (!tr || !summary) return null;
  return {
    ...summary,
    id: record.id,
    title: tr.title,
    summary: tr.summary,
    titleLang: tr.lang,
    lang: tr.lang,
    fellBack,
    bodyMd: tr.body_md,
    images: record.images,
    views: record.views,
    preview,
  };
}

/** Neighbouring published posts by date (older = previous, newer = next), wrapping around. */
export function adjacent(
  all: PostSummary[],
  slug: string,
): { previous: PostSummary | null; next: PostSummary | null } {
  const i = all.findIndex((p) => p.slug === slug);
  if (i === -1 || all.length < 2) return { previous: null, next: null };
  const newer = all[(i - 1 + all.length) % all.length] as PostSummary;
  const older = all[(i + 1) % all.length] as PostSummary;
  return { previous: older, next: newer };
}
