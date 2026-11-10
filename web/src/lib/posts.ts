import type PocketBase from 'pocketbase';
import { loadEnv } from './env';
import { getPb, UpstreamError } from './pb';
import {
  type Lang,
  type Post,
  type PostRecord,
  PostRecordSchema,
  type PostSummary,
  type PostTranslationRecord,
  PostTranslationRecordSchema,
  SlugSchema,
} from './schemas';

const LANG_ORDER: Lang[] = ['en', 'fa'];

/** Browser-facing URL of a file attached to a post (`/pb` is proxied to PocketBase by nginx). */
export function imageUrl(
  post: { id: string },
  filename: string,
  publicUrl: string = loadEnv().PB_PUBLIC_URL,
): string {
  return `${publicUrl}/api/files/posts/${post.id}/${filename}`;
}

function upstream(error: unknown): never {
  if (error instanceof UpstreamError) throw error;
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);
  // Zod validation errors are our own contract failures: surface them as-is.
  if (error instanceof Error && error.name === '$ZodError') throw error;
  throw new UpstreamError(
    `PocketBase request failed${status ? ` (${status})` : ''}: ${message}`,
    error,
  );
}

function summarize(post: PostRecord, trs: PostTranslationRecord[]): PostSummary | null {
  const langs = LANG_ORDER.filter((l) => trs.some((t) => t.lang === l));
  const primary = langs[0];
  if (!primary) return null;
  const tr = trs.find((t) => t.lang === primary) as PostTranslationRecord;
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
  opts: { limit?: number; tag?: string } = {},
  pb: PocketBase = getPb(),
): Promise<PostSummary[]> {
  let postRecords: PostRecord[];
  let trRecords: PostTranslationRecord[];
  try {
    const [rawPosts, rawTrs] = await Promise.all([
      pb.collection('posts').getFullList({ sort: '-date', filter: 'status = "published"' }),
      pb.collection('post_translations').getFullList({ filter: 'post.status = "published"' }),
    ]);
    postRecords = rawPosts.map((r) => PostRecordSchema.parse(r));
    trRecords = rawTrs.map((r) => PostTranslationRecordSchema.parse(r));
  } catch (error) {
    upstream(error);
  }
  const items = postRecords
    .filter((p) => p.status === 'published' && (!opts.tag || p.tags.includes(opts.tag)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) =>
      summarize(
        p,
        trRecords.filter((t) => t.post === p.id),
      ),
    )
    .filter((s): s is PostSummary => s !== null);
  return opts.limit ? items.slice(0, opts.limit) : items;
}

/** One published post in the requested language, or null (unknown slug, draft, or no such translation). */
export async function getPost(
  slug: string,
  lang: Lang,
  pb: PocketBase = getPb(),
): Promise<Post | null> {
  if (!SlugSchema.safeParse(slug).success) return null;
  let record: PostRecord;
  let trs: PostTranslationRecord[];
  try {
    record = PostRecordSchema.parse(
      await pb.collection('posts').getFirstListItem(`slug = "${slug}" && status = "published"`),
    );
    trs = (
      await pb.collection('post_translations').getFullList({ filter: `post = "${record.id}"` })
    )
      .map((r) => PostTranslationRecordSchema.parse(r))
      .filter((t) => t.post === record.id);
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    upstream(error);
  }
  if (record.status !== 'published') return null;
  const tr = trs.find((t) => t.lang === lang);
  const summary = summarize(record, trs);
  if (!tr || !summary) return null;
  return {
    ...summary,
    title: tr.title,
    summary: tr.summary,
    titleLang: lang,
    lang,
    bodyMd: tr.body_md,
    images: record.images,
  };
}
